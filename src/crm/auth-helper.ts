import { NextRequest } from 'next/server';
import { SecurityService } from '@/src/server/auth/security.service';
import { ClientUserContext } from './client.service';

export function getClientUserContext(req: NextRequest): ClientUserContext {
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
    role: verified.role as ClientUserContext['role'],
    permissions: [],
  };
}
