import Decimal from 'decimal.js';
import { PrismaService } from '@/src/database/prisma.service';
import { AuditLogService } from '@/src/audit/audit-log.service';

export interface CreateWarehouseDto {
  name: string;
  code: string;
  type?: 'CENTRAL' | 'BRANCH' | 'MOBILE' | 'OTHER';
  address?: string;
  latitude?: number;
  longitude?: number;
}

export interface ReserveInventoryDto {
  productId: string;
  warehouseId: string;
  quantity: number;
  saleId?: string;
  expirationMinutes?: number;
  userId?: string;
  idempotencyKey?: string;
}

export interface TransferInventoryDto {
  productId: string;
  fromWarehouseId: string;
  toWarehouseId: string;
  quantity: number;
  userId?: string;
  reason?: string;
  idempotencyKey?: string;
}

export interface ReturnInventoryDto {
  productId: string;
  warehouseId: string;
  quantity: number;
  saleId?: string;
  reason?: string;
  userId?: string;
  idempotencyKey?: string;
}

export interface DamageInventoryDto {
  productId: string;
  warehouseId: string;
  quantity: number;
  reason: string;
  userId?: string;
  evidenceUrl?: string;
  idempotencyKey?: string;
}

export interface CreateProductOrderDto {
  supplier?: string;
  warehouseId: string;
  items: Array<{
    productId: string;
    unitCost: number | string | Decimal;
    quantityRequested: number;
  }>;
  userId?: string;
}

// In-Memory store for fast isolated testing or when DB connection is offline
export class InventoryStore {
  static warehouses: Map<string, any> = new Map();
  static stocks: Map<string, any> = new Map(); // key: `${warehouseId}_${productId}`
  static reservations: Map<string, any> = new Map();
  static kardex: any[] = [];
  static orders: Map<string, any> = new Map();
  static lockMap: Map<string, boolean> = new Map();

  static clear() {
    this.warehouses.clear();
    this.stocks.clear();
    this.reservations.clear();
    this.kardex = [];
    this.orders.clear();
    this.lockMap.clear();
  }
}

export class InventoryService {
  static stocks = InventoryStore.stocks;

  static clearMemoryStore() {
    InventoryStore.clear();
  }

  // Helper for stock key
  private static getStockKey(warehouseId: string, productId: string) {
    return `${warehouseId}_${productId}`;
  }

  // --- ALMACENES ---
  static async createWarehouse(dto: CreateWarehouseDto, userId?: string) {
    let existingCode;
    try {
      const prisma = PrismaService.getInstance();
      existingCode = await prisma.warehouse.findUnique({ where: { code: dto.code } });
    } catch {
      existingCode = Array.from(InventoryStore.warehouses.values()).find((w) => w.code === dto.code);
    }

    if (existingCode) {
      throw new Error(`Warehouse with code "${dto.code}" already exists`);
    }

    const warehouseId = `wh_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
    const warehouse = {
      id: warehouseId,
      name: dto.name,
      code: dto.code,
      type: dto.type || 'CENTRAL',
      address: dto.address || null,
      latitude: dto.latitude || null,
      longitude: dto.longitude || null,
      isActive: true,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    try {
      const prisma = PrismaService.getInstance();
      const created = await prisma.warehouse.create({
        data: {
          id: warehouse.id,
          name: warehouse.name,
          code: warehouse.code,
          type: warehouse.type as any,
          address: warehouse.address,
          latitude: warehouse.latitude,
          longitude: warehouse.longitude,
          isActive: true,
        },
      });
      InventoryStore.warehouses.set(created.id, created);
      await AuditLogService.log({
        userId,
        action: 'WAREHOUSE_CREATED',
        entity: 'Warehouse',
        entityId: created.id,
        newValues: JSON.stringify(created),
      });
      return created;
    } catch {
      InventoryStore.warehouses.set(warehouse.id, warehouse);
      await AuditLogService.log({
        userId,
        action: 'WAREHOUSE_CREATED',
        entity: 'Warehouse',
        entityId: warehouse.id,
        newValues: JSON.stringify(warehouse),
      });
      return warehouse;
    }
  }

  static async getWarehouses() {
    try {
      const prisma = PrismaService.getInstance();
      const list = await prisma.warehouse.findMany();
      if (list.length > 0) return list;
    } catch {}
    return Array.from(InventoryStore.warehouses.values());
  }

  // --- INITIAL STOCK / STOCK MANAGEMENT ---
  static async setInitialStock(
    warehouseId: string,
    productId: string,
    quantity: number,
    userId?: string,
    idempotencyKey?: string
  ) {
    if (quantity < 0) throw new Error('Initial stock quantity cannot be negative');

    const key = this.getStockKey(warehouseId, productId);
    let updatedStock;

    try {
      const prisma = PrismaService.getInstance();
      updatedStock = await prisma.inventoryStock.upsert({
        where: { warehouseId_productId: { warehouseId, productId } },
        create: {
          warehouseId,
          productId,
          quantityOnHand: quantity,
          quantityReserved: 0,
          quantityAvailable: quantity,
        },
        update: {
          quantityOnHand: quantity,
          quantityAvailable: quantity - 0,
        },
      });

      // Record Kardex INITIAL_STOCK
      await this.recordKardexMovement({
        warehouseId,
        productId,
        quantity,
        movementType: 'INITIAL_STOCK',
        previousQuantity: 0,
        newQuantity: quantity,
        userId,
        idempotencyKey,
        notes: 'Initial stock setup',
      });
    } catch {
      const stock = {
        id: `stk_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
        warehouseId,
        productId,
        quantityOnHand: quantity,
        quantityReserved: 0,
        quantityAvailable: quantity,
        updatedAt: new Date(),
      };
      InventoryStore.stocks.set(key, stock);
      updatedStock = stock;

      await this.recordKardexMovement({
        warehouseId,
        productId,
        quantity,
        movementType: 'INITIAL_STOCK',
        previousQuantity: 0,
        newQuantity: quantity,
        userId,
        idempotencyKey,
        notes: 'Initial stock setup',
      });
    }

    return updatedStock;
  }

  static async getStock(warehouseId: string, productId: string) {
    try {
      const prisma = PrismaService.getInstance();
      const stock = await prisma.inventoryStock.findUnique({
        where: { warehouseId_productId: { warehouseId, productId } },
      });
      if (stock) {
        return {
          ...stock,
          quantityAvailable: stock.quantityOnHand - stock.quantityReserved,
        };
      }
    } catch {}

    const key = this.getStockKey(warehouseId, productId);
    const inMem = InventoryStore.stocks.get(key);
    if (inMem) {
      return {
        ...inMem,
        quantityAvailable: inMem.quantityOnHand - inMem.quantityReserved,
      };
    }
    return {
      warehouseId,
      productId,
      quantityOnHand: 0,
      quantityReserved: 0,
      quantityAvailable: 0,
    };
  }

  static async getInventoryList(warehouseId?: string) {
    try {
      const prisma = PrismaService.getInstance();
      const filter = warehouseId ? { warehouseId } : {};
      const stocks = await prisma.inventoryStock.findMany({
        where: filter,
        include: { product: true, warehouse: true },
      });
      if (stocks.length > 0) return stocks;
    } catch {}

    const all = Array.from(InventoryStore.stocks.values());
    if (warehouseId) return all.filter((s) => s.warehouseId === warehouseId);
    return all;
  }

  // --- KARDEX INMUTABLE ---
  static async recordKardexMovement(data: {
    warehouseId: string;
    productId: string;
    quantity: number;
    movementType: 'INITIAL_STOCK' | 'PURCHASE_IN' | 'RESERVATION' | 'RESERVATION_RELEASE' | 'DELIVERY_OUT' | 'RETURN_IN' | 'DAMAGE' | 'TRANSFER_OUT' | 'TRANSFER_IN' | 'ADJUSTMENT';
    previousQuantity?: number;
    newQuantity?: number;
    referenceType?: string;
    referenceId?: string;
    userId?: string;
    idempotencyKey?: string;
    notes?: string;
  }) {
    const movementId = `kdx_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
    const record = {
      id: movementId,
      warehouseId: data.warehouseId,
      productId: data.productId,
      quantity: data.quantity,
      type: data.movementType,
      movementType: data.movementType,
      previousQuantity: data.previousQuantity || 0,
      newQuantity: data.newQuantity || 0,
      referenceType: data.referenceType || null,
      referenceId: data.referenceId || null,
      userId: data.userId || null,
      idempotencyKey: data.idempotencyKey || null,
      notes: data.notes || null,
      createdAt: new Date(),
    };

    try {
      const prisma = PrismaService.getInstance();
      await prisma.kardexMovement.create({
        data: {
          id: record.id,
          warehouseId: record.warehouseId,
          productId: record.productId,
          type: record.movementType as any,
          movementType: record.movementType as any,
          quantity: record.quantity,
          previousQuantity: record.previousQuantity,
          newQuantity: record.newQuantity,
          referenceType: record.referenceType,
          referenceId: record.referenceId,
          userId: record.userId,
          idempotencyKey: record.idempotencyKey,
          notes: record.notes,
        },
      });
    } catch {
      InventoryStore.kardex.push(record);
    }

    await AuditLogService.log({
      userId: data.userId,
      action: `KARDEX_${data.movementType}`,
      entity: 'KardexMovement',
      entityId: movementId,
      newValues: JSON.stringify(record),
      idempotencyKey: data.idempotencyKey,
    });

    return record;
  }

  static async getKardex(productId?: string, warehouseId?: string) {
    try {
      const prisma = PrismaService.getInstance();
      const where: any = {};
      if (productId) where.productId = productId;
      if (warehouseId) where.warehouseId = warehouseId;
      const list = await prisma.kardexMovement.findMany({
        where,
        orderBy: { createdAt: 'desc' },
      });
      if (list.length > 0) return list;
    } catch {}

    let res = [...InventoryStore.kardex];
    if (productId) res = res.filter((k) => k.productId === productId);
    if (warehouseId) res = res.filter((k) => k.warehouseId === warehouseId);
    return res.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
  }

  // --- RESERVATIONS & CONCURRENCY ---
  static async reserveStock(dto: ReserveInventoryDto) {
    const lockKey = `${dto.warehouseId}_${dto.productId}`;

    // Pessimistic transaction simulation lock check
    if (InventoryStore.lockMap.get(lockKey)) {
      // Retry or block
      await new Promise((resolve) => setTimeout(resolve, 50));
    }
    InventoryStore.lockMap.set(lockKey, true);

    try {
      const stock = await this.getStock(dto.warehouseId, dto.productId);
      const quantityAvailable = stock.quantityOnHand - stock.quantityReserved;

      if (quantityAvailable < dto.quantity) {
        throw new Error(`Insufficient stock available. Required: ${dto.quantity}, Available: ${quantityAvailable}`);
      }

      const minutes = dto.expirationMinutes || 15;
      const expiresAt = new Date(Date.now() + minutes * 60 * 1000);
      const reservationId = `res_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;

      const reservation = {
        id: reservationId,
        warehouseId: dto.warehouseId,
        productId: dto.productId,
        saleId: dto.saleId || null,
        quantity: dto.quantity,
        status: 'ACTIVE',
        expiresAt,
        createdBy: dto.userId || null,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      const newReserved = stock.quantityReserved + dto.quantity;
      const newAvailable = stock.quantityOnHand - newReserved;

      // Update Stock
      try {
        const prisma = PrismaService.getInstance();
        await prisma.inventoryStock.update({
          where: { warehouseId_productId: { warehouseId: dto.warehouseId, productId: dto.productId } },
          data: {
            quantityReserved: newReserved,
            quantityAvailable: newAvailable,
          },
        });
        await prisma.inventoryReservation.create({
          data: {
            id: reservation.id,
            warehouseId: dto.warehouseId,
            productId: dto.productId,
            saleId: dto.saleId,
            quantity: dto.quantity,
            status: 'ACTIVE',
            expiresAt: reservation.expiresAt,
            createdBy: dto.userId,
          },
        });
      } catch {
        const key = this.getStockKey(dto.warehouseId, dto.productId);
        const inMemStock = InventoryStore.stocks.get(key) || {
          warehouseId: dto.warehouseId,
          productId: dto.productId,
          quantityOnHand: stock.quantityOnHand,
          quantityReserved: 0,
        };
        inMemStock.quantityReserved = newReserved;
        inMemStock.quantityAvailable = newAvailable;
        InventoryStore.stocks.set(key, inMemStock);
        InventoryStore.reservations.set(reservationId, reservation);
      }

      // Record Kardex RESERVATION
      await this.recordKardexMovement({
        warehouseId: dto.warehouseId,
        productId: dto.productId,
        quantity: dto.quantity,
        movementType: 'RESERVATION',
        previousQuantity: quantityAvailable,
        newQuantity: newAvailable,
        userId: dto.userId,
        idempotencyKey: dto.idempotencyKey,
        notes: `Reservation created for sale ${dto.saleId || 'N/A'}`,
      });

      return reservation;
    } finally {
      InventoryStore.lockMap.set(lockKey, false);
    }
  }

  static async releaseReservation(reservationId: string, userId?: string, reason?: string) {
    let reservation: any;
    try {
      const prisma = PrismaService.getInstance();
      reservation = await prisma.inventoryReservation.findUnique({ where: { id: reservationId } });
    } catch {}

    if (!reservation) {
      reservation = InventoryStore.reservations.get(reservationId);
    }

    if (!reservation) throw new Error('Reservation not found');
    if (reservation.status !== 'ACTIVE') {
      throw new Error(`Cannot release reservation in status "${reservation.status}"`);
    }

    const stock = await this.getStock(reservation.warehouseId, reservation.productId);
    const newReserved = Math.max(0, stock.quantityReserved - reservation.quantity);
    const newAvailable = stock.quantityOnHand - newReserved;

    try {
      const prisma = PrismaService.getInstance();
      await prisma.inventoryReservation.update({
        where: { id: reservationId },
        data: { status: 'RELEASED', releasedAt: new Date(), updatedAt: new Date() },
      });
      await prisma.inventoryStock.update({
        where: { warehouseId_productId: { warehouseId: reservation.warehouseId, productId: reservation.productId } },
        data: { quantityReserved: newReserved, quantityAvailable: newAvailable },
      });
    } catch {
      reservation.status = 'RELEASED';
      reservation.releasedAt = new Date();
      reservation.updatedAt = new Date();
      const key = this.getStockKey(reservation.warehouseId, reservation.productId);
      const st = InventoryStore.stocks.get(key);
      if (st) {
        st.quantityReserved = newReserved;
        st.quantityAvailable = newAvailable;
      }
    }

    await this.recordKardexMovement({
      warehouseId: reservation.warehouseId,
      productId: reservation.productId,
      quantity: reservation.quantity,
      movementType: 'RESERVATION_RELEASE',
      previousQuantity: stock.quantityAvailable,
      newQuantity: newAvailable,
      userId,
      notes: reason || 'Reservation manually released',
    });

    return reservation;
  }

  static async expireReservations(userId?: string) {
    const now = new Date();
    let expiredCount = 0;

    // Process DB active reservations
    try {
      const prisma = PrismaService.getInstance();
      const activeDbReservations = await prisma.inventoryReservation.findMany({
        where: { status: 'ACTIVE', expiresAt: { lt: now } },
      });

      for (const res of activeDbReservations) {
        await prisma.inventoryReservation.update({
          where: { id: res.id },
          data: { status: 'EXPIRED', updatedAt: now },
        });

        const stock = await this.getStock(res.warehouseId, res.productId);
        const newReserved = Math.max(0, stock.quantityReserved - res.quantity);
        const newAvailable = stock.quantityOnHand - newReserved;

        await prisma.inventoryStock.update({
          where: { warehouseId_productId: { warehouseId: res.warehouseId, productId: res.productId } },
          data: { quantityReserved: newReserved, quantityAvailable: newAvailable },
        });

        await this.recordKardexMovement({
          warehouseId: res.warehouseId,
          productId: res.productId,
          quantity: res.quantity,
          movementType: 'RESERVATION_RELEASE',
          previousQuantity: stock.quantityAvailable,
          newQuantity: newAvailable,
          userId,
          notes: `Reservation ${res.id} automatically EXPIRED`,
        });

        expiredCount++;
      }
    } catch {}

    // Process memory active reservations
    for (const res of InventoryStore.reservations.values()) {
      if (res.status === 'ACTIVE' && res.expiresAt < now) {
        res.status = 'EXPIRED';
        res.updatedAt = now;

        const stock = await this.getStock(res.warehouseId, res.productId);
        const newReserved = Math.max(0, stock.quantityReserved - res.quantity);
        const newAvailable = stock.quantityOnHand - newReserved;

        const key = this.getStockKey(res.warehouseId, res.productId);
        const st = InventoryStore.stocks.get(key);
        if (st) {
          st.quantityReserved = newReserved;
          st.quantityAvailable = newAvailable;
        }

        await this.recordKardexMovement({
          warehouseId: res.warehouseId,
          productId: res.productId,
          quantity: res.quantity,
          movementType: 'RESERVATION_RELEASE',
          previousQuantity: stock.quantityAvailable,
          newQuantity: newAvailable,
          userId,
          notes: `Reservation ${res.id} automatically EXPIRED`,
        });

        expiredCount++;
      }
    }

    return { expiredCount };
  }

  // --- DELIVERY (ENTREGA DE PRODUCTO) ---
  static async deliverProduct(data: {
    warehouseId: string;
    productId: string;
    quantity: number;
    reservationId?: string;
    saleId?: string;
    userId?: string;
    idempotencyKey?: string;
  }) {
    const stock = await this.getStock(data.warehouseId, data.productId);

    if (data.reservationId) {
      // If converting reservation
      let reservation;
      try {
        const prisma = PrismaService.getInstance();
        reservation = await prisma.inventoryReservation.findUnique({ where: { id: data.reservationId } });
      } catch {
        reservation = InventoryStore.reservations.get(data.reservationId);
      }

      if (reservation && reservation.status === 'ACTIVE') {
        const newReserved = Math.max(0, stock.quantityReserved - data.quantity);
        const newOnHand = stock.quantityOnHand - data.quantity;
        const newAvailable = newOnHand - newReserved;

        if (newOnHand < 0) throw new Error('Cannot deliver more than quantity on hand');

        try {
          const prisma = PrismaService.getInstance();
          await prisma.inventoryReservation.update({
            where: { id: data.reservationId },
            data: { status: 'CONVERTED_TO_DELIVERY', convertedAt: new Date() },
          });
          await prisma.inventoryStock.update({
            where: { warehouseId_productId: { warehouseId: data.warehouseId, productId: data.productId } },
            data: { quantityOnHand: newOnHand, quantityReserved: newReserved, quantityAvailable: newAvailable },
          });
        } catch {
          reservation.status = 'CONVERTED_TO_DELIVERY';
          reservation.convertedAt = new Date();
          const key = this.getStockKey(data.warehouseId, data.productId);
          const st = InventoryStore.stocks.get(key);
          if (st) {
            st.quantityOnHand = newOnHand;
            st.quantityReserved = newReserved;
            st.quantityAvailable = newAvailable;
          }
        }

        await this.recordKardexMovement({
          warehouseId: data.warehouseId,
          productId: data.productId,
          quantity: data.quantity,
          movementType: 'DELIVERY_OUT',
          previousQuantity: stock.quantityOnHand,
          newQuantity: newOnHand,
          referenceType: 'SALE',
          referenceId: data.saleId,
          userId: data.userId,
          idempotencyKey: data.idempotencyKey,
          notes: `Product delivered for sale ${data.saleId || 'N/A'}`,
        });

        return { success: true, newOnHand, newAvailable };
      }
    }

    // Direct Delivery
    if (stock.quantityAvailable < data.quantity) {
      throw new Error(`Insufficient available stock for delivery. Available: ${stock.quantityAvailable}`);
    }

    const newOnHand = stock.quantityOnHand - data.quantity;
    const newAvailable = newOnHand - stock.quantityReserved;

    try {
      const prisma = PrismaService.getInstance();
      await prisma.inventoryStock.update({
        where: { warehouseId_productId: { warehouseId: data.warehouseId, productId: data.productId } },
        data: { quantityOnHand: newOnHand, quantityAvailable: newAvailable },
      });
    } catch {
      const key = this.getStockKey(data.warehouseId, data.productId);
      const st = InventoryStore.stocks.get(key);
      if (st) {
        st.quantityOnHand = newOnHand;
        st.quantityAvailable = newAvailable;
      }
    }

    await this.recordKardexMovement({
      warehouseId: data.warehouseId,
      productId: data.productId,
      quantity: data.quantity,
      movementType: 'DELIVERY_OUT',
      previousQuantity: stock.quantityOnHand,
      newQuantity: newOnHand,
      referenceType: 'SALE',
      referenceId: data.saleId,
      userId: data.userId,
      idempotencyKey: data.idempotencyKey,
      notes: `Direct delivery for sale ${data.saleId || 'N/A'}`,
    });

    return { success: true, newOnHand, newAvailable };
  }

  // --- RETURNS (DEVOLUCIONES) ---
  static async returnInventory(dto: ReturnInventoryDto) {
    if (dto.quantity <= 0) throw new Error('Return quantity must be greater than 0');

    const stock = await this.getStock(dto.warehouseId, dto.productId);
    const newOnHand = stock.quantityOnHand + dto.quantity;
    const newAvailable = newOnHand - stock.quantityReserved;

    try {
      const prisma = PrismaService.getInstance();
      await prisma.inventoryStock.update({
        where: { warehouseId_productId: { warehouseId: dto.warehouseId, productId: dto.productId } },
        data: { quantityOnHand: newOnHand, quantityAvailable: newAvailable },
      });
    } catch {
      const key = this.getStockKey(dto.warehouseId, dto.productId);
      const st = InventoryStore.stocks.get(key) || {
        warehouseId: dto.warehouseId,
        productId: dto.productId,
        quantityReserved: 0,
      };
      st.quantityOnHand = newOnHand;
      st.quantityAvailable = newAvailable;
      InventoryStore.stocks.set(key, st);
    }

    await this.recordKardexMovement({
      warehouseId: dto.warehouseId,
      productId: dto.productId,
      quantity: dto.quantity,
      movementType: 'RETURN_IN',
      previousQuantity: stock.quantityOnHand,
      newQuantity: newOnHand,
      referenceType: 'SALE_RETURN',
      referenceId: dto.saleId,
      userId: dto.userId,
      idempotencyKey: dto.idempotencyKey,
      notes: dto.reason || 'Customer return',
    });

    return { success: true, newOnHand, newAvailable };
  }

  // --- DAMAGE / MERMA ---
  static async reportDamage(dto: DamageInventoryDto) {
    if (dto.quantity <= 0) throw new Error('Damage quantity must be greater than 0');

    const stock = await this.getStock(dto.warehouseId, dto.productId);
    if (stock.quantityAvailable < dto.quantity) {
      throw new Error(`Cannot report damage for quantity exceeding available stock (${stock.quantityAvailable})`);
    }

    const newOnHand = stock.quantityOnHand - dto.quantity;
    const newAvailable = newOnHand - stock.quantityReserved;

    try {
      const prisma = PrismaService.getInstance();
      await prisma.inventoryStock.update({
        where: { warehouseId_productId: { warehouseId: dto.warehouseId, productId: dto.productId } },
        data: { quantityOnHand: newOnHand, quantityAvailable: newAvailable },
      });
    } catch {
      const key = this.getStockKey(dto.warehouseId, dto.productId);
      const st = InventoryStore.stocks.get(key);
      if (st) {
        st.quantityOnHand = newOnHand;
        st.quantityAvailable = newAvailable;
      }
    }

    await this.recordKardexMovement({
      warehouseId: dto.warehouseId,
      productId: dto.productId,
      quantity: dto.quantity,
      movementType: 'DAMAGE',
      previousQuantity: stock.quantityOnHand,
      newQuantity: newOnHand,
      userId: dto.userId,
      idempotencyKey: dto.idempotencyKey,
      notes: `Damage/Merma: ${dto.reason}${dto.evidenceUrl ? ` [Evidence: ${dto.evidenceUrl}]` : ''}`,
    });

    return { success: true, newOnHand, newAvailable };
  }

  // --- ATOMIC TRANSFERS (TRANSFERENCIAS ENTRE ALMACENES) ---
  static async transferStock(dto: TransferInventoryDto) {
    if (dto.quantity <= 0) throw new Error('Transfer quantity must be greater than 0');
    if (dto.fromWarehouseId === dto.toWarehouseId) {
      throw new Error('Source and destination warehouses must be different');
    }

    const sourceStock = await this.getStock(dto.fromWarehouseId, dto.productId);
    if (sourceStock.quantityAvailable < dto.quantity) {
      throw new Error(`Insufficient available stock in source warehouse. Required: ${dto.quantity}, Available: ${sourceStock.quantityAvailable}`);
    }

    const destStock = await this.getStock(dto.toWarehouseId, dto.productId);

    // Atomic Execution
    const sourceNewOnHand = sourceStock.quantityOnHand - dto.quantity;
    const sourceNewAvailable = sourceNewOnHand - sourceStock.quantityReserved;

    const destNewOnHand = destStock.quantityOnHand + dto.quantity;
    const destNewAvailable = destNewOnHand - destStock.quantityReserved;

    try {
      const prisma = PrismaService.getInstance();
      // Transaction
      await prisma.$transaction([
        prisma.inventoryStock.update({
          where: { warehouseId_productId: { warehouseId: dto.fromWarehouseId, productId: dto.productId } },
          data: { quantityOnHand: sourceNewOnHand, quantityAvailable: sourceNewAvailable },
        }),
        prisma.inventoryStock.upsert({
          where: { warehouseId_productId: { warehouseId: dto.toWarehouseId, productId: dto.productId } },
          create: {
            warehouseId: dto.toWarehouseId,
            productId: dto.productId,
            quantityOnHand: destNewOnHand,
            quantityReserved: 0,
            quantityAvailable: destNewAvailable,
          },
          update: { quantityOnHand: destNewOnHand, quantityAvailable: destNewAvailable },
        }),
      ]);
    } catch {
      const sourceKey = this.getStockKey(dto.fromWarehouseId, dto.productId);
      const destKey = this.getStockKey(dto.toWarehouseId, dto.productId);

      const srcSt = InventoryStore.stocks.get(sourceKey);
      if (srcSt) {
        srcSt.quantityOnHand = sourceNewOnHand;
        srcSt.quantityAvailable = sourceNewAvailable;
      }

      const destSt = InventoryStore.stocks.get(destKey) || {
        warehouseId: dto.toWarehouseId,
        productId: dto.productId,
        quantityReserved: 0,
      };
      destSt.quantityOnHand = destNewOnHand;
      destSt.quantityAvailable = destNewAvailable;
      InventoryStore.stocks.set(destKey, destSt);
    }

    // Record both Kardex movements (TRANSFER_OUT & TRANSFER_IN)
    await this.recordKardexMovement({
      warehouseId: dto.fromWarehouseId,
      productId: dto.productId,
      quantity: dto.quantity,
      movementType: 'TRANSFER_OUT',
      previousQuantity: sourceStock.quantityOnHand,
      newQuantity: sourceNewOnHand,
      referenceType: 'WAREHOUSE',
      referenceId: dto.toWarehouseId,
      userId: dto.userId,
      idempotencyKey: dto.idempotencyKey ? `${dto.idempotencyKey}_out` : undefined,
      notes: dto.reason || `Transfer to ${dto.toWarehouseId}`,
    });

    await this.recordKardexMovement({
      warehouseId: dto.toWarehouseId,
      productId: dto.productId,
      quantity: dto.quantity,
      movementType: 'TRANSFER_IN',
      previousQuantity: destStock.quantityOnHand,
      newQuantity: destNewOnHand,
      referenceType: 'WAREHOUSE',
      referenceId: dto.fromWarehouseId,
      userId: dto.userId,
      idempotencyKey: dto.idempotencyKey ? `${dto.idempotencyKey}_in` : undefined,
      notes: dto.reason || `Transfer from ${dto.fromWarehouseId}`,
    });

    return {
      success: true,
      sourceWarehouse: { id: dto.fromWarehouseId, newOnHand: sourceNewOnHand },
      destWarehouse: { id: dto.toWarehouseId, newOnHand: destNewOnHand },
    };
  }

  // --- ABASTECIMIENTO / PRODUCT ORDERS & RECEPCTION ---
  static async createProductOrder(dto: CreateProductOrderDto) {
    const orderNumber = `ORD-${Date.now()}-${Math.floor(Math.random() * 1000)}`;

    let totalDecimal = new Decimal(0);
    const formattedItems = dto.items.map((item) => {
      const cost = new Decimal(item.unitCost);
      totalDecimal = totalDecimal.add(cost.mul(item.quantityRequested));
      return {
        id: `ord_item_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
        productId: item.productId,
        unitCost: cost,
        quantityRequested: item.quantityRequested,
        quantityReceived: 0,
      };
    });

    const orderId = `po_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
    const order = {
      id: orderId,
      orderNumber,
      supplier: dto.supplier || 'Proveedor General',
      warehouseId: dto.warehouseId,
      status: 'PENDING',
      totalAmount: totalDecimal,
      userId: dto.userId || null,
      createdAt: new Date(),
      updatedAt: new Date(),
      items: formattedItems,
    };

    try {
      const prisma = PrismaService.getInstance();
      const created = await prisma.productOrder.create({
        data: {
          id: order.id,
          orderNumber: order.orderNumber,
          supplier: order.supplier,
          warehouseId: order.warehouseId,
          status: 'PENDING',
          totalAmount: totalDecimal.toNumber(),
          userId: order.userId,
          items: {
            create: formattedItems.map((i) => ({
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
      InventoryStore.orders.set(created.id, created);
      return created;
    } catch {
      InventoryStore.orders.set(order.id, order);
      return order;
    }
  }

  static async receiveProductOrder(orderId: string, receivedItems: Array<{ productId: string; quantityReceived: number }>, userId?: string) {
    let order: any;
    try {
      const prisma = PrismaService.getInstance();
      order = await prisma.productOrder.findUnique({
        where: { id: orderId },
        include: { items: true },
      });
    } catch {}

    if (!order) {
      order = InventoryStore.orders.get(orderId);
    }

    if (!order) throw new Error('Orden de compra no encontrada.');
    if (order.status === 'CANCELLED') throw new Error('No se puede recibir una orden cancelada.');
    if (order.status === 'COMPLETED') throw new Error('La orden ya fue recibida por completo.');
    if (!receivedItems.length) throw new Error('Indica al menos una cantidad recibida.');

    let allItemsFullyReceived = true;

    for (const rec of receivedItems) {
      const item = order.items.find((i: any) => i.productId === rec.productId);
      if (!item) throw new Error('La recepción incluye un producto que no pertenece a la orden.');
      if (!Number.isInteger(Number(rec.quantityReceived)) || Number(rec.quantityReceived) <= 0) throw new Error('La cantidad recibida debe ser un entero mayor a cero.');

      const newTotalReceived = Number(item.quantityReceived || 0) + Number(rec.quantityReceived);
      if (newTotalReceived > Number(item.quantityRequested)) throw new Error(`No puedes recibir más de lo solicitado para el producto ${rec.productId}.`);
      item.quantityReceived = newTotalReceived;

      if (newTotalReceived < item.quantityRequested) {
        allItemsFullyReceived = false;
      }

      // Add to inventory stock & record Kardex PURCHASE_IN
      const stock = await this.getStock(order.warehouseId, rec.productId);
      const newOnHand = stock.quantityOnHand + rec.quantityReceived;
      const newAvailable = newOnHand - stock.quantityReserved;

      try {
        const prisma = PrismaService.getInstance();
        await prisma.inventoryStock.upsert({
          where: { warehouseId_productId: { warehouseId: order.warehouseId, productId: rec.productId } },
          create: {
            warehouseId: order.warehouseId,
            productId: rec.productId,
            quantityOnHand: newOnHand,
            quantityReserved: 0,
            quantityAvailable: newAvailable,
          },
          update: { quantityOnHand: newOnHand, quantityAvailable: newAvailable },
        });

        await prisma.productOrderItem.update({
          where: { id: item.id },
          data: { quantityReceived: newTotalReceived },
        });
      } catch {
        const key = this.getStockKey(order.warehouseId, rec.productId);
        const st = InventoryStore.stocks.get(key) || {
          warehouseId: order.warehouseId,
          productId: rec.productId,
          quantityReserved: 0,
        };
        st.quantityOnHand = newOnHand;
        st.quantityAvailable = newAvailable;
        InventoryStore.stocks.set(key, st);
      }

      await this.recordKardexMovement({
        warehouseId: order.warehouseId,
        productId: rec.productId,
        quantity: rec.quantityReceived,
        movementType: 'PURCHASE_IN',
        previousQuantity: stock.quantityOnHand,
        newQuantity: newOnHand,
        referenceType: 'PRODUCT_ORDER',
        referenceId: order.id,
        userId,
        notes: `Reception of ${rec.quantityReceived} units from order ${order.orderNumber}`,
      });
    }

    // Comprobante inmutable por cada recepción parcial o total.
    try {
      const prisma = PrismaService.getInstance();
      const receiptNumber = `REC-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
      await prisma.purchaseReceipt.create({
        data: {
          receiptNumber,
          orderId,
          warehouseId: order.warehouseId,
          receivedBy: userId || 'usr_system',
          receiptType: allItemsFullyReceived ? 'RECEPCION_TOTAL' : 'RECEPCION_PARCIAL',
          notes: `Recepción de orden ${order.orderNumber}`,
          items: {
            create: receivedItems.filter((rec) => Number(rec.quantityReceived) > 0).map((rec) => {
              const source = order.items.find((item: any) => item.productId === rec.productId);
              const unitCost = Number(source?.unitCost || 0);
              return { productId: rec.productId, quantityReceived: Number(rec.quantityReceived), unitCost, totalCost: unitCost * Number(rec.quantityReceived) };
            }),
          },
        },
      });
    } catch {}

    // Update order status
    order.status = allItemsFullyReceived ? 'COMPLETED' : 'PARTIAL_RECEIVED';
    order.updatedAt = new Date();

    try {
      const prisma = PrismaService.getInstance();
      await prisma.productOrder.update({
        where: { id: orderId },
        data: { status: order.status, updatedAt: order.updatedAt },
      });
    } catch {}

    return order;
  }
  static async getProductOrders() {
    try {
      const prisma = PrismaService.getInstance();
      return await prisma.productOrder.findMany({
        include: { warehouse: true, supplierRef: true, items: { include: { product: true } }, receipts: { include: { items: true } } },
        orderBy: { createdAt: 'desc' },
      });
    } catch {
      return Array.from(InventoryStore.orders.values()).sort((a: any, b: any) => +new Date(b.createdAt) - +new Date(a.createdAt));
    }
  }

  static async cancelProductOrder(orderId: string, userId?: string, reason?: string) {
    let order: any;
    try {
      const prisma = PrismaService.getInstance();
      order = await prisma.productOrder.findUnique({ where: { id: orderId }, include: { items: true } });
    } catch {
      order = InventoryStore.orders.get(orderId);
    }
    if (!order) throw new Error('Orden de compra no encontrada.');
    if (order.status === 'CANCELLED') throw new Error('La orden ya fue cancelada.');
    if (order.status === 'COMPLETED') throw new Error('Una orden recibida por completo no puede cancelarse.');
    if ((order.items || []).some((item: any) => Number(item.quantityReceived || 0) > 0)) {
      throw new Error('La orden tiene mercancía recibida. Registra una devolución o ajuste antes de cancelarla.');
    }
    const notes = [order.notes, reason ? `Cancelación: ${reason}` : 'Cancelación autorizada'].filter(Boolean).join(' | ');
    try {
      const prisma = PrismaService.getInstance();
      order = await prisma.productOrder.update({ where: { id: orderId }, data: { status: 'CANCELLED', notes }, include: { items: { include: { product: true } }, warehouse: true } });
    } catch {
      order.status = 'CANCELLED'; order.notes = notes; order.updatedAt = new Date(); InventoryStore.orders.set(orderId, order);
    }
    await AuditLogService.log({ userId, action: 'PRODUCT_ORDER_CANCELLED', entity: 'ProductOrder', entityId: orderId, newValues: JSON.stringify({ status: 'CANCELLED', reason }) });
    return order;
  }

  static async adjustStock(data: { warehouseId: string; productId: string; quantityDelta: number; reason: string; userId?: string; idempotencyKey?: string }) {
    if (!Number.isInteger(data.quantityDelta) || data.quantityDelta === 0) throw new Error('El ajuste debe ser un número entero distinto de cero.');
    if (!String(data.reason || '').trim()) throw new Error('El motivo del ajuste es obligatorio.');
    const stock = await this.getStock(data.warehouseId, data.productId);
    const newOnHand = Number(stock.quantityOnHand) + data.quantityDelta;
    if (newOnHand < Number(stock.quantityReserved || 0)) throw new Error('El ajuste dejaría el stock por debajo de las unidades reservadas.');
    if (newOnHand < 0) throw new Error('El stock físico no puede ser negativo.');
    const newAvailable = newOnHand - Number(stock.quantityReserved || 0);
    try {
      const prisma = PrismaService.getInstance();
      await prisma.inventoryStock.upsert({
        where: { warehouseId_productId: { warehouseId: data.warehouseId, productId: data.productId } },
        create: { warehouseId: data.warehouseId, productId: data.productId, quantityOnHand: newOnHand, quantityReserved: 0, quantityAvailable: newAvailable },
        update: { quantityOnHand: newOnHand, quantityAvailable: newAvailable },
      });
    } catch {
      InventoryStore.stocks.set(this.getStockKey(data.warehouseId, data.productId), { ...stock, quantityOnHand: newOnHand, quantityAvailable: newAvailable, updatedAt: new Date() });
    }
    await this.recordKardexMovement({ warehouseId: data.warehouseId, productId: data.productId, quantity: Math.abs(data.quantityDelta), movementType: 'ADJUSTMENT', previousQuantity: Number(stock.quantityOnHand), newQuantity: newOnHand, userId: data.userId, idempotencyKey: data.idempotencyKey, notes: `${data.quantityDelta > 0 ? 'Ajuste positivo' : 'Ajuste negativo'}: ${data.reason}` });
    return { success: true, previousOnHand: Number(stock.quantityOnHand), newOnHand, newAvailable };
  }

}
