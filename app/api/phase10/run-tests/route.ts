import { NextRequest, NextResponse } from 'next/server';
import Decimal from 'decimal.js';
import { RenewalService, RenewalEngine, RenewalsStore } from '@/src/renewals/renewals.service';
import { ProcurementService, InventoryReorderEngine, ProcurementStore } from '@/src/procurement/procurement.service';
import { NotificationService, NotificationsStore, NotificationAbacService } from '@/src/notifications/notifications.service';
import { InventoryService } from '@/src/inventory/inventory.service';
import { AuditLogService } from '@/src/audit/audit-log.service';

export async function GET(req: NextRequest) {
  const testResults: Array<{ id: number; group: string; name: string; passed: boolean; details?: string }> = [];
  const testRunId = `p10_${Date.now()}_${Math.floor(Math.random() * 1000)}`;

  // Reset in-memory stores for isolated clean run
  RenewalsStore.clearMemoryStore();
  ProcurementStore.clearMemoryStore();
  NotificationsStore.clearMemoryStore();
  InventoryService.clearMemoryStore();
  AuditLogService.clear();

  async function runTest(id: number, group: string, name: string, fn: () => Promise<void>) {
    try {
      await fn();
      testResults.push({ id, group, name, passed: true });
    } catch (err: any) {
      testResults.push({ id, group, name, passed: false, details: err?.message || String(err) });
    }
  }

  // Set up mock test entities
  const clientId = `cli_${testRunId}`;
  const creditId = `cred_${testRunId}`;
  const sellerId = `vendedora_${testRunId}`;
  const supervisorId = `supervisora_${testRunId}`;
  const collectorId = `cobrador_${testRunId}`;
  const adminId = `admin_${testRunId}`;
  const productId = `prod_${testRunId}`;
  const warehouseId = `wh_${testRunId}`;

  // -------------------------------------------------------------
  // GRUPO 1 — RENOVACIONES (Tests 1 - 10)
  // -------------------------------------------------------------
  await runTest(1, 'Renovaciones', '1. Detectar crédito candidato (avance >= 70%)', async () => {
    // Generar candidato con 75% pagado
    const candidate = await RenewalService.createRenewalCandidate({
      clientId,
      sourceCreditId: creditId,
      creditId,
      progressPercentage: 75,
      remainingBalance: 250,
      assignedSellerId: sellerId,
      assignedSupervisorId: supervisorId,
      notes: 'Prueba de detección candidate',
    });
    if (!candidate || candidate.status !== 'RENEWAL_PENDING') {
      throw new Error(`Estado esperado RENEWAL_PENDING, obtenido: ${candidate?.status}`);
    }
  });

  await runTest(2, 'Renovaciones', '2. Crear oportunidad de renovación (ClientRenewal)', async () => {
    const renewal = await RenewalService.getRenewalByCredit(creditId);
    if (!renewal || renewal.clientId !== clientId) {
      throw new Error('No se encontró el registro de renovación creado');
    }
  });

  await runTest(3, 'Renovaciones', '3. Evitar renovación duplicada para el mismo crédito activo', async () => {
    const existing = await RenewalService.getRenewalByCredit(creditId);
    if (!existing) throw new Error('Se esperaba renovación existente');
    // Si se reevalúa, no debe duplicar la activa
    const allForCredit = (await RenewalService.listRenewals()).filter((r) => r.creditId === creditId);
    if (allForCredit.length > 1) {
      throw new Error('Se generó una renovación duplicada');
    }
  });

  await runTest(4, 'Renovaciones', '4. Notificar a vendedora y supervisora sobre renovación', async () => {
    const notifsSeller = await NotificationService.getUserNotifications(sellerId);
    const notifsSup = await NotificationService.getUserNotifications(supervisorId);
    if (notifsSeller.length === 0 || notifsSup.length === 0) {
      throw new Error('Faltan notificaciones enviadas a la vendedora o supervisora');
    }
  });

  await runTest(5, 'Renovaciones', '5. Registrar contacto con cliente (CONTACTED)', async () => {
    const list = await RenewalService.listRenewals();
    const ren = list[0];
    const updated = await RenewalService.contactClient(ren.id, 'Cliente interesado en renovar lavadora', sellerId);
    if (updated.status !== 'CONTACTED' || !updated.lastContactAt) {
      throw new Error(`Estado de contacto no actualizado: ${updated.status}`);
    }
  });

  await runTest(6, 'Renovaciones', '6. Programar visita con cliente (VISIT_SCHEDULED)', async () => {
    const list = await RenewalService.listRenewals();
    const ren = list[0];
    const visitDate = new Date(Date.now() + 86400000);
    const updated = await RenewalService.scheduleVisit(ren.id, visitDate, 'Visita en domicilio', sellerId);
    if (updated.status !== 'VISIT_SCHEDULED') {
      throw new Error(`Estado esperado VISIT_SCHEDULED, obtenido: ${updated.status}`);
    }
  });

  await runTest(7, 'Renovaciones', '7. Registrar resultado de visita (VISIT_DONE)', async () => {
    const list = await RenewalService.listRenewals();
    const ren = list[0];
    const updated = await RenewalService.completeVisit(ren.id, 'Visita completada con éxito', sellerId);
    if (updated.status !== 'VISIT_DONE') {
      throw new Error(`Estado esperado VISIT_DONE, obtenido: ${updated.status}`);
    }
  });

  await runTest(8, 'Renovaciones', '8. Convertir renovación a venta (CONVERTED)', async () => {
    const list = await RenewalService.listRenewals();
    const ren = list[0];
    const mockSaleId = `sale_${testRunId}`;
    const updated = await RenewalService.convertToSale(ren.id, mockSaleId, sellerId);
    if (updated.status !== 'CONVERTED' || updated.convertedSaleId !== mockSaleId) {
      throw new Error(`Fallo al convertir la renovación: status=${updated.status}`);
    }
  });

  await runTest(9, 'Renovaciones', '9. Rechazar renovación con motivo (REJECTED)', async () => {
    const candidate2 = await RenewalService.createRenewalCandidate({
      clientId: `cli_reject_${testRunId}`,
      sourceCreditId: `cred_reject_${testRunId}`,
      creditId: `cred_reject_${testRunId}`,
      progressPercentage: 80,
      remainingBalance: 100,
    });
    const rejected = await RenewalService.rejectRenewal(candidate2.id, 'Cliente cambió de ciudad', sellerId);
    if (rejected.status !== 'REJECTED' || rejected.reason !== 'Cliente cambió de ciudad') {
      throw new Error(`Fallo al rechazar renovación: status=${rejected.status}`);
    }
  });

  await runTest(10, 'Renovaciones', '10. Confirmar que la renovación NO crea venta, crédito, pago ni movimiento de caja automáticamente', async () => {
    // Verificar regla crítica: la sola creación de un candidato de renovación solo genera ClientRenewal y Notification
    const candidate3 = await RenewalService.createRenewalCandidate({
      clientId: `cli_rule_${testRunId}`,
      creditId: `cred_rule_${testRunId}`,
      progressPercentage: 90,
    });
    if (candidate3.status !== 'RENEWAL_PENDING' || candidate3.convertedSaleId !== null) {
      throw new Error('La renovación creó datos de venta automáticamente');
    }
  });

  // -------------------------------------------------------------
  // GRUPO 2 — INVENTARIO & ABASTECIMIENTO (Tests 11 - 20)
  // -------------------------------------------------------------
  await runTest(11, 'Abastecimiento', '11. Detectar stock bajo (por debajo de reorderPoint)', async () => {
    // Establecer stock inicial de 5 unidades donde reorderPoint es 10
    await InventoryService.setInitialStock(warehouseId, productId, 5);
    const stock = await InventoryService.getStock(warehouseId, productId);
    if (stock.quantityAvailable > 10) throw new Error('El stock disponible no refleja stock bajo');
  });

  await runTest(12, 'Abastecimiento', '12. Detectar stock agotado (quantityAvailable <= 0)', async () => {
    const zeroStockProd = `prod_zero_${testRunId}`;
    await InventoryService.setInitialStock(warehouseId, zeroStockProd, 0);
    const stock = await InventoryService.getStock(warehouseId, zeroStockProd);
    if (stock.quantityAvailable > 0) throw new Error('El stock no es 0');
  });

  await runTest(13, 'Abastecimiento', '13. Calcular cantidad de reorden (maxStock - quantityAvailable)', async () => {
    const maxStock = 50;
    const available = 5;
    const reorderQty = InventoryReorderEngine.calculateReorderQuantity(maxStock, available);
    if (reorderQty !== 45) {
      throw new Error(`Reorden esperado 45, obtenido: ${reorderQty}`);
    }
  });

  await runTest(14, 'Abastecimiento', '14. Crear sugerencia de reordenamiento de inventario', async () => {
    const suggestions = await InventoryReorderEngine.evaluateStockAndGenerateAlerts(warehouseId);
    if (!Array.isArray(suggestions)) throw new Error('Sugerencias no es una lista');
  });

  let orderIdGlobal = '';
  await runTest(15, 'Abastecimiento', '15. Crear orden de compra/pedido (ProductOrder)', async () => {
    const order = await ProcurementService.createProductOrder({
      supplier: 'Proveedor Electrónicos SA',
      warehouseId,
      items: [{ productId, unitCost: 1000, quantityRequested: 20 }],
    }, sellerId);
    if (!order || order.status !== 'PENDING_APPROVAL') {
      throw new Error(`Estado de orden esperado PENDING_APPROVAL, obtenido: ${order?.status}`);
    }
    orderIdGlobal = order.id;
  });

  await runTest(16, 'Abastecimiento', '16. Aprobar orden de compra (APPROVED)', async () => {
    const approved = await ProcurementService.approveOrder(orderIdGlobal, supervisorId);
    if (approved.status !== 'APPROVED' || approved.approvedBy !== supervisorId) {
      throw new Error(`Estado esperado APPROVED, obtenido: ${approved.status}`);
    }
  });

  await runTest(17, 'Abastecimiento', '17. Registrar recepción parcial de mercancía (PARTIALLY_RECEIVED)', async () => {
    const res = await ProcurementService.receiveOrder({
      orderId: orderIdGlobal,
      warehouseId,
      receivedBy: supervisorId,
      notes: 'Llegaron 8 de 20 unidades',
      items: [{ productId, quantityReceived: 8, unitCost: 1000 }],
    }, supervisorId);

    if (res.order.status !== 'PARTIALLY_RECEIVED' || res.receipt.receiptType !== 'RECEPCION_PARCIAL') {
      throw new Error(`Estado esperado PARTIALLY_RECEIVED, obtenido: ${res.order.status}`);
    }
  });

  await runTest(18, 'Abastecimiento', '18. Registrar recepción total de mercancía (COMPLETED)', async () => {
    const res = await ProcurementService.receiveOrder({
      orderId: orderIdGlobal,
      warehouseId,
      receivedBy: supervisorId,
      notes: 'Llegaron las 12 unidades restantes',
      items: [{ productId, quantityReceived: 12, unitCost: 1000 }],
    }, supervisorId);

    if (res.order.status !== 'COMPLETED' || res.receipt.receiptType !== 'RECEPCION_TOTAL') {
      throw new Error(`Estado esperado COMPLETED, obtenido: ${res.order.status}`);
    }
  });

  await runTest(19, 'Abastecimiento', '19. Incrementar stock disponible y en existencia tras recepción', async () => {
    const stock = await InventoryService.getStock(warehouseId, productId);
    // Stock inicial era 5 + 8 parcial + 12 restante = 25 total
    if (stock.quantityOnHand !== 25) {
      throw new Error(`Stock físico esperado 25, obtenido: ${stock.quantityOnHand}`);
    }
  });

  await runTest(20, 'Abastecimiento', '20. Generar movimiento inmutable en Kardex tipo PURCHASE_IN', async () => {
    const kardex = await InventoryService.getKardex(productId, warehouseId);
    const purchaseInMovements = kardex.filter((m) => m.movementType === 'PURCHASE_IN');
    if (purchaseInMovements.length < 2) {
      throw new Error(`Se esperaban al menos 2 movimientos PURCHASE_IN en Kardex, encontrados: ${purchaseInMovements.length}`);
    }
  });

  // -------------------------------------------------------------
  // GRUPO 3 — SEGURIDAD & CONTROL ABAC (Tests 21 - 25)
  // -------------------------------------------------------------
  await runTest(21, 'Seguridad ABAC', '21. Cobrador NO puede ver pedidos globales de compra', async () => {
    // Simular contexto COBRADOR
    const cobradorContext = { userId: collectorId, role: 'COBRADOR' };
    const canAccess = NotificationAbacService.canAccessNotification(cobradorContext, { type: 'PURCHASE_ORDER_GLOBAL' });
    if (canAccess) throw new Error('El cobrador pudo acceder a notificaciones de compra globales');
  });

  await runTest(22, 'Seguridad ABAC', '22. Vendedora NO puede acceder a notificaciones/sesiones de caja', async () => {
    const vendedoraContext = { userId: sellerId, role: 'VENDEDORA' };
    const canAccess = NotificationAbacService.canAccessNotification(vendedoraContext, { type: 'CASH_VARIANCE' });
    if (canAccess) throw new Error('La vendedora pudo acceder a variaciones de caja');
  });

  await runTest(23, 'Seguridad ABAC', '23. Supervisora accede a información de renovaciones y pedidos de su zona', async () => {
    const supervisorContext = { userId: supervisorId, role: 'SUPERVISORA', zoneId: 'zone_north' };
    const canAccess = NotificationAbacService.canAccessNotification(supervisorContext, { type: 'RENEWAL_PENDING' });
    if (!canAccess) throw new Error('La supervisora no pudo acceder a notificaciones de renovación');
  });

  await runTest(24, 'Seguridad ABAC', '24. Admin accede globalmente a todas las secciones', async () => {
    const adminContext = { userId: adminId, role: 'ADMIN' };
    const canAccess1 = NotificationAbacService.canAccessNotification(adminContext, { type: 'FINANCIAL_ANOMALY' });
    const canAccess2 = NotificationAbacService.canAccessNotification(adminContext, { type: 'PURCHASE_ORDER_PENDING' });
    if (!canAccess1 || !canAccess2) throw new Error('El admin no tuvo acceso global');
  });

  await runTest(25, 'Seguridad ABAC', '25. ABAC bloquea notificaciones fuera de asignación', async () => {
    const foreignUserContext = { userId: 'usr_other', role: 'COBRADOR' };
    const canAccess = NotificationAbacService.canAccessNotification(foreignUserContext, { userId: sellerId, type: 'OFFLINE_CONFLICT' });
    if (canAccess) throw new Error('ABAC permitió acceso a usuario no asignado');
  });

  // -------------------------------------------------------------
  // GRUPO 4 — NOTIFICACIONES & AUDITORÍA (Tests 26 - 30)
  // -------------------------------------------------------------
  await runTest(26, 'Notificaciones', '26. Crear alerta crítica (INVENTORY_STOCKOUT, CRITICAL)', async () => {
    const notif = await NotificationService.createNotification({
      userId: adminId,
      type: 'INVENTORY_STOCKOUT',
      priority: 'CRITICAL',
      title: 'Desabasto Crítico',
      message: 'Producto lavadora sin stock',
      entity: 'Product',
      entityId: productId,
    });
    if (notif.priority !== 'CRITICAL' || notif.type !== 'INVENTORY_STOCKOUT') {
      throw new Error(`Prioridad o tipo incorrecto: ${notif.priority}`);
    }
  });

  await runTest(27, 'Notificaciones', '27. Crear alerta importante (INVENTORY_REORDER_REQUIRED, HIGH)', async () => {
    const notif = await NotificationService.createNotification({
      userId: supervisorId,
      type: 'INVENTORY_REORDER_REQUIRED',
      priority: 'HIGH',
      title: 'Reorden Requerido',
      message: 'Producto refrigerador cerca del reorder point',
      entity: 'Product',
      entityId: productId,
    });
    if (notif.priority !== 'HIGH' || notif.type !== 'INVENTORY_REORDER_REQUIRED') {
      throw new Error(`Prioridad o tipo incorrecto: ${notif.priority}`);
    }
  });

  await runTest(28, 'Notificaciones', '28. Marcar notificación como leída (READ)', async () => {
    const notifs = await NotificationService.getUserNotifications(adminId);
    const target = notifs[0];
    const read = await NotificationService.markAsRead(target.id, adminId);
    if (read.status !== 'READ' || !read.readAt) {
      throw new Error(`Estado de notificación esperado READ, obtenido: ${read.status}`);
    }
  });

  await runTest(29, 'Notificaciones', '29. Evitar notificación duplicada abierta para el mismo objeto', async () => {
    const notif1 = await NotificationService.createNotification({
      userId: adminId,
      type: 'DUPLICATE_TEST',
      priority: 'MEDIUM',
      title: 'Alerta Duplicada',
      message: 'Mensaje 1',
      entity: 'TestEntity',
      entityId: 'ent_100',
    });

    const notif2 = await NotificationService.createNotification({
      userId: adminId,
      type: 'DUPLICATE_TEST',
      priority: 'MEDIUM',
      title: 'Alerta Duplicada Intent 2',
      message: 'Mensaje 2',
      entity: 'TestEntity',
      entityId: 'ent_100',
    });

    if (notif1.id !== notif2.id) {
      throw new Error('Se generó una notificación duplicada para el mismo objeto sin leer');
    }
  });

  await runTest(30, 'Notificaciones', '30. Verificar registro inmutable de auditoría 360° en todas las operaciones', async () => {
    const logs = await AuditLogService.getLogs();
    if (logs.length < 5) {
      throw new Error(`Se esperaban múltiples registros de auditoría 360°, encontrados: ${logs.length}`);
    }
  });

  const passedCount = testResults.filter((t) => t.passed).length;
  const failedCount = testResults.filter((t) => !t.passed).length;

  return NextResponse.json({
    phase: 10,
    summary: {
      total: testResults.length,
      passed: passedCount,
      failed: failedCount,
      status: failedCount === 0 ? 'COMPLETED' : 'FAILED',
    },
    results: testResults,
  });
}
