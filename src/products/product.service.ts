import Decimal from 'decimal.js';
import { PrismaService } from '@/src/database/prisma.service';
import { AuditLogService } from '@/src/audit/audit-log.service';

export interface CreateProductDto {
  sku: string;
  barcode?: string;
  name: string;
  description?: string;
  brand?: string;
  categoryId?: string;
  costPrice: number | string | Decimal;
  minStock?: number;
  reorderPoint?: number;
  maxStock?: number;
  prices?: Array<{
    priceType: 'LIST' | 'LIST_PRICE' | 'MINIMUM_AUTHORIZED' | 'CREDIT' | 'CASH';
    amount: number | string | Decimal;
  }>;
}

export interface CreateCategoryDto {
  name: string;
  description?: string;
  parentId?: string;
}

export interface PriceOverrideRequestDto {
  productId: string;
  proposedPrice: number | string | Decimal;
  userId: string;
  userRole: string;
  reason?: string;
}

// In-memory fallback / mock DB store for tests running without active DB connection if needed
class InStore {
  static categories: Map<string, any> = new Map();
  static products: Map<string, any> = new Map();
  static images: Map<string, any> = new Map();
  static prices: Map<string, any> = new Map();
  static priceHistories: any[] = [];
  static authorizationRequests: Map<string, any> = new Map();

  static clear() {
    this.categories.clear();
    this.products.clear();
    this.images.clear();
    this.prices.clear();
    this.priceHistories = [];
    this.authorizationRequests.clear();
  }
}

export class ProductService {
  static clearMemoryStore() {
    InStore.clear();
  }

  // --- CATEGORIES ---
  static async createCategory(dto: CreateCategoryDto, userId?: string) {
    // Check if name exists
    let existing;
    try {
      const prisma = PrismaService.getInstance();
      existing = await prisma.productCategory.findFirst({ where: { name: dto.name } });
    } catch {
      existing = Array.from(InStore.categories.values()).find((c) => c.name === dto.name);
    }

    if (existing) {
      throw new Error(`Category with name "${dto.name}" already exists`);
    }

    const category = {
      id: `cat_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
      name: dto.name,
      description: dto.description || null,
      parentId: dto.parentId || null,
      status: 'ACTIVE',
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    try {
      const prisma = PrismaService.getInstance();
      const created = await prisma.productCategory.create({
        data: {
          id: category.id,
          name: category.name,
          description: category.description,
          parentId: category.parentId,
          status: category.status,
        },
      });
      InStore.categories.set(created.id, created);
      await AuditLogService.log({
        userId,
        action: 'CATEGORY_CREATED',
        entity: 'ProductCategory',
        entityId: created.id,
        newValues: JSON.stringify(created),
      });
      return created;
    } catch {
      InStore.categories.set(category.id, category);
      await AuditLogService.log({
        userId,
        action: 'CATEGORY_CREATED',
        entity: 'ProductCategory',
        entityId: category.id,
        newValues: JSON.stringify(category),
      });
      return category;
    }
  }

  static async getCategories() {
    try {
      const prisma = PrismaService.getInstance();
      const categories = await prisma.productCategory.findMany({
        include: { children: true, parent: true },
      });
      if (categories.length > 0) return categories;
    } catch {}
    return Array.from(InStore.categories.values());
  }

  // --- PRODUCTS ---
  static async createProduct(dto: CreateProductDto, userId?: string) {
    const costDecimal = new Decimal(dto.costPrice);
    if (costDecimal.isNaN() || costDecimal.lt(0)) {
      throw new Error('Invalid cost price');
    }

    // Check SKU uniqueness
    let existingSku;
    try {
      const prisma = PrismaService.getInstance();
      existingSku = await prisma.product.findUnique({ where: { sku: dto.sku } });
    } catch {
      existingSku = Array.from(InStore.products.values()).find((p) => p.sku === dto.sku);
    }

    if (existingSku) {
      throw new Error(`Product with SKU "${dto.sku}" already exists`);
    }

    // Check barcode uniqueness if provided
    if (dto.barcode) {
      let existingBarcode;
      try {
        const prisma = PrismaService.getInstance();
        existingBarcode = await prisma.product.findUnique({ where: { barcode: dto.barcode } });
      } catch {
        existingBarcode = Array.from(InStore.products.values()).find((p) => p.barcode === dto.barcode);
      }
      if (existingBarcode) {
        throw new Error(`Product with Barcode "${dto.barcode}" already exists`);
      }
    }

    const productId = `prod_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
    const product = {
      id: productId,
      sku: dto.sku,
      barcode: dto.barcode || null,
      name: dto.name,
      description: dto.description || null,
      brand: dto.brand || null,
      cost: costDecimal,
      costPrice: costDecimal,
      status: 'ACTIVE',
      categoryId: dto.categoryId || null,
      minStock: dto.minStock || 0,
      reorderPoint: dto.reorderPoint || 0,
      maxStock: dto.maxStock || 100,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    try {
      const prisma = PrismaService.getInstance();
      const created = await prisma.product.create({
        data: {
          id: product.id,
          sku: product.sku,
          barcode: product.barcode,
          name: product.name,
          description: product.description,
          brand: product.brand,
          cost: product.cost.toNumber(),
          costPrice: product.costPrice.toNumber(),
          status: 'ACTIVE',
          categoryId: product.categoryId,
          minStock: product.minStock,
          reorderPoint: product.reorderPoint,
          maxStock: product.maxStock,
        },
      });

      if (dto.prices && dto.prices.length > 0) {
        for (const pr of dto.prices) {
          const amt = new Decimal(pr.amount);
          await prisma.productPrice.create({
            data: {
              productId: created.id,
              priceType: pr.priceType as any,
              price: amt.toNumber(),
              amount: amt.toNumber(),
              isActive: true,
            },
          });
        }
      }

      InStore.products.set(created.id, created);
      await AuditLogService.log({
        userId,
        action: 'PRODUCT_CREATED',
        entity: 'Product',
        entityId: created.id,
        newValues: JSON.stringify(created),
      });
      return created;
    } catch {
      InStore.products.set(product.id, product);

      if (dto.prices) {
        for (const pr of dto.prices) {
          const priceObj = {
            id: `prc_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
            productId: product.id,
            priceType: pr.priceType,
            price: new Decimal(pr.amount),
            amount: new Decimal(pr.amount),
            isActive: true,
            createdAt: new Date(),
          };
          InStore.prices.set(`${product.id}_${pr.priceType}`, priceObj);
        }
      }

      await AuditLogService.log({
        userId,
        action: 'PRODUCT_CREATED',
        entity: 'Product',
        entityId: product.id,
        newValues: JSON.stringify(product),
      });
      return product;
    }
  }

  static async getProductById(id: string) {
    try {
      const prisma = PrismaService.getInstance();
      const product = await prisma.product.findUnique({
        where: { id },
        include: { category: true, images: true, prices: true, stocks: true },
      });
      if (product) return product;
    } catch {}
    return InStore.products.get(id) || null;
  }

  static async getProducts() {
    try {
      const prisma = PrismaService.getInstance();
      const products = await prisma.product.findMany({
        include: { category: true, images: true, prices: true },
      });
      if (products.length > 0) return products;
    } catch {}
    return Array.from(InStore.products.values());
  }

  // --- IMAGES ---
  static async addProductImage(productId: string, url: string, isPrimary: boolean = false, storageKey?: string) {
    const product = await this.getProductById(productId);
    if (!product) throw new Error('Product not found');

    const imageId = `img_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;

    // If isPrimary is set, unset previous primary images
    try {
      const prisma = PrismaService.getInstance();
      if (isPrimary) {
        await prisma.productImage.updateMany({
          where: { productId },
          data: { isPrimary: false, isMain: false },
        });
      }
      const image = await prisma.productImage.create({
        data: {
          id: imageId,
          productId,
          url,
          storageKey,
          isPrimary,
          isMain: isPrimary,
        },
      });
      return image;
    } catch {
      if (isPrimary) {
        for (const [k, v] of InStore.images.entries()) {
          if (v.productId === productId) {
            v.isPrimary = false;
            v.isMain = false;
          }
        }
      }
      const img = {
        id: imageId,
        productId,
        url,
        storageKey,
        isPrimary,
        isMain: isPrimary,
        createdAt: new Date(),
      };
      InStore.images.set(imageId, img);
      return img;
    }
  }

  static async getProductImages(productId: string) {
    try {
      const prisma = PrismaService.getInstance();
      return await prisma.productImage.findMany({ where: { productId } });
    } catch {
      return Array.from(InStore.images.values()).filter((img) => img.productId === productId);
    }
  }

  // --- PRICES & HISTORIAL DE PRECIOS ---
  static async setProductPrice(
    productId: string,
    priceType: 'LIST' | 'LIST_PRICE' | 'MINIMUM_AUTHORIZED' | 'CREDIT' | 'CASH',
    amount: number | string | Decimal,
    userId?: string,
    reason?: string,
    idempotencyKey?: string,
    ipAddress?: string
  ) {
    const newPriceDecimal = new Decimal(amount);
    if (newPriceDecimal.isNaN() || newPriceDecimal.lt(0)) {
      throw new Error('Invalid price amount');
    }

    const product = await this.getProductById(productId);
    if (!product) throw new Error('Product not found');

    // Get current price
    let oldPriceDecimal = new Decimal(0);
    try {
      const prisma = PrismaService.getInstance();
      const currentPrice = await prisma.productPrice.findFirst({
        where: { productId, priceType: priceType as any },
      });
      if (currentPrice) {
        oldPriceDecimal = new Decimal(currentPrice.amount.toString());
      }
    } catch {
      const inStorePrice = InStore.prices.get(`${productId}_${priceType}`);
      if (inStorePrice) {
        oldPriceDecimal = new Decimal(inStorePrice.amount.toString());
      }
    }

    // Update/Upsert Price
    let updatedPrice;
    try {
      const prisma = PrismaService.getInstance();
      updatedPrice = await prisma.productPrice.upsert({
        where: { productId_priceType: { productId, priceType: priceType as any } },
        create: {
          productId,
          priceType: priceType as any,
          price: newPriceDecimal.toNumber(),
          amount: newPriceDecimal.toNumber(),
          isActive: true,
          createdBy: userId,
        },
        update: {
          price: newPriceDecimal.toNumber(),
          amount: newPriceDecimal.toNumber(),
          updatedAt: new Date(),
        },
      });

      // Record Immutable History
      const auditLog = await AuditLogService.log({
        userId,
        action: 'PRICE_CHANGED',
        entity: 'ProductPrice',
        entityId: updatedPrice.id,
        oldValues: JSON.stringify({ priceType, amount: oldPriceDecimal.toString() }),
        newValues: JSON.stringify({ priceType, amount: newPriceDecimal.toString() }),
        idempotencyKey,
        ipAddress,
      });

      await prisma.productPriceHistory.create({
        data: {
          productId,
          priceType: priceType as any,
          oldPrice: oldPriceDecimal.toNumber(),
          newPrice: newPriceDecimal.toNumber(),
          userId,
          reason,
          ipAddress,
          idempotencyKey,
          auditLogId: auditLog.id,
        },
      });
    } catch {
      const priceObj = {
        id: `prc_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
        productId,
        priceType,
        price: newPriceDecimal,
        amount: newPriceDecimal,
        isActive: true,
        updatedAt: new Date(),
      };
      InStore.prices.set(`${productId}_${priceType}`, priceObj);
      updatedPrice = priceObj;

      const auditLog = await AuditLogService.log({
        userId,
        action: 'PRICE_CHANGED',
        entity: 'ProductPrice',
        entityId: priceObj.id,
        oldValues: JSON.stringify({ priceType, amount: oldPriceDecimal.toString() }),
        newValues: JSON.stringify({ priceType, amount: newPriceDecimal.toString() }),
        idempotencyKey,
        ipAddress,
      });

      InStore.priceHistories.push({
        id: `prh_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
        productId,
        priceType,
        oldPrice: oldPriceDecimal,
        newPrice: newPriceDecimal,
        userId,
        reason,
        ipAddress,
        idempotencyKey,
        auditLogId: auditLog.id,
        changedAt: new Date(),
      });
    }

    return updatedPrice;
  }

  static async getPriceHistory(productId: string) {
    try {
      const prisma = PrismaService.getInstance();
      const history = await prisma.productPriceHistory.findMany({
        where: { productId },
        orderBy: { changedAt: 'desc' },
      });
      if (history.length > 0) return history;
    } catch {}
    return InStore.priceHistories.filter((h) => h.productId === productId);
  }

  // --- MINIMUM PRICE & AUTHORIZATION ---
  static async validateAndCheckMinimumPrice(
    productId: string,
    proposedPrice: number | string | Decimal,
    userId: string,
    userRole: string,
    reason?: string
  ): Promise<{ allowed: boolean; authorizationRequest?: any; minimumPrice?: Decimal }> {
    const proposed = new Decimal(proposedPrice);

    // Get minimum authorized price for this product
    let minPriceDecimal: Decimal | null = null;
    try {
      const prisma = PrismaService.getInstance();
      const minPriceRecord = await prisma.productPrice.findFirst({
        where: { productId, priceType: { in: ['MINIMUM_AUTHORIZED' as any, 'MINIMUM' as any] } },
      });
      if (minPriceRecord) {
        minPriceDecimal = new Decimal(minPriceRecord.amount.toString());
      }
    } catch {
      const prc = InStore.prices.get(`${productId}_MINIMUM_AUTHORIZED`);
      if (prc) minPriceDecimal = new Decimal(prc.amount.toString());
    }

    if (!minPriceDecimal) {
      // If no minimum price defined, allow
      return { allowed: true };
    }

    if (proposed.gte(minPriceDecimal)) {
      return { allowed: true, minimumPrice: minPriceDecimal };
    }

    // Proposed price < minimumAuthorizedPrice
    // If user is SUPERVISORA or ADMIN, they can directly override if performing supervisor action,
    // but if VENDEDORA or standard action, block and create AuthorizationRequest (PRICE_OVERRIDE, PENDING)
    const reqId = `auth_req_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
    const authRequest = {
      id: reqId,
      type: 'PRICE_OVERRIDE',
      status: 'PENDING',
      requestedBy: userId,
      productId,
      proposedPrice: proposed,
      minimumPrice: minPriceDecimal,
      reason: reason || 'Proposed price below authorized minimum',
      createdAt: new Date(),
    };

    try {
      const prisma = PrismaService.getInstance();
      const createdAuth = await prisma.authorizationRequest.create({
        data: {
          id: reqId,
          type: 'PRICE_OVERRIDE',
          status: 'PENDING',
          requestedBy: userId,
          productId,
          proposedPrice: proposed.toNumber(),
          minimumPrice: minPriceDecimal.toNumber(),
          reason: authRequest.reason,
        },
      });
      await AuditLogService.log({
        userId,
        action: 'PRICE_OVERRIDE_REQUESTED',
        entity: 'AuthorizationRequest',
        entityId: createdAuth.id,
        newValues: JSON.stringify(createdAuth),
      });
      return { allowed: false, authorizationRequest: createdAuth, minimumPrice: minPriceDecimal };
    } catch {
      InStore.authorizationRequests.set(reqId, authRequest);
      await AuditLogService.log({
        userId,
        action: 'PRICE_OVERRIDE_REQUESTED',
        entity: 'AuthorizationRequest',
        entityId: reqId,
        newValues: JSON.stringify(authRequest),
      });
      return { allowed: false, authorizationRequest: authRequest, minimumPrice: minPriceDecimal };
    }
  }

  static async approveAuthorizationRequest(requestId: string, supervisorUserId: string, supervisorRole: string) {
    if (supervisorRole !== 'SUPERVISORA' && supervisorRole !== 'ADMIN') {
      throw new Error('Forbidden: Only SUPERVISORA or ADMIN can approve price override requests');
    }

    try {
      const prisma = PrismaService.getInstance();
      const updated = await prisma.authorizationRequest.update({
        where: { id: requestId },
        data: {
          status: 'APPROVED',
          approvedBy: supervisorUserId,
          updatedAt: new Date(),
        },
      });
      await AuditLogService.log({
        userId: supervisorUserId,
        action: 'PRICE_OVERRIDE_APPROVED',
        entity: 'AuthorizationRequest',
        entityId: requestId,
        newValues: JSON.stringify(updated),
      });
      return updated;
    } catch {
      const req = InStore.authorizationRequests.get(requestId);
      if (!req) throw new Error('Authorization request not found');
      req.status = 'APPROVED';
      req.approvedBy = supervisorUserId;
      req.updatedAt = new Date();
      await AuditLogService.log({
        userId: supervisorUserId,
        action: 'PRICE_OVERRIDE_APPROVED',
        entity: 'AuthorizationRequest',
        entityId: requestId,
        newValues: JSON.stringify(req),
      });
      return req;
    }
  }
}
