export interface AbacUserContext {
  userId: string;
  role: 'ADMIN' | 'SUPERVISORA' | 'VENDEDORA' | 'COBRADOR';
  permissions: string[];
  assignedRouteId?: string;
  branchId?: string;
}

export interface AbacResourceContext {
  entity: string;
  entityId: string;
  ownerUserId?: string;
  clientRouteId?: string;
  priceRequested?: number;
  minimumAuthorizedPrice?: number;
  evidenceStatus?: string;
  itemCount?: number;
  hasAuthorizationApproved?: boolean;
}

export interface AbacResult {
  allowed: boolean;
  reason?: string;
  requiresAuthorization?: boolean;
  authorizationType?: 'PRICE_OVERRIDE' | 'DISCOUNT_OVERRIDE' | 'TWO_PRODUCT_SALE' | 'CREDIT_EXCEPTION';
}

export class AbacService {
  /**
   * Evalúa reglas ABAC dinámicas
   */
  public static evaluate(user: AbacUserContext, resource: AbacResourceContext, action: string): AbacResult {
    // 1. ADMIN siempre tiene acceso global
    if (user.role === 'ADMIN') {
      return { allowed: true };
    }

    // 2. Reglas para COBRADOR
    if (user.role === 'COBRADOR') {
      if (action === 'payments.create' || action === 'clients.collect') {
        // Bloquear cobro fuera de ruta asignada
        if (resource.clientRouteId && user.assignedRouteId && resource.clientRouteId !== user.assignedRouteId) {
          if (!resource.hasAuthorizationApproved) {
            return {
              allowed: false,
              reason: 'ABAC DENIED: El cliente pertenece a otra ruta no asignada al cobrador.',
              requiresAuthorization: true,
              authorizationType: 'CREDIT_EXCEPTION',
            };
          }
        }
      }
    }

    // 3. Reglas para VENDEDORA
    if (user.role === 'VENDEDORA') {
      if (action === 'sales.create' || action === 'sales.price_override') {
        // Precio inferior al mínimo autorizado
        if (
          resource.priceRequested !== undefined &&
          resource.minimumAuthorizedPrice !== undefined &&
          resource.priceRequested < resource.minimumAuthorizedPrice
        ) {
          if (!resource.hasAuthorizationApproved) {
            return {
              allowed: false,
              reason: 'ABAC DENIED: El precio solicitado es inferior al mínimo autorizado.',
              requiresAuthorization: true,
              authorizationType: 'PRICE_OVERRIDE',
            };
          }
        }

        // Venta de 2 productos requiere autorización comercial si no está aprobada previamente
        if (resource.itemCount && resource.itemCount >= 2 && !resource.hasAuthorizationApproved) {
          return {
            allowed: false,
            reason: 'ABAC DENIED: La venta de múltiples productos requiere autorización comercial.',
            requiresAuthorization: true,
            authorizationType: 'TWO_PRODUCT_SALE',
          };
        }
      }

      // Modificación de Evidencia Aprobada (EVIDENCIA APPROVED)
      if (action === 'evidences.update' || action === 'evidences.delete') {
        if (resource.evidenceStatus === 'APPROVED') {
          return {
            allowed: false,
            reason: 'ABAC DENIED: Una vendedora no puede modificar o eliminar una evidencia ya APROBADA.',
          };
        }
      }
    }

    // 4. Reglas para SUPERVISORA
    if (user.role === 'SUPERVISORA') {
      // Modificación de Evidencias Aprobadas permitida para Supervisora
      if (action === 'evidences.update' && resource.evidenceStatus === 'APPROVED') {
        return { allowed: true };
      }
    }

    // Por defecto, validar que el permiso explícito existe
    const hasPermission = user.permissions.includes(action) || user.permissions.includes('*');
    if (!hasPermission) {
      return { allowed: false, reason: `PERMISSION DENIED: El rol ${user.role} no cuenta con el permiso ${action}.` };
    }

    return { allowed: true };
  }

  /**
   * Protección Estricta contra IDOR y Manipulación de User ID desde el Frontend
   */
  public static preventIdor(authenticatedUserId: string, payloadUserId?: string, userRole?: string): { valid: boolean; reason?: string } {
    if (userRole === 'ADMIN') {
      return { valid: true };
    }

    if (payloadUserId && payloadUserId !== authenticatedUserId) {
      return {
        valid: false,
        reason: 'IDOR DETECTED: Intento no autorizado de suplantación de userId en el payload.',
      };
    }

    return { valid: true };
  }
}
