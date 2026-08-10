import { NextRequest } from 'next/server';
import { UserContext } from './sales.service';
import { SecurityService } from '@/src/server/auth/security.service';

export function getSalesUserContext(req: NextRequest): UserContext {
  const userIdHeader = req.headers.get('x-user-id');
  const userRoleHeader = req.headers.get('x-user-role') as any;
  const authHeader = req.headers.get('authorization');

  let userId = userIdHeader || 'user_vendedora_01';
  let role: 'ADMIN' | 'SUPERVISORA' | 'VENDEDORA' | 'COBRADOR' = userRoleHeader || 'VENDEDORA';

  if (authHeader && authHeader.startsWith('Bearer ')) {
    const token = authHeader.substring(7);
    const verified = SecurityService.verifyAccessToken(token);
    if (verified && verified.sub) {
      userId = verified.sub;
      if (verified.role) {
        role = verified.role as any;
      }
    }
  }

  return {
    userId,
    role,
  };
}

export function extractUserContext(req: NextRequest): UserContext {
  return getSalesUserContext(req);
}

export default extractUserContext;

