import {NextRequest,NextResponse} from 'next/server';
import {PrismaService} from '@/src/database/prisma.service';
import {SecurityService} from '@/src/server/auth/security.service';
import {PermissionService} from '@/src/server/auth/permission.service';
import {RefreshTokenService} from '@/src/server/auth/refresh-token.service';
import {getSalesUserContext} from '@/src/sales/sales-auth.helper';

const prisma=PrismaService.getInstance();
const roles=['ADMIN','SUPERVISORA','VENDEDORA','COBRADOR'] as const;
type RoleName=typeof roles[number];
const allPermissions=['dashboard.view','clients.view','clients.create','clients.edit','clients.delete','sales.view','sales.create','sales.approve','collections.view','collections.collect','route.view','route.manage','cash.view','cash.operate','cash.close','inventory.view','inventory.manage','renewals.view','renewals.manage','commissions.view','reports.view','audit.view','users.manage','settings.manage'];
const defaults:Record<RoleName,string[]>={
 ADMIN:allPermissions,
 SUPERVISORA:['dashboard.view','clients.view','clients.create','clients.edit','sales.view','sales.create','sales.approve','collections.view','route.view','route.manage','cash.view','cash.operate','cash.close','inventory.view','renewals.view','renewals.manage','commissions.view','reports.view','audit.view'],
 VENDEDORA:['dashboard.view','clients.view','clients.create','clients.edit','sales.view','sales.create','inventory.view','renewals.view','commissions.view'],
 COBRADOR:['dashboard.view','clients.view','collections.view','collections.collect','route.view','route.manage','cash.view','cash.operate','cash.close','commissions.view'],
};

function requireAdmin(req:NextRequest){const ctx=getSalesUserContext(req);if(ctx.role!=='ADMIN')throw new Error('FORBIDDEN: Solo administrador.');return ctx;}
function codeFromError(error:any){const m=String(error?.message||'');if(m.includes('UNAUTHORIZED'))return 401;if(m.includes('FORBIDDEN'))return 403;if(m.includes('P2002'))return 409;return 400;}
async function ensureRole(role:RoleName){const r=await prisma.role.upsert({where:{name:role},update:{},create:{name:role,description:`Rol operativo ${role}`}});const count=await prisma.rolePermission.count({where:{roleId:r.id}});if(count===0){const records=[] as Array<{id:string}>;for(const code of defaults[role])records.push(await prisma.permission.upsert({where:{code},update:{},create:{code,description:code.replaceAll('.',' · ')}}));await prisma.$transaction(records.map(p=>prisma.rolePermission.create({data:{roleId:r.id,permissionId:p.id}})));}return r;}
async function protectLastAdmin(userId:string,nextRole?:RoleName,nextStatus?:string){const target=await prisma.user.findUnique({where:{id:userId},include:{userRoles:{include:{role:true}}}});if(!target)throw new Error('Usuario no encontrado.');const isAdmin=target.userRoles.some(x=>x.role.name==='ADMIN');const removesAdmin=(nextRole&&nextRole!=='ADMIN')||(nextStatus&&nextStatus!=='ACTIVE');if(isAdmin&&removesAdmin){const activeAdmins=await prisma.user.count({where:{accountStatus:'ACTIVE',userRoles:{some:{role:{name:'ADMIN'}}}}});if(activeAdmins<=1)throw new Error('No puedes desactivar o cambiar el rol del último administrador activo.');}}

export async function GET(req:NextRequest){
 try{requireAdmin(req);for(const role of roles)await ensureRole(role);const [users,dbRoles,permissions]=await Promise.all([
  prisma.user.findMany({select:{id:true,email:true,phone:true,firstName:true,lastName:true,accountStatus:true,permissionVersion:true,createdAt:true,userRoles:{include:{role:true}}},orderBy:{createdAt:'desc'}}),
  prisma.role.findMany({include:{rolePermissions:{include:{permission:true}}},orderBy:{name:'asc'}}),
  prisma.permission.findMany({orderBy:{code:'asc'}}),
 ]);
 const usersWithOverrides=await Promise.all(users.map(async u=>({...u,role:u.userRoles[0]?.role?.name||null,permissionOverrides:await PermissionService.getUserOverrides(u.id),effectivePermissionCodes:await PermissionService.getEffectivePermissionCodes(u.id)})));
 return NextResponse.json({users:usersWithOverrides,roles:dbRoles.map(r=>({id:r.id,name:r.name,description:r.description,permissionCodes:r.rolePermissions.map(x=>x.permission.code)})),permissions});
 }catch(e:any){return NextResponse.json({error:e.message||'No se pudo cargar la seguridad.'},{status:codeFromError(e)});}
}

export async function POST(req:NextRequest){
 try{const admin=requireAdmin(req);const body=await req.json();const action=String(body?.action||'');
  if(action==='createUser'){
   const email=String(body.email||'').trim().toLowerCase(),firstName=String(body.firstName||'').trim(),lastName=String(body.lastName||'').trim(),password=String(body.password||''),role=String(body.role||'VENDEDORA') as RoleName;
   if(!email||!firstName||!lastName||!roles.includes(role))throw new Error('Completa nombre, correo y rol.');
   if(await prisma.user.findUnique({where:{email}}))throw new Error('Ya existe un usuario con ese correo.');
   const strength=SecurityService.validatePasswordStrength(password);if(!strength.valid)throw new Error(strength.reason||'Contraseña inválida.');
   const passwordHash=await SecurityService.hashPassword(password),roleRecord=await ensureRole(role);
   const user=await prisma.user.create({data:{email,phone:body.phone?String(body.phone).trim():null,passwordHash,firstName,lastName,accountStatus:'ACTIVE',passwordChangedAt:new Date(),userRoles:{create:{roleId:roleRecord.id}}},select:{id:true,email:true,firstName:true,lastName:true,accountStatus:true}});
   return NextResponse.json({success:true,user,createdBy:admin.userId},{status:201});
  }
  if(action==='resetPassword'){
   const userId=String(body.userId||''),password=String(body.password||'');if(!userId)throw new Error('Usuario inválido.');const strength=SecurityService.validatePasswordStrength(password);if(!strength.valid)throw new Error(strength.reason||'Contraseña inválida.');const target=await prisma.user.findUnique({where:{id:userId},select:{accountStatus:true}});if(!target)throw new Error('Usuario no encontrado.');const passwordHash=await SecurityService.hashPassword(password);await prisma.user.update({where:{id:userId},data:{passwordHash,passwordChangedAt:new Date(),failedLoginAttempts:0,lockoutUntil:null,accountStatus:target.accountStatus==='LOCKED'?'ACTIVE':target.accountStatus,permissionVersion:{increment:1}}});RefreshTokenService.revokeAllUserSessions(userId);return NextResponse.json({success:true});
  }
  if(action==='setUserRole'){
   const userId=String(body.userId||''),role=String(body.role||'') as RoleName;if(!userId||!roles.includes(role))throw new Error('Usuario o rol inválido.');if(userId===admin.userId&&role!=='ADMIN')throw new Error('No puedes quitarte tu propio rol de administrador.');await protectLastAdmin(userId,role);const roleRecord=await ensureRole(role);await prisma.$transaction([prisma.userRoleMapping.deleteMany({where:{userId}}),prisma.userRoleMapping.create({data:{userId,roleId:roleRecord.id}}),prisma.user.update({where:{id:userId},data:{permissionVersion:{increment:1}}})]);return NextResponse.json({success:true});
  }
  if(action==='setUserStatus'){
   const userId=String(body.userId||''),status=String(body.status||'');if(!['ACTIVE','INACTIVE','LOCKED','SUSPENDED'].includes(status))throw new Error('Estado inválido.');if(userId===admin.userId&&status!=='ACTIVE')throw new Error('No puedes desactivar tu propia cuenta.');await protectLastAdmin(userId,undefined,status);await prisma.user.update({where:{id:userId},data:{accountStatus:status as any,permissionVersion:{increment:1}}});if(status!=='ACTIVE')RefreshTokenService.revokeAllUserSessions(userId);return NextResponse.json({success:true});
  }
  if(action==='setRolePermissions'){
   const role=String(body.role||'') as RoleName,permissionCodes=Array.isArray(body.permissionCodes)?body.permissionCodes.map(String):[];if(!roles.includes(role))throw new Error('Rol inválido.');if(role==='ADMIN'&&!permissionCodes.includes('users.manage'))throw new Error('El rol ADMIN debe conservar el permiso de administrar usuarios.');const roleRecord=await ensureRole(role);const permissionRecords=[] as Array<{id:string}>;for(const code of permissionCodes)permissionRecords.push(await prisma.permission.upsert({where:{code},update:{},create:{code,description:code.replaceAll('.',' · ')}}));await prisma.$transaction([prisma.rolePermission.deleteMany({where:{roleId:roleRecord.id}}),...permissionRecords.map(p=>prisma.rolePermission.create({data:{roleId:roleRecord.id,permissionId:p.id}})),prisma.user.updateMany({where:{userRoles:{some:{roleId:roleRecord.id}}},data:{permissionVersion:{increment:1}}})]);return NextResponse.json({success:true});
  }
  if(action==='setUserPermissionOverride'){
   const userId=String(body.userId||''),permissionCode=String(body.permissionCode||''),effect=String(body.effect||'INHERIT') as 'ALLOW'|'DENY'|'INHERIT';if(!userId||!permissionCode||!['ALLOW','DENY','INHERIT'].includes(effect))throw new Error('Override de permiso inválido.');if(userId===admin.userId&&permissionCode==='users.manage'&&effect==='DENY')throw new Error('No puedes denegarte la administración de usuarios.');const target=await prisma.user.findUnique({where:{id:userId},select:{id:true}});if(!target)throw new Error('Usuario no encontrado.');await prisma.permission.upsert({where:{code:permissionCode},update:{},create:{code:permissionCode,description:permissionCode.replaceAll('.',' · ')}});await PermissionService.setUserOverride({userId,permissionCode,effect,updatedBy:admin.userId});return NextResponse.json({success:true,effect});
  }
  throw new Error('Acción no soportada.');
 }catch(e:any){return NextResponse.json({error:e.message||'No se pudo guardar la configuración.'},{status:codeFromError(e)});}
}
