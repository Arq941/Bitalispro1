import { prisma } from '@/src/database/prisma.service';
import Decimal from 'decimal.js';
import crypto from 'crypto';

export interface SyncOperationPayload {
  idempotencyKey: string;
  operationType: 'PAYMENT' | 'DOWN_PAYMENT' | 'VISIT' | 'NON_PAYMENT_REASON' | 'RESCHEDULE' | 'PAYMENT_PROMISE' | 'EXPENSE' | 'GPS_TRACE' | 'CLIENT' | 'SALE' | 'PRICE_OVERRIDE' | 'DISCOUNT_OVERRIDE' | 'TWO_PRODUCT_SALE' | 'FORCE_CREDIT' | 'CASH_ADJUSTMENT';
  payload: any;
  clientCapturedAt: string | Date;
  deviceId: string;
  userId?: string;
}

export interface SyncOperationResult {
  idempotencyKey: string;
  status: 'SYNCED' | 'DUPLICATE' | 'CONFLICT' | 'REJECTED' | 'FAILED';
  originalOperation?: boolean;
  duplicate?: boolean;
  data?: any;
  errorCode?: string;
  errorMessage?: string;
  conflictCode?: string;
  serverReceivedAt: string;
}

const FORBIDDEN_OFFLINE_OPERATIONS = [
  'PRICE_OVERRIDE',
  'DISCOUNT_OVERRIDE',
  'TWO_PRODUCT_SALE',
  'FORCE_CREDIT',
  'CASH_ADJUSTMENT',
];

const OPERATION_PRIORITIES: Record<string, number> = {
  CLIENT: 1,
  VISIT: 2,
  NON_PAYMENT_REASON: 2,
  SALE: 3,
  DOWN_PAYMENT: 3,
  PAYMENT: 4,
  EXPENSE: 5,
  RESCHEDULE: 6,
  PAYMENT_PROMISE: 7,
  GPS_TRACE: 8,
};

export class OfflineSyncService {
  private static CLOCK_SKEW_THRESHOLD_MS = parseInt(process.env.CLOCK_SKEW_THRESHOLD || '43200000', 10); // 12 hrs default

  /**
   * Helper to compute SHA-256 hash of payload
   */
  public static hashPayload(payload: any): string {
    const stringified = typeof payload === 'string' ? payload : JSON.stringify(payload || {});
    return crypto.createHash('sha256').update(stringified).digest('hex');
  }

  /**
   * Process a batch of offline operations sequentially ordered by priority and client timestamp
   */
  public static async processSyncBatch(
    deviceId: string,
    authUserId: string,
    operations: SyncOperationPayload[]
  ): Promise<SyncOperationResult[]> {
    // Sort operations by priority then clientCapturedAt
    const sorted = [...operations].sort((a, b) => {
      const pA = OPERATION_PRIORITIES[a.operationType] || 99;
      const pB = OPERATION_PRIORITIES[b.operationType] || 99;
      if (pA !== pB) return pA - pB;
      return new Date(a.clientCapturedAt).getTime() - new Date(b.clientCapturedAt).getTime();
    });

    const results: SyncOperationResult[] = [];
    for (const op of sorted) {
      const res = await this.processSingleOperation(deviceId, authUserId, op);
      results.push(res);
    }
    return results;
  }

  /**
   * Process a single offline operation with dual timestamps, idempotency, clock skew check & atomic transactions
   */
  public static async processSingleOperation(
    deviceId: string,
    authUserId: string,
    op: SyncOperationPayload
  ): Promise<SyncOperationResult> {
    const serverReceivedAt = new Date();
    const clientCapturedAt = new Date(op.clientCapturedAt || Date.now());
    const idempotencyKey = op.idempotencyKey;
    const payloadHash = this.hashPayload(op.payload);
    const userId = authUserId || op.userId || 'SYSTEM_COBRADOR';

    // 1. Check if operation is forbidden offline
    if (FORBIDDEN_OFFLINE_OPERATIONS.includes(op.operationType)) {
      await prisma.syncOperation.upsert({
        where: { idempotencyKey },
        create: {
          idempotencyKey,
          deviceId,
          userId,
          operationType: op.operationType,
          clientCapturedAt,
          serverReceivedAt,
          status: 'REJECTED',
          payload: JSON.stringify(op.payload),
          payloadHash,
          errorCode: 'OPERATION_NOT_ALLOWED_OFFLINE',
          errorMessage: `La operación ${op.operationType} requiere autorización en línea.`,
        },
        update: {
          status: 'REJECTED',
          errorCode: 'OPERATION_NOT_ALLOWED_OFFLINE',
          errorMessage: `La operación ${op.operationType} requiere autorización en línea.`,
        },
      });

      await prisma.syncConflict.create({
        data: {
          idempotencyKey,
          conflictType: 'USER_NOT_AUTHORIZED',
          severity: 'HIGH',
          description: `Operación bloqueada fuera de línea: ${op.operationType}`,
          originalPayload: JSON.stringify(op.payload),
          clientCapturedAt,
        },
      });

      return {
        idempotencyKey,
        status: 'REJECTED',
        errorCode: 'OPERATION_NOT_ALLOWED_OFFLINE',
        errorMessage: `La operación ${op.operationType} requiere autorización en línea.`,
        serverReceivedAt: serverReceivedAt.toISOString(),
      };
    }

    // 2. Check Clock Skew
    const timeDiffMs = Math.abs(serverReceivedAt.getTime() - clientCapturedAt.getTime());
    if (timeDiffMs > this.CLOCK_SKEW_THRESHOLD_MS) {
      await prisma.syncOperation.upsert({
        where: { idempotencyKey },
        create: {
          idempotencyKey,
          deviceId,
          userId,
          operationType: op.operationType,
          clientCapturedAt,
          serverReceivedAt,
          status: 'CONFLICT',
          payload: JSON.stringify(op.payload),
          payloadHash,
          errorCode: 'CLOCK_SKEW',
          errorMessage: `Desfase de reloj detectado (${Math.round(timeDiffMs / 60000)} minutos).`,
          conflictCode: 'CLOCK_SKEW',
        },
        update: {
          status: 'CONFLICT',
          errorCode: 'CLOCK_SKEW',
          errorMessage: `Desfase de reloj detectado (${Math.round(timeDiffMs / 60000)} minutos).`,
          conflictCode: 'CLOCK_SKEW',
        },
      });

      const syncOp = await prisma.syncOperation.findUnique({ where: { idempotencyKey } });

      await prisma.syncConflict.create({
        data: {
          syncOperationId: syncOp?.id,
          idempotencyKey,
          conflictType: 'CLOCK_SKEW',
          severity: 'MEDIUM',
          description: `Desfase de reloj extremo: Dispositivo ${clientCapturedAt.toISOString()} vs Servidor ${serverReceivedAt.toISOString()}`,
          originalPayload: JSON.stringify(op.payload),
          clientCapturedAt,
        },
      });

      return {
        idempotencyKey,
        status: 'CONFLICT',
        conflictCode: 'CLOCK_SKEW',
        errorMessage: `Desfase de reloj detectado (${Math.round(timeDiffMs / 60000)} minutos).`,
        serverReceivedAt: serverReceivedAt.toISOString(),
      };
    }

    // 3. Idempotency & Duplicate Check
    const existingSyncOp = await prisma.syncOperation.findUnique({
      where: { idempotencyKey },
    });

    if (existingSyncOp) {
      // Check payload hash match
      if (existingSyncOp.payloadHash && existingSyncOp.payloadHash !== payloadHash) {
        // IDEMPOTENCY_KEY_PAYLOAD_MISMATCH
        await prisma.syncConflict.create({
          data: {
            syncOperationId: existingSyncOp.id,
            idempotencyKey,
            conflictType: 'PAYLOAD_MISMATCH',
            severity: 'HIGH',
            description: `Misma idempotencyKey (${idempotencyKey}) enviada con datos diferentes.`,
            originalPayload: JSON.stringify(op.payload),
            serverState: existingSyncOp.payload,
            clientCapturedAt,
          },
        });

        return {
          idempotencyKey,
          status: 'REJECTED',
          errorCode: 'IDEMPOTENCY_KEY_PAYLOAD_MISMATCH',
          errorMessage: `Clave de idempotencia ${idempotencyKey} ya fue utilizada con un contenido diferente.`,
          serverReceivedAt: serverReceivedAt.toISOString(),
        };
      }

      // If already synced, return duplicate result
      if (existingSyncOp.status === 'SYNCED') {
        let existingData = null;
        if (existingSyncOp.entityType === 'Payment' && existingSyncOp.entityId) {
          existingData = await prisma.payment.findUnique({ where: { id: existingSyncOp.entityId } });
        }
        return {
          idempotencyKey,
          status: 'DUPLICATE',
          duplicate: true,
          originalOperation: true,
          data: existingData || { message: 'Operación previamente sincronizada' },
          serverReceivedAt: existingSyncOp.serverReceivedAt.toISOString(),
        };
      }
    }

    // 4. Process operation atomically according to type
    try {
      if (op.operationType === 'PAYMENT') {
        return await this.processPaymentOperation(deviceId, userId, idempotencyKey, op.payload, clientCapturedAt, serverReceivedAt, payloadHash);
      } else if (op.operationType === 'DOWN_PAYMENT') {
        return await this.processDownPaymentOperation(deviceId, userId, idempotencyKey, op.payload, clientCapturedAt, serverReceivedAt, payloadHash);
      } else if (op.operationType === 'VISIT' || op.operationType === 'NON_PAYMENT_REASON') {
        return await this.processVisitOperation(deviceId, userId, idempotencyKey, op.payload, clientCapturedAt, serverReceivedAt, payloadHash);
      } else if (op.operationType === 'RESCHEDULE') {
        return await this.processRescheduleOperation(deviceId, userId, idempotencyKey, op.payload, clientCapturedAt, serverReceivedAt, payloadHash);
      } else if (op.operationType === 'PAYMENT_PROMISE') {
        return await this.processPromiseOperation(deviceId, userId, idempotencyKey, op.payload, clientCapturedAt, serverReceivedAt, payloadHash);
      } else if (op.operationType === 'EXPENSE') {
        return await this.processExpenseOperation(deviceId, userId, idempotencyKey, op.payload, clientCapturedAt, serverReceivedAt, payloadHash);
      } else if (op.operationType === 'GPS_TRACE') {
        return await this.processGpsTraceOperation(deviceId, userId, idempotencyKey, op.payload, clientCapturedAt, serverReceivedAt, payloadHash);
      } else {
        // Never acknowledge an operation whose domain mutation was not executed.
        await prisma.syncOperation.upsert({
          where: { idempotencyKey },
          create: {
            idempotencyKey, deviceId, userId, operationType: op.operationType,
            clientCapturedAt, serverReceivedAt, status: 'REJECTED',
            payload: JSON.stringify(op.payload), payloadHash,
            errorCode: 'OFFLINE_HANDLER_NOT_IMPLEMENTED',
            errorMessage: 'Esta operación todavía no tiene un procesador offline seguro.',
          },
          update: {
            status: 'REJECTED',
            errorCode: 'OFFLINE_HANDLER_NOT_IMPLEMENTED',
            errorMessage: 'Esta operación todavía no tiene un procesador offline seguro.',
          },
        });
        return {
          idempotencyKey,
          status: 'REJECTED',
          errorCode: 'OFFLINE_HANDLER_NOT_IMPLEMENTED',
          errorMessage: 'La operación no fue aplicada ni confirmada.',
          serverReceivedAt: serverReceivedAt.toISOString(),
        };

      }
    } catch (err: any) {
      const errorMessage = err?.message || 'Error durante la sincronización de la operación';
      await prisma.syncOperation.upsert({
        where: { idempotencyKey },
        create: {
          idempotencyKey,
          deviceId,
          userId,
          operationType: op.operationType,
          clientCapturedAt,
          serverReceivedAt,
          status: 'FAILED',
          payload: JSON.stringify(op.payload),
          payloadHash,
          errorMessage,
        },
        update: {
          status: 'FAILED',
          errorMessage,
        },
      });

      return {
        idempotencyKey,
        status: 'FAILED',
        errorCode: 'SYNC_EXECUTION_ERROR',
        errorMessage,
        serverReceivedAt: serverReceivedAt.toISOString(),
      };
    }
  }

  /**
   * Process PAYMENT offline operation atomically
   */
  private static async processPaymentOperation(
    deviceId: string,
    userId: string,
    idempotencyKey: string,
    payload: any,
    clientCapturedAt: Date,
    serverReceivedAt: Date,
    payloadHash: string
  ): Promise<SyncOperationResult> {
    const { creditId, amount, paymentMethod = 'CASH', notes, gpsLatitude, gpsLongitude } = payload;

    if (!creditId || !amount) {
      throw new Error('Crédito o monto de pago no especificado');
    }

    const payAmount = new Decimal(amount);

    return await prisma.$transaction(async (tx: any) => {
      // Check existing Payment by idempotencyKey
      const existingPayment = await tx.payment.findUnique({
        where: { idempotencyKey },
      });

      if (existingPayment) {
        return {
          idempotencyKey,
          status: 'DUPLICATE',
          duplicate: true,
          originalOperation: true,
          data: existingPayment,
          serverReceivedAt: serverReceivedAt.toISOString(),
        } as SyncOperationResult;
      }

      // Find credit
      const credit = await tx.credit.findUnique({
        where: { id: creditId },
      });

      if (!credit) {
        throw new Error(`Crédito con ID ${creditId} no encontrado`);
      }

      if (credit.status === 'SETTLED') {
        // Create conflict CREDIT_CLOSED
        const syncOp = await tx.syncOperation.create({
          data: {
            idempotencyKey,
            deviceId,
            userId,
            operationType: 'PAYMENT',
            clientCapturedAt,
            serverReceivedAt,
            status: 'CONFLICT',
            payload: JSON.stringify(payload),
            payloadHash,
            conflictCode: 'CREDIT_CLOSED',
            errorMessage: 'El crédito ya se encuentra liquidado',
          },
        });

        await tx.syncConflict.create({
          data: {
            syncOperationId: syncOp.id,
            idempotencyKey,
            conflictType: 'CREDIT_CLOSED',
            severity: 'HIGH',
            description: `Abono intentado sobre crédito liquidado (ID: ${creditId})`,
            originalPayload: JSON.stringify(payload),
            serverState: JSON.stringify(credit),
            clientCapturedAt,
          },
        });

        return {
          idempotencyKey,
          status: 'CONFLICT',
          conflictCode: 'CREDIT_CLOSED',
          errorMessage: 'El crédito ya se encuentra liquidado',
          serverReceivedAt: serverReceivedAt.toISOString(),
        } as SyncOperationResult;
      }


      // ABAC: Check collector cash session
      const cashSession = await tx.cashSession.findFirst({
        where: {
          userId,
          status: { in: ['OPEN', 'OPERATING'] },
        },
      });

      // Calculate new balance according to Financial Rule: saldoActual = saldoActual - pagoReal
      const currentSaldo = new Decimal(credit.saldoActual);
      const newSaldo = currentSaldo.minus(payAmount);
      const isSettled = newSaldo.lessThanOrEqualTo(0);
      const finalSaldo = isSettled ? new Decimal(0) : newSaldo;

      const isBankTransfer = paymentMethod === 'BANK_TRANSFER';
      const verificationStatus = isBankTransfer ? 'PENDING_VERIFICATION' : 'VERIFIED';

      // 1. Create Payment
      const payment = await tx.payment.create({
        data: {
          creditId,
          collectorId: userId,
          cashSessionId: cashSession?.id || null,
          amount: payAmount,
          paymentMethod,
          verificationStatus,
          idempotencyKey,
          clientCapturedAt,
          serverReceivedAt,
          gpsLatitude: gpsLatitude ? parseFloat(gpsLatitude) : null,
          gpsLongitude: gpsLongitude ? parseFloat(gpsLongitude) : null,
          notes: notes || 'Abono sincronizado offline',
        },
      });

      // 2. Update Credit balance directly
      await tx.credit.update({
        where: { id: creditId },
        data: {
          saldoActual: finalSaldo,
          status: isSettled ? 'SETTLED' : credit.status,
        },
      });

      // 3. Create CashMovement if CASH payment & session exists
      let cashMovement = null;
      if (!isBankTransfer && cashSession) {
        cashMovement = await tx.cashMovement.create({
          data: {
            cashSessionId: cashSession.id,
            collectorId: userId,
            paymentId: payment.id,
            type: 'PAYMENT',
            amount: payAmount,
            reference: `PAGO-OFFLINE-${idempotencyKey.slice(0, 8)}`,
            description: `Abono offline crédito ${credit.id}`,
            clientId: credit.clientId,
            clientCapturedAt,
            serverReceivedAt,
            idempotencyKey: `CM-${idempotencyKey}`,
          },
        });

        // Update currentCash in CashSession
        await tx.cashSession.update({
          where: { id: cashSession.id },
          data: {
            currentCash: { increment: payAmount },
          },
        });
      }

      // 4. Create AuditLog
      await tx.auditLog.create({
        data: {
          userId,
          action: 'OFFLINE_PAYMENT_SYNCED',
          entity: 'Payment',
          entityId: payment.id,
          idempotencyKey,
          newValues: JSON.stringify({
            paymentId: payment.id,
            amount: payAmount.toString(),
            previousSaldo: currentSaldo.toString(),
            newSaldo: finalSaldo.toString(),
            clientCapturedAt,
            serverReceivedAt,
          }),
        },
      });

      // 5. Record SyncOperation
      await tx.syncOperation.create({
        data: {
          idempotencyKey,
          deviceId,
          userId,
          operationType: 'PAYMENT',
          entityType: 'Payment',
          entityId: payment.id,
          clientCapturedAt,
          serverReceivedAt,
          status: 'SYNCED',
          payload: JSON.stringify(payload),
          payloadHash,
        },
      });

      return {
        idempotencyKey,
        status: 'SYNCED',
        data: {
          payment,
          cashMovement,
          previousSaldo: currentSaldo,
          newSaldo: finalSaldo,
        },
        serverReceivedAt: serverReceivedAt.toISOString(),
      } as SyncOperationResult;
    });
  }

  /**
   * Process DOWN_PAYMENT offline operation
   */
  private static async processDownPaymentOperation(
    deviceId: string,
    userId: string,
    idempotencyKey: string,
    payload: any,
    clientCapturedAt: Date,
    serverReceivedAt: Date,
    payloadHash: string
  ): Promise<SyncOperationResult> {
    const { saleId, amount, paymentMethod = 'CASH' } = payload;
    const dpAmount = new Decimal(amount || 0);

    return await prisma.$transaction(async (tx: any) => {
      const existingDp = await tx.saleDownPayment.findFirst({
        where: { saleId },
      });

      if (existingDp) {
        return {
          idempotencyKey,
          status: 'DUPLICATE',
          duplicate: true,
          data: existingDp,
          serverReceivedAt: serverReceivedAt.toISOString(),
        } as SyncOperationResult;
      }

      const dp = await tx.saleDownPayment.create({
        data: {
          saleId,
          amount: dpAmount,
          paymentMethod,
          status: 'COMPLETED',
          createdBy: userId,
        },
      });

      await tx.syncOperation.create({
        data: {
          idempotencyKey,
          deviceId,
          userId,
          operationType: 'DOWN_PAYMENT',
          entityType: 'SaleDownPayment',
          entityId: dp.id,
          clientCapturedAt,
          serverReceivedAt,
          status: 'SYNCED',
          payload: JSON.stringify(payload),
          payloadHash,
        },
      });

      return {
        idempotencyKey,
        status: 'SYNCED',
        data: dp,
        serverReceivedAt: serverReceivedAt.toISOString(),
      } as SyncOperationResult;
    });
  }

  /**
   * Process Collection VISIT / NON_PAYMENT_REASON offline operation
   */
  private static async processVisitOperation(
    deviceId: string,
    userId: string,
    idempotencyKey: string,
    payload: any,
    clientCapturedAt: Date,
    serverReceivedAt: Date,
    payloadHash: string
  ): Promise<SyncOperationResult> {
    const { clientId, creditId, result, visitType = 'COLLECTION', noPaymentReason, notes, gpsLatitude, gpsLongitude, accuracy } = payload;

    return await prisma.$transaction(async (tx: any) => {
      const visit = await tx.collectionVisit.create({
        data: {
          clientId,
          creditId: creditId || null,
          userId,
          visitType,
          result: result || (noPaymentReason ? 'NO_PAYMENT' : 'VISITED'),
          noPaymentReason: noPaymentReason || null,
          notes: notes || null,
          gpsLatitude: gpsLatitude ? parseFloat(gpsLatitude) : null,
          gpsLongitude: gpsLongitude ? parseFloat(gpsLongitude) : null,
          accuracy: accuracy ? parseFloat(accuracy) : null,
          idempotencyKey,
          clientCapturedAt,
          serverReceivedAt,
        },
      });

      await tx.syncOperation.create({
        data: {
          idempotencyKey,
          deviceId,
          userId,
          operationType: 'VISIT',
          entityType: 'CollectionVisit',
          entityId: visit.id,
          clientCapturedAt,
          serverReceivedAt,
          status: 'SYNCED',
          payload: JSON.stringify(payload),
          payloadHash,
        },
      });

      return {
        idempotencyKey,
        status: 'SYNCED',
        data: visit,
        serverReceivedAt: serverReceivedAt.toISOString(),
      } as SyncOperationResult;
    });
  }

  /**
   * Process RESCHEDULE offline operation
   */
  private static async processRescheduleOperation(
    deviceId: string,
    userId: string,
    idempotencyKey: string,
    payload: any,
    clientCapturedAt: Date,
    serverReceivedAt: Date,
    payloadHash: string
  ): Promise<SyncOperationResult> {
    const { creditId, paymentScheduleId, newDate, reason, notes, gpsLatitude, gpsLongitude } = payload;

    return await prisma.$transaction(async (tx: any) => {
      const schedule = await tx.paymentSchedule.findUnique({
        where: { id: paymentScheduleId },
      });

      if (!schedule) {
        throw new Error(`Cuota ${paymentScheduleId} no encontrada`);
      }

      const reschedule = await tx.paymentReschedule.create({
        data: {
          creditId,
          paymentScheduleId,
          previousDate: schedule.scheduledDate,
          newDate: new Date(newDate),
          reason: reason || 'Reprogramación en ruta',
          notes: notes || null,
          gpsLatitude: gpsLatitude ? parseFloat(gpsLatitude) : null,
          gpsLongitude: gpsLongitude ? parseFloat(gpsLongitude) : null,
          createdBy: userId,
        },
      });

      await tx.paymentSchedule.update({
        where: { id: paymentScheduleId },
        data: {
          scheduledDate: new Date(newDate),
          status: 'RESCHEDULED',
        },
      });

      await tx.syncOperation.create({
        data: {
          idempotencyKey,
          deviceId,
          userId,
          operationType: 'RESCHEDULE',
          entityType: 'PaymentReschedule',
          entityId: reschedule.id,
          clientCapturedAt,
          serverReceivedAt,
          status: 'SYNCED',
          payload: JSON.stringify(payload),
          payloadHash,
        },
      });

      return {
        idempotencyKey,
        status: 'SYNCED',
        data: reschedule,
        serverReceivedAt: serverReceivedAt.toISOString(),
      } as SyncOperationResult;
    });
  }

  /**
   * Process PAYMENT_PROMISE offline operation
   */
  private static async processPromiseOperation(
    deviceId: string,
    userId: string,
    idempotencyKey: string,
    payload: any,
    clientCapturedAt: Date,
    serverReceivedAt: Date,
    payloadHash: string
  ): Promise<SyncOperationResult> {
    const { creditId, clientId, promisedAmount, promisedDate, notes, gpsLatitude, gpsLongitude } = payload;

    return await prisma.$transaction(async (tx: any) => {
      const promise = await tx.paymentPromise.create({
        data: {
          creditId,
          clientId,
          promisedAmount: new Decimal(promisedAmount),
          promisedDate: new Date(promisedDate),
          status: 'PENDING',
          notes: notes || null,
          gpsLatitude: gpsLatitude ? parseFloat(gpsLatitude) : null,
          gpsLongitude: gpsLongitude ? parseFloat(gpsLongitude) : null,
          createdBy: userId,
        },
      });

      await tx.syncOperation.create({
        data: {
          idempotencyKey,
          deviceId,
          userId,
          operationType: 'PAYMENT_PROMISE',
          entityType: 'PaymentPromise',
          entityId: promise.id,
          clientCapturedAt,
          serverReceivedAt,
          status: 'SYNCED',
          payload: JSON.stringify(payload),
          payloadHash,
        },
      });

      return {
        idempotencyKey,
        status: 'SYNCED',
        data: promise,
        serverReceivedAt: serverReceivedAt.toISOString(),
      } as SyncOperationResult;
    });
  }

  /**
   * Process EXPENSE offline operation
   */
  private static async processExpenseOperation(
    deviceId: string,
    userId: string,
    idempotencyKey: string,
    payload: any,
    clientCapturedAt: Date,
    serverReceivedAt: Date,
    payloadHash: string
  ): Promise<SyncOperationResult> {
    const { amount, description, category = 'GENERAL', gpsLatitude, gpsLongitude } = payload;

    return await prisma.$transaction(async (tx: any) => {
      const cashSession = await tx.cashSession.findFirst({
        where: {
          userId,
          status: { in: ['OPEN', 'OPERATING'] },
        },
      });

      if (!cashSession) {
        throw new Error('No se encontró sesión de caja abierta para registrar el gasto');
      }

      const expense = await tx.expense.create({
        data: {
          cashSessionId: cashSession.id,
          userId,
          collectorId: userId,
          amount: new Decimal(amount),
          description: description || 'Gasto de ruta offline',
          category,
          status: 'PENDING_REVIEW',
          clientCapturedAt,
          serverReceivedAt,
          idempotencyKey,
          gpsLatitude: gpsLatitude ? parseFloat(gpsLatitude) : null,
          gpsLongitude: gpsLongitude ? parseFloat(gpsLongitude) : null,
        },
      });

      await tx.syncOperation.create({
        data: {
          idempotencyKey,
          deviceId,
          userId,
          operationType: 'EXPENSE',
          entityType: 'Expense',
          entityId: expense.id,
          clientCapturedAt,
          serverReceivedAt,
          status: 'SYNCED',
          payload: JSON.stringify(payload),
          payloadHash,
        },
      });

      return {
        idempotencyKey,
        status: 'SYNCED',
        data: expense,
        serverReceivedAt: serverReceivedAt.toISOString(),
      } as SyncOperationResult;
    });
  }

  /**
   * Process GPS_TRACE offline operation
   */
  private static async processGpsTraceOperation(
    deviceId: string,
    userId: string,
    idempotencyKey: string,
    payload: any,
    clientCapturedAt: Date,
    serverReceivedAt: Date,
    payloadHash: string
  ): Promise<SyncOperationResult> {
    await prisma.syncOperation.upsert({
      where: { idempotencyKey },
      create: {
        idempotencyKey,
        deviceId,
        userId,
        operationType: 'GPS_TRACE',
        clientCapturedAt,
        serverReceivedAt,
        status: 'SYNCED',
        payload: JSON.stringify(payload),
        payloadHash,
      },
      update: {
        status: 'SYNCED',
        serverReceivedAt,
      },
    });

    return {
      idempotencyKey,
      status: 'SYNCED',
      data: { gpsCaptured: true },
      serverReceivedAt: serverReceivedAt.toISOString(),
    };
  }
}
