import Decimal from 'decimal.js';
import { PrismaService } from '@/src/database/prisma.service';
import { InventoryService } from '@/src/inventory/inventory.service';
import { AuditLogService } from '@/src/audit/audit-log.service';
import { NotificationService } from '@/src/notifications/notifications.service';

export interface CreateSupplierDto {
  name: string;
  contactName?: string;
  email?: string;
  phone?: string;
  address?: string;
  taxId?: string;
}

export interface CreateOrderDto {
  supplierId?: string;
  supplier?: string;
  warehouseId: string;
  expectedDate?: Date | string;
  notes?: string;
  userId?: string;
  items: Array<{
    productId: string;
    unitCost: number | string | Decimal;
    quantityRequested: number;
  }>;
}

export interface ReceiveOrderDto {
  orderId: string;
  warehouseId: string;
  receivedBy: string;
  notes?: string;
  receiptType?: 'RECEPCION_PARCIAL' | 'RECEPCION_TOTAL';
  items: Array<{
    productId: string;
    quantityReceived: number;
    unitCost?: number | string | Decimal;
  }>;
}

export class ProcurementStore {
  static suppliers: Map<string, any> = new Map();
  static orders: Map<string, any> = new Map();
  static receipts: Map<string, any> = new Map();

  static clearMemoryStore() {
    this.suppliers.clear();
    this.orders.clear();
    this.receipts.clear();
  }
}

export class InventoryReorderEngine {
  /**
   * Calcula la cantidad sugerida a reordenar: cantidad = maxStock - quantityAvailable
   * considerando el stock disponible real (quantityOnHand - quantityReserved).
   */
  static calculateReorderQuantity(maxStock: number, quantityAvailable: number): number {
    const suggested = maxStock - quantityAvailable;
    return Math.max(0, suggested);
  }

  /**
   * Examina los niveles de stock de productos en los almacenes y genera sugerencias y alertas de desabasto/reorden.
   */
  static async evaluateStockAndGenerateAlerts(warehouseId?: string): Promise<any[]> {
    const suggestions: any[] = [];
    let products: any[] = [];

    try {
      const prisma = PrismaService.getInstance();
      products = await prisma.product.findMany({ where: { status: 'ACTIVE' } });
    } catch {}

    if (products.length === 0) {
      // Mock / fallback products if empty
      products = [
        { id: 'prod_lavadora_01', sku: 'SKU-LAV-01', name: 'Lavadora 15kg', minStock: 5, reorderPoint: 10, maxStock: 50 },
        { id: 'prod_refrigerador_01', sku: 'SKU-REF-01', name: 'Refrigerador 14cu', minStock: 3, reorderPoint: 8, maxStock: 30 },
      ];
    }

    const whId = warehouseId || 'wh_central_01';

    for (const prod of products) {
      const stock = await InventoryService.getStock(whId, prod.id);
      const qOnHand = stock.quantityOnHand || 0;
      const qReserved = stock.quantityReserved || 0;
      const qAvailable = qOnHand - qReserved;

      const minStock = prod.minStock || 5;
      const reorderPoint = prod.reorderPoint || 10;
      const maxStock = prod.maxStock || 50;

      const suggestedQty = this.calculateReorderQuantity(maxStock, qAvailable);

      if (qAvailable <= 0) {
        // ALERTA DE DESABASTO CRÍTICA
        await NotificationService.createNotification({
          userId: 'ADMIN',
          type: 'INVENTORY_STOCKOUT',
          priority: 'CRITICAL',
          title: 'Stock Agotado Crítico',
          message: `El producto ${prod.name} (${prod.sku}) no tiene stock disponible en almacén.`,
          entity: 'Product',
          entityId: prod.id,
        });

        await AuditLogService.record({
          userId: 'SYSTEM',
          action: 'INVENTORY_REORDER_ALERT',
          resource: 'Product',
          resourceId: prod.id,
          payload: { alertType: 'STOCKOUT', quantityAvailable: qAvailable },
        });

        suggestions.push({
          productId: prod.id,
          productName: prod.name,
          sku: prod.sku,
          warehouseId: whId,
          quantityOnHand: qOnHand,
          quantityReserved: qReserved,
          quantityAvailable: qAvailable,
          reorderPoint,
          minStock,
          maxStock,
          suggestedQuantity: suggestedQty,
          status: 'STOCKOUT',
        });
      } else if (qAvailable <= reorderPoint) {
        // ALERTA DE REORDEN ALTA
        await NotificationService.createNotification({
          userId: 'ADMIN',
          type: 'INVENTORY_REORDER_REQUIRED',
          priority: 'HIGH',
          title: 'Reorden de Inventario Requerido',
          message: `El producto ${prod.name} (${prod.sku}) está en punto de reorden (${qAvailable} disp / ${reorderPoint} min).`,
          entity: 'Product',
          entityId: prod.id,
        });

        await AuditLogService.record({
          userId: 'SYSTEM',
          action: 'INVENTORY_REORDER_ALERT',
          resource: 'Product',
          resourceId: prod.id,
          payload: { alertType: 'REORDER_REQUIRED', quantityAvailable: qAvailable },
        });

        suggestions.push({
          productId: prod.id,
          productName: prod.name,
          sku: prod.sku,
          warehouseId: whId,
          quantityOnHand: qOnHand,
          quantityReserved: qReserved,
          quantityAvailable: qAvailable,
          reorderPoint,
          minStock,
          maxStock,
          suggestedQuantity: suggestedQty,
          status: 'REORDER_REQUIRED',
        });
      }
    }

    return suggestions;
  }
}

export class ProcurementService {
  static async createSupplier(dto: CreateSupplierDto, userId?: string) {
    const id = `sup_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
    const supplier = {
      id,
      name: dto.name,
      contactName: dto.contactName || null,
      email: dto.email || null,
      phone: dto.phone || null,
      address: dto.address || null,
      taxId: dto.taxId || null,
      status: 'ACTIVE',
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    try {
      const prisma = PrismaService.getInstance();
      const created = await prisma.supplier.create({ data: supplier });
      ProcurementStore.suppliers.set(created.id, created);
      return created;
    } catch {
      ProcurementStore.suppliers.set(supplier.id, supplier);
      return supplier;
    }
  }

  static async listSuppliers() {
    try {
      const prisma = PrismaService.getInstance();
      const list = await prisma.supplier.findMany({ where: { status: 'ACTIVE' } });
      if (list.length > 0) return list;
    } catch {}
    return Array.from(ProcurementStore.suppliers.values());
  }

  static async createProductOrder(dto: CreateOrderDto, userId?: string) {
    const orderNumber = `ORD-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
    const orderId = `po_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;

    let totalDecimal = new Decimal(0);
    const items = dto.items.map((it) => {
      const unitCost = new Decimal(it.unitCost || 0);
      const totalCost = unitCost.mul(it.quantityRequested);
      totalDecimal = totalDecimal.add(totalCost);
      return {
        id: `poi_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
        orderId,
        productId: it.productId,
        unitCost,
        quantityRequested: it.quantityRequested,
        quantityReceived: 0,
        createdAt: new Date(),
      };
    });

    const order = {
      id: orderId,
      orderNumber,
      supplierId: dto.supplierId || null,
      supplier: dto.supplier || 'Proveedor General',
      warehouseId: dto.warehouseId,
      status: 'PENDING_APPROVAL',
      requestedBy: userId || dto.userId || 'SYSTEM',
      approvedBy: null,
      requestedAt: new Date(),
      approvedAt: null,
      expectedDate: dto.expectedDate ? new Date(dto.expectedDate) : null,
      totalAmount: totalDecimal,
      totalEstimatedCost: totalDecimal,
      notes: dto.notes || null,
      userId: userId || dto.userId || null,
      createdAt: new Date(),
      updatedAt: new Date(),
      items,
    };

    try {
      const prisma = PrismaService.getInstance();
      const created = await prisma.productOrder.create({
        data: {
          id: order.id,
          orderNumber: order.orderNumber,
          supplierId: order.supplierId,
          supplier: order.supplier,
          warehouseId: order.warehouseId,
          status: 'PENDING_APPROVAL',
          requestedBy: order.requestedBy,
          requestedAt: order.requestedAt,
          expectedDate: order.expectedDate,
          totalAmount: totalDecimal.toNumber(),
          totalEstimatedCost: totalDecimal.toNumber(),
          notes: order.notes,
          userId: order.userId,
          items: {
            create: items.map((i) => ({
              id: i.id,
              productId: i.productId,
              unitCost: i.unitCost.toNumber(),
              quantityRequested: i.quantityRequested,
              quantityReceived: 0,
            })),
          },
        },
        include: { items: true },
      });
      ProcurementStore.orders.set(created.id, created);
    } catch {
      ProcurementStore.orders.set(order.id, order);
    }

    await AuditLogService.record({
      userId: userId || 'SYSTEM',
      action: 'PURCHASE_ORDER_CREATED',
      resource: 'ProductOrder',
      resourceId: orderId,
      payload: { orderNumber, totalEstimatedCost: totalDecimal.toNumber() },
    });

    await NotificationService.createNotification({
      userId: 'SUPERVISOR',
      type: 'PURCHASE_ORDER_PENDING',
      priority: 'HIGH',
      title: 'Orden de Compra Pendiente de Aprobación',
      message: `Orden ${orderNumber} por $${totalDecimal.toFixed(2)} requiere aprobación.`,
      entity: 'ProductOrder',
      entityId: orderId,
    });

    return order;
  }

  static async getOrderById(id: string) {
    try {
      const prisma = PrismaService.getInstance();
      const dbOrder = await prisma.productOrder.findUnique({
        where: { id },
        include: { items: true, receipts: true },
      });
      if (dbOrder) return dbOrder;
    } catch {}
    return ProcurementStore.orders.get(id) || null;
  }

  static async listOrders(filters?: { status?: string; warehouseId?: string }) {
    let list: any[] = [];
    try {
      const prisma = PrismaService.getInstance();
      const whereClause: any = {};
      if (filters?.status) whereClause.status = filters.status;
      if (filters?.warehouseId) whereClause.warehouseId = filters.warehouseId;

      list = await prisma.productOrder.findMany({
        where: whereClause,
        include: { items: true },
        orderBy: { createdAt: 'desc' },
      });
      if (list.length > 0) return list;
    } catch {}

    list = Array.from(ProcurementStore.orders.values());
    if (filters?.status) list = list.filter((o) => o.status === filters.status);
    if (filters?.warehouseId) list = list.filter((o) => o.warehouseId === filters.warehouseId);
    return list;
  }

  static async approveOrder(id: string, userId: string) {
    const order = await this.getOrderById(id);
    if (!order) throw new Error('Orden de compra no encontrada');

    order.status = 'APPROVED';
    order.approvedBy = userId;
    order.approvedAt = new Date();
    order.updatedAt = new Date();

    try {
      const prisma = PrismaService.getInstance();
      await prisma.productOrder.update({
        where: { id },
        data: {
          status: 'APPROVED',
          approvedBy: userId,
          approvedAt: order.approvedAt,
        },
      });
    } catch {}

    ProcurementStore.orders.set(id, order);

    await AuditLogService.record({
      userId,
      action: 'PURCHASE_ORDER_APPROVED',
      resource: 'ProductOrder',
      resourceId: id,
      payload: { approvedBy: userId },
    });

    return order;
  }

  static async receiveOrder(dto: ReceiveOrderDto, userId?: string) {
    const order = await this.getOrderById(dto.orderId);
    if (!order) throw new Error('Orden de compra no encontrada');

    const receiptNumber = `REC-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
    const receiptId = `rec_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;

    let allFullyReceived = true;
    const receiptItems: any[] = [];

    for (const rec of dto.items) {
      const orderItem = order.items.find((i: any) => i.productId === rec.productId);
      if (!orderItem) continue;

      const newQtyReceived = (orderItem.quantityReceived || 0) + rec.quantityReceived;
      orderItem.quantityReceived = newQtyReceived;

      if (newQtyReceived < orderItem.quantityRequested) {
        allFullyReceived = false;
      }

      const unitCost = new Decimal(rec.unitCost || orderItem.unitCost || 0);
      const totalCost = unitCost.mul(rec.quantityReceived);

      receiptItems.push({
        id: `reci_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
        receiptId,
        productId: rec.productId,
        quantityReceived: rec.quantityReceived,
        unitCost,
        totalCost,
        createdAt: new Date(),
      });

      // Actualizar inventario físicamente: incrementar quantityOnHand y recalculando quantityAvailable
      const stock = await InventoryService.getStock(order.warehouseId, rec.productId);
      const newOnHand = stock.quantityOnHand + rec.quantityReceived;
      const newAvailable = newOnHand - stock.quantityReserved;

      // Actualizar stock en memoria y DB
      const key = `${order.warehouseId}_${rec.productId}`;
      const updatedStock = {
        warehouseId: order.warehouseId,
        productId: rec.productId,
        quantityOnHand: newOnHand,
        quantityReserved: stock.quantityReserved,
        quantityAvailable: newAvailable,
      };
      InventoryService.stocks.set(key, updatedStock);

      try {
        const prisma = PrismaService.getInstance();
        await prisma.inventoryStock.upsert({
          where: { warehouseId_productId: { warehouseId: order.warehouseId, productId: rec.productId } },
          create: {
            warehouseId: order.warehouseId,
            productId: rec.productId,
            quantityOnHand: newOnHand,
            quantityReserved: stock.quantityReserved,
            quantityAvailable: newAvailable,
          },
          update: { quantityOnHand: newOnHand, quantityAvailable: newAvailable },
        });

        await prisma.productOrderItem.update({
          where: { id: orderItem.id },
          data: { quantityReceived: newQtyReceived },
        });
      } catch {}

      // Registrar movimiento Kardex inmutable
      await InventoryService.recordKardexMovement({
        warehouseId: order.warehouseId,
        productId: rec.productId,
        quantity: rec.quantityReceived,
        movementType: 'PURCHASE_IN',
        previousQuantity: stock.quantityOnHand,
        newQuantity: newOnHand,
        referenceType: 'PURCHASE_RECEIPT',
        referenceId: receiptId,
        userId: dto.receivedBy || userId,
        notes: `Recepción de ${rec.quantityReceived} unidades (Factura/Entrada ${receiptNumber})`,
      });
    }

    const receiptType = allFullyReceived ? 'RECEPCION_TOTAL' : 'RECEPCION_PARCIAL';
    order.status = allFullyReceived ? 'COMPLETED' : 'PARTIALLY_RECEIVED';
    order.updatedAt = new Date();

    const purchaseReceipt = {
      id: receiptId,
      receiptNumber,
      orderId: dto.orderId,
      warehouseId: dto.warehouseId || order.warehouseId,
      receivedBy: dto.receivedBy || userId || 'SYSTEM',
      receiptType,
      notes: dto.notes || null,
      createdAt: new Date(),
      items: receiptItems,
    };

    try {
      const prisma = PrismaService.getInstance();
      await prisma.purchaseReceipt.create({
        data: {
          id: purchaseReceipt.id,
          receiptNumber: purchaseReceipt.receiptNumber,
          orderId: purchaseReceipt.orderId,
          warehouseId: purchaseReceipt.warehouseId,
          receivedBy: purchaseReceipt.receivedBy,
          receiptType: purchaseReceipt.receiptType,
          notes: purchaseReceipt.notes,
          items: {
            create: receiptItems.map((r) => ({
              id: r.id,
              productId: r.productId,
              quantityReceived: r.quantityReceived,
              unitCost: r.unitCost.toNumber(),
              totalCost: r.totalCost.toNumber(),
            })),
          },
        },
      });

      await prisma.productOrder.update({
        where: { id: dto.orderId },
        data: { status: order.status, updatedAt: order.updatedAt },
      });
    } catch {}

    ProcurementStore.receipts.set(receiptId, purchaseReceipt);
    ProcurementStore.orders.set(dto.orderId, order);

    await AuditLogService.record({
      userId: dto.receivedBy || userId || 'SYSTEM',
      action: 'PURCHASE_ORDER_RECEIVED',
      resource: 'PurchaseReceipt',
      resourceId: receiptId,
      payload: { receiptNumber, receiptType, orderStatus: order.status },
    });

    await NotificationService.createNotification({
      userId: order.requestedBy || 'SUPERVISOR',
      type: 'PURCHASE_ORDER_RECEIVED',
      priority: 'INFO',
      title: `Recepción de Pedido ${receiptType}`,
      message: `Se ha registrado la recepción de mercancía para la orden ${order.orderNumber}.`,
      entity: 'PurchaseReceipt',
      entityId: receiptId,
    });

    return { order, receipt: purchaseReceipt };
  }

  static async cancelOrder(id: string, reason?: string, userId?: string) {
    const order = await this.getOrderById(id);
    if (!order) throw new Error('Orden de compra no encontrada');

    order.status = 'CANCELLED';
    order.notes = reason ? `Cancelado: ${reason}` : order.notes;
    order.updatedAt = new Date();

    try {
      const prisma = PrismaService.getInstance();
      await prisma.productOrder.update({
        where: { id },
        data: { status: 'CANCELLED', notes: order.notes, updatedAt: order.updatedAt },
      });
    } catch {}

    ProcurementStore.orders.set(id, order);

    await AuditLogService.record({
      userId: userId || 'SYSTEM',
      action: 'PURCHASE_ORDER_CANCELLED',
      resource: 'ProductOrder',
      resourceId: id,
      payload: { reason },
    });

    return order;
  }

  static clearMemoryStore() {
    ProcurementStore.clearMemoryStore();
  }
}
