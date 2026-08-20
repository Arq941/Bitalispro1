import Decimal from "decimal.js";
import { PrismaService } from "@/src/database/prisma.service";
import { AuditLogService } from "@/src/audit/audit-log.service";
import { IdempotencyService } from "@/src/idempotency/idempotency.service";
import { InventoryService } from "@/src/inventory/inventory.service";
import { FinancialRulesService } from "@/src/financial/financial-rules.service";
import { PaymentCalendarService } from "@/src/financial/payment-calendar.service";

export interface UserContext {
  userId: string;
  role: "ADMIN" | "SUPERVISORA" | "VENDEDORA" | "COBRADOR";
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
  saleType?: "CASH" | "CREDIT";
  items: CreateSaleItemDto[];
  engancheCliente?: number | string | Decimal;
  paymentFrequency?: "WEEKLY" | "BIWEEKLY" | "MONTHLY";
  installmentsCount?: number;
  firstPaymentDate?: string | Date;
  idempotencyKey?: string;
}

export interface RegisterDownPaymentDto {
  saleId: string;
  amount: number | string | Decimal;
  paymentMethod?: "CASH" | "BANK_TRANSFER";
  cashSessionId?: string;
  idempotencyKey?: string;
}

export interface CreateCreditDto {
  saleId: string;
  paymentFrequency?: "WEEKLY" | "BIWEEKLY" | "MONTHLY";
  installmentsCount?: number;
  firstPaymentDate?: string | Date;
  idempotencyKey?: string;
}

export interface SettleCreditDto {
  creditId: string;
  paymentMethod?: "CASH" | "BANK_TRANSFER";
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
  private static failClosedInProduction(error: unknown) {
    if (process.env.NODE_ENV === "production") throw error;
  }

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
        orderBy: { saleNumber: "desc" },
        select: { saleNumber: true },
      });
      let seq = 1;
      if (last?.saleNumber) {
        const parts = last.saleNumber.split("-");
        if (parts.length === 3) {
          const num = parseInt(parts[2], 10);
          if (!isNaN(num)) seq = num + 1;
        }
      }
      return `${prefix}${seq.toString().padStart(4, "0")}`;
    } catch (error) {
      this.failClosedInProduction(error);
      const existing = Array.from(SalesStore.sales.values()).filter((s) =>
        s.saleNumber?.startsWith(prefix),
      );
      return `${prefix}${(existing.length + 1).toString().padStart(4, "0")}`;
    }
  }

  public static async createSale(dto: CreateSaleDto, userContext: UserContext) {
    if (dto.idempotencyKey) {
      const cached = await IdempotencyService.check(
        dto.idempotencyKey,
        "/api/sales",
      );
      if (cached) return cached.responseBody;
    }
    const limitCheck = FinancialRulesService.validarLimiteProductosVenta(
      dto.items.length,
    );
    if (!limitCheck.valido) throw new Error(limitCheck.mensaje);
    if (dto.items.length === 0)
      throw new Error("La venta debe incluir al menos 1 producto.");
    const saleType = dto.saleType || "CREDIT";
    const warehouseId = dto.warehouseId || "wh_central";
    const saleNumber = await this.generateSaleNumber();
    const saleId = `sale_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
    let totalListPrice = new Decimal(0),
      subtotal = new Decimal(0),
      requiresAuthorization = false;
    const authorizationMetadata =
      saleType === "CREDIT"
        ? {
            paymentFrequency: dto.paymentFrequency || "WEEKLY",
            installmentsCount: dto.installmentsCount || 10,
            firstPaymentDate: dto.firstPaymentDate
              ? new Date(dto.firstPaymentDate).toISOString()
              : new Date(Date.now() + 7 * 86400000).toISOString(),
          }
        : null;
    const authReasons: string[] = [];
    if (dto.items.length === 2) {
      requiresAuthorization = true;
      authReasons.push("TWO_PRODUCT_SALE");
    }
    const itemsData = dto.items.map((it, idx) => {
      const qty = it.quantity || 1;
      const unitPrice = new Decimal(it.unitPrice || it.negotiatedPrice || 1490);
      const negotiatedPrice = new Decimal(it.negotiatedPrice || unitPrice);
      const minimumAuthorizedPrice = new Decimal(
        it.minimumAuthorizedPrice || unitPrice,
      );
      const itemSubtotal = negotiatedPrice.mul(qty),
        itemTotalListPrice = unitPrice.mul(qty);
      totalListPrice = totalListPrice.plus(itemTotalListPrice);
      subtotal = subtotal.plus(itemSubtotal);
      if (negotiatedPrice.lessThan(minimumAuthorizedPrice)) {
        requiresAuthorization = true;
        authReasons.push(`PRICE_OVERRIDE_ITEM_${idx + 1}`);
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
    const aporteEmpresa =
      FinancialRulesService.calcularAporteEmpresa(engancheCliente);
    const calcResult = FinancialRulesService.calcularSaldoFinanciado({
      precioLista: subtotal,
      engancheCliente,
      aporteEmpresa,
    });
    if (!calcResult.esInvarianteValida)
      throw new Error(
        `Invariante financiera inválida: ${calcResult.mensajesValidacion.join(", ")}`,
      );
    const totalDiscount = calcResult.descuentoComercialTotal,
      totalFinanced = calcResult.saldoFinanciado;
    let status: "DRAFT" | "PENDING_AUTHORIZATION" | "APPROVED" | "COMPLETED" =
      requiresAuthorization ? "PENDING_AUTHORIZATION" : "APPROVED";
    const saleRecord = {
      id: saleId,
      saleNumber,
      clientId: dto.clientId,
      sellerId: userContext.userId,
      supervisorId:
        userContext.role === "SUPERVISORA" ? userContext.userId : null,
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
      if (requiresAuthorization)
        for (const reason of authReasons)
          await prisma.authorizationRequest.create({
            data: {
              type: reason.startsWith("PRICE")
                ? "PRICE_OVERRIDE"
                : "TWO_PRODUCT_SALE",
              status: "PENDING",
              requestedBy: userContext.userId,
              saleId,
              reason: authorizationMetadata
                ? `${reason}\nMETA:${JSON.stringify(authorizationMetadata)}`
                : reason,
            },
          });
    } catch (error) {
      this.failClosedInProduction(error);
      SalesStore.sales.set(saleRecord.id, saleRecord);
      for (const item of itemsData) SalesStore.saleItems.set(item.id, item);
      if (requiresAuthorization)
        for (const reason of authReasons) {
          const authReq = {
            id: `auth_${Date.now()}_${Math.random().toString(36).substring(2, 5)}`,
            type: reason.startsWith("PRICE")
              ? "PRICE_OVERRIDE"
              : "TWO_PRODUCT_SALE",
            status: "PENDING",
            requestedBy: userContext.userId,
            saleId,
            reason: authorizationMetadata
              ? `${reason}\nMETA:${JSON.stringify(authorizationMetadata)}`
              : reason,
            createdAt: new Date(),
          };
          SalesStore.authorizationRequests.set(authReq.id, authReq);
        }
      createdSale = saleRecord;
    }
    for (const item of itemsData)
      await InventoryService.reserveStock({
        productId: item.productId,
        warehouseId,
        quantity: item.quantity,
        saleId,
        userId: userContext.userId,
        idempotencyKey: dto.idempotencyKey
          ? `${dto.idempotencyKey}_res_${item.productId}`
          : undefined,
      });
    let downPaymentRecord = null,
      companyContributionRecord = null;
    if (engancheCliente.greaterThan(0)) {
      const dpResult = await this.registerDownPayment(
        { saleId, amount: engancheCliente, paymentMethod: "CASH" },
        userContext,
      );
      downPaymentRecord = dpResult.downPayment;
      companyContributionRecord = dpResult.companyContribution;
    }
    await AuditLogService.log({
      userId: userContext.userId,
      action: "SALE_CREATED",
      entity: "Sale",
      entityId: saleId,
      newValues: JSON.stringify({ saleNumber, totalFinanced, status }),
      idempotencyKey: dto.idempotencyKey,
    });
    const result = {
      ...createdSale,
      downPayment: downPaymentRecord,
      companyContribution: companyContributionRecord,
      saldoFinanciado: totalFinanced,
      invarianteValida: calcResult.esInvarianteValida,
    };
    if (dto.idempotencyKey)
      await IdempotencyService.record(
        dto.idempotencyKey,
        "/api/sales",
        result,
        201,
      );
    return result;
  }

  public static async registerDownPayment(
    dto: RegisterDownPaymentDto,
    userContext: UserContext,
  ) {
    if (dto.idempotencyKey) {
      const cached = await IdempotencyService.check(
        dto.idempotencyKey,
        `/api/sales/${dto.saleId}/down-payment`,
      );
      if (cached) return cached.responseBody;
    }
    const amount = new Decimal(dto.amount);
    if (amount.lessThanOrEqualTo(0))
      throw new Error("El monto del enganche debe ser mayor a cero.");
    const sale = await this.getSaleById(dto.saleId);
    if (!sale) throw new Error("Venta no encontrada.");
    const paymentMethod = dto.paymentMethod || "CASH";
    const dpId = `dp_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
    const downPaymentStatus =
      paymentMethod === "CASH" ? "COMPLETED" : "PENDING_VERIFICATION";
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
    const companyContributionAmount =
      FinancialRulesService.calcularAporteEmpresa(amount);
    const companyContribution = {
      id: ccId,
      saleId: dto.saleId,
      amount: companyContributionAmount,
      rule: "MATCH_DOWN_PAYMENT_UP_TO_200",
      percentageOrRatio: amount.greaterThan(0)
        ? companyContributionAmount.div(amount)
        : new Decimal(0),
      createdBy: userContext.userId,
      createdAt: new Date(),
    };
    if (paymentMethod === "CASH" && dto.cashSessionId) {
      try {
        const prisma = PrismaService.getInstance();
        const cm = await prisma.cashMovement.create({
          data: {
            cashSessionId: dto.cashSessionId,
            type: "DOWN_PAYMENT",
            amount: amount.toNumber(),
            description: `Enganche de venta ${sale.saleNumber}`,
          },
        });
        downPayment.cashMovementId = cm.id;
      } catch (error) {
        this.failClosedInProduction(error);
        downPayment.cashMovementId = `cm_${Date.now()}`;
      }
    }
    try {
      const prisma = PrismaService.getInstance();
      await prisma.saleDownPayment.create({
        data: {
          id: downPayment.id,
          saleId: downPayment.saleId,
          amount: amount.toNumber(),
          paymentMethod: paymentMethod as any,
          status: downPayment.status,
          cashMovementId: downPayment.cashMovementId,
          createdBy: downPayment.createdBy,
        },
      });
      await prisma.companyContribution.create({
        data: {
          id: companyContribution.id,
          saleId: companyContribution.saleId,
          amount: companyContribution.amount.toNumber(),
          rule: companyContribution.rule,
          percentageOrRatio: companyContribution.percentageOrRatio.toNumber(),
          createdBy: companyContribution.createdBy,
        },
      });
    } catch (error) {
      this.failClosedInProduction(error);
      SalesStore.downPayments.set(dto.saleId, downPayment);
      SalesStore.companyContributions.set(dto.saleId, companyContribution);
    }
    await AuditLogService.log({
      userId: userContext.userId,
      action: "DOWN_PAYMENT_CREATED",
      entity: "SaleDownPayment",
      entityId: dpId,
      newValues: JSON.stringify({
        amount,
        paymentMethod,
        status: downPaymentStatus,
      }),
      idempotencyKey: dto.idempotencyKey,
    });
    await AuditLogService.log({
      userId: userContext.userId,
      action: "COMPANY_CONTRIBUTION_CREATED",
      entity: "CompanyContribution",
      entityId: ccId,
      newValues: JSON.stringify({
        amount: companyContributionAmount,
        rule: companyContribution.rule,
      }),
      idempotencyKey: dto.idempotencyKey,
    });
    const response = {
      downPayment,
      companyContribution,
      descuentoComercialGenerado: amount.plus(companyContributionAmount),
    };
    if (dto.idempotencyKey)
      await IdempotencyService.record(
        dto.idempotencyKey,
        `/api/sales/${dto.saleId}/down-payment`,
        response,
        201,
      );
    return response;
  }

  public static async approveSale(
    saleId: string,
    userContext: UserContext,
    notes?: string,
  ) {
    if (userContext.role !== "SUPERVISORA" && userContext.role !== "ADMIN")
      throw new Error(
        "Permisos insuficientes: Solo SUPERVISORA o ADMIN pueden autorizar ventas.",
      );
    const sale = await this.getSaleById(saleId);
    if (!sale) throw new Error("Venta no encontrada.");
    try {
      const prisma = PrismaService.getInstance();
      await prisma.sale.update({
        where: { id: saleId },
        data: {
          status: "APPROVED",
          supervisorId: userContext.userId,
          updatedAt: new Date(),
        },
      });
      await prisma.authorizationRequest.updateMany({
        where: { saleId, status: "PENDING" },
        data: {
          status: "APPROVED",
          approvedBy: userContext.userId,
          updatedAt: new Date(),
        },
      });
    } catch (error) {
      this.failClosedInProduction(error);
      if (SalesStore.sales.has(saleId)) {
        const s = SalesStore.sales.get(saleId);
        s.status = "APPROVED";
        s.supervisorId = userContext.userId;
        s.updatedAt = new Date();
      }
      for (const authReq of SalesStore.authorizationRequests.values())
        if (authReq.saleId === saleId && authReq.status === "PENDING") {
          authReq.status = "APPROVED";
          authReq.approvedBy = userContext.userId;
        }
    }
    await AuditLogService.log({
      userId: userContext.userId,
      action: "SALE_APPROVED",
      entity: "Sale",
      entityId: saleId,
      notes: notes || "Venta autorizada por supervisión",
    });
    return { success: true, saleId, status: "APPROVED" };
  }

  public static async requestDownPaymentException(
    dto: RequestDownPaymentExceptionDto,
    userContext: UserContext,
  ) {
    const requestedAmount = new Decimal(dto.requestedAmount);
    const excId = `exc_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
    const exc = {
      id: excId,
      saleId: dto.saleId,
      requestedAmount,
      reason: dto.reason,
      requestedBy: userContext.userId,
      approvedBy: null as string | null,
      status: "PENDING",
      createdAt: new Date(),
    };
    try {
      const prisma = PrismaService.getInstance();
      await prisma.downPaymentException.create({
        data: {
          id: exc.id,
          saleId: exc.saleId,
          requestedAmount: requestedAmount.toNumber(),
          reason: exc.reason,
          requestedBy: exc.requestedBy,
          status: "PENDING",
        },
      });
    } catch (error) {
      this.failClosedInProduction(error);
      SalesStore.exceptions.set(dto.saleId, exc);
    }
    await AuditLogService.log({
      userId: userContext.userId,
      action: "DOWN_PAYMENT_EXCEPTION_REQUESTED",
      entity: "DownPaymentException",
      entityId: excId,
      newValues: JSON.stringify({ requestedAmount, reason: dto.reason }),
    });
    return exc;
  }

  public static async approveDownPaymentException(
    saleId: string,
    userContext: UserContext,
  ) {
    if (userContext.role !== "SUPERVISORA" && userContext.role !== "ADMIN")
      throw new Error(
        "Permisos insuficientes: Solo SUPERVISORA o ADMIN pueden aprobar excepciones de enganche.",
      );
    try {
      const prisma = PrismaService.getInstance();
      await prisma.downPaymentException.update({
        where: { saleId },
        data: {
          status: "APPROVED",
          approvedBy: userContext.userId,
          approvedAt: new Date(),
        },
      });
    } catch (error) {
      this.failClosedInProduction(error);
      const exc = SalesStore.exceptions.get(saleId);
      if (exc) {
        exc.status = "APPROVED";
        exc.approvedBy = userContext.userId;
        exc.approvedAt = new Date();
      }
    }
    await AuditLogService.log({
      userId: userContext.userId,
      action: "DOWN_PAYMENT_EXCEPTION_APPROVED",
      entity: "DownPaymentException",
      entityId: saleId,
    });
    return { success: true, saleId, status: "APPROVED" };
  }

  public static async createCredit(
    dto: CreateCreditDto,
    userContext: UserContext,
  ) {
    if (dto.idempotencyKey) {
      const cached = await IdempotencyService.check(
        dto.idempotencyKey,
        `/api/sales/${dto.saleId}/credit`,
      );
      if (cached) return cached.responseBody;
    }
    const sale = await this.getSaleById(dto.saleId);
    if (!sale) throw new Error("Venta no encontrada.");
    let downPaymentRecord = await this.getDownPaymentBySaleId(dto.saleId);
    // BITALIS permite iniciar una venta sin enganche. En ese caso el crédito se
    // crea por el total y el primer cobro preguntará si se trata de enganche o abono.
    const frequency = dto.paymentFrequency || "WEEKLY";
    const installmentsCount = dto.installmentsCount || 10;
    const firstPaymentDate = dto.firstPaymentDate
      ? new Date(dto.firstPaymentDate)
      : new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
    const items: any[] = sale.items || [];
    const createdCredits: any[] = [];
    const allSchedules: any[] = [];
    const saleSubtotal = new Decimal(sale.subtotal || sale.totalAmount);
    const saleEnganche = new Decimal(downPaymentRecord?.amount || 0);
    const saleAporte =
      FinancialRulesService.calcularAporteEmpresa(saleEnganche);
    if (!items.length) throw new Error("La venta no tiene productos relacionados.");
    // Un crédito consolidado por venta evita saldos parciales y cobros aplicados
    // sólo a uno de varios productos. Los productos permanecen relacionados por SaleItem.
    for (let i = 0; i < 1; i++) {
      const itemSubtotal = saleSubtotal;
      const itemEnganche = saleEnganche;
      const itemAporte = saleAporte;
      const creditSaldo = FinancialRulesService.calcularSaldoFinanciado({
        precioLista: itemSubtotal,
        engancheCliente: itemEnganche,
        aporteEmpresa: itemAporte,
      }).saldoFinanciado;
      const calendar = PaymentCalendarService.buildWholeAmounts({
        balance: creditSaldo,
        requestedInstallments: installmentsCount,
        frequency,
      });
      const effectiveInstallmentsCount = calendar.amounts.length;
      const suggestedInstallment = calendar.regularAmount;
      const creditId = `cred_${Date.now()}_${i}_${Math.random().toString(36).substring(2, 5)}`;
      const creditRecord = {
        id: creditId,
        saleId: dto.saleId,
        clientId: sale.clientId,
        saleItemId: null,
        productId: null,
        principalAmount: itemSubtotal,
        engancheCliente: itemEnganche,
        aporteEmpresa: itemAporte,
        saldoActual: creditSaldo,
        paymentFrequency: frequency,
        suggestedInstallment,
        status: "ACTIVE",
        createdAt: new Date(),
        updatedAt: new Date(),
      };
      const creditSchedules: any[] = [];
      let stepDays =
        frequency === "BIWEEKLY" ? 14 : frequency === "MONTHLY" ? 30 : 7;
      for (let n = 1; n <= effectiveInstallmentsCount; n++) {
        const schedDate = new Date(
          firstPaymentDate.getTime() + (n - 1) * stepDays * 86400000,
        );
        const amountForThisInstallment = calendar.amounts[n - 1];
        const scheduleItem = {
          id: `sched_${Date.now()}_${n}_${Math.random().toString(36).substring(2, 5)}`,
          creditId,
          installmentNumber: n,
          scheduledDate: schedDate,
          originalScheduledDate: schedDate,
          suggestedAmount: amountForThisInstallment,
          status: "PENDING",
          createdAt: new Date(),
          updatedAt: new Date(),
        };
        creditSchedules.push(scheduleItem);
        allSchedules.push(scheduleItem);
      }
      try {
        const prisma = PrismaService.getInstance();
        await prisma.credit.create({
          data: {
            id: creditRecord.id,
            saleId: creditRecord.saleId,
            clientId: creditRecord.clientId,
            saleItemId: creditRecord.saleItemId,
            productId: creditRecord.productId,
            principalAmount: creditRecord.principalAmount.toNumber(),
            engancheCliente: creditRecord.engancheCliente.toNumber(),
            aporteEmpresa: creditRecord.aporteEmpresa.toNumber(),
            saldoActual: creditRecord.saldoActual.toNumber(),
            paymentFrequency: creditRecord.paymentFrequency as any,
            suggestedInstallment: creditRecord.suggestedInstallment.toNumber(),
            status: creditRecord.status as any,
            schedules: {
              create: creditSchedules.map((s) => ({
                id: s.id,
                installmentNumber: s.installmentNumber,
                scheduledDate: s.scheduledDate,
                originalScheduledDate: s.originalScheduledDate,
                suggestedAmount: s.suggestedAmount.toNumber(),
                status: s.status as any,
              })),
            },
          },
        });
      } catch (error) {
        this.failClosedInProduction(error);
        SalesStore.credits.set(creditRecord.id, creditRecord);
        for (const s of creditSchedules) SalesStore.schedules.set(s.id, s);
      }
      const commAmount = creditSaldo.mul(0.03).toDecimalPlaces(2),
        commId = `comm_${Date.now()}_${i}`;
      const commRecord = {
        id: commId,
        saleId: dto.saleId,
        creditId,
        userId: sale.sellerId,
        role: "VENDEDORA",
        type: "SALE_COMMISSION",
        amount: commAmount,
        status: "PENDING",
        createdAt: new Date(),
      };
      try {
        const prisma = PrismaService.getInstance();
        await prisma.commission.create({
          data: {
            id: commRecord.id,
            saleId: commRecord.saleId,
            creditId: commRecord.creditId,
            employeeId: commRecord.userId,
            role: "VENDEDORA",
            commissionType: "SALE_COMMISSION",
            baseAmount: creditSaldo,
            rate: new Decimal("0.0300"),
            commissionAmount: commAmount,
            status: "CALCULATED",
            idempotencyKey: `COMM-SALE-${commRecord.saleId}-${commRecord.creditId}`,
          },
        });
      } catch (error) {
        this.failClosedInProduction(error);
        SalesStore.commissions.set(commId, commRecord);
      }
      createdCredits.push(creditRecord);
      await AuditLogService.log({
        userId: userContext.userId,
        action: "CREDIT_CREATED",
        entity: "Credit",
        entityId: creditId,
        newValues: JSON.stringify({
          creditSaldo,
          frequency,
          requestedInstallmentsCount: installmentsCount,
          installmentsCount: effectiveInstallmentsCount,
        }),
        idempotencyKey: dto.idempotencyKey,
      });
    }
    try {
      const prisma = PrismaService.getInstance();
      await prisma.client.update({ where: { id: sale.clientId }, data: { status: "ACTIVE", updatedAt: new Date() } });
    } catch (error) { this.failClosedInProduction(error); }
    const response = {
      credits: createdCredits,
      schedules: allSchedules,
      totalCreditsCount: createdCredits.length,
    };
    if (dto.idempotencyKey)
      await IdempotencyService.record(
        dto.idempotencyKey,
        `/api/sales/${dto.saleId}/credit`,
        response,
        201,
      );
    return response;
  }

  public static async settleCredit(
    dto: SettleCreditDto,
    userContext: UserContext,
  ) {
    if (dto.idempotencyKey) {
      const cached = await IdempotencyService.check(
        dto.idempotencyKey,
        `/api/credits/${dto.creditId}/settle`,
      );
      if (cached) return cached.responseBody;
    }
    const credit = await this.getCreditById(dto.creditId);
    if (!credit) throw new Error("Crédito no encontrado.");
    if (credit.status === "SETTLED")
      throw new Error("El crédito ya se encuentra liquidado.");
    const outstandingBalance = new Decimal(credit.saldoActual);
    if (outstandingBalance.lessThanOrEqualTo(0))
      throw new Error(
        "El saldo pendiente debe ser mayor a cero para liquidar.",
      );
    const discountAmount = outstandingBalance.mul(0.1).toDecimalPlaces(2),
      settlementAmount = outstandingBalance
        .minus(discountAmount)
        .toDecimalPlaces(2),
      paymentMethod = dto.paymentMethod || "CASH",
      settlementId = `stl_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
    const settlement = {
      id: settlementId,
      saleId: credit.saleId,
      creditId: dto.creditId,
      outstandingBalance,
      discountAmount,
      settlementAmount,
      paymentMethod,
      cashMovementId: null as string | null,
      status: "COMPLETED",
      createdBy: userContext.userId,
      createdAt: new Date(),
    };
    if (paymentMethod === "CASH" && dto.cashSessionId) {
      try {
        const prisma = PrismaService.getInstance();
        const cm = await prisma.cashMovement.create({
          data: {
            cashSessionId: dto.cashSessionId,
            type: "PAYMENT",
            amount: settlementAmount.toNumber(),
            description: `Liquidación anticipada de crédito ${dto.creditId}`,
          },
        });
        settlement.cashMovementId = cm.id;
      } catch (error) {
        this.failClosedInProduction(error);
        settlement.cashMovementId = `cm_stl_${Date.now()}`;
      }
    }
    try {
      const prisma = PrismaService.getInstance();
      await prisma.credit.update({
        where: { id: dto.creditId },
        data: { saldoActual: 0, status: "SETTLED", updatedAt: new Date() },
      });
      await prisma.settlement.create({
        data: {
          id: settlement.id,
          saleId: settlement.saleId,
          creditId: settlement.creditId,
          outstandingBalance: outstandingBalance.toNumber(),
          discountAmount: discountAmount.toNumber(),
          settlementAmount: settlementAmount.toNumber(),
          paymentMethod: paymentMethod as any,
          cashMovementId: settlement.cashMovementId,
          status: "COMPLETED",
          createdBy: settlement.createdBy,
        },
      });
      await prisma.paymentSchedule.updateMany({
        where: { creditId: dto.creditId, status: "PENDING" },
        data: { status: "CANCELLED", updatedAt: new Date() },
      });
    } catch (error) {
      this.failClosedInProduction(error);
      credit.saldoActual = new Decimal(0);
      credit.status = "SETTLED";
      credit.updatedAt = new Date();
      SalesStore.settlements.set(settlementId, settlement);
      for (const s of SalesStore.schedules.values())
        if (s.creditId === dto.creditId && s.status === "PENDING")
          s.status = "CANCELLED";
    }
    await AuditLogService.log({
      userId: userContext.userId,
      action: "CREDIT_SETTLED",
      entity: "Settlement",
      entityId: settlementId,
      newValues: JSON.stringify({
        outstandingBalance,
        discountAmount,
        settlementAmount,
      }),
      idempotencyKey: dto.idempotencyKey,
    });
    const result = {
      settlement,
      creditId: dto.creditId,
      saldoAnterior: outstandingBalance,
      descuento10Pct: discountAmount,
      montoMapeadoLiquidacion: settlementAmount,
      nuevoSaldo: new Decimal(0),
      status: "SETTLED",
    };
    if (dto.idempotencyKey)
      await IdempotencyService.record(
        dto.idempotencyKey,
        `/api/credits/${dto.creditId}/settle`,
        result,
        200,
      );
    return result;
  }

  public static async cancelSale(
    saleId: string,
    reason: string,
    userContext: UserContext,
  ) {
    const sale = await this.getSaleById(saleId);
    if (!sale) throw new Error("Venta no encontrada.");
    if (sale.status === "CANCELLED")
      throw new Error("La venta ya se encuentra cancelada.");
    try {
      const prisma = PrismaService.getInstance();
      await prisma.sale.update({
        where: { id: saleId },
        data: { status: "CANCELLED", updatedAt: new Date() },
      });
      const reservations = await prisma.inventoryReservation.findMany({
        where: { saleId, status: "ACTIVE" },
      });
      for (const res of reservations)
        await InventoryService.releaseReservation(
          res.id,
          userContext.userId,
          `Venta ${saleId} cancelada`,
        );
    } catch (error) {
      this.failClosedInProduction(error);
      sale.status = "CANCELLED";
      sale.updatedAt = new Date();
    }
    await AuditLogService.log({
      userId: userContext.userId,
      action: "SALE_CANCELLED",
      entity: "Sale",
      entityId: saleId,
      notes: reason || "Cancelación de venta y liberación de inventario",
    });
    return { success: true, saleId, status: "CANCELLED" };
  }

  public static async getSaleById(saleId: string) {
    try {
      const prisma = PrismaService.getInstance();
      const sale = await prisma.sale.findUnique({
        where: { id: saleId },
        include: {
          items: { include: { product: true } },
          client: { include: { profile: true } },
          seller: true,
          credits: { include: { schedules: true } },
          downPayment: true,
          companyContribution: true,
          downPaymentException: true,
        },
      });
      if (sale) return sale;
    } catch (error) {
      this.failClosedInProduction(error);
    }
    const memorySale = SalesStore.sales.get(saleId);
    if (memorySale) {
      const items = Array.from(SalesStore.saleItems.values()).filter(
        (i) => i.saleId === saleId,
      );
      const credits = Array.from(SalesStore.credits.values()).filter(
        (c) => c.saleId === saleId,
      );
      for (const cred of credits)
        cred.schedules = Array.from(SalesStore.schedules.values()).filter(
          (s) => s.creditId === cred.id,
        );
      return {
        ...memorySale,
        items,
        credits,
        downPayment: SalesStore.downPayments.get(saleId) || null,
        companyContribution:
          SalesStore.companyContributions.get(saleId) || null,
        downPaymentException: SalesStore.exceptions.get(saleId) || null,
      };
    }
    return null;
  }

  public static async getCreditById(creditId: string) {
    try {
      const prisma = PrismaService.getInstance();
      const credit = await prisma.credit.findUnique({
        where: { id: creditId },
        include: { schedules: true, sale: true, client: true },
      });
      if (credit) return credit;
    } catch (error) {
      this.failClosedInProduction(error);
    }
    const memoryCredit = SalesStore.credits.get(creditId);
    if (memoryCredit)
      return {
        ...memoryCredit,
        schedules: Array.from(SalesStore.schedules.values()).filter(
          (s) => s.creditId === creditId,
        ),
      };
    return null;
  }

  public static async getDownPaymentBySaleId(saleId: string) {
    try {
      const prisma = PrismaService.getInstance();
      const dp = await prisma.saleDownPayment.findUnique({ where: { saleId } });
      if (dp) return dp;
    } catch (error) {
      this.failClosedInProduction(error);
    }
    return SalesStore.downPayments.get(saleId) || null;
  }
  public static async getExceptionBySaleId(saleId: string) {
    try {
      const prisma = PrismaService.getInstance();
      const exc = await prisma.downPaymentException.findUnique({
        where: { saleId },
      });
      if (exc) return exc;
    } catch (error) {
      this.failClosedInProduction(error);
    }
    return SalesStore.exceptions.get(saleId) || null;
  }
  public static async getSalesList() {
    try {
      const prisma = PrismaService.getInstance();
      const list = await prisma.sale.findMany({
        include: {
          items: { include: { product: true } },
          client: true,
          credits: { include: { payments: true, schedules: true } },
        },
        orderBy: { createdAt: "desc" },
      });
      if (list.length > 0) return list;
    } catch (error) {
      this.failClosedInProduction(error);
    }
    return Array.from(SalesStore.sales.values());
  }
  public static async getAllCredits() {
    try {
      const prisma = PrismaService.getInstance();
      const list = await prisma.credit.findMany({
        include: { schedules: true, client: true },
      });
      if (list.length > 0) return list;
    } catch (error) {
      this.failClosedInProduction(error);
    }
    return Array.from(SalesStore.credits.values());
  }
  public static async getAllSchedules() {
    try {
      const prisma = PrismaService.getInstance();
      const list = await prisma.paymentSchedule.findMany({});
      if (list.length > 0) return list;
    } catch (error) {
      this.failClosedInProduction(error);
    }
    return Array.from(SalesStore.schedules.values());
  }
}
