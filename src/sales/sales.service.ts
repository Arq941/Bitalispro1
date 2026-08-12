import Decimal from 'decimal.js';
import { PrismaService } from '@/src/database/prisma.service';
import { AuditLogService } from '@/src/audit/audit-log.service';
import { IdempotencyService } from '@/src/idempotency/idempotency.service';
import { InventoryService } from '@/src/inventory/inventory.service';
import { FinancialRulesService } from '@/src/financial/financial-rules.service';

export interface UserContext {
  userId: string;
  role: 'ADMIN' | 'SUPERVISORA' | 'VENDEDORA' | 'COBRADOR';
  assignedRouteId?: string;
  zoneId?: string;
}

export interface CreateSaleItemDto {
  productId: string;
  quantity?: number;
  unitPrice?: number | string | Decimal;
  negotiatedPrice?: number | string | Decimal;
  minimumAuthorizedPrice?: number | string | Decimal;
}

export interface CreateSaleDto {
  clientId: string;
  warehouseId?: string;
  saleType?: 'CASH' | 'CREDIT';
  items: CreateSaleItemDto[];
  engancheCliente?: number | string | Decimal;
  aporteEmpresaRatio?: number;
  idempotencyKey?: string;
}

export interface RegisterDownPaymentDto {
  saleId: string;
  amount: number | string | Decimal;
  paymentMethod?: 'CASH' | 'BANK_TRANSFER';
  cashSessionId?: string;
  idempotencyKey?: string;
}

export interface CreateCreditDto {
  saleId: string;
  paymentFrequency?: 'WEEKLY' | 'BIWEEKLY' | 'MONTHLY';
  installmentsCount?: number;
  firstPaymentDate?: string | Date;
  idempotencyKey?: string;
}

export interface SettleCreditDto {
  creditId: string;
  paymentMethod?: 'CASH' | 'BANK_TRANSFER';
  cashSessionId?: string;
  idempotencyKey?: string;
}

export interface RequestDownPaymentExceptionDto {
  saleId: string;
  requestedAmount: number | string | Decimal;
  reason: string;
}

class SalesStore {
  static sales: Map<string, any> = new Map();
  static saleItems: Map<string, any> = new Map();
  static downPayments: Map<string, any> = new Map();
  static companyContributions: Map<string, any> = new Map();
  static exceptions: Map<string, any> = new Map();
  static credits: Map<string, any> = new Map();
  static schedules: Map<string, any> = new Map();
  static settlements: Map<string, any> = new Map();
  static commissions: Map<string, any> = new Map();
  static authorizationRequests: Map<string, any> = new Map();

  static clear() {
    this.sales.clear();
    this.saleItems.clear();
    this.downPayments.clear();
    this.companyContributions.clear();
    this.exceptions.clear();
    this.credits.clear();
    this.schedules.clear();
    this.settlements.clear();
    this.commissions.clear();
    this.authorizationRequests.clear();
  }
}

export class SalesService {
  public static clearMemoryStore() {
    SalesStore.clear();
  }

  public static async generateSaleNumber(): Promise<string> {
    const year = new Date().getFullYear();
    const prefix = `VTA-${year}-`;
    try {
      const prisma = PrismaService.getInstance();
      const last = await prisma.sale.findFirst({
        where: { saleNumber: { startsWith: prefix } },
        orderBy: { saleNumber: 'desc' },
        select: { saleNumber: true },
      });
      let seq = 1;
      if (last?.saleNumber) {
        const parts = last.saleNumber.split('-');
        if (parts.length === 3) {
          const num = parseInt(parts[2], 10);
          if (!isNaN(num)) seq = num + 1;
        }
      }
      return `${prefix}${seq.toString().padStart(4, '0')}`;
    } catch {
      const existing = Array.from(SalesStore.sales.values()).filter((s) => s.saleNumber?.startsWith(prefix));
      const seq = existing.length + 1;
      return `${prefix}${seq.toString().padStart(4, '0')}`;
    }
  }

  public static async createSale(dto: CreateSaleDto, userContext: UserContext) {
    if (dto.idempotencyKey) {
      const cached = await IdempotencyService.check(dto.idempotencyKey, '/api/sales');
      if (cached) return cached.responseBody;
    }

    const limitCheck = FinancialRulesService.validarLimiteProductosVenta(dto.items.length);
    if (!limitCheck.valido) throw new Error(limitCheck.mensaje);
    if (dto.items.length === 0) throw new Error('La venta debe incluir al menos 1 producto.');

    const saleType = dto.saleType || 'CREDIT';
    const warehouseId = dto.warehouseId || 'wh_central';
    const saleNumber = await this.generateSaleNumber();
    const saleId = `sale_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
    const canAuthorizeInField = userContext.role === 'SUPERVISORA' || userContext.role === 'ADMIN';

    let totalListPrice = new Decimal(0);
    let subtotal = new Decimal(0);
    let requiresAuthorization = false;
    const authReasons: string[] = [];
    const fieldOverrides: string[] = [];

    if (dto.items.length === 2) {
      if (canAuthorizeInField) fieldOverrides.push('TWO_PRODUCT_SALE');
      else {
        requiresAuthorization = true;
        authReasons.push('TWO_PRODUCT_SALE');
      }
    }

    const itemsData = dto.items.map((it, idx) => {
      const qty = it.quantity || 1;
      const unitPrice = new Decimal(it.unitPrice || it.negotiatedPrice || 1490);
      const negotiatedPrice = new Decimal(it.negotiatedPrice || unitPrice);
      const minimumAuthorizedPrice = new Decimal(it.minimumAuthorizedPrice || unitPrice);
      const itemSubtotal = negotiatedPrice.mul(qty);
      const itemTotalListPrice = unitPrice.mul(qty);

      totalListPrice = totalListPrice.plus(itemTotalListPrice);
      subtotal = subtotal.plus(itemSubtotal);

      if (negotiatedPrice.lessThan(minimumAuthorizedPrice)) {
        const reason = `PRICE_OVERRIDE_ITEM_${idx + 1}`;
        if (canAuthorizeInField) fieldOverrides.push(reason);
        else {
          requiresAuthorization = true;
          authReasons.push(reason);
        }
      }

      return {
        id: `item_${Date.now()}_${idx}_${Math.random().toString(36).substring(2, 5)}`,
        saleId,
        productId: it.productId,
        quantity: qty,
        unitPrice,
        subtotal: itemSubtotal,
        minimumAuthorizedPrice,
        negotiatedPrice,
        discount: itemTotalListPrice.minus(itemSubtotal),
        financedAmount: itemSubtotal,
        total: itemSubtotal,
      };
    });

    const engancheCliente = new Decimal(dto.engancheCliente || 0);
    const ratio = new Decimal(dto.aporteEmpresaRatio !== undefined ? dto.aporteEmpresaRatio : 1.0);
    const aporteEmpresa = engancheCliente.mul(ratio);
    const calcResult = FinancialRulesService.calcularSaldoFinanciado({
      precioLista: subtotal,
      engancheCliente,
      aporteEmpresa,
    });
    if (!calcResult.esInvarianteValida) {
      throw new Error(`Invariante financiera inválida: ${calcResult.mensajesValidacion.join(', ')}`);
    }

    const totalDiscount = calcResult.descuentoComercialTotal;
    const totalFinanced = calcResult.saldoFinanciado;
    let status: 'DRAFT' | 'PENDING_AUTHORIZATION' | 'APPROVED' | 'COMPLETED' = requiresAuthorization ? 'PENDING_AUTHORIZATION' : 'APPROVED';

    const saleRecord = {
      id: saleId,
      saleNumber,
      clientId: dto.clientId,
      sellerId: userContext.userId,
      supervisorId: userContext.role === 'SUPERVISORA' ? userContext.userId : null,
      saleType,
      status,
      subtotal,
      totalListPrice,
      totalDiscount,
      totalFinanced,
      totalAmount: totalFinanced,
      idempotencyKey: dto.idempotencyKey || null,
      createdAt: new Date(),
      updatedAt: new Date(),
      items: itemsData,
    };

    let createdSale: any;
    try {
      const prisma = PrismaService.getInstance();
      createdSale = await prisma.sale.create({
        data: {
          id: saleRecord.id,
          saleNumber: saleRecord.saleNumber,
          clientId: saleRecord.clientId,
          sellerId: saleRecord.sellerId,
          supervisorId: saleRecord.supervisorId,
          saleType: saleRecord.saleType as any,
          status: saleRecord.status as any,
          subtotal: saleRecord.subtotal.toNumber(),
          totalListPrice: saleRecord.totalListPrice.toNumber(),
          totalDiscount: saleRecord.totalDiscount.toNumber(),
          totalFinanced: saleRecord.totalFinanced.toNumber(),
          totalAmount: saleRecord.totalFinanced.toNumber(),
          idempotencyKey: saleRecord.idempotencyKey,
          items: {
            create: itemsData.map((i) => ({
              id: i.id,
              productId: i.productId,
              quantity: i.quantity,
              unitPrice: i.unitPrice.toNumber(),
              subtotal: i.subtotal.toNumber(),
              minimumAuthorizedPrice: i.minimumAuthorizedPrice.toNumber(),
              negotiatedPrice: i.negotiatedPrice.toNumber(),
              discount: i.discount.toNumber(),
              financedAmount: i.financedAmount.toNumber(),
              total: i.total.toNumber(),
            })),
          },
        },
        include: { items: true, client: true },
      });

      if (requiresAuthorization) {
        for (const reason of authReasons) {
          await prisma.authorizationRequest.create({
            data: {
              type: reason.startsWith('PRICE') ? 'PRICE_OVERRIDE' : 'TWO_PRODUCT_SALE',
              status: 'PENDING',
              requestedBy: userContext.userId,
              saleId,
              reason,
            },
          });
        }
      }
    } catch {
      SalesStore.sales.set(saleRecord.id, saleRecord);
      for (const item of itemsData) SalesStore.saleItems.set(item.id, item);
      if (requiresAuthorization) {
        for (const reason of authReasons) {
          const authReq = {
            id: `auth_${Date.now()}_${Math.random().toString(36).substring(2, 5)}`,
            type: reason.startsWith('PRICE') ? 'PRICE_OVERRIDE' : 'TWO_PRODUCT_SALE',
            status: 'PENDING',
            requestedBy: userContext.userId,
            saleId,
            reason,
            createdAt: new Date(),
          };
          SalesStore.authorizationRequests.set(authReq.id, authReq);
        }
      }
      createdSale = saleRecord;
    }

    for (const item of itemsData) {
      await InventoryService.reserveStock({
        productId: item.productId,
        warehouseId,
        quantity: item.quantity,
        saleId,
        userId: userContext.userId,
        idempotencyKey: dto.idempotencyKey ? `${dto.idempotencyKey}_res_${item.productId}` : undefined,
      });
    }

    let downPaymentRecord = null;
    let companyContributionRecord = null;
    if (engancheCliente.greaterThan(0)) {
      const dpResult = await this.registerDownPayment(
        { saleId, amount: engancheCliente, paymentMethod: 'CASH' },
        userContext
      );
      downPaymentRecord = dpResult.downPayment;
      companyContributionRecord = dpResult.companyContribution;
    }

    await AuditLogService.log({
      userId: userContext.userId,
      action: fieldOverrides.length ? 'SALE_CREATED_WITH_FIELD_AUTHORITY' : 'SALE_CREATED',
      entity: 'Sale',
      entityId: saleId,
      newValues: JSON.stringify({ saleNumber, totalFinanced, status, fieldOverrides }),
      idempotencyKey: dto.idempotencyKey,
    });

    const result = {
      ...createdSale,
      downPayment: downPaymentRecord,
      companyContribution: companyContributionRecord,
      saldoFinanciado: totalFinanced,
      invarianteValida: calcResult.esInvarianteValida,
      fieldOverrides,
    };

    if (dto.idempotencyKey) {
      await IdempotencyService.record(dto.idempotencyKey, '/api/sales', result, 201);
    }

    return result;
  }

  public static async registerDownPayment(dto: RegisterDownPaymentDto, userContext: UserContext) {
    if (dto.idempotencyKey) {
      const cached = await IdempotencyService.check(dto.idempotencyKey, `/api/sales/${dto.saleId}/down-payment`);
      if (cached) return cached.responseBody;
    }

    const amount = new Decimal(dto.amount);
    if (amount.lessThanOrEqualTo(0)) throw new Error('El monto del enganche debe ser mayor a cero.');
    const sale = await this.getSaleById(dto.saleId);
    if (!sale) throw new Error('Venta no encontrada.');
    const paymentMethod = dto.paymentMethod || 'CASH';
    const dpId = `dp_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
    const downPaymentStatus = paymentMethod === 'CASH' ? 'COMPLETED' : 'PENDING_VERIFICATION';

    const downPayment = {
      id: dpId,
      saleId: dto.saleId,
      amount,
      paymentMethod,
      status: downPaymentStatus,
      cashMovementId: null as string | null,
      createdBy: userContext.userId,
      createdAt: new Date(),
    };

    const ccId = `cc_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
    const companyContribution = {
      id: ccId,
      saleId: dto.saleId,
      amount,
      rule: 'MATCH_DOWN_PAYMENT_1_TO_1',
      percentageOrRatio: new Decimal(1.0),
      createdBy: userContext.userId,
      createdAt: new Date(),
    };

    if (paymentMethod === 'CASH' && dto.cashSessionId) {
      try {
        const prisma = PrismaService.getInstance();
        const cm = await prisma.cashMovement.create({
          data: {
            cashSessionId: dto.cashSessionId,
            type: 'DOWN_PAYMENT',
            amount: amount.toNumber(),
            description: `Enganche de venta ${sale.saleNumber}`,
          },
        });
        downPayment.cashMovementId = cm.id;
      } catch {
        downPayment.cashMovementId = `cm_${Date.now()}`;
      }
    }

    try {
      const prisma = PrismaService.getInstance();
      await prisma.$transaction(async (tx) => {
        await tx.downPayment.create({
          data: {
            id: downPayment.id,
            saleId: downPayment.saleId,
            amount: amount.toNumber(),
            paymentMethod: paymentMethod as any,
            status: downPayment.status as any,
            cashMovementId: downPayment.cashMovementId,
            createdBy: downPayment.createdBy,
          },
        });
        await tx.companyContribution.create({
          data: {
            id: companyContribution.id,
            saleId: companyContribution.saleId,
            amount: amount.toNumber(),
            rule: companyContribution.rule,
            percentageOrRatio: 1.0,
            createdBy: companyContribution.createdBy,
          },
        });
      });
    } catch {
      SalesStore.downPayments.set(downPayment.id, downPayment);
      SalesStore.companyContributions.set(companyContribution.id, companyContribution);
    }

    await AuditLogService.log({
      userId: userContext.userId,
      action: 'DOWN_PAYMENT_REGISTERED',
      entity: 'Sale',
      entityId: dto.saleId,
      newValues: JSON.stringify({ amount: amount.toString(), paymentMethod }),
      idempotencyKey: dto.idempotencyKey,
    });

    return { downPayment, companyContribution };
  }

  public static async getSaleById(id: string) {
    try {
      const prisma = PrismaService.getInstance();
      const sale = await prisma.sale.findUnique({
        where: { id },
        include: {
          client: true,
          items: { include: { product: { include: { images: true, prices: true } } } },
          downPayments: true,
          companyContributions: true,
          authorizationRequests: true,
          credits: { include: { paymentSchedules: true } },
        },
      });
      if (sale) return sale;
    } catch {}
    return SalesStore.sales.get(id) || null;
  }

  public static async getSalesList() {
    try {
      const prisma = PrismaService.getInstance();
      return await prisma.sale.findMany({ orderBy: { createdAt: 'desc' }, include: { client: true, items: true } });
    } catch {
      return Array.from(SalesStore.sales.values());
    }
  }

  public static async createCredit(dto: CreateCreditDto, userContext: UserContext) {
    const sale = await this.getSaleById(dto.saleId);
    if (!sale) throw new Error('Venta no encontrada.');
    if (sale.saleType !== 'CREDIT') throw new Error('La venta no es de crédito.');
    if (sale.status !== 'APPROVED') throw new Error('La venta debe estar aprobada antes de crear el crédito.');

    const balance = new Decimal(sale.totalFinanced?.toString?.() ?? sale.totalFinanced ?? sale.totalAmount ?? 0);
    const frequency = dto.paymentFrequency || 'WEEKLY';
    const minPayment = frequency === 'WEEKLY' ? new Decimal(100) : frequency === 'BIWEEKLY' ? new Decimal(200) : new Decimal(400);
    const requestedCount = dto.installmentsCount || Math.max(1, balance.div(minPayment).ceil().toNumber());
    const installment = balance.div(requestedCount).toDecimalPlaces(2);
    if (installment.lessThan(minPayment) && balance.greaterThan(minPayment)) {
      throw new Error(`La cuota calculada no puede ser menor a ${minPayment.toFixed(2)} para la frecuencia seleccionada.`);
    }

    const creditId = `credit_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
    const first = dto.firstPaymentDate ? new Date(dto.firstPaymentDate) : new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
    const schedules = [];
    let remaining = balance;
    for (let i = 0; i < requestedCount; i++) {
      const amount = i === requestedCount - 1 ? remaining : installment;
      const dueDate = new Date(first);
      const multiplier = frequency === 'WEEKLY' ? 7 : frequency === 'BIWEEKLY' ? 14 : 30;
      dueDate.setDate(first.getDate() + i * multiplier);
      schedules.push({
        id: `sched_${Date.now()}_${i}_${Math.random().toString(36).substring(2, 5)}`,
        creditId,
        installmentNumber: i + 1,
        dueDate,
        amount,
        paidAmount: new Decimal(0),
        status: 'PENDING',
      });
      remaining = remaining.minus(amount);
    }

    const creditRecord = {
      id: creditId,
      saleId: dto.saleId,
      clientId: sale.clientId,
      originalBalance: balance,
      saldoActual: balance,
      paymentFrequency: frequency,
      installmentsCount: requestedCount,
      suggestedInstallment: installment,
      status: 'ACTIVE',
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    try {
      const prisma = PrismaService.getInstance();
      const created = await prisma.credit.create({
        data: {
          id: creditRecord.id,
          saleId: creditRecord.saleId,
          clientId: creditRecord.clientId,
          originalBalance: balance.toNumber(),
          saldoActual: balance.toNumber(),
          paymentFrequency: frequency as any,
          installmentsCount: requestedCount,
          suggestedInstallment: installment.toNumber(),
          status: 'ACTIVE' as any,
          paymentSchedules: {
            create: schedules.map((s) => ({
              id: s.id,
              installmentNumber: s.installmentNumber,
              dueDate: s.dueDate,
              amount: s.amount.toNumber(),
              paidAmount: 0,
              status: s.status as any,
            })),
          },
        },
        include: { paymentSchedules: true },
      });
      await AuditLogService.log({ userId: userContext.userId, action: 'CREDIT_CREATED', entity: 'Credit', entityId: created.id, newValues: JSON.stringify({ balance: balance.toString(), frequency, requestedCount }) });
      return created;
    } catch {
      SalesStore.credits.set(creditId, creditRecord);
      for (const s of schedules) SalesStore.schedules.set(s.id, s);
      return { ...creditRecord, paymentSchedules: schedules };
    }
  }
}
