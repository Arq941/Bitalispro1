import Decimal from 'decimal.js';
import { PrismaService } from '@/src/database/prisma.service';

export interface RegisterPaymentDto {
  creditId: string;
  collectorId: string;
  amount: number | string | Decimal;
  paymentMethod?: 'CASH' | 'BANK_TRANSFER';
  cashSessionId?: string;
  clientCapturedAt?: string | Date;
  gpsLatitude?: number;
  gpsLongitude?: number;
  notes?: string;
  idempotencyKey: string;
}

export class PaymentService {
  private static prisma = PrismaService.getInstance();

  static async registerPayment(dto: RegisterPaymentDto) {
    const amount = new Decimal(dto.amount);
    if (amount.lte(0)) throw new Error('El abono debe ser mayor a cero.');
    if (!dto.idempotencyKey) throw new Error('idempotencyKey es requerido.');

    const existing = await this.prisma.payment.findUnique({
      where: { idempotencyKey: dto.idempotencyKey },
    });
    if (existing) return existing;

    const credit = await this.prisma.credit.findUnique({
      where: { id: dto.creditId },
      include: {
        schedules: { orderBy: { installmentNumber: 'asc' } },
        payments: { orderBy: { createdAt: 'asc' } },
      },
    });

    if (!credit) throw new Error('Crédito no encontrado.');
    if (credit.status !== 'ACTIVE') throw new Error('El crédito no está activo.');

    const currentBalance = new Decimal(credit.saldoActual);
    if (amount.gt(currentBalance)) {
      throw new Error(`El abono no puede ser mayor al saldo actual ($${currentBalance.toFixed(2)}).`);
    }

    if (dto.cashSessionId) {
      const session = await this.prisma.cashSession.findUnique({ where: { id: dto.cashSessionId } });
      if (!session) throw new Error('Sesión de caja no encontrada.');
      if (['CLOSED', 'CANCELLED'].includes(session.status)) {
        throw new Error('La sesión de caja está cerrada o cancelada.');
      }
    }

    return this.prisma.$transaction(async (tx) => {
      const payment = await tx.payment.create({
        data: {
          creditId: dto.creditId,
          collectorId: dto.collectorId,
          cashSessionId: dto.cashSessionId || null,
          amount,
          paymentMethod: dto.paymentMethod || 'CASH',
          verificationStatus: 'VERIFIED',
          idempotencyKey: dto.idempotencyKey,
          clientCapturedAt: dto.clientCapturedAt ? new Date(dto.clientCapturedAt) : new Date(),
          serverReceivedAt: new Date(),
          gpsLatitude: dto.gpsLatitude ?? null,
          gpsLongitude: dto.gpsLongitude ?? null,
          notes: dto.notes || null,
          paymentType: 'REGULAR',
          verifiedBy: dto.collectorId,
          verifiedAt: new Date(),
        },
      });

      const newBalance = currentBalance.minus(amount);
      await tx.credit.update({
        where: { id: dto.creditId },
        data: {
          saldoActual: newBalance,
          status: newBalance.eq(0) ? 'SETTLED' : 'ACTIVE',
          updatedAt: new Date(),
        },
      });

      const paidBefore = credit.payments.reduce((sum, p) => sum.plus(new Decimal(p.amount)), new Decimal(0));
      let remainingToAllocate = paidBefore.plus(amount);
      for (const schedule of credit.schedules) {
        const scheduled = new Decimal(schedule.suggestedAmount);
        let status: 'PENDING' | 'PARTIAL' | 'COMPLETED' = 'PENDING';
        if (remainingToAllocate.gte(scheduled)) {
          status = 'COMPLETED';
          remainingToAllocate = remainingToAllocate.minus(scheduled);
        } else if (remainingToAllocate.gt(0)) {
          status = 'PARTIAL';
          remainingToAllocate = new Decimal(0);
        }
        if (schedule.status !== status) {
          await tx.paymentSchedule.update({
            where: { id: schedule.id },
            data: { status, updatedAt: new Date() },
          });
        }
      }

      if (dto.cashSessionId && (dto.paymentMethod || 'CASH') === 'CASH') {
        const session = await tx.cashSession.findUnique({ where: { id: dto.cashSessionId } });
        if (!session) throw new Error('Sesión de caja no encontrada durante el registro.');

        await tx.cashMovement.create({
          data: {
            cashSessionId: dto.cashSessionId,
            collectorId: dto.collectorId,
            paymentId: payment.id,
            type: 'PAYMENT',
            amount,
            reference: dto.creditId,
            description: `Abono de crédito ${dto.creditId}`,
            clientCapturedAt: dto.clientCapturedAt ? new Date(dto.clientCapturedAt) : new Date(),
            serverReceivedAt: new Date(),
            idempotencyKey: `${dto.idempotencyKey}-cash`,
            createdBy: dto.collectorId,
          },
        });

        await tx.cashSession.update({
          where: { id: dto.cashSessionId },
          data: {
            expectedCash: new Decimal(session.expectedCash).plus(amount),
            currentCash: new Decimal(session.currentCash).plus(amount),
            status: session.status === 'OPEN' ? 'OPERATING' : session.status,
            updatedAt: new Date(),
          },
        });
      }

      await tx.auditLog.create({
        data: {
          userId: dto.collectorId,
          action: 'PAYMENT_CREATED',
          entity: 'Payment',
          entityId: payment.id,
          newValues: JSON.stringify({
            creditId: dto.creditId,
            amount: amount.toString(),
            previousBalance: currentBalance.toString(),
            newBalance: newBalance.toString(),
          }),
          idempotencyKey: dto.idempotencyKey,
        },
      });

      return payment;
    });
  }
}
