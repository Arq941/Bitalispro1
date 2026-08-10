import Decimal from 'decimal.js';
import { PrismaService } from '@/src/database/prisma.service';
import { AuditLogService } from '@/src/audit/audit-log.service';
import { NotificationService } from '@/src/notifications/notifications.service';

export interface CreateRenewalCandidateDto {
  clientId: string;
  sourceCreditId?: string;
  creditId?: string;
  progressPercentage?: number | Decimal;
  remainingBalance?: number | Decimal;
  estimatedRenewalDate?: Date | string;
  assignedSellerId?: string;
  assignedSupervisorId?: string;
  notes?: string;
  reason?: string;
}

export class RenewalsStore {
  static renewals: Map<string, any> = new Map();

  static clearMemoryStore() {
    this.renewals.clear();
  }
}

export class RenewalEngine {
  /**
   * Identifica créditos candidatos a renovación (ej: pagado >= 70% o saldo <= 30% del financiado).
   * REGLA CRÍTICA: JAMÁS genera automáticamente Sale, Credit, Payment o CashMovement.
   * Únicamente genera ClientRenewal y notificación RENEWAL_PENDING.
   */
  static async evaluateAndGenerateCandidates(minPaidPercentage: number = 70): Promise<any[]> {
    const generated: any[] = [];
    let credits: any[] = [];

    try {
      const prisma = PrismaService.getInstance();
      credits = await prisma.credit.findMany({
        where: { status: 'ACTIVE' },
        include: { client: true, sale: true },
      });
    } catch {
      // Fallback a memoria si aplica
    }

    for (const credit of credits) {
      const principal = new Decimal(credit.principalAmount || 1000);
      const saldo = new Decimal(credit.saldoActual || 0);
      const paidAmount = principal.sub(saldo);
      const paidPct = principal.gt(0) ? paidAmount.div(principal).mul(100).toNumber() : 0;

      if (paidPct >= minPaidPercentage) {
        // Verificar si ya existe una renovación pendiente o activa para este cliente/crédito
        const existing = await RenewalService.getRenewalByCredit(credit.id);
        if (!existing) {
          const candidate = await RenewalService.createRenewalCandidate({
            clientId: credit.clientId,
            sourceCreditId: credit.id,
            creditId: credit.id,
            progressPercentage: paidPct,
            remainingBalance: saldo.toNumber(),
            estimatedRenewalDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // +7 días
            assignedSellerId: credit.sale?.sellerId,
            assignedSupervisorId: credit.sale?.supervisorId,
            notes: `Candidato detectado automáticamente con ${paidPct.toFixed(1)}% pagado`,
            reason: 'AUTO_DETECTION_70_PERCENT',
          });
          generated.push(candidate);
        }
      }
    }

    return generated;
  }
}

export class RenewalService {
  static async createRenewalCandidate(dto: CreateRenewalCandidateDto, userId?: string) {
    const id = `ren_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
    const progressPct = new Decimal(dto.progressPercentage || 0);
    const balance = new Decimal(dto.remainingBalance || 0);

    const renewal = {
      id,
      clientId: dto.clientId,
      sourceCreditId: dto.sourceCreditId || dto.creditId || null,
      creditId: dto.creditId || dto.sourceCreditId || null,
      status: 'RENEWAL_PENDING',
      progressPercentage: progressPct,
      remainingBalance: balance,
      estimatedRenewalDate: dto.estimatedRenewalDate ? new Date(dto.estimatedRenewalDate) : new Date(),
      assignedSellerId: dto.assignedSellerId || null,
      assignedSupervisorId: dto.assignedSupervisorId || null,
      lastContactAt: null,
      convertedSaleId: null,
      reason: dto.reason || 'HIGH_PAYMENT_PROGRESS',
      notes: dto.notes || null,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    try {
      const prisma = PrismaService.getInstance();
      const created = await prisma.clientRenewal.create({
        data: {
          id: renewal.id,
          clientId: renewal.clientId,
          sourceCreditId: renewal.sourceCreditId,
          creditId: renewal.creditId,
          status: renewal.status,
          progressPercentage: renewal.progressPercentage.toNumber(),
          remainingBalance: renewal.remainingBalance.toNumber(),
          estimatedRenewalDate: renewal.estimatedRenewalDate,
          assignedSellerId: renewal.assignedSellerId,
          assignedSupervisorId: renewal.assignedSupervisorId,
          reason: renewal.reason,
          notes: renewal.notes,
        },
      });
      RenewalsStore.renewals.set(created.id, created);
    } catch {
      RenewalsStore.renewals.set(renewal.id, renewal);
    }

    // Registrar auditoría y notificación
    await AuditLogService.record({
      userId: userId || 'SYSTEM',
      action: 'RENEWAL_CREATED',
      resource: 'ClientRenewal',
      resourceId: id,
      payload: { clientId: dto.clientId, status: 'RENEWAL_PENDING' },
    });

    if (renewal.assignedSellerId) {
      await NotificationService.createNotification({
        userId: renewal.assignedSellerId,
        type: 'RENEWAL_PENDING',
        priority: 'HIGH',
        title: 'Nueva Oportunidad de Renovación',
        message: `El cliente ID ${dto.clientId} ha alcanzado ${progressPct.toFixed(0)}% de avance de pago.`,
        entity: 'ClientRenewal',
        entityId: id,
      });
    }

    if (renewal.assignedSupervisorId) {
      await NotificationService.createNotification({
        userId: renewal.assignedSupervisorId,
        type: 'SUPERVISOR_ALERT',
        priority: 'MEDIUM',
        title: 'Alerta de Renovación en Zona',
        message: `Oportunidad de renovación detectada para el cliente ID ${dto.clientId}.`,
        entity: 'ClientRenewal',
        entityId: id,
      });
    }

    return renewal;
  }

  static async getRenewalById(id: string) {
    try {
      const prisma = PrismaService.getInstance();
      const dbObj = await prisma.clientRenewal.findUnique({
        where: { id },
        include: { client: true },
      });
      if (dbObj) return dbObj;
    } catch {}
    return RenewalsStore.renewals.get(id) || null;
  }

  static async getRenewalByCredit(creditId: string) {
    try {
      const prisma = PrismaService.getInstance();
      const dbObj = await prisma.clientRenewal.findFirst({
        where: {
          OR: [{ sourceCreditId: creditId }, { creditId }],
          status: { notIn: ['REJECTED', 'CANCELLED', 'CONVERTED'] },
        },
      });
      if (dbObj) return dbObj;
    } catch {}

    for (const r of Array.from(RenewalsStore.renewals.values())) {
      if ((r.sourceCreditId === creditId || r.creditId === creditId) && !['REJECTED', 'CANCELLED', 'CONVERTED'].includes(r.status)) {
        return r;
      }
    }
    return null;
  }

  static async listRenewals(filters?: { status?: string; sellerId?: string; supervisorId?: string }) {
    let list: any[] = [];
    try {
      const prisma = PrismaService.getInstance();
      const whereClause: any = {};
      if (filters?.status) whereClause.status = filters.status;
      if (filters?.sellerId) whereClause.assignedSellerId = filters.sellerId;
      if (filters?.supervisorId) whereClause.assignedSupervisorId = filters.supervisorId;

      list = await prisma.clientRenewal.findMany({
        where: whereClause,
        include: { client: true },
        orderBy: { createdAt: 'desc' },
      });
      if (list.length > 0) return list;
    } catch {}

    list = Array.from(RenewalsStore.renewals.values());
    if (filters?.status) list = list.filter((r) => r.status === filters.status);
    if (filters?.sellerId) list = list.filter((r) => r.assignedSellerId === filters.sellerId);
    if (filters?.supervisorId) list = list.filter((r) => r.assignedSupervisorId === filters.supervisorId);
    return list;
  }

  static async contactClient(id: string, notes?: string, userId?: string) {
    const renewal = await this.getRenewalById(id);
    if (!renewal) throw new Error('Renovación no encontrada');

    renewal.status = 'CONTACTED';
    renewal.lastContactAt = new Date();
    renewal.updatedAt = new Date();
    if (notes) renewal.notes = notes;

    try {
      const prisma = PrismaService.getInstance();
      await prisma.clientRenewal.update({
        where: { id },
        data: {
          status: 'CONTACTED',
          lastContactAt: renewal.lastContactAt,
          notes: renewal.notes,
        },
      });
    } catch {}

    RenewalsStore.renewals.set(id, renewal);

    await AuditLogService.record({
      userId: userId || 'SYSTEM',
      action: 'RENEWAL_CONTACTED',
      resource: 'ClientRenewal',
      resourceId: id,
      payload: { notes },
    });

    return renewal;
  }

  static async scheduleVisit(id: string, visitDate: Date | string, notes?: string, userId?: string) {
    const renewal = await this.getRenewalById(id);
    if (!renewal) throw new Error('Renovación no encontrada');

    renewal.status = 'VISIT_SCHEDULED';
    renewal.estimatedRenewalDate = new Date(visitDate);
    renewal.updatedAt = new Date();
    if (notes) renewal.notes = notes;

    try {
      const prisma = PrismaService.getInstance();
      await prisma.clientRenewal.update({
        where: { id },
        data: {
          status: 'VISIT_SCHEDULED',
          estimatedRenewalDate: renewal.estimatedRenewalDate,
          notes: renewal.notes,
        },
      });
    } catch {}

    RenewalsStore.renewals.set(id, renewal);

    await AuditLogService.record({
      userId: userId || 'SYSTEM',
      action: 'RENEWAL_VISIT',
      resource: 'ClientRenewal',
      resourceId: id,
      payload: { visitDate, notes },
    });

    return renewal;
  }

  static async completeVisit(id: string, resultNotes?: string, userId?: string) {
    const renewal = await this.getRenewalById(id);
    if (!renewal) throw new Error('Renovación no encontrada');

    renewal.status = 'VISIT_DONE';
    renewal.updatedAt = new Date();
    if (resultNotes) renewal.notes = resultNotes;

    try {
      const prisma = PrismaService.getInstance();
      await prisma.clientRenewal.update({
        where: { id },
        data: { status: 'VISIT_DONE', notes: renewal.notes },
      });
    } catch {}

    RenewalsStore.renewals.set(id, renewal);

    await AuditLogService.record({
      userId: userId || 'SYSTEM',
      action: 'RENEWAL_VISIT',
      resource: 'ClientRenewal',
      resourceId: id,
      payload: { visitDone: true, resultNotes },
    });

    return renewal;
  }

  static async convertToSale(id: string, saleId: string, userId?: string) {
    const renewal = await this.getRenewalById(id);
    if (!renewal) throw new Error('Renovación no encontrada');

    renewal.status = 'CONVERTED';
    renewal.convertedSaleId = saleId;
    renewal.updatedAt = new Date();

    try {
      const prisma = PrismaService.getInstance();
      await prisma.clientRenewal.update({
        where: { id },
        data: { status: 'CONVERTED', convertedSaleId: saleId },
      });
    } catch {}

    RenewalsStore.renewals.set(id, renewal);

    await AuditLogService.record({
      userId: userId || 'SYSTEM',
      action: 'RENEWAL_CONVERTED',
      resource: 'ClientRenewal',
      resourceId: id,
      payload: { saleId },
    });

    return renewal;
  }

  static async rejectRenewal(id: string, reason: string, userId?: string) {
    const renewal = await this.getRenewalById(id);
    if (!renewal) throw new Error('Renovación no encontrada');

    renewal.status = 'REJECTED';
    renewal.reason = reason;
    renewal.updatedAt = new Date();

    try {
      const prisma = PrismaService.getInstance();
      await prisma.clientRenewal.update({
        where: { id },
        data: { status: 'REJECTED', reason },
      });
    } catch {}

    RenewalsStore.renewals.set(id, renewal);

    await AuditLogService.record({
      userId: userId || 'SYSTEM',
      action: 'RENEWAL_REJECTED',
      resource: 'ClientRenewal',
      resourceId: id,
      payload: { reason },
    });

    return renewal;
  }

  static clearMemoryStore() {
    RenewalsStore.clearMemoryStore();
  }
}
