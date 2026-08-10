import { NextRequest } from 'next/server';
import { SecurityService } from '@/src/server/auth/security.service';
import { ClientUserContext } from './client.service';

export function getClientUserContext(req: NextRequest): ClientUserContext {
  const authHeader = req.headers.get('authorization');
  let userId = 'usr_system';
  let role: 'ADMIN' | 'SUPERVISORA' | 'VENDEDORA' | 'COBRADOR' = 'ADMIN';

  if (authHeader) {
    const token = authHeader.replace('Bearer ', '');
    const verified = SecurityService.verifyAccessToken(token);
    if (verified) {
      userId = verified.sub;
      if (verified.role) {
        role = verified.role as any;
      }
    }
  }

  // Permite override explícito desde headers o query si se testea
  const roleHeader = req.headers.get('x-user-role');
  if (roleHeader && ['ADMIN', 'SUPERVISORA', 'VENDEDORA', 'COBRADOR'].includes(roleHeader)) {
    role = roleHeader as any;
  }

  const userIdHeader = req.headers.get('x-user-id');
  if (userIdHeader) {
    userId = userIdHeader;
  }

  const zoneIdHeader = req.headers.get('x-zone-id');

  return {
    userId,
    role,
    zoneId: zoneIdHeader || undefined,
    assignedRouteId: zoneIdHeader || undefined,
  };
}
