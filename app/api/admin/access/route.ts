import {NextRequest,NextResponse} from 'next/server';
import {PrismaService} from '@/src/database/prisma.service';
import {SecurityService} from '@/src/server/auth/security.service';
import {PermissionService} from '@/src/server/auth/permission.service';
import {getSalesUserContext} from '@/src/sales/sales-auth.helper';

const prisma=PrismaService.getInstance();
const roles=['ADMIN','SUPERVISORA','VENDEDORA','COBRADOR'] as const;
type RoleName=typeof roles[number];

const roleDefaults:Record<RoleName,string[]>={
 ADMIN:['dashboard.view','clients.view','clients.create','clients.edit','clients.delete','sales.view','sales.create','sales.approve','collections.view','collections.collect','route.view','route.manage','cash.view','cash.operate','cash.close','inventory.view','inventory.manage','renewals.view','renewals.manage','commissions.view','reports.view','audit.view','users.manage','settings.manage'],
 SUPERVISORA:['dashboard.view','clients.view','clients.create','clients.edit','sales.view','sales.create','sales.approve','collections.view','collections.collect','route.view','route.manage','cash.view','cash.operate','cash.close','inventory.view','renewals.view','renewals.manage','commissions.view','reports.view'],
 VENDEDORA:['dashboard.view','clients.view','clients.create','clients.edit','sales.view','sales.create','inventory.view','renewals.view','commissions.view'],
 COBRADOR:['dashboard.view','clients.view','collections.view','collections.collect','route.view','route.manage','cash.view','cash.operate','cash.close','commissions.view'],
};

function requireAdmin(req:NextRequest){const ctx=getSalesUserContext(req);if(ctx.role!=='ADMIN')throw new Error('FORBIDDEN: Solo administrador.');return ctx;}
function codeFromError(error:any){const m=String(error?.message||'');if(m.includes('UNAUTHORIZED'))return 401;if(m.includes('FORBIDDEN'))return 403;if(m.includes('Unique constraint'))return 409;return 400;}

async function ensureRole(role:RoleName){
 const roleRecord=await prisma.role.upsert({where:{name:role},update:{},create:{name:role,description:`Acceso operativo ${role}`}});
 const existing=await prisma.rolePermission.count({where:{roleId:roleRecord.id}});
 if(existing===0){
  const permissionIds:string[]=[];
  for(const code of roleDefaults[role]){const p=await prisma.permission.upsert({where:{code},update:{},create:{code,description:code.replaceAll('.',' · ')}});permissionIds.push(p.id);}
  await prisma.rolePermission.createMany({data:permissionIds.map(permissionId=>({roleId:roleRecord.id,permissionId})),skipDuplicates:true});
 }
 return roleRecord;
}

export async function GET(req:NextRequest){
 try{requireAdmin(req);await Promise.all(roles.map(ensureRole));const [users,dbRoles,permissions]=await Promise.all([
  prisma.user.findMany({select:{id:true,email:true,phone:true,firstName:true,lastName:true,accountStatus:true,permissionVersion:true,createdAt:true,passwordChangedAt:true,userRoles:{include:{role:true}}},orderBy:{createdAt:'desc'}}),
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
   if(!/^\S+@\S+\.\S+$/.test(email))throw new Error('El correo no es válido.');
   const exists=await prisma.user.findUnique({where:{email},select:{id:true}});if(exists)throw new Error('Ya existe un usuario con ese correo.');
   const strength=SecurityService.validatePasswordStrength(password);if(!strength.valid)throw new Error(strength.reason||'Contraseña inválida.');
   const passwordHash=await SecurityService.hashPassword(password);const roleRecord=await ensureRole(role);
   const user=await prisma.user.create({data:{email,phone:body.phone?String(body.phone).trim():null,passwordHash,firstName,lastName,accountStatus:'ACTIVE',passwordChangedAt:new Date(),userRoles:{create:{roleId:roleRecord.id}}},select:{id:true,email:true,firstName:true,lastName:true,accountStatus:true}});
   return NextResponse.json({success:true,user,createdBy:admin.userId},{status:201});
  }
  if(action==='resetPassword'){
   const userId=String(body.userId||''),password=String(body.password||'');if(!userId)throw new Error('Usuario inválido.');
   const strength=SecurityService.validatePasswordStrength(password);if(!strength.valid)throw new Error(strength.reason||'Contraseña inválida.');
   const target=await prisma.user.findUnique({where:{id:userId},select:{id:true,accountStatus:true}});if(!target)throw new Error('Usuario no encontrado.');
   const passwordHash=await SecurityService.hashPassword(password);
   await prisma.user.update({where:{id:userId},data:{passwordHash,passwordChangedAt:new Date(),failedLoginAttempts:0,lockoutUntil:null,accountStatus:target.accountStatus==='LOCKED'?'ACTIVE':target.accountStatus,permissionVersion:{increment:1}}});
   return NextResponse.json({success:true});
  }
  if(action==='setUserRole'){
   const userId=String(body.userId||''),role=String(body.role||'') as RoleName;if(!userId||!roles.includes(role))throw new Error('Usuario o rol inválido.');const roleRecord=await ensureRole(role);
   await prisma.$transaction([prisma.userRoleMapping.deleteMany({where:{userId}}),prisma.userRoleMapping.create({data:{userId,roleId:roleRecord.id}}),prisma.user.update({where:{id:userId},data:{permissionVersion:{increment:1}}})]);return NextResponse.json({success:true});
  }
  if(action==='setUserStatus'){
   const userId=String(body.userId||''),status=String(body.status||'');if(!userId||!['ACTIVE','INACTIVE','LOCKED','SUSPENDED'].includes(status))throw new Error('Estado inválido.');
   await prisma.user.update({where:{id:userId},data:{accountStatus:status as any,permissionVersion:{increment:1},...(status==='ACTIVE'?{failedLoginAttempts:0,lockoutUntil:null}:{})}});return NextResponse.json({success:true});
  }
  if(action==='setRolePermissions'){
   const role=String(body.role||'') as RoleName,permissionCodes=Array.isArray(body.permissionCodes)?body.permissionCodes.map(String):[];if(!roles.includes(role))throw new Error('Rol inválido.');const roleRecord=await ensureRole(role);
   const permissionRecords=[] as Array<{id:string}>;for(const code of permissionCodes){const p=await prisma.permission.upsert({where:{code},update:{},create:{code,description:code.replaceAll('.',' · ')}});permissionRecords.push(p);}
   await prisma.$transaction([prisma.rolePermission.deleteMany({where:{roleId:roleRecord.id}}),...permissionRecords.map(p=>prisma.rolePermission.create({data:{roleId:roleRecord.id,permissionId:p.id}})),prisma.user.updateMany({where:{userRoles:{some:{roleId:roleRecord.id}}},data:{permissionVersion:{increment:1}}})]);return NextResponse.json({success:true});
  }
  if(action==='setUserPermissionOverride'){
   const userId=String(body.userId||''),permissionCode=String(body.permissionCode||''),effect=String(body.effect||'INHERIT') as 'ALLOW'|'DENY'|'INHERIT';if(!userId||!permissionCode||!['ALLOW','DENY','INHERIT'].includes(effect))throw new Error('Override de permiso inválido.');
   const target=await prisma.user.findUnique({where:{id:userId},select:{id:true}});if(!target)throw new Error('Usuario no encontrado.');await prisma.permission.upsert({where:{code:permissionCode},update:{},create:{code:permissionCode,description:permissionCode.replaceAll('.',' · ')}});await PermissionService.setUserOverride({userId,permissionCode,effect,updatedBy:admin.userId});return NextResponse.json({success:true,effect});
  }
  throw new Error('Acción no soportada.');
 }catch(e:any){return NextResponse.json({error:e.message||'No se pudo guardar la configuración.'},{status:codeFromError(e)});}
}
