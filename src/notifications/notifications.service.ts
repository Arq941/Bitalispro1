import { PrismaService } from '@/src/database/prisma.service';
import { AuditLogService } from '@/src/audit/audit-log.service';

export interface CreateNotificationDto {
  userId: string;
  type: string;
  priority?: 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW' | 'INFO';
  title: string;
  message: string;
  entity?: string;
  entityId?: string;
  expiresAt?: Date | string;
}

export class NotificationsStore {
  static notifications: Map<string, any> = new Map();

  static clearMemoryStore() {
    this.notifications.clear();
  }
}

export class NotificationAbacService {
  /**
   * Valida si un usuario con un rol y contexto específico puede acceder a una notificación.
   * COBRADOR: solo notificaciones de su ruta/clientes asignados, caja u offline.
   * VENDEDORA: prospectos, renovaciones asignadas, autorizaciones de venta, stock comercial.
   * SUPERVISORA: alertas de su zona, renovaciones, morosidad, diferencias de caja, pedidos.
   * ADMIN: acceso global.
   */
  static canAccessNotification(userContext: { userId: string; role: string; routeId?: string; zoneId?: string }, notification: any): boolean {
    if (!userContext || !userContext.role) return false;
    const role = userContext.role.toUpperCase();

    if (role === 'ADMIN' || role === 'SUPER_ADMIN') return true;

    if (notification.userId && notification.userId === userContext.userId) {
      return true;
    }

    if (role === 'COBRADOR') {
      const allowedTypes = ['COLLECTION_RISK', 'OVERDUE_CLIENT', 'BROKEN_PROMISE', 'CASH_VARIANCE', 'OFFLINE_CONFLICT', 'PAYMENT_VERIFIED', 'FIRST_COLLECTION_DUE', 'COLLECTION_ROUTE_DUE'];
      if (!allowedTypes.includes(notification.type)) return false;
      return true;
    }

    if (role === 'VENDEDORA') {
      const allowedTypes = ['RENEWAL_PENDING', 'AUTHORIZATION_PENDING', 'INVENTORY_REORDER_REQUIRED', 'PURCHASE_ORDER_PENDING', 'PURCHASE_ORDER_RECEIVED'];
      if (!allowedTypes.includes(notification.type)) return false;
      return true;
    }

    if (role === 'SUPERVISORA') {
      const restrictedTypes = ['SYSTEM_INTERNAL_SECRET'];
      return !restrictedTypes.includes(notification.type);
    }

    return notification.userId === userContext.userId;
  }
}

export class NotificationService {
  static async ensureOperationalNotices(userContext: { userId: string; role: string }) {
    const role = String(userContext.role || '').toUpperCase();
    if (!['COBRADOR', 'VENDEDORA', 'SUPERVISORA', 'ADMIN', 'SUPER_ADMIN'].includes(role)) return;

    try {
      const prisma = PrismaService.getInstance();
      const now = new Date();
      const startOfDay = new Date(now); startOfDay.setHours(0, 0, 0, 0);
      const endOfDay = new Date(now); endOfDay.setHours(23, 59, 59, 999);

      if (['COBRADOR', 'SUPERVISORA', 'ADMIN', 'SUPER_ADMIN'].includes(role)) {
        const schedules = await prisma.paymentSchedule.findMany({
          where: {
            scheduledDate: { lte: endOfDay },
            status: { in: ['PENDING', 'PARTIAL'] },
            credit: {
              status: 'ACTIVE',
              ...(role === 'COBRADOR' ? { client: { assignedCollectorId: userContext.userId } } : {}),
            },
          },
          include: { credit: { include: { client: true } } },
          orderBy: { scheduledDate: 'asc' },
          take: 150,
        });

        for (const schedule of schedules) {
          const client = schedule.credit.client;
          const fullName = [client.firstName, client.lastName].filter(Boolean).join(' ');
          const isFirst = schedule.installmentNumber === 1;
          const overdue = schedule.scheduledDate < startOfDay;
          await this.createNotification({
            userId: userContext.userId,
            type: isFirst ? 'FIRST_COLLECTION_DUE' : overdue ? 'OVERDUE_CLIENT' : 'COLLECTION_ROUTE_DUE',
            priority: overdue ? 'HIGH' : isFirst ? 'HIGH' : 'MEDIUM',
            title: isFirst ? 'Primer cobro pendiente' : overdue ? 'Cobro vencido' : 'Cobro en ruta para hoy',
            message: `${fullName} · abono ${schedule.installmentNumber} · ${schedule.scheduledDate.toLocaleDateString('es-MX')}`,
            entity: 'Credit',
            entityId: schedule.creditId,
          });
        }
      }

      if (['VENDEDORA', 'SUPERVISORA', 'ADMIN', 'SUPER_ADMIN'].includes(role)) {
        const stocks = await prisma.inventoryStock.findMany({
          include: { product: true, warehouse: true },
          take: 250,
        });
        for (const stock of stocks.filter((x: any) => x.quantityAvailable <= Math.max(x.product.reorderPoint, x.product.minStock))) {
          await this.createNotification({
            userId: userContext.userId,
            type: 'INVENTORY_REORDER_REQUIRED',
            priority: stock.quantityAvailable <= 0 ? 'CRITICAL' : 'HIGH',
            title: stock.quantityAvailable <= 0 ? 'Producto sin existencia' : 'Inventario crítico',
            message: `${stock.product.name} · ${stock.quantityAvailable} disponibles · ${stock.warehouse.name}`,
            entity: 'InventoryStock',
            entityId: stock.id,
          });
        }

        const authorizations = await prisma.authorizationRequest.findMany({
          where: {
            status: 'PENDING',
            ...(role === 'VENDEDORA' ? { requestedBy: userContext.userId } : {}),
          },
          orderBy: { createdAt: 'asc' },
          take: 100,
        });
        for (const item of authorizations) {
          await this.createNotification({
            userId: userContext.userId,
            type: 'AUTHORIZATION_PENDING',
            priority: 'HIGH',
            title: 'Autorización pendiente',
            message: `${item.type} · solicitada ${item.createdAt.toLocaleDateString('es-MX')}`,
            entity: 'AuthorizationRequest',
            entityId: item.id,
          });
        }
      }

      if (['COBRADOR', 'SUPERVISORA', 'ADMIN', 'SUPER_ADMIN'].includes(role)) {
        const conflicts = await prisma.syncConflict.findMany({
          where: {
            resolvedAt: null,
            ...(role === 'COBRADOR' ? { syncOperation: { userId: userContext.userId } } : {}),
          },
          include: { syncOperation: true },
          orderBy: { detectedAt: 'asc' },
          take: 100,
        });
        for (const conflict of conflicts) {
          await this.createNotification({
            userId: userContext.userId,
            type: 'OFFLINE_CONFLICT',
            priority: conflict.severity === 'CRITICAL' ? 'CRITICAL' : 'HIGH',
            title: 'Conflicto de sincronización',
            message: conflict.description || `${conflict.conflictType} requiere revisión`,
            entity: 'SyncConflict',
            entityId: conflict.id,
          });
        }
      }
    } catch {
      // La bandeja sigue disponible aunque una fuente operativa esté temporalmente fuera de línea.
    }
  }

  static async ensureFirstCollectionNotices(userContext: { userId: string; role: string }) {
    return this.ensureOperationalNotices(userContext);
  }

  /**
   * Crea una notificación para un usuario evitando duplicados abiertos con el mismo tipo, entidad y entityId.
   */
  static async createNotification(dto: CreateNotificationDto): Promise<any> {
    const id = `notif_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
    const priority = dto.priority || 'MEDIUM';

    // Anti-duplicado: verificar si existe una no leída con el mismo tipo, entidad y id
    if (dto.entity && dto.entityId) {
      const existing = await this.findDuplicate(dto.userId, dto.type, dto.entity, dto.entityId);
      if (existing) {
        return existing;
      }
    }

    const notification = {
      id,
      userId: dto.userId,
      type: dto.type,
      priority,
      title: dto.title,
      message: dto.message,
      entity: dto.entity || null,
      entityId: dto.entityId || null,
      status: 'UNREAD',
      readAt: null,
      createdAt: new Date(),
      expiresAt: dto.expiresAt ? new Date(dto.expiresAt) : null,
    };

    try {
      const prisma = PrismaService.getInstance();
      const created = await prisma.notification.create({
        data: {
          id: notification.id,
          userId: notification.userId,
          type: notification.type,
          priority: notification.priority,
          title: notification.title,
          message: notification.message,
          entity: notification.entity,
          entityId: notification.entityId,
          status: 'UNREAD',
          expiresAt: notification.expiresAt,
        },
      });
      NotificationsStore.notifications.set(created.id, created);
    } catch {
      NotificationsStore.notifications.set(notification.id, notification);
    }

    await AuditLogService.record({
      userId: dto.userId,
      action: 'NOTIFICATION_CREATED',
      resource: 'Notification',
      resourceId: id,
      payload: { type: dto.type, priority, title: dto.title },
    });

    return notification;
  }

  private static async findDuplicate(userId: string, type: string, entity: string, entityId: string): Promise<any | null> {
    try {
      const prisma = PrismaService.getInstance();
      const dbNotif = await prisma.notification.findFirst({
        where: { userId, type, entity, entityId, status: 'UNREAD' },
      });
      if (dbNotif) return dbNotif;
    } catch {}

    for (const n of Array.from(NotificationsStore.notifications.values())) {
      if (n.userId === userId && n.type === type && n.entity === entity && n.entityId === entityId && n.status === 'UNREAD') {
        return n;
      }
    }
    return null;
  }

  static async getUserNotifications(userId: string, filterStatus?: string, userContext?: any): Promise<any[]> {
    let list: any[] = [];
    try {
      const prisma = PrismaService.getInstance();
      const whereClause: any = { userId };
      if (filterStatus) whereClause.status = filterStatus;

      list = await prisma.notification.findMany({
        where: whereClause,
        orderBy: [{ priority: 'asc' }, { createdAt: 'desc' }],
      });
      if (list.length > 0) return list;
    } catch {}

    list = Array.from(NotificationsStore.notifications.values()).filter((n) => n.userId === userId);
    if (filterStatus) {
      list = list.filter((n) => n.status === filterStatus);
    }

    if (userContext) {
      list = list.filter((n) => NotificationAbacService.canAccessNotification(userContext, n));
    }

    return list;
  }

  static async markAsRead(id: string, userId: string): Promise<any> {
    let notification: any = null;
    try {
      const prisma = PrismaService.getInstance();
      const dbNotif = await prisma.notification.findUnique({ where: { id } });
      if (dbNotif) {
        notification = await prisma.notification.update({
          where: { id },
          data: { status: 'READ', readAt: new Date() },
        });
      }
    } catch {}

    if (!notification) {
      notification = NotificationsStore.notifications.get(id);
      if (notification) {
        notification.status = 'READ';
        notification.readAt = new Date();
      }
    }

    if (!notification) throw new Error('Notificación no encontrada');

    NotificationsStore.notifications.set(id, notification);

    await AuditLogService.record({
      userId,
      action: 'NOTIFICATION_READ',
      resource: 'Notification',
      resourceId: id,
      payload: { status: 'READ' },
    });

    return notification;
  }

  static async markAllAsRead(userId: string): Promise<number> {
    let count = 0;
    try {
      const prisma = PrismaService.getInstance();
      const result = await prisma.notification.updateMany({
        where: { userId, status: 'UNREAD' },
        data: { status: 'READ', readAt: new Date() },
      });
      count = result.count;
    } catch {}

    for (const n of Array.from(NotificationsStore.notifications.values())) {
      if (n.userId === userId && n.status === 'UNREAD') {
        n.status = 'READ';
        n.readAt = new Date();
        count++;
      }
    }

    await AuditLogService.record({
      userId,
      action: 'NOTIFICATION_READ_ALL',
      resource: 'Notification',
      resourceId: userId,
      payload: { markedCount: count },
    });

    return count;
  }

  static clearMemoryStore() {
    NotificationsStore.clearMemoryStore();
  }
}
