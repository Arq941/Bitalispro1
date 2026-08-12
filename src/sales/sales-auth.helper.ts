import { NextRequest } from 'next/server';
import { UserContext } from './sales.service';
import { SecurityService } from '@/src/server/auth/security.service';

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
  return getSalesUserContext(req);
}

export default extractUserContext;
