import { NextRequest } from 'next/server';
import { UserContext } from './sales.service';
import { SecurityService } from '@/src/server/auth/security.service';
import { RefreshTokenService } from '@/src/server/auth/refresh-token.service';
import { PrismaService } from '@/src/database/prisma.service';

export function getSalesUserContext(req: NextRequest): UserContext {
  const authHeader = req.headers.get('authorization');
  if (!authHeader || !authHeader.toLowerCase().startsWith('bearer ')) {
    throw new Error('UNAUTHORIZED: Bearer token requerido.');
  }

  const token = authHeader.slice(7).trim();
  const verified = SecurityService.verifyAccessToken(token);
  if (!verified || !verified.sub || !verified.role) {
    throw new Error('UNAUTHORIZED: Token inválido o expirado.');
  }

  const allowedRoles = ['ADMIN', 'SUPERVISORA', 'VENDEDORA', 'COBRADOR'] as const;
  if (!allowedRoles.includes(verified.role as any)) {
    throw new Error('FORBIDDEN: Rol no autorizado.');
  }

  return {
    userId: verified.sub,
    role: verified.role as UserContext['role'],
  };
}

export async function extractUserContext(req: NextRequest): Promise<UserContext> {
  const jwtContext=getSalesUserContext(req);
  const authHeader=req.headers.get('authorization')!;
  const claims=SecurityService.verifyAccessToken(authHeader.slice(7).trim());
  if(!claims)throw new Error('UNAUTHORIZED: Token inválido o expirado.');
  const [activeSession,user]=await Promise.all([
    RefreshTokenService.isSessionActive(claims.sessionId,claims.sub),
    PrismaService.getInstance().user.findUnique({where:{id:claims.sub},select:{accountStatus:true,permissionVersion:true,userRoles:{include:{role:true}}}}),
  ]);
  const currentRole=String(user?.userRoles[0]?.role?.name||'').toUpperCase();
  if(!activeSession||!user||user.accountStatus!=='ACTIVE'||user.permissionVersion!==claims.permissionVersion){
    throw new Error('UNAUTHORIZED: La sesión fue revocada o los permisos cambiaron.');
  }
  if(currentRole!==String(jwtContext.role).toUpperCase())throw new Error('UNAUTHORIZED: El rol de la sesión cambió.');
  return jwtContext;
}

export default extractUserContext;
