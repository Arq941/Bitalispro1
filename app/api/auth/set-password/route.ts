import {NextRequest,NextResponse} from 'next/server';
import {PrismaService} from '@/src/database/prisma.service';
import {SecurityService} from '@/src/server/auth/security.service';
import {RefreshTokenService} from '@/src/server/auth/refresh-token.service';

export async function POST(req:NextRequest){
 try{
  const {token,password}=await req.json();
  const payload=SecurityService.verifyPasswordSetupToken(String(token||''));
  if(!payload)return NextResponse.json({success:false,error:'El enlace es inválido o ya venció.'},{status:400});
  const strength=SecurityService.validatePasswordStrength(String(password||''));
  if(!strength.valid)return NextResponse.json({success:false,error:strength.reason},{status:400});
  const prisma=PrismaService.getInstance();
  const user=await prisma.user.findUnique({where:{id:payload.sub},select:{permissionVersion:true,accountStatus:true}});
  if(!user||user.permissionVersion!==payload.permissionVersion)return NextResponse.json({success:false,error:'Este enlace ya fue utilizado o reemplazado.'},{status:400});
  if(user.accountStatus==='INACTIVE'||user.accountStatus==='SUSPENDED')return NextResponse.json({success:false,error:'La cuenta no está activa.'},{status:403});
  await prisma.user.update({where:{id:payload.sub},data:{passwordHash:await SecurityService.hashPassword(password),passwordChangedAt:new Date(),failedLoginAttempts:0,lockoutUntil:null,accountStatus:user.accountStatus==='LOCKED'?'ACTIVE':user.accountStatus,permissionVersion:{increment:1}}});
  RefreshTokenService.revokeAllUserSessions(payload.sub);
  return NextResponse.json({success:true});
 }catch{return NextResponse.json({success:false,error:'No fue posible guardar la contraseña.'},{status:400})}
}
