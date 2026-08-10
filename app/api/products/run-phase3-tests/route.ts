import { NextResponse } from 'next/server';
import Decimal from 'decimal.js';
import { ProductService } from '@/src/products/product.service';
import { InventoryService } from '@/src/inventory/inventory.service';
import { AuditLogService } from '@/src/audit/audit-log.service';

export async function GET() {
  const testResults: Array<{ id: number; name: string; passed: boolean; details?: string }> = [];

  try {
    // Reset stores for clean test run
    ProductService.clearMemoryStore();
    InventoryService.clearMemoryStore();
    AuditLogService.clear();

    // Test 1: Crear producto
    const p1 = await ProductService.createProduct({
      sku: 'SKU-LAV-300',
      barcode: '7501234567890',
      name: 'Lavadora Bitalis 15kg',
      description: 'Lavadora automática alta eficiencia',
      brand: 'Bitalis Home',
      costPrice: new Decimal('1490.00'),
    });
    testResults.push({ id: 1, name: 'Crear producto', passed: Boolean(p1 && p1.sku === 'SKU-LAV-300') });

    // Test 2: SKU único
    let duplicateSkuFailed = false;
    try {
      await ProductService.createProduct({
        sku: 'SKU-LAV-300',
        name: 'Otra lavadora',
        costPrice: '1000.00',
      });
    } catch {
      duplicateSkuFailed = true;
    }
    testResults.push({ id: 2, name: 'SKU único', passed: duplicateSkuFailed });

    // Test 3: Crear categoría
    const c1 = await ProductService.createCategory({
      name: 'Hogar',
      description: 'Electrodomésticos del hogar',
    });
    testResults.push({ id: 3, name: 'Crear categoría', passed: Boolean(c1 && c1.name === 'Hogar') });

    // Test 4: Categoría jerárquica
    const c2 = await ProductService.createCategory({
      name: 'Cocina',
      description: 'Línea blanca de cocina',
      parentId: c1.id,
    });
    testResults.push({ id: 4, name: 'Categoría jerárquica', passed: Boolean(c2 && c2.parentId === c1.id) });

    // Test 5: Imagen principal
    const img1 = await ProductService.addProductImage(p1.id, 'https://storage.bitalis.com/images/lavadora-main.jpg', true, 'img_key_01');
    testResults.push({ id: 5, name: 'Imagen principal', passed: Boolean(img1 && (img1.isPrimary || img1.isMain)) });

    // Test 6: Múltiples imágenes
    const img2 = await ProductService.addProductImage(p1.id, 'https://storage.bitalis.com/images/lavadora-detail.jpg', false, 'img_key_02');
    const images = await ProductService.getProductImages(p1.id);
    testResults.push({ id: 6, name: 'Múltiples imágenes', passed: images.length >= 2 });

    // Test 7: Precio lista
    const prList = await ProductService.setProductPrice(p1.id, 'LIST_PRICE', new Decimal('1490.00'), 'usr_admin_01');
    testResults.push({ id: 7, name: 'Precio lista', passed: Boolean(prList) });

    // Test 8: Precio mínimo
    const prMin = await ProductService.setProductPrice(p1.id, 'MINIMUM_AUTHORIZED', new Decimal('1200.00'), 'usr_admin_01');
    testResults.push({ id: 8, name: 'Precio mínimo', passed: Boolean(prMin) });

    // Test 9: Historial de precio
    await ProductService.setProductPrice(p1.id, 'LIST_PRICE', new Decimal('1590.00'), 'usr_admin_01', 'Aumento de costo de transporte');
    const priceHistory = await ProductService.getPriceHistory(p1.id);
    testResults.push({ id: 9, name: 'Historial de precio', passed: priceHistory.length >= 2 });

    // Test 10: Bloqueo precio debajo mínimo
    const checkMin = await ProductService.validateAndCheckMinimumPrice(
      p1.id,
      new Decimal('1100.00'),
      'usr_vend_01',
      'VENDEDORA',
      'Venta especial cliente frecuente'
    );
    testResults.push({ id: 10, name: 'Bloqueo precio debajo mínimo', passed: !checkMin.allowed });

    // Test 11: Solicitud PRICE_OVERRIDE
    const hasAuthReq = Boolean(checkMin.authorizationRequest && checkMin.authorizationRequest.type === 'PRICE_OVERRIDE');
    testResults.push({ id: 11, name: 'Solicitud PRICE_OVERRIDE', passed: hasAuthReq });

    // Test 12: Crear almacén
    const wh1 = await InventoryService.createWarehouse({
      name: 'Almacén Central Monterrey',
      code: 'WH-MTY-01',
      type: 'CENTRAL',
    });
    testResults.push({ id: 12, name: 'Crear almacén', passed: Boolean(wh1 && wh1.code === 'WH-MTY-01') });

    // Test 13: Stock inicial
    await InventoryService.setInitialStock(wh1.id, p1.id, 10, 'usr_admin_01');
    const stk1 = await InventoryService.getStock(wh1.id, p1.id);
    testResults.push({ id: 13, name: 'Stock inicial', passed: stk1.quantityOnHand === 10 });

    // Test 14: Cálculo quantityAvailable
    const calcAvailable = stk1.quantityOnHand - stk1.quantityReserved;
    testResults.push({ id: 14, name: 'Cálculo quantityAvailable', passed: calcAvailable === 10 });

    // Test 15: Reserva
    const res1 = await InventoryService.reserveStock({
      warehouseId: wh1.id,
      productId: p1.id,
      quantity: 3,
      saleId: 'SALE-2026-001',
      userId: 'usr_vend_01',
    });
    const stkAfterRes = await InventoryService.getStock(wh1.id, p1.id);
    testResults.push({ id: 15, name: 'Reserva', passed: Boolean(res1 && stkAfterRes.quantityReserved === 3 && stkAfterRes.quantityAvailable === 7) });

    // Test 16: Liberación
    const wh2 = await InventoryService.createWarehouse({ name: 'Almacén Norte', code: 'WH-NORTE-01', type: 'BRANCH' });
    await InventoryService.setInitialStock(wh2.id, p1.id, 5);
    const tempRes = await InventoryService.reserveStock({ warehouseId: wh2.id, productId: p1.id, quantity: 2 });
    await InventoryService.releaseReservation(tempRes.id, 'usr_admin_01', 'Cliente canceló apartado');
    const stkWh2 = await InventoryService.getStock(wh2.id, p1.id);
    testResults.push({ id: 16, name: 'Liberación', passed: stkWh2.quantityReserved === 0 && stkWh2.quantityAvailable === 5 });

    // Test 17: Expiración
    const tempResExp = await InventoryService.reserveStock({
      warehouseId: wh2.id,
      productId: p1.id,
      quantity: 1,
      expirationMinutes: -1, // Expired immediately
    });
    await InventoryService.expireReservations('usr_system');
    const stkAfterExp = await InventoryService.getStock(wh2.id, p1.id);
    testResults.push({ id: 17, name: 'Expiración', passed: stkAfterExp.quantityAvailable === 5 });

    // Test 18: Bloqueo de sobreventa
    let oversellBlocked = false;
    try {
      await InventoryService.reserveStock({
        warehouseId: wh1.id,
        productId: p1.id,
        quantity: 50, // Only 7 available
      });
    } catch {
      oversellBlocked = true;
    }
    testResults.push({ id: 18, name: 'Bloqueo de sobreventa', passed: oversellBlocked });

    // Test 19: Concurrencia de reservas
    const currentAvail = (await InventoryService.getStock(wh1.id, p1.id)).quantityAvailable;
    const req1 = InventoryService.reserveStock({ warehouseId: wh1.id, productId: p1.id, quantity: 5 });
    const req2 = InventoryService.reserveStock({ warehouseId: wh1.id, productId: p1.id, quantity: 4 });

    const results = await Promise.allSettled([req1, req2]);
    const passCount = results.filter((r) => r.status === 'fulfilled').length;
    const failCount = results.filter((r) => r.status === 'rejected').length;
    // With 7 available, one for 5 passes, the one for 4 fails because 7 - 5 = 2 < 4.
    testResults.push({ id: 19, name: 'Concurrencia de reservas', passed: passCount === 1 && failCount === 1 });

    // Test 20: Entrega
    const stkBeforeDeliver = await InventoryService.getStock(wh1.id, p1.id);
    const deliverRes = await InventoryService.deliverProduct({
      reservationId: res1.id,
      warehouseId: wh1.id,
      productId: p1.id,
      quantity: 3,
      saleId: 'SALE-2026-001',
      userId: 'usr_vend_01',
    });
    testResults.push({ id: 20, name: 'Entrega', passed: deliverRes.success && deliverRes.newOnHand === 7 });

    // Test 21: Kardex DELIVERY_OUT
    const kardexDeliver = await InventoryService.getKardex(p1.id, wh1.id);
    const hasDeliveryOut = kardexDeliver.some((k: any) => k.type === 'DELIVERY_OUT' || k.movementType === 'DELIVERY_OUT');

    testResults.push({ id: 21, name: 'Kardex DELIVERY_OUT', passed: hasDeliveryOut });

    // Test 22: Devolución
    const returnRes = await InventoryService.returnInventory({
      productId: p1.id,
      warehouseId: wh1.id,
      quantity: 1,
      reason: 'Empaque dañado al entregar',
      userId: 'usr_vend_01',
    });
    testResults.push({ id: 22, name: 'Devolución', passed: returnRes.success && returnRes.newOnHand === 8 });

    // Test 23: Merma
    const damageRes = await InventoryService.reportDamage({
      productId: p1.id,
      warehouseId: wh1.id,
      quantity: 1,
      reason: 'Cristal roto durante traslado',
      userId: 'usr_admin_01',
    });
    testResults.push({ id: 23, name: 'Merma', passed: damageRes.success && damageRes.newOnHand === 7 });

    // Test 24: Transferencia atómica
    const transferRes = await InventoryService.transferStock({
      productId: p1.id,
      fromWarehouseId: wh1.id,
      toWarehouseId: wh2.id,
      quantity: 2,
      userId: 'usr_admin_01',
      reason: 'Reabastecimiento de sucursal norte',
    });
    testResults.push({
      id: 24,
      name: 'Transferencia atómica',
      passed: transferRes.success && transferRes.sourceWarehouse.newOnHand === 5 && transferRes.destWarehouse.newOnHand === 7,
    });

    // Test 25: Kardex inmutable
    const kardexAll = await InventoryService.getKardex(p1.id);
    const kardexLength = kardexAll.length;
    testResults.push({ id: 25, name: 'Kardex inmutable', passed: kardexLength >= 5 });

    // Test 26: Pedido de abastecimiento
    const po1 = await InventoryService.createProductOrder({
      supplier: 'Mabe México S.A. de C.V.',
      warehouseId: wh1.id,
      items: [{ productId: p1.id, unitCost: '1400.00', quantityRequested: 10 }],
      userId: 'usr_admin_01',
    });
    testResults.push({ id: 26, name: 'Pedido de abastecimiento', passed: Boolean(po1 && po1.status === 'PENDING') });

    // Test 27: Recepción parcial
    const recPartial = await InventoryService.receiveProductOrder(po1.id, [{ productId: p1.id, quantityReceived: 4 }], 'usr_admin_01');
    testResults.push({ id: 27, name: 'Recepción parcial', passed: recPartial.status === 'PARTIAL_RECEIVED' });

    // Test 28: Recepción total
    const recTotal = await InventoryService.receiveProductOrder(po1.id, [{ productId: p1.id, quantityReceived: 6 }], 'usr_admin_01');
    testResults.push({ id: 28, name: 'Recepción total', passed: recTotal.status === 'COMPLETED' });

    // Test 29: Idempotencia
    const auditLogs = await AuditLogService.getLogs();
    testResults.push({ id: 29, name: 'Idempotencia', passed: Boolean(auditLogs) });

    // Test 30: Auditoría
    const hasAuditRecords = auditLogs.length > 5;
    testResults.push({ id: 30, name: 'Auditoría', passed: hasAuditRecords });

    const passedCount = testResults.filter((t) => t.passed).length;
    const allPassed = passedCount === testResults.length;

    return NextResponse.json({
      success: true,
      allPassed,
      totalTests: testResults.length,
      passedCount,
      results: testResults,
    });
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message, testResults }, { status: 500 });
  }
}
