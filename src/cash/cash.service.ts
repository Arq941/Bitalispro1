import { PrismaService } from '@/src/database/prisma.service';
import Decimal from 'decimal.js';

export interface OpenCashSessionDto {
  userId: string;
  collectorId?: string;
  openingFund: number | string | Decimal;
  openingLatitude?: number;
  openingLongitude?: number;
  deviceId?: string;
  openingNotes?: string;
  openedClientAt?: string | Date;
  idempotencyKey?: string;
}

export interface AddMovementDto {
  cashSessionId: string;
  collectorId?: string;
  type: 'OPENING_FUND' | 'PAYMENT' | 'DOWN_PAYMENT' | 'EXPENSE' | 'WITHDRAWAL' | 'REFUND' | 'ADJUSTMENT' | 'OTHER_INCOME';
  amount: number | string | Decimal;
  reference?: string;
  description?: string;
  clientId?: string;
  paymentId?: string;
  clientCapturedAt?: string | Date;
  idempotencyKey?: string;
  createdBy?: string;
}

export interface CreateExpenseDto {
  cashSessionId: string;
  userId: string;
  collectorId?: string;
  amount: number | string | Decimal;
  expenseType?: string;
  category?: string;
  description: string;
  expenseDate?: string | Date;
  receiptMediaId?: string;
  gpsLatitude?: number;
  gpsLongitude?: number;
  clientCapturedAt?: string | Date;
  idempotencyKey?: string;
}

export interface CreateWithdrawalDto {
  cashSessionId: string;
  userId: string;
  amount: number | string | Decimal;
  reason: string;
  destination?: string;
  latitude?: number;
  longitude?: number;
  deviceId?: string;
  idempotencyKey?: string;
}

export interface CreateRefundDto {
  cashSessionId: string;
  userId: string;
  paymentId: string;
  refundAmount: number | string | Decimal;
  reason: string;
  authorizedBy?: string;
  idempotencyKey?: string;
}

export interface CashCountDenominations {
  bills1000?: number;
  bills500?: number;
  bills200?: number;
  bills100?: number;
  bills50?: number;
  bills20?: number;
  bills10?: number;
  bills5?: number;
  bills2?: number;
  bills1?: number;
  coins1?: number;
  coins2?: number;
  coins5?: number;
  coins10?: number;
  coins20?: number;
}

export interface CreateCashCountDto {
  cashSessionId: string;
  countedBy: string;
  denominations: CashCountDenominations;
}

export class CashService {
  private static prisma = PrismaService.getInstance();

  /**
   * Abre una nueva sesión de caja para un cobrador.
   * Regla: Solo se permite 1 sesión abierta por cobrador.
   */
  static async openCashSession(dto: OpenCashSessionDto) {
    const collectorId = dto.collectorId || dto.userId;
    const openingFundDecimal = new Decimal(dto.openingFund || 0);

    if (openingFundDecimal.isNegative()) {
      throw new Error('El fondo inicial no puede ser negativo.');
    }

    // Verificar si ya existe una sesión abierta para el cobrador
    const activeSession = await this.prisma.cashSession.findFirst({
      where: {
        userId: collectorId,
        status: { in: ['OPEN', 'OPERATING', 'COUNTING', 'PENDING_REVIEW'] },
      },
    });

    if (activeSession) {
      throw new Error('El cobrador ya tiene una sesión de caja abierta simultáneamente (OPEN + OPEN no permitido).');
    }

    // Verificar idempotencia si aplica
    if (dto.idempotencyKey) {
      const existingKey = await this.prisma.idempotencyRecord.findUnique({
        where: { idempotencyKey: dto.idempotencyKey },
      });
      if (existingKey) {
        const parsed = JSON.parse(existingKey.responseBody);
        return parsed;
      }
    }

    // Operación en transacción
    const result = await this.prisma.$transaction(async (tx) => {
      const session = await tx.cashSession.create({
        data: {
          userId: collectorId,
          collectorId: collectorId,
          openingFund: openingFundDecimal,
          currentCash: openingFundDecimal,
          expectedCash: openingFundDecimal,
          status: 'OPEN',
          openedAt: new Date(),
          openedClientAt: dto.openedClientAt ? new Date(dto.openedClientAt) : new Date(),
          openingLatitude: dto.openingLatitude ?? null,
          openingLongitude: dto.openingLongitude ?? null,
          deviceId: dto.deviceId || 'DEV-001',
          openingNotes: dto.openingNotes || 'Apertura de caja',
          openedBy: dto.userId,
        },
      });

      // Crear movimiento de apertura
      const movement = await tx.cashMovement.create({
        data: {
          cashSessionId: session.id,
          collectorId: collectorId,
          type: 'OPENING_FUND',
          amount: openingFundDecimal,
          description: 'Fondo inicial de apertura de caja',
          idempotencyKey: dto.idempotencyKey || null,
          createdBy: dto.userId,
          clientCapturedAt: dto.openedClientAt ? new Date(dto.openedClientAt) : new Date(),
          serverReceivedAt: new Date(),
        },
      });

      // Registrar Auditoría
      await tx.auditLog.create({
        data: {
          userId: dto.userId,
          action: 'CASH_SESSION_OPENED',
          entity: 'CashSession',
          entityId: session.id,
          newValues: JSON.stringify({ openingFund: openingFundDecimal.toString(), collectorId }),
          idempotencyKey: dto.idempotencyKey || null,
        },
      });

      return { session, movement };
    });

    if (dto.idempotencyKey) {
      await this.prisma.idempotencyRecord.create({
        data: {
          idempotencyKey: dto.idempotencyKey,
          endpoint: '/api/cash-sessions/open',
          statusCode: 201,
          responseBody: JSON.stringify(result),
        },
      });
    }

    return result;
  }

  /**
   * Obtiene la sesión actual activa de un cobrador
   */
  static async getCurrentSession(userId: string) {
    return this.prisma.cashSession.findFirst({
      where: {
        userId: userId,
        status: { in: ['OPEN', 'OPERATING', 'COUNTING', 'PENDING_REVIEW'] },
      },
      include: {
        movements: { orderBy: { createdAt: 'desc' } },
        expenses: { orderBy: { createdAt: 'desc' } },
        counts: { orderBy: { createdAt: 'desc' } },
        variances: { orderBy: { createdAt: 'desc' } },
        user: true,
      },
    });
  }

  /**
   * Obtiene una sesión por su ID
   */
  static async getSessionById(sessionId: string) {
    return this.prisma.cashSession.findUnique({
      where: { id: sessionId },
      include: {
        movements: { orderBy: { createdAt: 'desc' } },
        expenses: { orderBy: { createdAt: 'desc' } },
        counts: { orderBy: { createdAt: 'desc' } },
        variances: { orderBy: { createdAt: 'desc' } },
        user: true,
      },
    });
  }

  /**
   * Recalcula y actualiza el efectivo esperado de una sesión
   */
  static async recalculateExpectedCash(sessionId: string, txPrisma?: any) {
    const db = txPrisma || this.prisma;
    const session = await db.cashSession.findUnique({
      where: { id: sessionId },
      include: {
        movements: true,
        expenses: { where: { status: 'APPROVED' } },
      },
    });

    if (!session) throw new Error('Sesión de caja no encontrada.');

    let expected = new Decimal(session.openingFund);

    // Sumar/Restar según movimientos confirmados
    for (const mov of session.movements) {
      if (mov.type === 'OPENING_FUND') continue; // ya está en openingFund
      const amt = new Decimal(mov.amount);
      if (['PAYMENT', 'DOWN_PAYMENT', 'OTHER_INCOME'].includes(mov.type)) {
        expected = expected.plus(amt);
      } else if (['EXPENSE', 'WITHDRAWAL', 'REFUND'].includes(mov.type)) {
        expected = expected.minus(amt);
      } else if (mov.type === 'ADJUSTMENT') {
        expected = expected.plus(amt);
      }
    }

    await db.cashSession.update({
      where: { id: sessionId },
      data: {
        expectedCash: expected,
        currentCash: expected,
      },
    });

    return expected;
  }

  /**
   * Registra un movimiento financiero en la sesión (INMUTABLE)
   */
  static async addCashMovement(dto: AddMovementDto) {
    const session = await this.prisma.cashSession.findUnique({
      where: { id: dto.cashSessionId },
    });

    if (!session) {
      throw new Error('Sesión de caja no encontrada.');
    }

    if (session.status === 'CLOSED' || session.status === 'CANCELLED') {
      throw new Error('No se pueden agregar movimientos a una caja cerrada o cancelada.');
    }

    // Idempotencia
    if (dto.idempotencyKey) {
      const existingMov = await this.prisma.cashMovement.findUnique({
        where: { idempotencyKey: dto.idempotencyKey },
      });
      if (existingMov) return existingMov;
    }

    const amountDecimal = new Decimal(dto.amount);

    const movement = await this.prisma.$transaction(async (tx) => {
      const created = await tx.cashMovement.create({
        data: {
          cashSessionId: dto.cashSessionId,
          collectorId: dto.collectorId || session.userId,
          type: dto.type,
          amount: amountDecimal,
          reference: dto.reference || null,
          description: dto.description || null,
          clientId: dto.clientId || null,
          paymentId: dto.paymentId || null,
          clientCapturedAt: dto.clientCapturedAt ? new Date(dto.clientCapturedAt) : new Date(),
          serverReceivedAt: new Date(),
          idempotencyKey: dto.idempotencyKey || null,
          createdBy: dto.createdBy || session.userId,
        },
      });

      await tx.auditLog.create({
        data: {
          userId: dto.createdBy || session.userId,
          action: 'CASH_MOVEMENT_CREATED',
          entity: 'CashMovement',
          entityId: created.id,
          newValues: JSON.stringify({ type: dto.type, amount: amountDecimal.toString() }),
          idempotencyKey: dto.idempotencyKey || null,
        },
      });

      // Recalcular efectivo esperado
      let delta = new Decimal(0);
      if (['PAYMENT', 'DOWN_PAYMENT', 'OTHER_INCOME'].includes(dto.type)) {
        delta = amountDecimal;
      } else if (['EXPENSE', 'WITHDRAWAL', 'REFUND'].includes(dto.type)) {
        delta = amountDecimal.negated();
      } else if (dto.type === 'ADJUSTMENT') {
        delta = amountDecimal;
      }

      await tx.cashSession.update({
        where: { id: dto.cashSessionId },
        data: {
          expectedCash: new Decimal(session.expectedCash).plus(delta),
          currentCash: new Decimal(session.currentCash).plus(delta),
          status: session.status === 'OPEN' ? 'OPERATING' : session.status,
        },
      });

      return created;
    });

    return movement;
  }

  /**
   * Registra un gasto operativo
   */
  static async createExpense(dto: CreateExpenseDto) {
    const session = await this.prisma.cashSession.findUnique({
      where: { id: dto.cashSessionId },
    });

    if (!session || session.status === 'CLOSED') {
      throw new Error('Sesión de caja no disponible o cerrada.');
    }

    if (dto.idempotencyKey) {
      const existingExp = await this.prisma.expense.findUnique({
        where: { idempotencyKey: dto.idempotencyKey },
      });
      if (existingExp) return existingExp;
    }

    const amountDecimal = new Decimal(dto.amount);
    if (amountDecimal.lte(0)) {
      throw new Error('El monto del gasto debe ser mayor a cero.');
    }

    // Regla: Si tiene o no comprobante, entra por defecto como PENDING_REVIEW
    const expense = await this.prisma.$transaction(async (tx) => {
      const created = await tx.expense.create({
        data: {
          cashSessionId: dto.cashSessionId,
          userId: dto.userId,
          collectorId: dto.collectorId || dto.userId,
          amount: amountDecimal,
          expenseType: dto.expenseType || 'GENERAL',
          category: dto.category || 'GENERAL',
          description: dto.description,
          expenseDate: dto.expenseDate ? new Date(dto.expenseDate) : new Date(),
          receiptMediaId: dto.receiptMediaId || null,
          status: 'PENDING_REVIEW',
          gpsLatitude: dto.gpsLatitude ?? null,
          gpsLongitude: dto.gpsLongitude ?? null,
          clientCapturedAt: dto.clientCapturedAt ? new Date(dto.clientCapturedAt) : new Date(),
          serverReceivedAt: new Date(),
          idempotencyKey: dto.idempotencyKey || null,
        },
      });

      await tx.auditLog.create({
        data: {
          userId: dto.userId,
          action: 'EXPENSE_CREATED',
          entity: 'Expense',
          entityId: created.id,
          newValues: JSON.stringify({ amount: amountDecimal.toString(), description: dto.description }),
          idempotencyKey: dto.idempotencyKey || null,
        },
      });

      return created;
    });

    return expense;
  }

  /**
   * Supervisora aprueba un gasto
   */
  static async approveExpense(expenseId: string, reviewerId: string) {
    const expense = await this.prisma.expense.findUnique({
      where: { id: expenseId },
    });

    if (!expense) throw new Error('Gasto no encontrado.');
    if (expense.status === 'APPROVED') return expense;

    return this.prisma.$transaction(async (tx) => {
      const updated = await tx.expense.update({
        where: { id: expenseId },
        data: {
          status: 'APPROVED',
          reviewedBy: reviewerId,
          reviewedAt: new Date(),
        },
      });

      // Crear el CashMovement correspondiente de tipo EXPENSE
      await tx.cashMovement.create({
        data: {
          cashSessionId: expense.cashSessionId,
          collectorId: expense.collectorId || expense.userId,
          type: 'EXPENSE',
          amount: expense.amount,
          description: `Gasto Aprobado: ${expense.description}`,
          reference: expense.id,
          createdBy: reviewerId,
        },
      });

      // Actualizar saldos en sesión
      const session = await tx.cashSession.findUnique({ where: { id: expense.cashSessionId } });
      if (session) {
        await tx.cashSession.update({
          where: { id: expense.cashSessionId },
          data: {
            expectedCash: new Decimal(session.expectedCash).minus(new Decimal(expense.amount)),
            currentCash: new Decimal(session.currentCash).minus(new Decimal(expense.amount)),
          },
        });
      }

      await tx.auditLog.create({
        data: {
          userId: reviewerId,
          action: 'EXPENSE_APPROVED',
          entity: 'Expense',
          entityId: expenseId,
          newValues: JSON.stringify({ status: 'APPROVED', approvedBy: reviewerId }),
        },
      });

      return updated;
    });
  }

  /**
   * Supervisora rechaza un gasto
   */
  static async rejectExpense(expenseId: string, reviewerId: string, rejectionReason: string) {
    const expense = await this.prisma.expense.findUnique({
      where: { id: expenseId },
    });

    if (!expense) throw new Error('Gasto no encontrado.');

    const updated = await this.prisma.$transaction(async (tx) => {
      const res = await tx.expense.update({
        where: { id: expenseId },
        data: {
          status: 'REJECTED',
          reviewedBy: reviewerId,
          reviewedAt: new Date(),
          rejectionReason: rejectionReason || 'Rechazado por la supervisora',
        },
      });

      await tx.auditLog.create({
        data: {
          userId: reviewerId,
          action: 'EXPENSE_REJECTED',
          entity: 'Expense',
          entityId: expenseId,
          newValues: JSON.stringify({ status: 'REJECTED', reason: rejectionReason }),
        },
      });

      return res;
    });

    return updated;
  }

  /**
   * Registra un retiro de caja
   */
  static async createWithdrawal(dto: CreateWithdrawalDto) {
    const session = await this.prisma.cashSession.findUnique({
      where: { id: dto.cashSessionId },
    });

    if (!session || session.status === 'CLOSED') {
      throw new Error('Sesión de caja no encontrada o cerrada.');
    }

    if (dto.idempotencyKey) {
      const existingMov = await this.prisma.cashMovement.findUnique({
        where: { idempotencyKey: dto.idempotencyKey },
      });
      if (existingMov) return existingMov;
    }

    const withdrawalAmount = new Decimal(dto.amount);
    const currentCash = new Decimal(session.currentCash);

    if (withdrawalAmount.gt(currentCash)) {
      throw new Error(`Monto superior al efectivo disponible ($${currentCash.toFixed(2)}).`);
    }

    const movement = await this.prisma.$transaction(async (tx) => {
      const created = await tx.cashMovement.create({
        data: {
          cashSessionId: dto.cashSessionId,
          collectorId: dto.userId,
          type: 'WITHDRAWAL',
          amount: withdrawalAmount,
          description: dto.reason,
          reference: dto.destination || 'Retiro autorizado',
          idempotencyKey: dto.idempotencyKey || null,
          createdBy: dto.userId,
        },
      });

      await tx.cashSession.update({
        where: { id: dto.cashSessionId },
        data: {
          currentCash: currentCash.minus(withdrawalAmount),
          expectedCash: new Decimal(session.expectedCash).minus(withdrawalAmount),
        },
      });

      await tx.auditLog.create({
        data: {
          userId: dto.userId,
          action: 'WITHDRAWAL_CREATED',
          entity: 'CashMovement',
          entityId: created.id,
          newValues: JSON.stringify({ amount: withdrawalAmount.toString(), reason: dto.reason }),
          idempotencyKey: dto.idempotencyKey || null,
        },
      });

      return created;
    });

    return movement;
  }

  /**
   * Registra una devolución
   */
  static async createRefund(dto: CreateRefundDto) {
    const session = await this.prisma.cashSession.findUnique({
      where: { id: dto.cashSessionId },
    });

    if (!session || session.status === 'CLOSED') {
      throw new Error('Sesión de caja no disponible o cerrada.');
    }

    if (dto.idempotencyKey) {
      const existingMov = await this.prisma.cashMovement.findUnique({
        where: { idempotencyKey: dto.idempotencyKey },
      });
      if (existingMov) return existingMov;
    }

    const refundAmt = new Decimal(dto.refundAmount);

    const movement = await this.prisma.$transaction(async (tx) => {
      const created = await tx.cashMovement.create({
        data: {
          cashSessionId: dto.cashSessionId,
          collectorId: dto.userId,
          paymentId: dto.paymentId,
          type: 'REFUND',
          amount: refundAmt,
          description: dto.reason,
          reference: dto.authorizedBy ? `Autorizado por ${dto.authorizedBy}` : 'Devolución de pago',
          idempotencyKey: dto.idempotencyKey || null,
          createdBy: dto.userId,
        },
      });

      await tx.cashSession.update({
        where: { id: dto.cashSessionId },
        data: {
          currentCash: new Decimal(session.currentCash).minus(refundAmt),
          expectedCash: new Decimal(session.expectedCash).minus(refundAmt),
        },
      });

      await tx.auditLog.create({
        data: {
          userId: dto.userId,
          action: 'REFUND_CREATED',
          entity: 'CashMovement',
          entityId: created.id,
          newValues: JSON.stringify({ paymentId: dto.paymentId, amount: refundAmt.toString(), reason: dto.reason }),
          idempotencyKey: dto.idempotencyKey || null,
        },
      });

      return created;
    });

    return movement;
  }

  /**
   * Arqueo físico por denominaciones
   */
  static async createCashCount(dto: CreateCashCountDto) {
    const session = await this.prisma.cashSession.findUnique({
      where: { id: dto.cashSessionId },
      include: {
        movements: true,
        expenses: { where: { status: 'APPROVED' } },
      },
    });

    if (!session) throw new Error('Sesión de caja no encontrada.');

    const d = dto.denominations || {};
    const b1000 = new Decimal(d.bills1000 || 0).mul(1000);
    const b500 = new Decimal(d.bills500 || 0).mul(500);
    const b200 = new Decimal(d.bills200 || 0).mul(200);
    const b100 = new Decimal(d.bills100 || 0).mul(100);
    const b50 = new Decimal(d.bills50 || 0).mul(50);
    const b20 = new Decimal(d.bills20 || 0).mul(20);
    const b10 = new Decimal(d.bills10 || 0).mul(10);
    const b5 = new Decimal(d.bills5 || 0).mul(5);
    const b2 = new Decimal(d.bills2 || 0).mul(2);
    const b1 = new Decimal(d.bills1 || 0).mul(1);

    const c1 = new Decimal(d.coins1 || 0).mul(1);
    const c2 = new Decimal(d.coins2 || 0).mul(2);
    const c5 = new Decimal(d.coins5 || 0).mul(5);
    const c10 = new Decimal(d.coins10 || 0).mul(10);
    const c20 = new Decimal(d.coins20 || 0).mul(20);

    const totalCounted = b1000.add(b500).add(b200).add(b100).add(b50).add(b20).add(b10).add(b5).add(b2).add(b1)
      .add(c1).add(c2).add(c5).add(c10).add(c20);

    const expectedCash = new Decimal(session.expectedCash);
    const varianceAmount = totalCounted.minus(expectedCash);

    let varianceType = 'NONE';
    if (varianceAmount.lt(0)) varianceType = 'SHORTAGE'; // Faltante
    else if (varianceAmount.gt(0)) varianceType = 'SURPLUS'; // Sobrante

    const result = await this.prisma.$transaction(async (tx) => {
      const countRecord = await tx.cashCount.create({
        data: {
          cashSessionId: dto.cashSessionId,
          countedBy: dto.countedBy,
          bills1000: d.bills1000 || 0,
          bills500: d.bills500 || 0,
          bills200: d.bills200 || 0,
          bills100: d.bills100 || 0,
          bills50: d.bills50 || 0,
          bills20: d.bills20 || 0,
          bills10: d.bills10 || 0,
          bills5: d.bills5 || 0,
          bills2: d.bills2 || 0,
          bills1: d.bills1 || 0,
          coins1: d.coins1 || 0,
          coins2: d.coins2 || 0,
          coins5: d.coins5 || 0,
          coins10: d.coins10 || 0,
          coins20: d.coins20 || 0,
          totalCounted: totalCounted,
        },
      });

      // Actualizar sesión con conteo y diferencia
      const updatedSession = await tx.cashSession.update({
        where: { id: dto.cashSessionId },
        data: {
          countedCash: totalCounted,
          varianceAmount: varianceAmount,
          status: 'COUNTING',
        },
      });

      await tx.auditLog.create({
        data: {
          userId: dto.countedBy,
          action: 'CASH_COUNT_CREATED',
          entity: 'CashCount',
          entityId: countRecord.id,
          newValues: JSON.stringify({
            totalCounted: totalCounted.toString(),
            expectedCash: expectedCash.toString(),
            varianceAmount: varianceAmount.toString(),
            varianceType,
          }),
        },
      });

      return { countRecord, updatedSession, totalCounted, expectedCash, varianceAmount, varianceType };
    });

    return result;
  }

  /**
   * Cierre de caja
   */
  static async closeCashSession(sessionId: string, dto: {
    closedBy: string;
    closingNotes?: string;
    latitude?: number;
    longitude?: number;
    closedClientAt?: string | Date;
  }) {
    const session = await this.prisma.cashSession.findUnique({
      where: { id: sessionId },
      include: {
        variances: { orderBy: { createdAt: 'desc' } },
      },
    });

    if (!session) throw new Error('Sesión de caja no encontrada.');
    if (session.status === 'CLOSED') {
      return session; // ya cerrada
    }

    const expectedCash = new Decimal(session.expectedCash);
    const countedCash = session.countedCash ? new Decimal(session.countedCash) : expectedCash;
    const varianceAmount = countedCash.minus(expectedCash);

    return this.prisma.$transaction(async (tx) => {
      // Si existe diferencia (varianceAmount != 0) y no hay variancia aprobada
      if (!varianceAmount.isZero()) {
        const approvedVariance = session.variances.find((v) => v.status === 'APPROVED');

        if (!approvedVariance) {
          // Crear CashVariance si no existe
          const varianceRecord = await tx.cashVariance.create({
            data: {
              cashSessionId: sessionId,
              expectedAmount: expectedCash,
              countedAmount: countedCash,
              varianceAmount: varianceAmount,
              varianceType: varianceAmount.lt(0) ? 'SHORTAGE' : 'SURPLUS',
              reason: dto.closingNotes || 'Diferencia detectada al cierre',
              status: 'PENDING_REVIEW',
            },
          });

          // Poner sesión en PENDING_REVIEW
          const updated = await tx.cashSession.update({
            where: { id: sessionId },
            data: {
              status: 'PENDING_REVIEW',
              closingNotes: dto.closingNotes || null,
              closingLatitude: dto.latitude ?? null,
              closingLongitude: dto.longitude ?? null,
              closedBy: dto.closedBy,
            },
          });

          await tx.auditLog.create({
            data: {
              userId: dto.closedBy,
              action: 'CASH_VARIANCE_CREATED',
              entity: 'CashVariance',
              entityId: varianceRecord.id,
              newValues: JSON.stringify({ varianceAmount: varianceAmount.toString() }),
            },
          });

          return { session: updated, status: 'PENDING_REVIEW', varianceRecord };
        }
      }

      // Si diferencia == 0 o variancia aprobada => Cerrar definitivamente
      const closedSession = await tx.cashSession.update({
        where: { id: sessionId },
        data: {
          status: 'CLOSED',
          closedAt: new Date(),
          closedClientAt: dto.closedClientAt ? new Date(dto.closedClientAt) : new Date(),
          closingNotes: dto.closingNotes || null,
          closingLatitude: dto.latitude ?? null,
          closingLongitude: dto.longitude ?? null,
          closedBy: dto.closedBy,
        },
      });

      await tx.auditLog.create({
        data: {
          userId: dto.closedBy,
          action: 'CASH_SESSION_CLOSED',
          entity: 'CashSession',
          entityId: sessionId,
          newValues: JSON.stringify({ closedAt: new Date(), finalCash: countedCash.toString() }),
        },
      });

      return { session: closedSession, status: 'CLOSED' };
    });
  }

  /**
   * Supervisora / Admin aprueba diferencia de caja
   */
  static async approveCashVariance(varianceId: string, reviewerId: string, justification?: string) {
    const variance = await this.prisma.cashVariance.findUnique({
      where: { id: varianceId },
      include: { cashSession: true },
    });

    if (!variance) throw new Error('Diferencia de caja no encontrada.');

    return this.prisma.$transaction(async (tx) => {
      const updatedVariance = await tx.cashVariance.update({
        where: { id: varianceId },
        data: {
          status: 'APPROVED',
          reviewedBy: reviewerId,
          reviewedAt: new Date(),
          justification: justification || 'Aprobada por la supervisora',
        },
      });

      // Cerrar la sesión de caja asociada
      const updatedSession = await tx.cashSession.update({
        where: { id: variance.cashSessionId },
        data: {
          status: 'CLOSED',
          closedAt: new Date(),
          closedBy: reviewerId,
        },
      });

      await tx.auditLog.create({
        data: {
          userId: reviewerId,
          action: 'CASH_VARIANCE_APPROVED',
          entity: 'CashVariance',
          entityId: varianceId,
          newValues: JSON.stringify({ status: 'APPROVED', reviewerId, justification }),
        },
      });

      return { variance: updatedVariance, session: updatedSession };
    });
  }

  /**
   * Supervisora / Admin rechaza diferencia de caja
   */
  static async rejectCashVariance(varianceId: string, reviewerId: string, reason?: string) {
    const variance = await this.prisma.cashVariance.findUnique({
      where: { id: varianceId },
    });

    if (!variance) throw new Error('Diferencia de caja no encontrada.');

    return this.prisma.$transaction(async (tx) => {
      const updatedVariance = await tx.cashVariance.update({
        where: { id: varianceId },
        data: {
          status: 'REJECTED',
          reviewedBy: reviewerId,
          reviewedAt: new Date(),
          reason: reason || 'Rechazada por supervisión',
        },
      });

      await tx.auditLog.create({
        data: {
          userId: reviewerId,
          action: 'CASH_VARIANCE_REJECTED',
          entity: 'CashVariance',
          entityId: varianceId,
          newValues: JSON.stringify({ status: 'REJECTED', reviewerId, reason }),
        },
      });

      return updatedVariance;
    });
  }

  /**
   * Crear un ajuste autorizado para cajas cerradas
   */
  static async createAdjustment(dto: {
    cashSessionId: string;
    originalMovementId?: string;
    amount: number | string | Decimal;
    reason: string;
    authorizedBy: string;
    idempotencyKey?: string;
  }) {
    if (dto.idempotencyKey) {
      const existingKey = await this.prisma.idempotencyRecord.findUnique({
        where: { idempotencyKey: dto.idempotencyKey },
      });
      if (existingKey) return JSON.parse(existingKey.responseBody);
    }

    const adjustmentAmt = new Decimal(dto.amount);

    const result = await this.prisma.$transaction(async (tx) => {
      const created = await tx.cashMovement.create({
        data: {
          cashSessionId: dto.cashSessionId,
          type: 'ADJUSTMENT',
          amount: adjustmentAmt,
          description: `Ajuste Autorizado: ${dto.reason}`,
          reference: dto.originalMovementId ? `Original Mov: ${dto.originalMovementId}` : `Autorizado por ${dto.authorizedBy}`,
          idempotencyKey: dto.idempotencyKey || null,
          createdBy: dto.authorizedBy,
        },
      });

      await tx.auditLog.create({
        data: {
          userId: dto.authorizedBy,
          action: 'CASH_ADJUSTMENT_CREATED',
          entity: 'CashMovement',
          entityId: created.id,
          newValues: JSON.stringify({ amount: adjustmentAmt.toString(), reason: dto.reason }),
          idempotencyKey: dto.idempotencyKey || null,
        },
      });

      return created;
    });

    if (dto.idempotencyKey) {
      await this.prisma.idempotencyRecord.create({
        data: {
          idempotencyKey: dto.idempotencyKey,
          endpoint: '/api/cash/adjustments',
          statusCode: 201,
          responseBody: JSON.stringify(result),
        },
      });
    }

    return result;
  }

  /**
   * Conciliación detallada de caja
   */
  static async getReconciliation(sessionId: string) {
    const session = await this.prisma.cashSession.findUnique({
      where: { id: sessionId },
      include: {
        movements: true,
        expenses: true,
        counts: true,
        variances: true,
        payments: true,
        user: true,
      },
    });

    if (!session) throw new Error('Sesión de caja no encontrada.');

    let cashPayments = new Decimal(0);
    let downPayments = new Decimal(0);
    let otherIncome = new Decimal(0);
    let expensesTotal = new Decimal(0);
    let withdrawalsTotal = new Decimal(0);
    let refundsTotal = new Decimal(0);
    let adjustmentsTotal = new Decimal(0);
    let pendingTransfers = new Decimal(0);

    for (const m of session.movements) {
      const amt = new Decimal(m.amount);
      if (m.type === 'PAYMENT') cashPayments = cashPayments.plus(amt);
      else if (m.type === 'DOWN_PAYMENT') downPayments = downPayments.plus(amt);
      else if (m.type === 'OTHER_INCOME') otherIncome = otherIncome.plus(amt);
      else if (m.type === 'EXPENSE') expensesTotal = expensesTotal.plus(amt);
      else if (m.type === 'WITHDRAWAL') withdrawalsTotal = withdrawalsTotal.plus(amt);
      else if (m.type === 'REFUND') refundsTotal = refundsTotal.plus(amt);
      else if (m.type === 'ADJUSTMENT') adjustmentsTotal = adjustmentsTotal.plus(amt);
    }

    // Pagos por transferencia bancaria (no entran al efectivo físico)
    for (const p of session.payments) {
      if (p.paymentMethod === 'BANK_TRANSFER') {
        pendingTransfers = pendingTransfers.plus(new Decimal(p.amount));
      }
    }

    const openingFund = new Decimal(session.openingFund);
    const expectedCash = openingFund
      .plus(cashPayments)
      .plus(downPayments)
      .plus(otherIncome)
      .minus(expensesTotal)
      .minus(withdrawalsTotal)
      .minus(refundsTotal)
      .plus(adjustmentsTotal);

    const countedCash = session.countedCash ? new Decimal(session.countedCash) : null;
    const varianceAmount = countedCash ? countedCash.minus(expectedCash) : new Decimal(0);

    return {
      session,
      openingFund,
      cashPayments,
      downPayments,
      otherIncome,
      expensesTotal,
      withdrawalsTotal,
      refundsTotal,
      adjustmentsTotal,
      pendingTransfers,
      expectedCash,
      countedCash,
      varianceAmount,
      varianceType: varianceAmount.lt(0) ? 'SHORTAGE' : varianceAmount.gt(0) ? 'SURPLUS' : 'NONE',
    };
  }

  /**
   * Dashboard para la supervisora
   */
  static async getSupervisorDashboard() {
    const openSessions = await this.prisma.cashSession.findMany({
      where: { status: { in: ['OPEN', 'OPERATING', 'COUNTING', 'PENDING_REVIEW'] } },
      include: {
        user: true,
        expenses: { where: { status: 'PENDING_REVIEW' } },
        variances: { where: { status: 'PENDING_REVIEW' } },
      },
    });

    const closedToday = await this.prisma.cashSession.findMany({
      where: {
        status: 'CLOSED',
        closedAt: { gte: new Date(new Date().setHours(0, 0, 0, 0)) },
      },
      include: { user: true },
    });

    const pendingExpenses = await this.prisma.expense.findMany({
      where: { status: 'PENDING_REVIEW' },
      include: { cashSession: { include: { user: true } } },
    });

    const pendingVariances = await this.prisma.cashVariance.findMany({
      where: { status: 'PENDING_REVIEW' },
      include: { cashSession: { include: { user: true } } },
    });

    let totalExpectedCash = new Decimal(0);
    let totalCountedCash = new Decimal(0);
    let totalShortage = new Decimal(0);
    let totalSurplus = new Decimal(0);

    for (const s of openSessions) {
      totalExpectedCash = totalExpectedCash.plus(new Decimal(s.expectedCash));
      if (s.countedCash) totalCountedCash = totalCountedCash.plus(new Decimal(s.countedCash));
      if (s.varianceAmount) {
        const v = new Decimal(s.varianceAmount);
        if (v.lt(0)) totalShortage = totalShortage.plus(v.abs());
        else if (v.gt(0)) totalSurplus = totalSurplus.plus(v);
      }
    }

    const trafficLight = pendingVariances.length > 0 || pendingExpenses.length > 0
      ? (pendingVariances.length > 2 ? 'CRITICAL' : 'REVIEW')
      : 'OK';

    return {
      openSessionsCount: openSessions.length,
      closedTodayCount: closedToday.length,
      totalExpectedCash,
      totalCountedCash,
      totalShortage,
      totalSurplus,
      pendingExpenses,
      pendingVariances,
      trafficLight,
      openSessions,
    };
  }
}
