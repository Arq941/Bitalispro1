import {NextRequest,NextResponse} from 'next/server';
import {PrismaService} from '@/src/database/prisma.service';
import {SecurityService} from '@/src/server/auth/security.service';
import {getSalesUserContext} from '@/src/sales/sales-auth.helper';

const prisma=PrismaService.getInstance();
const roles=['ADMIN','SUPERVISORA','VENDEDORA','COBRADOR'] as const;

function requireAdmin(req:NextRequest){const ctx=getSalesUserContext(req);if(ctx.role!=='ADMIN')throw new Error('FORBIDDEN: Solo administrador.');return ctx;}
function codeFromError(error:any){const m=String(error?.message||'');if(m.includes('UNAUTHORIZED'))return 401;if(m.includes('FORBIDDEN'))return 403;return 400;}

export async function GET(req:NextRequest){
 try{requireAdmin(req);const [users,dbRoles,permissions]=await Promise.all([
  prisma.user.findMany({select:{id:true,email:true,phone:true,firstName:true,lastName:true,accountStatus:true,permissionVersion:true,createdAt:true,userRoles:{include:{role:true}}},orderBy:{createdAt:'desc'}}),
  prisma.role.findMany({include:{rolePermissions:{include:{permission:true}}},orderBy:{name:'asc'}}),
  prisma.permission.findMany({orderBy:{code:'asc'}}),
 ]);
 return NextResponse.json({users:users.map(u=>({...u,role:u.userRoles[0]?.role?.name||null})),roles:dbRoles.map(r=>({id:r.id,name:r.name,description:r.description,permissionCodes:r.rolePermissions.map(x=>x.permission.code)})),permissions});
 }catch(e:any){return NextResponse.json({error:e.message||'No se pudo cargar la seguridad.'},{status:codeFromError(e)});}
}

export async function POST(req:NextRequest){
 try{const admin=requireAdmin(req);const body=await req.json();const action=String(body?.action||'');
  if(action==='createUser'){
   const email=String(body.email||'').trim().toLowerCase(),firstName=String(body.firstName||'').trim(),lastName=String(body.lastName||'').trim(),password=String(body.password||''),role=String(body.role||'VENDEDORA') as typeof roles[number];
   if(!email||!firstName||!lastName||!roles.includes(role))throw new Error('Completa nombre, correo y rol.');
   const strength=SecurityService.validatePasswordStrength(password);if(!strength.valid)throw new Error(strength.reason||'Contraseña inválida.');
   const passwordHash=await SecurityService.hashPassword(password);
   const roleRecord=await prisma.role.upsert({where:{name:role},update:{},create:{name:role}});
   const user=await prisma.user.create({data:{email,phone:body.phone?String(body.phone):null,passwordHash,firstName,lastName,accountStatus:'ACTIVE',userRoles:{create:{roleId:roleRecord.id}}},select:{id:true,email:true,firstName:true,lastName:true,accountStatus:true}});
   return NextResponse.json({success:true,user,createdBy:admin.userId},{status:201});
  }
  if(action==='setUserRole'){
   const userId=String(body.userId||''),role=String(body.role||'') as typeof roles[number];if(!userId||!roles.includes(role))throw new Error('Usuario o rol inválido.');
   const roleRecord=await prisma.role.upsert({where:{name:role},update:{},create:{name:role}});
   await prisma.$transaction([prisma.userRoleMapping.deleteMany({where:{userId}}),prisma.userRoleMapping.create({data:{userId,roleId:roleRecord.id}}),prisma.user.update({where:{id:userId},data:{permissionVersion:{increment:1}}})]);
   return NextResponse.json({success:true});
  }
  if(action==='setUserStatus'){
   const userId=String(body.userId||''),status=String(body.status||'');if(!['ACTIVE','INACTIVE','LOCKED','SUSPENDED'].includes(status))throw new Error('Estado inválido.');
   await prisma.user.update({where:{id:userId},data:{accountStatus:status as any,permissionVersion:{increment:1}}});return NextResponse.json({success:true});
  }
  if(action==='setRolePermissions'){
   const role=String(body.role||'') as typeof roles[number],permissionCodes=Array.isArray(body.permissionCodes)?body.permissionCodes.map(String):[];if(!roles.includes(role))throw new Error('Rol inválido.');
   const roleRecord=await prisma.role.upsert({where:{name:role},update:{},create:{name:role}});
   const permissionRecords=[] as Array<{id:string}>;for(const code of permissionCodes){const p=await prisma.permission.upsert({where:{code},update:{},create:{code,description:code.replaceAll('.',' · ')}});permissionRecords.push(p);}
   await prisma.$transaction([prisma.rolePermission.deleteMany({where:{roleId:roleRecord.id}}),...permissionRecords.map(p=>prisma.rolePermission.create({data:{roleId:roleRecord.id,permissionId:p.id}})),prisma.user.updateMany({where:{userRoles:{some:{roleId:roleRecord.id}}},data:{permissionVersion:{increment:1}}})]);
   return NextResponse.json({success:true});
  }
  throw new Error('Acción no soportada.');
 }catch(e:any){return NextResponse.json({error:e.message||'No se pudo guardar la configuración.'},{status:codeFromError(e)});}
}
