export interface AuditLogEntry {
  id?: string;
  userId?: string;
  action: string;
  entity: string;
  entityId: string;
  notes?: string;
  oldValues?: string;
  newValues?: string;
  ipAddress?: string;
  userAgent?: string;
  idempotencyKey?: string;
  createdAt?: Date;
}

export class AuditLogService {
  private static logs: AuditLogEntry[] = [];

  public static log(entry: AuditLogEntry): AuditLogEntry {
    const created: AuditLogEntry = {
      id: entry.id || `audit_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`,
      userId: entry.userId || 'SYSTEM',
      action: entry.action,
      entity: entry.entity,
      entityId: entry.entityId,
      oldValues: entry.oldValues,
      newValues: entry.newValues,
      ipAddress: entry.ipAddress || '127.0.0.1',
      userAgent: entry.userAgent || 'BITALIS_ERP_AGENT',
      idempotencyKey: entry.idempotencyKey,
      createdAt: new Date(),
    };

    // Immutable in-memory log push
    this.logs.push(created);
    return created;
  }

  public static record(dto: any): AuditLogEntry {
    return this.log({
      userId: dto.userId || 'SYSTEM',
      action: dto.action,
      entity: dto.resource || dto.entity || 'UNKNOWN',
      entityId: dto.resourceId || dto.entityId || 'UNKNOWN',
      notes: typeof dto.payload === 'object' ? JSON.stringify(dto.payload) : dto.notes,
    });
  }

  public static getLogs(): AuditLogEntry[] {
    return [...this.logs];
  }

  public static clear(): void {
    this.logs = [];
  }
}
