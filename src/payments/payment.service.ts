import Decimal from 'decimal.js';
import { PrismaService } from '@/src/database/prisma.service';
import { FinancialRulesService } from '@/src/financial/financial-rules.service';

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
  paymentType?: 'REGULAR' | 'DOWN_PAYMENT';
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
    const paymentType = dto.paymentType || 'REGULAR';
    if (paymentType === 'DOWN_PAYMENT') {
      const [existingDownPayment,salePaymentCount] = await Promise.all([
        this.prisma.saleDownPayment.findUnique({ where: { saleId: credit.saleId } }),
        this.prisma.payment.count({where:{credit:{saleId:credit.saleId}}}),
      ]);
      if (salePaymentCount > 0) throw new Error('El enganche sólo puede registrarse como el primer cobro de la venta.');
      if (existingDownPayment) throw new Error('Esta venta ya tiene un enganche registrado.');
    }
    const companyContribution = paymentType === 'DOWN_PAYMENT'
      ? FinancialRulesService.calcularAporteEmpresa(amount)
      : new Decimal(0);
    const totalBalanceReduction = amount.plus(companyContribution);
    if (totalBalanceReduction.gt(currentBalance)) {
      throw new Error(`El descuento total no puede ser mayor al saldo actual ($${currentBalance.toFixed(2)}).`);
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
          paymentType,
          verifiedBy: dto.collectorId,
          verifiedAt: new Date(),
        },
      });

      const newBalance = currentBalance.minus(totalBalanceReduction);
      await tx.credit.update({
        where: { id: dto.creditId },
        data: {
          saldoActual: newBalance,
          status: newBalance.eq(0) ? 'SETTLED' : 'ACTIVE',
          engancheCliente: paymentType === 'DOWN_PAYMENT' ? new Decimal(credit.engancheCliente).plus(amount) : credit.engancheCliente,
          aporteEmpresa: paymentType === 'DOWN_PAYMENT' ? new Decimal(credit.aporteEmpresa).plus(companyContribution) : credit.aporteEmpresa,
          updatedAt: new Date(),
        },
      });

      if (paymentType === 'DOWN_PAYMENT') {
        await tx.saleDownPayment.create({data:{saleId:credit.saleId,amount,paymentMethod:dto.paymentMethod||'CASH',status:'COMPLETED',paymentId:payment.id,createdBy:dto.collectorId}});
        await tx.companyContribution.create({data:{saleId:credit.saleId,amount:companyContribution,rule:'MATCH_DOWN_PAYMENT_UP_TO_200',percentageOrRatio:companyContribution.div(amount),createdBy:dto.collectorId}});
        const saleCredits=await tx.credit.findMany({where:{saleId:credit.saleId}});
        const financed=saleCredits.reduce((sum,item)=>sum.plus(new Decimal(item.id===credit.id?newBalance:item.saldoActual)),new Decimal(0));
        await tx.sale.update({where:{id:credit.saleId},data:{totalDiscount:{increment:totalBalanceReduction},totalFinanced:financed,totalAmount:financed}});
      }

      const paidBefore = credit.payments.reduce((sum, p) => sum.plus(new Decimal(p.amount)), new Decimal(0));
      let remainingToAllocate = paymentType === 'DOWN_PAYMENT' ? new Decimal(0) : paidBefore.plus(amount);
      const pendingCount=credit.schedules.filter(schedule=>!['COMPLETED','CANCELLED'].includes(schedule.status)).length;
      let pendingIndex=0,pendingAllocated=new Decimal(0);
      for (const schedule of credit.schedules) {
        if(paymentType==='DOWN_PAYMENT'&&!['COMPLETED','CANCELLED'].includes(schedule.status)){
          pendingIndex++;
          const suggested=pendingIndex===pendingCount?newBalance.minus(pendingAllocated):newBalance.div(pendingCount).floor().toDecimalPlaces(2);
          pendingAllocated=pendingAllocated.plus(suggested);
          await tx.paymentSchedule.update({where:{id:schedule.id},data:{suggestedAmount:suggested,status:'PENDING',updatedAt:new Date()}});
          continue;
        }
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
            type: paymentType === 'DOWN_PAYMENT' ? 'DOWN_PAYMENT' : 'PAYMENT',
            amount,
            reference: dto.creditId,
            description: paymentType === 'DOWN_PAYMENT' ? `Enganche de venta ${credit.saleId}` : `Abono de crédito ${dto.creditId}`,
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

      const collectionRule = await tx.commissionRule.findFirst({
        where: {
          active: true,
          role: 'COBRADOR',
          ruleType: 'COLLECTION',
        },
        orderBy: { updatedAt: 'desc' },
      });

      if (collectionRule && paymentType !== 'DOWN_PAYMENT') {
        const commissionAmount = amount.mul(new Decimal(collectionRule.rate));
        await tx.commission.create({
          data: {
            employeeId: dto.collectorId,
            role: 'COBRADOR',
            commissionType: 'COLLECTION_COMMISSION',
            paymentId: payment.id,
            creditId: dto.creditId,
            baseAmount: amount,
            rate: collectionRule.rate,
            commissionAmount,
            status: 'CALCULATED',
            sourceEvent: 'PAYMENT_VERIFIED',
            idempotencyKey: `${dto.idempotencyKey}-commission`,
            createdBy: dto.collectorId,
          },
        });
      }

      await tx.auditLog.create({
        data: {
          userId: dto.collectorId,
          action: paymentType === 'DOWN_PAYMENT' ? 'FIRST_COLLECTION_DOWN_PAYMENT_CREATED' : 'PAYMENT_CREATED',
          entity: 'Payment',
          entityId: payment.id,
          newValues: JSON.stringify({
            creditId: dto.creditId,
            amount: amount.toString(),
            previousBalance: currentBalance.toString(),
            newBalance: newBalance.toString(),
            companyContribution: companyContribution.toString(),
            paymentType,
          }),
          idempotencyKey: dto.idempotencyKey,
        },
      });

      return payment;
    });
  }
}
