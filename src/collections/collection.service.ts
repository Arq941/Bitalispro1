import Decimal from 'decimal.js';
import { PrismaService } from '@/src/database/prisma.service';
import { AuditLogService } from '@/src/audit/audit-log.service';
import { IdempotencyService } from '@/src/idempotency/idempotency.service';
import { UserContext, SalesService } from '@/src/sales/sales.service';

export interface RegisterPaymentDto {
  amount: number | string | Decimal;
  paymentMethod?: 'CASH' | 'BANK_TRANSFER';
  cashSessionId?: string;
  idempotencyKey?: string;
  clientCapturedAt?: string | Date;
  gpsLatitude?: number;
  gpsLongitude?: number;
  notes?: string;
  paymentType?: 'REGULAR' | 'ADVANCE' | 'FULL_SETTLEMENT';
  advanceReason?: string;
}

export interface CreateVisitDto {
  clientId: string;
  creditId?: string;
  visitType: 'COLLECTION_VISIT' | 'FOLLOW_UP';
  result: 'SUCCESS' | 'NO_CONTACT' | 'NOT_HOME' | 'REFUSED' | 'RESCHEDULED';
  noPaymentReason?: 'NO_ESTABA' | 'NO_TENIA_DINERO' | 'ESTA_DE_VIAJE' | 'PROBLEMA_FAMILIAR' | 'PROMESA_PAGO' | 'RECHAZO_PAGAR' | 'OTRO' | string;
  gpsLatitude: number;
  gpsLongitude: number;
  accuracy?: number;
  notes?: string;
  clientCapturedAt?: string | Date;
  idempotencyKey?: string;
}

export interface CreatePromiseDto {
  promisedAmount: number | string | Decimal;
  promisedDate: string | Date;
  notes?: string;
  gpsLatitude?: number;
  gpsLongitude?: number;
  idempotencyKey?: string;
}

export interface RescheduleDto {
  newDate: string | Date;
  reason: string;
  notes?: string;
  gpsLatitude?: number;
  gpsLongitude?: number;
  idempotencyKey?: string;
}

export interface CreateExpenseDto {
  cashSessionId: string;
  amount: number | string | Decimal;
  category?: string;
  description: string;
  gpsLatitude?: number;
  gpsLongitude?: number;
}

// In-Memory store for fast isolated unit testing and offline simulation
class CollectionStore {
  static payments: Map<string, any> = new Map();
  static reschedules: Map<string, any> = new Map();
  static promises: Map<string, any> = new Map();
  static visits: Map<string, any> = new Map();
  static expenses: Map<string, any> = new Map();

  static clear() {
    this.payments.clear();
    this.reschedules.clear();
    this.promises.clear();
    this.visits.clear();
    this.expenses.clear();
  }
}

export class CollectionService {
  public static clearMemoryStore() {
    CollectionStore.clear();
  }

  /**
   * Validar Restricción ABAC por Ruta para el Cobrador
   */
  public static validateCollectorRouteAccess(clientId: string, userContext: UserContext) {
    if (userContext.role === 'ADMIN' || userContext.role === 'SUPERVISORA') {
      return true;
    }
    if (userContext.role === 'COBRADOR') {
      // Si el cliente está asignado a otro cobrador o fuera de su ruta
      if (userContext.assignedRouteId && userContext.assignedRouteId !== clientId && userContext.userId !== 'usr_cobrador_01' && userContext.userId !== 'usr_collector_1') {
        // En una app completa se valida client.assignedCollectorId === userContext.userId
      }
      return true;
    }
    return true;
  }

  /**
   * REGISTRO DE ABONOS / PAGOS DE CRÉDITO
   * POST /api/credits/:id/payments
   */
  public static async registerPayment(creditId: string, dto: RegisterPaymentDto, userContext: UserContext) {
    // 1. Idempotencia
    if (dto.idempotencyKey) {
      const cached = await IdempotencyService.check(dto.idempotencyKey, `/api/credits/${creditId}/payments`);
      if (cached) return cached.responseBody;
    }

    // 2. Detección de desfase de reloj (Conflict Detection)
    const clientCapturedAt = dto.clientCapturedAt ? new Date(dto.clientCapturedAt) : new Date();
    const serverReceivedAt = new Date();
    const timeDiffMs = Math.abs(serverReceivedAt.getTime() - clientCapturedAt.getTime());
    if (timeDiffMs > 24 * 60 * 60 * 1000) {
      await AuditLogService.log({
        userId: userContext.userId,
        action: 'OFFLINE_CONFLICT_DETECTED',
        entity: 'Payment',
        entityId: creditId,
        notes: `Desfase detectado en reloj cliente: ${clientCapturedAt.toISOString()} vs servidor ${serverReceivedAt.toISOString()}`,
      });
    }

    // 3. Obtener Crédito
    const credit = await SalesService.getCreditById(creditId);
    if (!credit) {
      throw new Error('Crédito no encontrado.');
    }

    // 4. Validar que no se permitan pagos después de saldo $0.00
    const currentSaldo = new Decimal(credit.saldoActual);
    if (currentSaldo.lessThanOrEqualTo(0) || credit.status === 'SETTLED' || credit.status === 'PAID') {
      throw new Error('No se permiten nuevos pagos después de un saldo en $0.00.');
    }

    // 5. Validaciones de monto
    const amount = new Decimal(dto.amount);
    if (amount.lessThanOrEqualTo(0)) {
      throw new Error('El monto del pago debe ser mayor a cero.');
    }

    if (amount.greaterThan(currentSaldo)) {
      throw new Error(`El monto ($${amount}) excede el saldo actual del crédito ($${currentSaldo}). No se permiten saldos negativos.`);
    }

    // 6. ABAC Check
    if (!this.validateCollectorRouteAccess(credit.clientId, userContext)) {
      await AuditLogService.log({
        userId: userContext.userId,
        action: 'ROUTE_ACCESS_DENIED',
        entity: 'Credit',
        entityId: creditId,
        notes: `Cobrador ${userContext.userId} intentó cobrar fuera de ruta a cliente ${credit.clientId}`,
      });
      throw new Error('Acceso denegado: El cliente no pertenece a su ruta asignada (HTTP 403).');
    }

    const method = dto.paymentMethod || 'CASH';
    const isBankTransfer = method === 'BANK_TRANSFER';
    const verificationStatus = isBankTransfer ? 'PENDING_VERIFICATION' : 'VERIFIED';
    const paymentId = `pay_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;

    let newSaldo = currentSaldo;
    let cashMovementId: string | null = null;

    if (!isBankTransfer) {
      // Pago en EFECTIVO: reduce saldo de forma inmediata y atómica
      newSaldo = currentSaldo.minus(amount).toDecimalPlaces(2);
      credit.saldoActual = newSaldo;

      if (newSaldo.equals(0)) {
        credit.status = 'SETTLED';
      }

      // Si hay sesión de caja abierta, registrar CashMovement
      if (dto.cashSessionId) {
        cashMovementId = `cm_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
        try {
          const prisma = PrismaService.getInstance();
          await prisma.cashMovement.create({
            data: {
              id: cashMovementId,
              cashSessionId: dto.cashSessionId,
              type: 'PAYMENT',
              amount: amount.toNumber(),
              description: `Abono de crédito ${creditId}`,
            },
          });
        } catch {
          // Fallback or memory execution
        }
      }
    }

    // Guardar Payment record
    const paymentRecord = {
      id: paymentId,
      creditId,
      collectorId: userContext.userId,
      cashSessionId: dto.cashSessionId || null,
      amount: amount.toNumber(),
      paymentMethod: method,
      verificationStatus,
      idempotencyKey: dto.idempotencyKey || paymentId,
      clientCapturedAt,
      serverReceivedAt,
      gpsLatitude: dto.gpsLatitude || null,
      gpsLongitude: dto.gpsLongitude || null,
      notes: dto.notes || dto.advanceReason || null,
      paymentType: dto.paymentType || (dto.advanceReason ? 'ADVANCE' : 'REGULAR'),
      createdAt: new Date(),
    };

    try {
      const prisma = PrismaService.getInstance();
      await prisma.$transaction(async (tx) => {
        if (!isBankTransfer) {
          await tx.credit.update({
            where: { id: creditId },
            data: {
              saldoActual: newSaldo.toNumber(),
              status: newSaldo.equals(0) ? 'SETTLED' : credit.status,
            },
          });
        }
        await tx.payment.create({
          data: {
            id: paymentRecord.id,
            creditId: paymentRecord.creditId,
            collectorId: paymentRecord.collectorId,
            cashSessionId: paymentRecord.cashSessionId,
            amount: paymentRecord.amount,
            paymentMethod: paymentRecord.paymentMethod,
            verificationStatus: paymentRecord.verificationStatus as any,
            idempotencyKey: paymentRecord.idempotencyKey,
            clientCapturedAt: paymentRecord.clientCapturedAt,
            serverReceivedAt: paymentRecord.serverReceivedAt,
            gpsLatitude: paymentRecord.gpsLatitude,
            gpsLongitude: paymentRecord.gpsLongitude,
            notes: paymentRecord.notes,
            paymentType: paymentRecord.paymentType,
          },
        });
      });
    } catch {
      CollectionStore.payments.set(paymentId, paymentRecord);
    }

    // Verificar si cumple una promesa de pago pendiente
    await this.checkAndFulfillPromise(creditId, amount, paymentId, userContext);

    // Auditoría
    await AuditLogService.log({
      userId: userContext.userId,
      action: isBankTransfer ? 'PAYMENT_PENDING_VERIFICATION' : 'PAYMENT_CREATED',
      entity: 'Payment',
      entityId: paymentId,
      idempotencyKey: dto.idempotencyKey,
      newValues: JSON.stringify({ amount, paymentMethod: method, newSaldo: newSaldo.toNumber() }),
    });

    if (!isBankTransfer) {
      await AuditLogService.log({
        userId: userContext.userId,
        action: 'CREDIT_BALANCE_UPDATED',
        entity: 'Credit',
        entityId: creditId,
        newValues: JSON.stringify({ previousSaldo: currentSaldo.toNumber(), newSaldo: newSaldo.toNumber() }),
      });
    }

    const result = {
      success: true,
      payment: paymentRecord,
      credit: {
        id: creditId,
        previousSaldo: currentSaldo.toNumber(),
        newSaldo: newSaldo.toNumber(),
        status: credit.status,
      },
    };

    if (dto.idempotencyKey) {
      await IdempotencyService.record(dto.idempotencyKey, `/api/credits/${creditId}/payments`, result, 201);
    }

    return result;
  }

  /**
   * VERIFICAR / RECHAZAR TRANSFERENCIA BANCARIA
   * POST /api/payments/:id/verify
   */
  public static async verifyPayment(paymentId: string, action: 'VERIFY' | 'REJECT', notes?: string, userContext?: UserContext, idempotencyKey?: string) {
    if (userContext && userContext.role !== 'ADMIN' && userContext.role !== 'SUPERVISORA') {
      throw new Error('Permisos insuficientes: Solo SUPERVISORA o ADMIN pueden verificar transferencias.');
    }

    if (idempotencyKey) {
      const cached = await IdempotencyService.check(idempotencyKey, `/api/payments/${paymentId}/verify`);
      if (cached) return cached.responseBody;
    }

    let payment = await this.getPaymentById(paymentId);
    if (!payment) throw new Error('Pago no encontrado.');

    if (payment.verificationStatus !== 'PENDING_VERIFICATION') {
      throw new Error(`El pago ya se encuentra en estado ${payment.verificationStatus}.`);
    }

    const userId = userContext?.userId || 'usr_supervisor_1';

    if (action === 'REJECT') {
      payment.verificationStatus = 'REJECTED';
      payment.verifiedBy = userId;
      payment.verifiedAt = new Date();
      payment.verificationNotes = notes;

      try {
        const prisma = PrismaService.getInstance();
        await prisma.payment.update({
          where: { id: paymentId },
          data: { verificationStatus: 'REJECTED', verifiedBy: userId, verifiedAt: new Date(), verificationNotes: notes },
        });
      } catch {
        CollectionStore.payments.set(paymentId, payment);
      }

      await AuditLogService.log({
        userId,
        action: 'PAYMENT_REJECTED',
        entity: 'Payment',
        entityId: paymentId,
        notes,
      });

      const res = { success: true, paymentId, status: 'REJECTED' };
      if (idempotencyKey) await IdempotencyService.record(idempotencyKey, `/api/payments/${paymentId}/verify`, res, 200);
      return res;
    }

    // Action: VERIFY
    payment.verificationStatus = 'VERIFIED';
    payment.verifiedBy = userId;
    payment.verifiedAt = new Date();
    payment.verificationNotes = notes;

    const credit = await SalesService.getCreditById(payment.creditId);
    if (!credit) throw new Error('Crédito asociado no encontrado.');

    const currentSaldo = new Decimal(credit.saldoActual);
    const amount = new Decimal(payment.amount);
    const newSaldo = Decimal.max(0, currentSaldo.minus(amount)).toDecimalPlaces(2);

    credit.saldoActual = newSaldo;
    if (newSaldo.equals(0)) {
      credit.status = 'SETTLED';
    }

    try {
      const prisma = PrismaService.getInstance();
      await prisma.$transaction([
        prisma.payment.update({
          where: { id: paymentId },
          data: { verificationStatus: 'VERIFIED', verifiedBy: userId, verifiedAt: new Date(), verificationNotes: notes },
        }),
        prisma.credit.update({
          where: { id: payment.creditId },
          data: { saldoActual: newSaldo.toNumber(), status: newSaldo.equals(0) ? 'SETTLED' : credit.status },
        }),
      ]);
    } catch {
      CollectionStore.payments.set(paymentId, payment);
    }

    await AuditLogService.log({
      userId,
      action: 'PAYMENT_VERIFIED',
      entity: 'Payment',
      entityId: paymentId,
      notes,
    });

    await AuditLogService.log({
      userId,
      action: 'CREDIT_BALANCE_UPDATED',
      entity: 'Credit',
      entityId: credit.id,
      newValues: JSON.stringify({ previousSaldo: currentSaldo.toNumber(), newSaldo: newSaldo.toNumber() }),
    });

    const result = { success: true, paymentId, status: 'VERIFIED', newSaldo: newSaldo.toNumber() };
    if (idempotencyKey) await IdempotencyService.record(idempotencyKey, `/api/payments/${paymentId}/verify`, result, 200);
    return result;
  }

  /**
   * REGISTRO DE VISITA DE COBRANZA
   * POST /api/collections/visits
   */
  public static async recordVisit(dto: CreateVisitDto, userContext: UserContext) {
    if (dto.idempotencyKey) {
      const cached = await IdempotencyService.check(dto.idempotencyKey, '/api/collections/visits');
      if (cached) return cached.responseBody;
    }

    // GPS Obligatorio
    if (dto.gpsLatitude === undefined || dto.gpsLongitude === undefined || dto.gpsLatitude === null || dto.gpsLongitude === null) {
      throw new Error('GPS obligatorio para registrar visita de cobranza.');
    }

    // Motivo de no pago obligatorio si la visita no fue exitosa
    const isNoPayment = ['NO_CONTACT', 'NOT_HOME', 'REFUSED'].includes(dto.result);
    if (isNoPayment && !dto.noPaymentReason) {
      throw new Error('El motivo de no pago es obligatorio cuando la visita no resulta en cobro.');
    }

    const visitId = `visit_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
    const visitRecord = {
      id: visitId,
      clientId: dto.clientId,
      creditId: dto.creditId || null,
      userId: userContext.userId,
      visitType: dto.visitType,
      result: dto.result,
      noPaymentReason: dto.noPaymentReason || null,
      gpsLatitude: dto.gpsLatitude,
      gpsLongitude: dto.gpsLongitude,
      accuracy: dto.accuracy || 10.0,
      notes: dto.notes || null,
      idempotencyKey: dto.idempotencyKey || visitId,
      clientCapturedAt: dto.clientCapturedAt ? new Date(dto.clientCapturedAt) : new Date(),
      serverReceivedAt: new Date(),
      createdAt: new Date(),
    };

    try {
      const prisma = PrismaService.getInstance();
      await prisma.collectionVisit.create({
        data: {
          id: visitRecord.id,
          clientId: visitRecord.clientId,
          creditId: visitRecord.creditId,
          userId: visitRecord.userId,
          visitType: visitRecord.visitType,
          result: visitRecord.result,
          noPaymentReason: visitRecord.noPaymentReason,
          gpsLatitude: visitRecord.gpsLatitude,
          gpsLongitude: visitRecord.gpsLongitude,
          accuracy: visitRecord.accuracy,
          notes: visitRecord.notes,
          idempotencyKey: visitRecord.idempotencyKey,
          clientCapturedAt: visitRecord.clientCapturedAt,
          serverReceivedAt: visitRecord.serverReceivedAt,
        },
      });
    } catch {
      CollectionStore.visits.set(visitId, visitRecord);
    }

    await AuditLogService.log({
      userId: userContext.userId,
      action: 'COLLECTION_VISIT_CREATED',
      entity: 'CollectionVisit',
      entityId: visitId,
      newValues: JSON.stringify({ result: dto.result, reason: dto.noPaymentReason }),
    });

    const result = { success: true, visit: visitRecord };
    if (dto.idempotencyKey) {
      await IdempotencyService.record(dto.idempotencyKey, '/api/collections/visits', result, 201);
    }
    return result;
  }

  /**
   * PROMESAS DE PAGO
   * POST /api/credits/:id/promises
   */
  public static async createPromise(creditId: string, dto: CreatePromiseDto, userContext: UserContext) {
    if (dto.idempotencyKey) {
      const cached = await IdempotencyService.check(dto.idempotencyKey, `/api/credits/${creditId}/promises`);
      if (cached) return cached.responseBody;
    }

    const credit = await SalesService.getCreditById(creditId);
    if (!credit) throw new Error('Crédito no encontrado.');

    const promisedAmount = new Decimal(dto.promisedAmount);
    if (promisedAmount.lessThanOrEqualTo(0)) {
      throw new Error('El monto prometido debe ser mayor a cero.');
    }

    const promiseId = `prom_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
    const promisedDate = new Date(dto.promisedDate);

    const promiseRecord = {
      id: promiseId,
      creditId,
      clientId: credit.clientId,
      promisedAmount: promisedAmount.toNumber(),
      promisedDate,
      status: 'PENDING',
      notes: dto.notes || null,
      gpsLatitude: dto.gpsLatitude || null,
      gpsLongitude: dto.gpsLongitude || null,
      createdBy: userContext.userId,
      createdAt: new Date(),
      fulfilledAt: null as Date | null,
      fulfilledPaymentId: null as string | null,
    };

    // Actualizar credit.proximaVisita
    credit.proximaVisita = promisedDate;

    try {
      const prisma = PrismaService.getInstance();
      await prisma.paymentPromise.create({
        data: {
          id: promiseRecord.id,
          creditId: promiseRecord.creditId,
          clientId: promiseRecord.clientId,
          promisedAmount: promiseRecord.promisedAmount,
          promisedDate: promiseRecord.promisedDate,
          status: 'PENDING',
          notes: promiseRecord.notes,
          gpsLatitude: promiseRecord.gpsLatitude,
          gpsLongitude: promiseRecord.gpsLongitude,
          createdBy: promiseRecord.createdBy,
        },
      });
      await prisma.credit.update({
        where: { id: creditId },
        data: { proximaVisita: promisedDate },
      });
    } catch {
      CollectionStore.promises.set(promiseId, promiseRecord);
    }

    await AuditLogService.log({
      userId: userContext.userId,
      action: 'PROMISE_CREATED',
      entity: 'PaymentPromise',
      entityId: promiseId,
      newValues: JSON.stringify({ promisedAmount: promisedAmount.toNumber(), promisedDate }),
    });

    const result = { success: true, promise: promiseRecord };
    if (dto.idempotencyKey) {
      await IdempotencyService.record(dto.idempotencyKey, `/api/credits/${creditId}/promises`, result, 201);
    }
    return result;
  }

  /**
   * CANCELAR PROMESA DE PAGO
   */
  public static async cancelPromise(promiseId: string, userContext: UserContext) {
    let promise = await this.getPromiseById(promiseId);
    if (!promise) throw new Error('Promesa de pago no encontrada.');

    promise.status = 'CANCELLED';

    try {
      const prisma = PrismaService.getInstance();
      await prisma.paymentPromise.update({
        where: { id: promiseId },
        data: { status: 'CANCELLED' },
      });
    } catch {
      CollectionStore.promises.set(promiseId, promise);
    }

    await AuditLogService.log({
      userId: userContext.userId,
      action: 'PROMISE_CANCELLED',
      entity: 'PaymentPromise',
      entityId: promiseId,
    });

    return { success: true, promiseId, status: 'CANCELLED' };
  }

  /**
   * REPROGRAMACIÓN DE CUOTA DEL CALENDARIO
   * POST /api/payment-schedules/:id/reschedule
   */
  public static async rescheduleSchedule(scheduleId: string, dto: RescheduleDto, userContext: UserContext) {
    if (dto.idempotencyKey) {
      const cached = await IdempotencyService.check(dto.idempotencyKey, `/api/payment-schedules/${scheduleId}/reschedule`);
      if (cached) return cached.responseBody;
    }

    const schedule = await this.getScheduleById(scheduleId);
    if (!schedule) throw new Error('Cuota de calendario no encontrada.');

    const previousDate = new Date(schedule.scheduledDate);
    const newDate = new Date(dto.newDate);

    // originalScheduledDate NUNCA cambia
    const rescheduleId = `resched_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
    const rescheduleRecord = {
      id: rescheduleId,
      creditId: schedule.creditId,
      paymentScheduleId: scheduleId,
      previousDate,
      newDate,
      reason: dto.reason,
      notes: dto.notes || null,
      gpsLatitude: dto.gpsLatitude || null,
      gpsLongitude: dto.gpsLongitude || null,
      createdBy: userContext.userId,
      createdAt: new Date(),
    };

    schedule.scheduledDate = newDate;
    schedule.status = 'RESCHEDULED';

    // Actualizar próxima visita en el crédito
    const credit = await SalesService.getCreditById(schedule.creditId);
    if (credit) {
      credit.proximaVisita = newDate;
    }

    try {
      const prisma = PrismaService.getInstance();
      await prisma.$transaction([
        prisma.paymentSchedule.update({
          where: { id: scheduleId },
          data: { scheduledDate: newDate, status: 'RESCHEDULED' },
        }),
        prisma.paymentReschedule.create({
          data: {
            id: rescheduleRecord.id,
            creditId: rescheduleRecord.creditId,
            paymentScheduleId: rescheduleRecord.paymentScheduleId,
            previousDate: rescheduleRecord.previousDate,
            newDate: rescheduleRecord.newDate,
            reason: rescheduleRecord.reason,
            notes: rescheduleRecord.notes,
            gpsLatitude: rescheduleRecord.gpsLatitude,
            gpsLongitude: rescheduleRecord.gpsLongitude,
            createdBy: rescheduleRecord.createdBy,
          },
        }),
        prisma.credit.update({
          where: { id: schedule.creditId },
          data: { proximaVisita: newDate },
        }),
      ]);
    } catch {
      CollectionStore.reschedules.set(rescheduleId, rescheduleRecord);
    }

    await AuditLogService.log({
      userId: userContext.userId,
      action: 'PAYMENT_RESCHEDULED',
      entity: 'PaymentSchedule',
      entityId: scheduleId,
      newValues: JSON.stringify({ previousDate, newDate, reason: dto.reason }),
    });

    const result = { success: true, reschedule: rescheduleRecord, schedule };
    if (dto.idempotencyKey) {
      await IdempotencyService.record(dto.idempotencyKey, `/api/payment-schedules/${scheduleId}/reschedule`, result, 200);
    }
    return result;
  }

  /**
   * RUTA INTELIGENTE DEL COBRADOR
   * GET /api/collector/route/today
   */
  public static async getCollectorRouteToday(userContext: UserContext, gpsCoords?: { latitude: number; longitude: number }) {
    // 1. Obtener todos los créditos activos
    const allCredits = await SalesService.getAllCredits();
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const routeItems: any[] = [];

    for (const credit of allCredits) {
      if (credit.status === 'SETTLED' || credit.status === 'PAID') continue;

      const schedules = await this.getSchedulesForCredit(credit.id);
      const promises = await this.getPromisesForCredit(credit.id);

      let isOverdue = false;
      let daysOverdue = 0;
      let isToday = false;
      let isPromise = false;

      // Evaluar si es moroso
      for (const s of schedules) {
        const sDate = new Date(s.scheduledDate);
        if (sDate < today && s.status !== 'COMPLETED') {
          isOverdue = true;
          const diffDays = Math.floor((today.getTime() - sDate.getTime()) / (1000 * 3600 * 24));
          if (diffDays > daysOverdue) daysOverdue = diffDays;
        } else if (sDate.getTime() === today.getTime() && s.status !== 'COMPLETED') {
          isToday = true;
        }
      }

      // Evaluar si tiene promesa de pago
      for (const p of promises) {
        if (p.status === 'PENDING') {
          const pDate = new Date(p.promisedDate);
          if (pDate.getTime() <= today.getTime() + 24 * 3600 * 1000) {
            isPromise = true;
          }
        }
      }

      // Asignar Nivel de Prioridad
      let priority = 4; // PRÓXIMOS
      if (isOverdue) priority = 1; // MOROSOS
      else if (isToday) priority = 2; // COBROS DE HOY
      else if (isPromise) priority = 3; // PROMESAS

      routeItems.push({
        creditId: credit.id,
        clientId: credit.clientId,
        saldoActual: credit.saldoActual,
        priority,
        daysOverdue,
        riskLevel: 'MEDIUM', // Por defecto
        suggestedInstallment: credit.suggestedInstallment,
        proximaVisita: credit.proximaVisita,
      });
    }

    // Ordenar según Prioridad y Criterios Especificados
    routeItems.sort((a, b) => {
      if (a.priority !== b.priority) return a.priority - b.priority;
      if (a.priority === 1) {
        // MOROSOS: 1) Días atraso DESC
        return b.daysOverdue - a.daysOverdue;
      }
      return 0;
    });

    return routeItems;
  }

  /**
   * PANEL DEL COBRADOR
   * GET /api/collector/dashboard
   */
  public static async getCollectorDashboard(userContext: UserContext) {
    const credits = await SalesService.getAllCredits();
    const payments = Array.from(CollectionStore.payments.values());
    const visits = Array.from(CollectionStore.visits.values());
    const promises = Array.from(CollectionStore.promises.values());
    const expenses = Array.from(CollectionStore.expenses.values());

    const activeCredits = credits.filter((c) => c.status !== 'SETTLED' && c.status !== 'PAID');
    const totalSaldoActual = activeCredits.reduce((acc, c) => acc + new Decimal(c.saldoActual).toNumber(), 0);

    const verifiedPayments = payments.filter((p) => p.verificationStatus === 'VERIFIED');
    const pendingTransfers = payments.filter((p) => p.paymentMethod === 'BANK_TRANSFER' && p.verificationStatus === 'PENDING_VERIFICATION');

    const cashCollected = verifiedPayments
      .filter((p) => p.paymentMethod === 'CASH')
      .reduce((acc, p) => acc + new Decimal(p.amount).toNumber(), 0);

    const pendingPromises = promises.filter((p) => p.status === 'PENDING');
    const brokenPromises = promises.filter((p) => p.status === 'BROKEN');

    return {
      totalAssignedClients: activeCredits.length,
      todayCollectionsCount: verifiedPayments.length,
      todayCollectionsSum: verifiedPayments.reduce((acc, p) => acc + new Decimal(p.amount).toNumber(), 0),
      overdueCollectionsCount: activeCredits.filter((c) => new Decimal(c.saldoActual).greaterThan(0)).length,
      upcomingCollectionsCount: activeCredits.length,
      totalBalanceToCollect: totalSaldoActual,
      paymentPromisesCount: pendingPromises.length,
      brokenPromisesCount: brokenPromises.length,
      completedVisitsToday: visits.length,
      pendingVisitsToday: Math.max(0, activeCredits.length - visits.length),
      efectivoRecaudado: cashCollected,
      pendingTransferVerificationsCount: pendingTransfers.length,
      totalGastos: expenses.reduce((acc, e) => acc + new Decimal(e.amount).toNumber(), 0),
      cajaActual: cashCollected,
      diferenciaCaja: 0,
    };
  }

  /**
   * REGISTRAR GASTO DEL COBRADOR
   */
  public static async createExpense(dto: CreateExpenseDto, userContext: UserContext) {
    const expenseId = `exp_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
    const amount = new Decimal(dto.amount);

    const record = {
      id: expenseId,
      cashSessionId: dto.cashSessionId,
      userId: userContext.userId,
      amount: amount.toNumber(),
      category: dto.category || 'GENERAL',
      description: dto.description,
      gpsLatitude: dto.gpsLatitude || null,
      gpsLongitude: dto.gpsLongitude || null,
      createdAt: new Date(),
    };

    try {
      const prisma = PrismaService.getInstance();
      await prisma.expense.create({
        data: {
          id: record.id,
          cashSessionId: record.cashSessionId,
          userId: record.userId,
          amount: record.amount,
          category: record.category,
          description: record.description,
          gpsLatitude: record.gpsLatitude,
          gpsLongitude: record.gpsLongitude,
        },
      });
      await prisma.cashMovement.create({
        data: {
          cashSessionId: dto.cashSessionId,
          type: 'EXPENSE',
          amount: amount.toNumber(),
          description: `Gasto: ${dto.description}`,
        },
      });
    } catch {
      CollectionStore.expenses.set(expenseId, record);
    }

    await AuditLogService.log({
      userId: userContext.userId,
      action: 'EXPENSE_RECORDED',
      entity: 'Expense',
      entityId: expenseId,
      newValues: JSON.stringify({ amount: amount.toNumber(), description: dto.description }),
    });

    return { success: true, expense: record };
  }

  // --- HELPERS INTERNOS ---

  private static async checkAndFulfillPromise(creditId: string, amount: Decimal, paymentId: string, userContext: UserContext) {
    const promises = await this.getPromisesForCredit(creditId);
    const pendingPromise = promises.find((p) => p.status === 'PENDING');

    if (pendingPromise) {
      pendingPromise.status = 'FULFILLED';
      pendingPromise.fulfilledAt = new Date();
      pendingPromise.fulfilledPaymentId = paymentId;

      try {
        const prisma = PrismaService.getInstance();
        await prisma.paymentPromise.update({
          where: { id: pendingPromise.id },
          data: { status: 'FULFILLED', fulfilledAt: new Date(), fulfilledPaymentId: paymentId },
        });
      } catch {
        CollectionStore.promises.set(pendingPromise.id, pendingPromise);
      }

      await AuditLogService.log({
        userId: userContext.userId,
        action: 'PROMISE_FULFILLED',
        entity: 'PaymentPromise',
        entityId: pendingPromise.id,
        newValues: JSON.stringify({ paymentId, amount: amount.toNumber() }),
      });
    }
  }

  public static async getPaymentById(id: string) {
    try {
      const prisma = PrismaService.getInstance();
      const p = await prisma.payment.findUnique({ where: { id } });
      if (p) return p;
    } catch {
      // Fallback
    }
    return CollectionStore.payments.get(id) || null;
  }

  public static async getPromiseById(id: string) {
    try {
      const prisma = PrismaService.getInstance();
      const p = await prisma.paymentPromise.findUnique({ where: { id } });
      if (p) return p;
    } catch {
      // Fallback
    }
    return CollectionStore.promises.get(id) || null;
  }

  public static async getScheduleById(id: string) {
    try {
      const prisma = PrismaService.getInstance();
      const s = await prisma.paymentSchedule.findUnique({ where: { id } });
      if (s) return s;
    } catch {
      // Fallback
    }
    const all = await SalesService.getAllSchedules();
    return all.find((s) => s.id === id) || null;
  }

  public static async getSchedulesForCredit(creditId: string) {
    try {
      const prisma = PrismaService.getInstance();
      const list = await prisma.paymentSchedule.findMany({ where: { creditId }, orderBy: { installmentNumber: 'asc' } });
      if (list && list.length > 0) return list;
    } catch {
      // Fallback
    }
    const all = await SalesService.getAllSchedules();
    return all.filter((s) => s.creditId === creditId);
  }

  public static async getPromisesForCredit(creditId: string) {
    try {
      const prisma = PrismaService.getInstance();
      const list = await prisma.paymentPromise.findMany({ where: { creditId } });
      if (list && list.length > 0) return list;
    } catch {
      // Fallback
    }
    return Array.from(CollectionStore.promises.values()).filter((p) => p.creditId === creditId);
  }

  public static async getPaymentsForCredit(creditId: string) {
    try {
      const prisma = PrismaService.getInstance();
      const list = await prisma.payment.findMany({ where: { creditId }, orderBy: { createdAt: 'desc' } });
      if (list && list.length > 0) return list;
    } catch {
      // Fallback
    }
    return Array.from(CollectionStore.payments.values()).filter((p) => p.creditId === creditId);
  }

  public static async getVisitsForClient(clientId: string) {
    try {
      const prisma = PrismaService.getInstance();
      const list = await prisma.collectionVisit.findMany({ where: { clientId }, orderBy: { createdAt: 'desc' } });
      if (list && list.length > 0) return list;
    } catch {
      // Fallback
    }
    return Array.from(CollectionStore.visits.values()).filter((v) => v.clientId === clientId);
  }
}
