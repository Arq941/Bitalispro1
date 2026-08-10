import Decimal from 'decimal.js';
import { PrismaService } from '@/src/database/prisma.service';

export interface CalculateSellerCommissionInput {
  saleId: string;
  employeeId?: string;
  supervisorId?: string;
  zoneId?: string;
  routeId?: string;
  idempotencyKey?: string;
  createdBy?: string;
}

export interface CalculateCollectorCommissionInput {
  paymentId: string;
  collectorId: string;
  supervisorId?: string;
  zoneId?: string;
  routeId?: string;
  idempotencyKey?: string;
  createdBy?: string;
}

export interface CreatePenaltyInput {
  employeeId: string;
  reason: string;
  amount: number | string;
  authorizedBy?: string;
  periodId?: string;
  notes?: string;
}

export interface CreateBonusRuleInput {
  name: string;
  role: string;
  productCategoryId?: string;
  percentage?: number | string;
  fixedAmount?: number | string;
  minSales?: number;
  minAmount?: number | string;
  startDate?: string | Date;
  endDate?: string | Date;
}

export interface CreateTargetInput {
  employeeId: string;
  role: string;
  period?: string;
  targetAmount: number | string;
  bonusRate?: number | string;
  bonusFixed?: number | string;
}

export class CommissionService {
  private static prisma = PrismaService.getInstance();

  /**
   * Configura o obtiene las reglas base de comisiones.
   * Si no existen en BD, retorna las reglas por defecto parametrizadas.
   */
  public static async getCommissionRules(role?: string) {
    const whereClause: any = { active: true };
    if (role) whereClause.role = role;

    const rules = await this.prisma.commissionRule.findMany({
      where: whereClause,
    });

    if (rules.length > 0) {
      return rules;
    }

    // Default rules fallback
    return [
      { role: 'VENDEDORA', ruleType: 'CASH_SALE', minDownPaymentPercentage: null, rate: new Decimal('0.0500'), active: true },
      { role: 'VENDEDORA', ruleType: 'CREDIT_HIGH_DOWN', minDownPaymentPercentage: new Decimal('10.00'), rate: new Decimal('0.0400'), active: true },
      { role: 'VENDEDORA', ruleType: 'CREDIT_LOW_DOWN', minDownPaymentPercentage: new Decimal('0.00'), rate: new Decimal('0.0200'), active: true },
      { role: 'COBRADOR', ruleType: 'COLLECTION', minDownPaymentPercentage: null, rate: new Decimal('0.0300'), active: true },
      { role: 'SUPERVISORA', ruleType: 'SUPERVISOR_SALE', minDownPaymentPercentage: null, rate: new Decimal('0.0100'), active: true },
      { role: 'SUPERVISORA', ruleType: 'SUPERVISOR_COLLECTION', minDownPaymentPercentage: null, rate: new Decimal('0.0050'), active: true },
    ];
  }

  /**
   * Crea o actualiza una regla de comisión
   */
  public static async upsertCommissionRule(input: {
    role: string;
    ruleType: string;
    rate: number | string;
    minDownPaymentPercentage?: number | string;
    description?: string;
  }) {
    const rateDec = new Decimal(input.rate);
    const minDownDec = input.minDownPaymentPercentage !== undefined && input.minDownPaymentPercentage !== null
      ? new Decimal(input.minDownPaymentPercentage)
      : null;

    const existing = await this.prisma.commissionRule.findFirst({
      where: { role: input.role, ruleType: input.ruleType, active: true },
    });

    if (existing) {
      return this.prisma.commissionRule.update({
        where: { id: existing.id },
        data: {
          rate: rateDec,
          minDownPaymentPercentage: minDownDec,
          description: input.description,
        },
      });
    }

    return this.prisma.commissionRule.create({
      data: {
        role: input.role,
        ruleType: input.ruleType,
        rate: rateDec,
        minDownPaymentPercentage: minDownDec,
        description: input.description,
        active: true,
      },
    });
  }

  /**
   * Calcula y registra la comisión de VENDEDORA sobre una Venta.
   * También genera la sobrecomisión de SUPERVISORA si corresponde.
   */
  public static async calculateSellerCommission(input: CalculateSellerCommissionInput) {
    const { saleId, idempotencyKey } = input;

    // Verificar idempotencia
    const effectiveKey = idempotencyKey || `SALE-COMMISSION-${saleId}-${input.employeeId || 'SELLER'}`;
    const existingComm = await this.prisma.commission.findUnique({
      where: { idempotencyKey: effectiveKey },
    });
    if (existingComm) {
      return existingComm;
    }

    const sale = await this.prisma.sale.findUnique({
      where: { id: saleId },
      include: {
        items: true,
        credits: true,
        downPayment: true,
      },
    });

    if (!sale) {
      throw new Error(`Venta con ID ${saleId} no encontrada`);
    }

    if (sale.status === 'CANCELLED' || (sale as any).status === 'RETURNED') {
      throw new Error(`No se puede comisionar una venta cancelada o devuelta (status: ${sale.status})`);
    }

    const sellerId = input.employeeId || sale.sellerId || (sale as any).createdBy || 'SYSTEM_SELLER';
    const creditRel = (sale as any).credits?.[0] || (sale as any).credit;
    const saleTotal = new Decimal((sale as any).totalAmount || (sale as any).total || 0);
    const isCredit = sale.saleType === 'CREDIT' || Boolean(creditRel);

    // Calcular Porcentaje de Enganche (Enganche cliente / Total venta)
    let downPaymentAmount = new Decimal((sale as any).downPayment?.amount || (sale as any).downPayment || 0);
    let downPaymentPct = new Decimal(0);
    if (saleTotal.greaterThan(0)) {
      downPaymentPct = downPaymentAmount.dividedBy(saleTotal).times(100);
    }

    // Determinar Tipo de Regla
    let ruleType = 'CASH_SALE';
    if (isCredit) {
      if (downPaymentPct.greaterThanOrEqualTo(10)) {
        ruleType = 'CREDIT_HIGH_DOWN';
      } else {
        ruleType = 'CREDIT_LOW_DOWN';
      }
    }

    // Buscar Tasa Aplicable desde BD o Defaults
    const rules = await this.getCommissionRules('VENDEDORA');
    const matchedRule = rules.find((r: any) => r.ruleType === ruleType) || { rate: isCredit ? (downPaymentPct.gte(10) ? new Decimal('0.04') : new Decimal('0.02')) : new Decimal('0.05') };
    const rate = new Decimal(matchedRule.rate);

    // BASE COMISIONABLE = Total Venta
    // NOTA: Aporte Empresa ($200) y Enganche ($200) reducen saldo financiado pero la base comercial es transparente.
    const baseAmount = saleTotal;
    let baseCommission = baseAmount.times(rate);

    // Bonificaciones por Categoría
    let bonusAmount = new Decimal(0);
    const activeBonuses = await this.prisma.commissionBonus.findMany({
      where: { role: 'VENDEDORA', active: true },
    });

    for (const item of sale.items) {
      // Check bonus by product category
      const matchedCatBonus = activeBonuses.find((b) => b.productCategoryId === (item as any).categoryId);
      if (matchedCatBonus) {
        if (matchedCatBonus.percentage) {
          const catBonusPct = new Decimal(matchedCatBonus.percentage);
          const itemSubtotal = new Decimal(item.subtotal || item.total || 0);
          bonusAmount = bonusAmount.plus(itemSubtotal.times(catBonusPct));
        }
        if (matchedCatBonus.fixedAmount) {
          bonusAmount = bonusAmount.plus(new Decimal(matchedCatBonus.fixedAmount));
        }
      }
    }

    const penaltyAmount = new Decimal(0);
    const finalCommissionAmount = baseCommission.plus(bonusAmount).minus(penaltyAmount);

    // Periodo Abierto
    const openPeriod = await this.getActivePeriod();

    const commission = await this.prisma.commission.create({
      data: {
        employeeId: sellerId,
        role: 'VENDEDORA',
        commissionType: 'SALE_COMMISSION',
        saleId: sale.id,
        creditId: creditRel?.id || null,
        supervisorId: input.supervisorId || null,
        routeId: input.routeId || null,
        zoneId: input.zoneId || null,
        periodId: openPeriod?.id || null,
        baseAmount,
        rate,
        bonusAmount,
        penaltyAmount,
        commissionAmount: finalCommissionAmount,
        status: 'CALCULATED',
        sourceEvent: 'SALE_COMPLETED',
        idempotencyKey: effectiveKey,
        createdBy: input.createdBy || sellerId,
      },
    });

    // Auditoría
    await this.logAudit({
      userId: input.createdBy || sellerId,
      action: 'COMMISSION_CREATED',
      entity: 'Commission',
      entityId: commission.id,
      newValues: JSON.stringify({ sellerId, saleId, baseAmount, rate, commissionAmount: finalCommissionAmount }),
      idempotencyKey: effectiveKey,
    });

    // Sobrecomisión de Supervisora (1% sobre venta válida)
    if (input.supervisorId || sale.supervisorId) {
      const supId = input.supervisorId || sale.supervisorId || 'SYSTEM_SUPERVISOR';
      const supIdemKey = `SUPERVISOR-SALE-${sale.id}-${supId}`;

      const existingSupComm = await this.prisma.commission.findUnique({
        where: { idempotencyKey: supIdemKey },
      });

      if (!existingSupComm) {
        const supRules = await this.getCommissionRules('SUPERVISORA');
        const supRule = supRules.find((r: any) => r.ruleType === 'SUPERVISOR_SALE') || { rate: new Decimal('0.0100') };
        const supRate = new Decimal(supRule.rate);
        const supCommissionAmount = baseAmount.times(supRate);

        await this.prisma.commission.create({
          data: {
            employeeId: supId,
            role: 'SUPERVISORA',
            commissionType: 'SUPERVISOR_SALE',
            saleId: sale.id,
            creditId: creditRel?.id || null,
            supervisorId: supId,
            zoneId: input.zoneId || null,
            periodId: openPeriod?.id || null,
            baseAmount,
            rate: supRate,
            commissionAmount: supCommissionAmount,
            status: 'CALCULATED',
            sourceEvent: 'SALE_COMPLETED',
            idempotencyKey: supIdemKey,
            createdBy: input.createdBy || sellerId,
          },
        });
      }
    }

    return commission;
  }

  /**
   * Calcula y registra la comisión de COBRADOR sobre un Pago efectivamente recibido y verificado.
   * Regla absoluta: Solo sobre dinero real CONFIRMED / VERIFIED.
   */
  public static async calculateCollectorCommission(input: CalculateCollectorCommissionInput) {
    const { paymentId, collectorId, idempotencyKey } = input;

    const effectiveKey = idempotencyKey || `PAYMENT-COMMISSION-${paymentId}-${collectorId}`;
    const existingComm = await this.prisma.commission.findUnique({
      where: { idempotencyKey: effectiveKey },
    });
    if (existingComm) {
      return existingComm;
    }

    const payment = await this.prisma.payment.findUnique({
      where: { id: paymentId },
      include: {
        credit: true,
      },
    });

    if (!payment) {
      throw new Error(`Pago con ID ${paymentId} no encontrado`);
    }

    // Regla de Inmutabilidad / Verificación de Pago:
    // Solo comisionar si status === 'CONFIRMED' o (paymentMethod === 'TRANSFER' && verificationStatus === 'VERIFIED')
    const isConfirmed = payment.verificationStatus === 'VERIFIED' || (payment as any).status === 'CONFIRMED';
    const isTransfer = (payment.paymentMethod as string) === 'BANK_TRANSFER' || (payment.paymentMethod as string) === 'TRANSFER';
    const isTransferVerified = (payment as any).verificationStatus === 'VERIFIED';

    if (!isConfirmed && !(isTransfer && isTransferVerified)) {
      // PENDING_VERIFICATION o PENDING -> $0 comisión
      return null;
    }

    const paymentAmount = new Decimal(payment.amount);
    if (paymentAmount.lessThanOrEqualTo(0)) {
      return null;
    }

    // Regla base 3%
    const rules = await this.getCommissionRules('COBRADOR');
    const colRule = rules.find((r: any) => r.ruleType === 'COLLECTION') || { rate: new Decimal('0.0300') };
    const rate = new Decimal(colRule.rate);
    const commissionAmount = paymentAmount.times(rate);

    const openPeriod = await this.getActivePeriod();

    const commission = await this.prisma.commission.create({
      data: {
        employeeId: collectorId,
        role: 'COBRADOR',
        commissionType: 'COLLECTION_COMMISSION',
        paymentId: payment.id,
        creditId: payment.creditId,
        supervisorId: input.supervisorId || null,
        routeId: input.routeId || null,
        zoneId: input.zoneId || null,
        periodId: openPeriod?.id || null,
        baseAmount: paymentAmount,
        rate,
        commissionAmount,
        status: 'CALCULATED',
        sourceEvent: 'PAYMENT_VERIFIED',
        idempotencyKey: effectiveKey,
        createdBy: input.createdBy || collectorId,
      },
    });

    await this.logAudit({
      userId: input.createdBy || collectorId,
      action: 'COMMISSION_CREATED',
      entity: 'Commission',
      entityId: commission.id,
      newValues: JSON.stringify({ collectorId, paymentId, baseAmount: paymentAmount, rate, commissionAmount }),
      idempotencyKey: effectiveKey,
    });

    // Sobrecomisión de Supervisora por Cobranza (0.5% sobre cobranza efectiva)
    if (input.supervisorId) {
      const supId = input.supervisorId;
      const supIdemKey = `SUPERVISOR-COLLECTION-${payment.id}-${supId}`;

      const existingSupComm = await this.prisma.commission.findUnique({
        where: { idempotencyKey: supIdemKey },
      });

      if (!existingSupComm) {
        const supRules = await this.getCommissionRules('SUPERVISORA');
        const supRule = supRules.find((r: any) => r.ruleType === 'SUPERVISOR_COLLECTION') || { rate: new Decimal('0.0050') };
        const supRate = new Decimal(supRule.rate);
        const supCommissionAmount = paymentAmount.times(supRate);

        await this.prisma.commission.create({
          data: {
            employeeId: supId,
            role: 'SUPERVISORA',
            commissionType: 'SUPERVISOR_COLLECTION',
            paymentId: payment.id,
            creditId: payment.creditId,
            supervisorId: supId,
            zoneId: input.zoneId || null,
            periodId: openPeriod?.id || null,
            baseAmount: paymentAmount,
            rate: supRate,
            commissionAmount: supCommissionAmount,
            status: 'CALCULATED',
            sourceEvent: 'PAYMENT_VERIFIED',
            idempotencyKey: supIdemKey,
            createdBy: input.createdBy || collectorId,
          },
        });
      }
    }

    return commission;
  }

  /**
   * Reversión de Comisiones por Cancelación / Devolución / Reembolso.
   * Regla de inmutabilidad: NUNCA elimina la comisión original, genera un registro REVERSED con monto negativo.
   */
  public static async processReversal(input: {
    saleId?: string;
    paymentId?: string;
    reason: string;
    authorizedBy?: string;
  }) {
    const { saleId, paymentId, reason, authorizedBy } = input;

    const whereClause: any = {
      status: { in: ['CALCULATED', 'APPROVED', 'PAID'] },
    };
    if (saleId) whereClause.saleId = saleId;
    if (paymentId) whereClause.paymentId = paymentId;

    const activeCommissions = await this.prisma.commission.findMany({
      where: whereClause,
    });

    const reversals = [];

    for (const comm of activeCommissions) {
      const reversalKey = `REVERSAL-${comm.id}-${Date.now()}`;

      // Check if already reversed
      const existingReversal = await this.prisma.commission.findFirst({
        where: { reversalOfId: comm.id },
      });

      if (!existingReversal) {
        const originalAmount = new Decimal(comm.commissionAmount);
        const negativeAmount = originalAmount.negated(); // -$X

        const reversalComm = await this.prisma.commission.create({
          data: {
            employeeId: comm.employeeId,
            role: comm.role,
            commissionType: 'REVERSAL',
            saleId: comm.saleId,
            paymentId: comm.paymentId,
            creditId: comm.creditId,
            supervisorId: comm.supervisorId,
            routeId: comm.routeId,
            zoneId: comm.zoneId,
            periodId: comm.periodId,
            baseAmount: comm.baseAmount,
            rate: comm.rate,
            commissionAmount: negativeAmount,
            status: 'REVERSED',
            sourceEvent: saleId ? 'SALE_CANCELLED' : 'PAYMENT_REFUNDED',
            idempotencyKey: reversalKey,
            reversalOfId: comm.id,
            createdBy: authorizedBy || 'SYSTEM',
            approvedBy: authorizedBy || 'SYSTEM',
          },
        });

        reversals.push(reversalComm);

        await this.logAudit({
          userId: authorizedBy || 'SYSTEM',
          action: 'COMMISSION_REVERSED',
          entity: 'Commission',
          entityId: reversalComm.id,
          oldValues: JSON.stringify({ originalCommissionId: comm.id, originalAmount: comm.commissionAmount }),
          newValues: JSON.stringify({ reversalAmount: negativeAmount, reason }),
          idempotencyKey: reversalKey,
        });
      }
    }

    return reversals;
  }

  /**
   * Crear Penalización a un Empleado
   */
  public static async createPenalty(input: CreatePenaltyInput) {
    const penaltyAmount = new Decimal(input.amount);
    const negativeCommission = penaltyAmount.negated();

    const openPeriod = await this.getActivePeriod();

    const penaltyRecord = await this.prisma.commissionPenalty.create({
      data: {
        employeeId: input.employeeId,
        reason: input.reason,
        amount: penaltyAmount,
        authorizedBy: input.authorizedBy,
        periodId: input.periodId || openPeriod?.id || null,
        notes: input.notes,
      },
    });

    const comm = await this.prisma.commission.create({
      data: {
        employeeId: input.employeeId,
        role: 'EMPLOYEE',
        commissionType: 'PENALTY',
        penaltyAmount: penaltyAmount,
        commissionAmount: negativeCommission,
        status: 'CALCULATED',
        sourceEvent: 'PENALTY_APPLIED',
        periodId: input.periodId || openPeriod?.id || null,
        createdBy: input.authorizedBy || 'SUPERVISOR',
      },
    });

    await this.logAudit({
      userId: input.authorizedBy || 'SYSTEM',
      action: 'PENALTY_CREATED',
      entity: 'CommissionPenalty',
      entityId: penaltyRecord.id,
      newValues: JSON.stringify({ employeeId: input.employeeId, amount: penaltyAmount, reason: input.reason }),
    });

    return { penaltyRecord, commission: comm };
  }

  /**
   * Crear o actualizar Meta
   */
  public static async upsertTarget(input: CreateTargetInput) {
    const existing = await this.prisma.commissionTarget.findFirst({
      where: { employeeId: input.employeeId, role: input.role, active: true },
    });

    const targetAmount = new Decimal(input.targetAmount);
    const bonusRate = input.bonusRate ? new Decimal(input.bonusRate) : null;
    const bonusFixed = input.bonusFixed ? new Decimal(input.bonusFixed) : null;

    if (existing) {
      return this.prisma.commissionTarget.update({
        where: { id: existing.id },
        data: {
          targetAmount,
          bonusRate,
          bonusFixed,
          period: input.period || 'MONTHLY',
        },
      });
    }

    return this.prisma.commissionTarget.create({
      data: {
        employeeId: input.employeeId,
        role: input.role,
        period: input.period || 'MONTHLY',
        targetAmount,
        bonusRate,
        bonusFixed,
        active: true,
      },
    });
  }

  /**
   * Gestión de Periodos de Comisión
   */
  public static async getActivePeriod() {
    return this.prisma.commissionPeriod.findFirst({
      where: { status: 'OPEN' },
      orderBy: { createdAt: 'desc' },
    });
  }

  public static async createPeriod(startDate: Date, endDate: Date, periodName?: string) {
    return this.prisma.commissionPeriod.create({
      data: {
        periodName: periodName || `Periodo ${startDate.toISOString().substring(0, 10)} - ${endDate.toISOString().substring(0, 10)}`,
        startDate,
        endDate,
        status: 'OPEN',
      },
    });
  }

  public static async closePeriod(periodId: string, closedBy: string) {
    const period = await this.prisma.commissionPeriod.findUnique({
      where: { id: periodId },
    });

    if (!period) {
      throw new Error(`Periodo con ID ${periodId} no encontrado`);
    }

    if (period.status === 'CLOSED' || period.status === 'PAID') {
      throw new Error(`El periodo ya se encuentra cerrado o pagado (${period.status})`);
    }

    // Reagrupar métricas del periodo
    const commissions = await this.prisma.commission.findMany({
      where: { periodId, status: { in: ['CALCULATED', 'APPROVED', 'REVERSED'] } },
    });

    let totalSalesCommission = new Decimal(0);
    let totalCollectionCommission = new Decimal(0);
    let totalSupervisorCommission = new Decimal(0);
    let totalBonuses = new Decimal(0);
    let totalPenalties = new Decimal(0);
    let totalNet = new Decimal(0);

    for (const c of commissions) {
      const amt = new Decimal(c.commissionAmount);
      totalNet = totalNet.plus(amt);

      if (c.commissionType === 'SALE_COMMISSION') totalSalesCommission = totalSalesCommission.plus(amt);
      else if (c.commissionType === 'COLLECTION_COMMISSION') totalCollectionCommission = totalCollectionCommission.plus(amt);
      else if (c.commissionType.startsWith('SUPERVISOR')) totalSupervisorCommission = totalSupervisorCommission.plus(amt);
      else if (c.commissionType === 'BONUS') totalBonuses = totalBonuses.plus(amt);
      else if (c.commissionType === 'PENALTY') totalPenalties = totalPenalties.plus(amt);
    }

    const snapshotHash = `HASH-P8-${periodId}-${totalNet.toFixed(2)}-${Date.now()}`;

    const updatedPeriod = await this.prisma.commissionPeriod.update({
      where: { id: periodId },
      data: {
        status: 'CLOSED',
        totalSalesCommission,
        totalCollectionCommission,
        totalSupervisorCommission,
        totalBonuses,
        totalPenalties,
        totalNet,
        snapshotHash,
        closedAt: new Date(),
        closedBy,
      },
    });

    await this.logAudit({
      userId: closedBy,
      action: 'PERIOD_CLOSED',
      entity: 'CommissionPeriod',
      entityId: periodId,
      newValues: JSON.stringify({ totalNet, snapshotHash }),
    });

    return updatedPeriod;
  }

  public static async approvePeriod(periodId: string, approvedBy: string) {
    const period = await this.prisma.commissionPeriod.findUnique({ where: { id: periodId } });
    if (!period) throw new Error('Periodo no encontrado');

    const updated = await this.prisma.commissionPeriod.update({
      where: { id: periodId },
      data: {
        status: 'PENDING_APPROVAL',
        approvedAt: new Date(),
        approvedBy,
      },
    });

    await this.prisma.commission.updateMany({
      where: { periodId, status: 'CALCULATED' },
      data: { status: 'APPROVED', approvedBy, approvedAt: new Date() },
    });

    return updated;
  }

  public static async payPeriod(periodId: string, paidBy: string) {
    const period = await this.prisma.commissionPeriod.findUnique({ where: { id: periodId } });
    if (!period) throw new Error('Periodo no encontrado');

    const updated = await this.prisma.commissionPeriod.update({
      where: { id: periodId },
      data: {
        status: 'PAID',
        paidAt: new Date(),
        paidBy,
      },
    });

    await this.prisma.commission.updateMany({
      where: { periodId, status: { in: ['CALCULATED', 'APPROVED'] } },
      data: { status: 'PAID', paidAt: new Date() },
    });

    await this.logAudit({
      userId: paidBy,
      action: 'PERIOD_PAID',
      entity: 'CommissionPeriod',
      entityId: periodId,
      newValues: JSON.stringify({ status: 'PAID', paidAt: new Date() }),
    });

    return updated;
  }

  /**
   * Dashboards para Vendedoras, Cobradores y Supervisoras
   */
  public static async getSellerDashboard(employeeId: string) {
    const commissions = await this.prisma.commission.findMany({
      where: { employeeId, role: 'VENDEDORA' },
      orderBy: { createdAt: 'desc' },
      include: { sale: true },
    });

    let totalBase = new Decimal(0);
    let totalCommissions = new Decimal(0);
    let totalBonuses = new Decimal(0);
    let totalPenalties = new Decimal(0);

    for (const c of commissions) {
      totalBase = totalBase.plus(new Decimal(c.baseAmount));
      totalCommissions = totalCommissions.plus(new Decimal(c.commissionAmount));
      totalBonuses = totalBonuses.plus(new Decimal(c.bonusAmount));
      totalPenalties = totalPenalties.plus(new Decimal(c.penaltyAmount));
    }

    const target = await this.prisma.commissionTarget.findFirst({
      where: { employeeId, active: true },
    });

    return {
      commissionsCount: commissions.length,
      totalSalesBase: totalBase.toFixed(2),
      totalCommissions: totalCommissions.toFixed(2),
      totalBonuses: totalBonuses.toFixed(2),
      totalPenalties: totalPenalties.toFixed(2),
      netEarned: totalCommissions.toFixed(2),
      targetAmount: target ? new Decimal(target.targetAmount).toFixed(2) : '0.00',
      targetProgressPct: target && new Decimal(target.targetAmount).gt(0)
        ? totalBase.dividedBy(new Decimal(target.targetAmount)).times(100).toFixed(1)
        : '0.0',
      recentCommissions: commissions.slice(0, 20),
    };
  }

  public static async getCollectorDashboard(collectorId: string) {
    const commissions = await this.prisma.commission.findMany({
      where: { employeeId: collectorId, role: 'COBRADOR' },
      orderBy: { createdAt: 'desc' },
    });

    let totalCollected = new Decimal(0);
    let totalCommissions = new Decimal(0);

    for (const c of commissions) {
      totalCollected = totalCollected.plus(new Decimal(c.baseAmount));
      totalCommissions = totalCommissions.plus(new Decimal(c.commissionAmount));
    }

    return {
      commissionsCount: commissions.length,
      totalCollected: totalCollected.toFixed(2),
      totalCommissions: totalCommissions.toFixed(2),
      recentCommissions: commissions.slice(0, 20),
    };
  }

  public static async getSupervisorDashboard(supervisorId: string) {
    const teamCommissions = await this.prisma.commission.findMany({
      where: {
        OR: [
          { supervisorId },
          { employeeId: supervisorId, role: 'SUPERVISORA' },
        ],
      },
      orderBy: { createdAt: 'desc' },
    });

    let ownSupervisorCommission = new Decimal(0);
    let teamSalesBase = new Decimal(0);
    let teamCollectionBase = new Decimal(0);

    for (const c of teamCommissions) {
      if (c.role === 'SUPERVISORA') {
        ownSupervisorCommission = ownSupervisorCommission.plus(new Decimal(c.commissionAmount));
      }
      if (c.role === 'VENDEDORA') {
        teamSalesBase = teamSalesBase.plus(new Decimal(c.baseAmount));
      }
      if (c.role === 'COBRADOR') {
        teamCollectionBase = teamCollectionBase.plus(new Decimal(c.baseAmount));
      }
    }

    return {
      ownSupervisorCommission: ownSupervisorCommission.toFixed(2),
      teamSalesBase: teamSalesBase.toFixed(2),
      teamCollectionBase: teamCollectionBase.toFixed(2),
      totalTeamRecords: teamCommissions.length,
      recentCommissions: teamCommissions.slice(0, 20),
    };
  }

  public static async getGlobalAdminDashboard() {
    const allCommissions = await this.prisma.commission.findMany({
      orderBy: { createdAt: 'desc' },
      take: 100,
    });

    let totalNet = new Decimal(0);
    let totalSeller = new Decimal(0);
    let totalCollector = new Decimal(0);
    let totalSupervisor = new Decimal(0);

    for (const c of allCommissions) {
      const amt = new Decimal(c.commissionAmount);
      totalNet = totalNet.plus(amt);
      if (c.role === 'VENDEDORA') totalSeller = totalSeller.plus(amt);
      if (c.role === 'COBRADOR') totalCollector = totalCollector.plus(amt);
      if (c.role === 'SUPERVISORA') totalSupervisor = totalSupervisor.plus(amt);
    }

    const openPeriods = await this.prisma.commissionPeriod.findMany({
      orderBy: { createdAt: 'desc' },
    });

    return {
      totalNet: totalNet.toFixed(2),
      totalSeller: totalSeller.toFixed(2),
      totalCollector: totalCollector.toFixed(2),
      totalSupervisor: totalSupervisor.toFixed(2),
      openPeriods,
      recentCommissions: allCommissions.slice(0, 30),
    };
  }

  private static async logAudit(data: {
    userId?: string;
    action: string;
    entity: string;
    entityId: string;
    oldValues?: string;
    newValues?: string;
    idempotencyKey?: string;
  }) {
    try {
      await this.prisma.auditLog.create({
        data: {
          userId: data.userId || null,
          action: data.action,
          entity: data.entity,
          entityId: data.entityId,
          oldValues: data.oldValues || null,
          newValues: data.newValues || null,
          idempotencyKey: data.idempotencyKey || null,
        },
      });
    } catch (e) {
      console.error('AuditLog insert failed:', e);
    }
  }
}
