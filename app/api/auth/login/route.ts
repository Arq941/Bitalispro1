import { NextRequest, NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';
import { AuthService } from '@/src/server/auth/auth.service';

const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };
const prisma = globalForPrisma.prisma ?? new PrismaClient();
if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = prisma;
const allowedRoles=['ADMIN','SUPERVISORA','VENDEDORA','COBRADOR'] as const;

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { email, password } = body;
    if (!email || !password) return NextResponse.json({ success: false, message: 'Se requieren correo y contraseña.' },{ status: 400 });
    const normalizedEmail = String(email).trim().toLowerCase();
    const dbUser = await prisma.user.findUnique({where:{email:normalizedEmail},include:{userRoles:{include:{role:{include:{rolePermissions:{include:{permission:true}}}}}}}});

    if (dbUser) {
      const primaryRole=dbUser.userRoles[0]?.role?.name;
      if(!primaryRole||!allowedRoles.includes(primaryRole as any)){
        return NextResponse.json({success:false,message:'La cuenta no tiene un rol operativo válido. Solicita al administrador que asigne un rol.'},{status:403});
      }
      const permissions=Array.from(new Set(dbUser.userRoles.flatMap(mapping=>mapping.role.rolePermissions.map(rp=>rp.permission.code))));
      AuthService.registerUserInMemory({id:dbUser.id,email:dbUser.email,firstName:dbUser.firstName,lastName:dbUser.lastName,role:primaryRole as 'ADMIN'|'SUPERVISORA'|'VENDEDORA'|'COBRADOR',passwordHash:dbUser.passwordHash,accountStatus:dbUser.accountStatus as 'ACTIVE'|'INACTIVE'|'LOCKED'|'SUSPENDED',failedLoginAttempts:dbUser.failedLoginAttempts,lockoutUntil:dbUser.lockoutUntil,passwordChangedAt:dbUser.passwordChangedAt,permissionVersion:dbUser.permissionVersion,lastLoginAt:null,lastLoginIp:null,permissions});
    }

    const ipAddress = req.headers.get('x-forwarded-for') || '127.0.0.1';
    const userAgent = req.headers.get('user-agent') || 'Unknown';
    const result = await AuthService.login({email:normalizedEmail,password,ipAddress,userAgent});
    if (!result.success) return NextResponse.json(result,{status:result.code==='ACCOUNT_LOCKED'?423:401});
    return NextResponse.json(result);
  } catch (error: any) {
    console.error('Login API error:', error);
    return NextResponse.json({ success: false, message: 'Error interno en login.' },{ status: 500 });
  }
}
