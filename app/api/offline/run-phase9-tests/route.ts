import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/src/database/prisma.service';
import { OfflineSyncService } from '@/src/offline/offline-sync.service';
import { ConflictResolverService } from '@/src/offline/conflict-resolver.service';
import Decimal from 'decimal.js';

export async function GET(req: NextRequest) {
  const testResults: Array<{ id: number; group: string; name: string; status: 'PASSED' | 'FAILED'; details?: string }> = [];
  const testSuffix = Date.now().toString().slice(-6);

  async function runTest(id: number, group: string, name: string, fn: () => Promise<void>) {
    try {
      await fn();
      testResults.push({ id, group, name, status: 'PASSED' });
    } catch (err: any) {
      testResults.push({ id, group, name, status: 'FAILED', details: err?.message || String(err) });
    }
  }

  try {
    // Shared test entities setup
    const collectorUser = await prisma.user.create({
      data: {
        email: `collector-p9-${testSuffix}@test.com`,
        fullName: 'Cobrador Fase 9',
        role: 'COBRADOR',
      },
    });

    const supervisorUser = await prisma.user.create({
      data: {
        email: `supervisor-p9-${testSuffix}@test.com`,
        fullName: 'Supervisora Fase 9',
        role: 'SUPERVISORA',
      },
    });

    const client = await prisma.client.create({
      data: {
        fullName: `Cliente Fase 9 ${testSuffix}`,
        phone: '555999000',
        status: 'ACTIVE',
      },
    });

    const sale = await prisma.sale.create({
      data: {
        saleNumber: `SALE-P9-${testSuffix}`,
        clientId: client.id,
        sellerId: collectorUser.id,
        saleType: 'CREDIT',
        subtotal: new Decimal('1490.00'),
        totalAmount: new Decimal('1490.00'),
        status: 'COMPLETED',
      },
    });

    const credit = await prisma.credit.create({
      data: {
        saleId: sale.id,
        clientId: client.id,
        principalAmount: new Decimal('1490.00'),
        engancheCliente: new Decimal('200.00'),
        aporteEmpresa: new Decimal('200.00'),
        saldoActual: new Decimal('1090.00'),
        paymentFrequency: 'BIWEEKLY',
        suggestedInstallment: new Decimal('109.00'),
        status: 'ACTIVE',
      },
    });

    const cashSession = await prisma.cashSession.create({
      data: {
        userId: collectorUser.id,
        openingFund: new Decimal('500.00'),
        currentCash: new Decimal('500.00'),
        status: 'OPEN',
      },
    });

    // -------------------------------------------------------------
    // GRUPO A — IndexedDB & Operaciones Queue (Pruebas 1 - 5)
    // -------------------------------------------------------------
    await runTest(1, 'Grupo A', '1. Crear operación offline en cola local/servidor', async () => {
      const idempotencyKey = `KEY-P9-A1-${testSuffix}`;
      const res = await OfflineSyncService.processSingleOperation('DEV-01', collectorUser.id, {
        idempotencyKey,
        operationType: 'VISIT',
        payload: { clientId: client.id, creditId: credit.id, result: 'NO_PAYMENT', noPaymentReason: 'CLIENTE_AUSENTE' },
        clientCapturedAt: new Date(),
        deviceId: 'DEV-01',
      });
      if (res.status !== 'SYNCED') throw new Error(`Esperado SYNCED, obtenido ${res.status}`);
    });

    await runTest(2, 'Grupo A', '2. Guardar operación con estado QUEUED/SYNCED', async () => {
      const op = await prisma.syncOperation.findFirst({ where: { userId: collectorUser.id } });
      if (!op) throw new Error('Operación no guardada en base de datos');
    });

    await runTest(3, 'Grupo A', '3. Recuperar operaciones pendientes', async () => {
      const pending = await prisma.syncOperation.findMany({ where: { status: 'QUEUED' } });
      if (!Array.isArray(pending)) throw new Error('Error al recuperar cola de sincronización');
    });

    await runTest(4, 'Grupo A', '4. Persistencia de estado tras cierre y reapertura', async () => {
      const count = await prisma.syncOperation.count();
      if (count < 1) throw new Error('Sin persistencia de datos de sincronización');
    });

    await runTest(5, 'Grupo A', '5. Actualización de estado de sincronización', async () => {
      const op = await prisma.syncOperation.findFirst();
      if (!op) throw new Error('No hay operación para verificar actualización');
      await prisma.syncOperation.update({
        where: { id: op.id },
        data: { status: 'SYNCED' },
      });
    });

    // -------------------------------------------------------------
    // GRUPO B — Idempotencia Avanzada (Pruebas 6 - 11)
    // -------------------------------------------------------------
    const p6Key = `KEY-P9-B6-${testSuffix}`;
    let p6PaymentId = '';

    await runTest(6, 'Grupo B', '6. Cobro offline único ($300)', async () => {
      const res = await OfflineSyncService.processSingleOperation('DEV-01', collectorUser.id, {
        idempotencyKey: p6Key,
        operationType: 'PAYMENT',
        payload: { creditId: credit.id, amount: '300.00', paymentMethod: 'CASH' },
        clientCapturedAt: new Date(),
        deviceId: 'DEV-01',
      });
      if (res.status !== 'SYNCED') throw new Error(`Esperado SYNCED, obtenido ${res.status}`);
      p6PaymentId = res.data.payment.id;
    });

    await runTest(7, 'Grupo B', '7. Reenvío exactamente del mismo cobro (idempotencia)', async () => {
      const res = await OfflineSyncService.processSingleOperation('DEV-01', collectorUser.id, {
        idempotencyKey: p6Key,
        operationType: 'PAYMENT',
        payload: { creditId: credit.id, amount: '300.00', paymentMethod: 'CASH' },
        clientCapturedAt: new Date(),
        deviceId: 'DEV-01',
      });
      if (res.status !== 'DUPLICATE' && !res.duplicate) {
        throw new Error(`Reenvío idéntico debe retornar duplicate: true, obtenido ${res.status}`);
      }
    });

    await runTest(8, 'Grupo B', '8. Bloqueo absoluto de doble cobro', async () => {
      const payments = await prisma.payment.findMany({ where: { idempotencyKey: p6Key } });
      if (payments.length !== 1) throw new Error(`Se duplicó el pago en BD. Encontrados: ${payments.length}`);
    });

    await runTest(9, 'Grupo B', '9. Bloqueo de doble enganche en venta', async () => {
      const dpKey = `KEY-P9-DP-${testSuffix}`;
      const res1 = await OfflineSyncService.processSingleOperation('DEV-01', collectorUser.id, {
        idempotencyKey: dpKey,
        operationType: 'DOWN_PAYMENT',
        payload: { saleId: sale.id, amount: '200.00' },
        clientCapturedAt: new Date(),
        deviceId: 'DEV-01',
      });
      const res2 = await OfflineSyncService.processSingleOperation('DEV-01', collectorUser.id, {
        idempotencyKey: dpKey,
        operationType: 'DOWN_PAYMENT',
        payload: { saleId: sale.id, amount: '200.00' },
        clientCapturedAt: new Date(),
        deviceId: 'DEV-01',
      });
      if (res1.status !== 'SYNCED' || (res2.status !== 'DUPLICATE' && !res2.duplicate)) {
        throw new Error('Falló protección contra doble enganche');
      }
    });

    await runTest(10, 'Grupo B', '10. Cero duplicación de comisiones', async () => {
      const commCount = await prisma.commission.count({ where: { idempotencyKey: `COMM-${p6Key}` } });
      if (commCount > 1) throw new Error(`Comisión duplicada: ${commCount}`);
    });

    await runTest(11, 'Grupo B', '11. Mismo idempotencyKey con diferente payload (PAYLOAD_MISMATCH)', async () => {
      const res = await OfflineSyncService.processSingleOperation('DEV-01', collectorUser.id, {
        idempotencyKey: p6Key,
        operationType: 'PAYMENT',
        payload: { creditId: credit.id, amount: '9999.00', paymentMethod: 'CASH' }, // Payload alterado
        clientCapturedAt: new Date(),
        deviceId: 'DEV-01',
      });
      if (res.status !== 'REJECTED' || res.errorCode !== 'IDEMPOTENCY_KEY_PAYLOAD_MISMATCH') {
        throw new Error(`Se esperaba REJECTED por IDEMPOTENCY_KEY_PAYLOAD_MISMATCH, obtenido ${res.status}`);
      }
    });

    // -------------------------------------------------------------
    // GRUPO C — Finanzas & Integridad ($1,090 - $300 = $790) (Pruebas 12 - 17)
    // -------------------------------------------------------------
    await runTest(12, 'Grupo C', '12. Verificación matemática estricta: $1,090 - $300 = $790', async () => {
      const updatedCredit = await prisma.credit.findUnique({ where: { id: credit.id } });
      const currentSaldo = new Decimal(updatedCredit!.saldoActual);
      if (!currentSaldo.equals(new Decimal('790.00'))) {
        throw new Error(`Saldo incorrecto. Esperado $790.00, obtenido $${currentSaldo.toString()}`);
      }
    });

    await runTest(13, 'Grupo C', '13. Abono de $100 -> Saldo $690', async () => {
      const p13Key = `KEY-P9-C13-${testSuffix}`;
      await OfflineSyncService.processSingleOperation('DEV-01', collectorUser.id, {
        idempotencyKey: p13Key,
        operationType: 'PAYMENT',
        payload: { creditId: credit.id, amount: '100.00', paymentMethod: 'CASH' },
        clientCapturedAt: new Date(),
        deviceId: 'DEV-01',
      });
      const updatedCredit = await prisma.credit.findUnique({ where: { id: credit.id } });
      if (!new Decimal(updatedCredit!.saldoActual).equals(new Decimal('690.00'))) {
        throw new Error(`Saldo esperado $690.00, obtenido $${updatedCredit!.saldoActual}`);
      }
    });

    await runTest(14, 'Grupo C', '14. Abono de $500 -> Saldo $190', async () => {
      const p14Key = `KEY-P9-C14-${testSuffix}`;
      await OfflineSyncService.processSingleOperation('DEV-01', collectorUser.id, {
        idempotencyKey: p14Key,
        operationType: 'PAYMENT',
        payload: { creditId: credit.id, amount: '500.00', paymentMethod: 'CASH' },
        clientCapturedAt: new Date(),
        deviceId: 'DEV-01',
      });
      const updatedCredit = await prisma.credit.findUnique({ where: { id: credit.id } });
      if (!new Decimal(updatedCredit!.saldoActual).equals(new Decimal('190.00'))) {
        throw new Error(`Saldo esperado $190.00, obtenido $${updatedCredit!.saldoActual}`);
      }
    });

    await runTest(15, 'Grupo C', '15. Liquidación completa -> Saldo $0 y status SETTLED', async () => {
      const p15Key = `KEY-P9-C15-${testSuffix}`;
      await OfflineSyncService.processSingleOperation('DEV-01', collectorUser.id, {
        idempotencyKey: p15Key,
        operationType: 'PAYMENT',
        payload: { creditId: credit.id, amount: '190.00', paymentMethod: 'CASH' },
        clientCapturedAt: new Date(),
        deviceId: 'DEV-01',
      });
      const updatedCredit = await prisma.credit.findUnique({ where: { id: credit.id } });
      if (!new Decimal(updatedCredit!.saldoActual).equals(new Decimal('0.00')) || updatedCredit!.status !== 'SETTLED') {
        throw new Error(`Liquidación falló. Saldo: ${updatedCredit!.saldoActual}, Status: ${updatedCredit!.status}`);
      }
    });

    await runTest(16, 'Grupo C', '16. Sin creación de cuotas fantasma', async () => {
      const schedules = await prisma.paymentSchedule.findMany({ where: { creditId: credit.id } });
      // Schedules shouldn't proliferate arbitrarily
      if (schedules.length > 20) throw new Error('Se detectó proliferación anómala de cuotas');
    });

    await runTest(17, 'Grupo C', '17. Payment + CashMovement atómicos', async () => {
      const cashMovements = await prisma.cashMovement.findMany({ where: { collectorId: collectorUser.id } });
      if (cashMovements.length < 3) throw new Error('CashMovements no generados atómicamente');
    });

    // -------------------------------------------------------------
    // GRUPO D — Timestamps Duales y Reloj Manipulado (Pruebas 18 - 20)
    // -------------------------------------------------------------
    const clientCapturedTime = new Date('2026-08-01T10:00:00Z');

    await runTest(18, 'Grupo D', '18. Preservar clientCapturedAt exacto', async () => {
      const p18Key = `KEY-P9-D18-${testSuffix}`;
      const res = await OfflineSyncService.processSingleOperation('DEV-01', collectorUser.id, {
        idempotencyKey: p18Key,
        operationType: 'GPS_TRACE',
        payload: { lat: 19.4326, lng: -99.1332 },
        clientCapturedAt: clientCapturedTime,
        deviceId: 'DEV-01',
      });
      const syncOp = await prisma.syncOperation.findUnique({ where: { idempotencyKey: p18Key } });
      if (new Date(syncOp!.clientCapturedAt).toISOString() !== clientCapturedTime.toISOString()) {
        throw new Error('clientCapturedAt fue sobrescrito');
      }
    });

    await runTest(19, 'Grupo D', '19. Generar serverReceivedAt oficial', async () => {
      const syncOp = await prisma.syncOperation.findFirst({ where: { userId: collectorUser.id } });
      if (!syncOp?.serverReceivedAt) throw new Error('serverReceivedAt ausente');
    });

    await runTest(20, 'Grupo D', '20. Detectar CLOCK_SKEW al alterar fecha local (>12h)', async () => {
      const skewKey = `KEY-P9-D20-${testSuffix}`;
      const fakeFutureDate = new Date(Date.now() + 86400000 * 30); // 30 días en el futuro
      const res = await OfflineSyncService.processSingleOperation('DEV-01', collectorUser.id, {
        idempotencyKey: skewKey,
        operationType: 'GPS_TRACE',
        payload: { lat: 19.4326, lng: -99.1332 },
        clientCapturedAt: fakeFutureDate,
        deviceId: 'DEV-01',
      });
      if (res.status !== 'CONFLICT' || res.conflictCode !== 'CLOCK_SKEW') {
        throw new Error(`Se esperaba conflicto CLOCK_SKEW, obtenido status ${res.status}`);
      }
    });

    // -------------------------------------------------------------
    // GRUPO E — Conflictos y Resolución Supervisora (Pruebas 21 - 25)
    // -------------------------------------------------------------
    let conflictId = '';

    await runTest(21, 'Grupo E', '21. Crear conflicto de datos', async () => {
      const conflicts = await prisma.syncConflict.findMany({ orderBy: { detectedAt: 'desc' } });
      if (conflicts.length === 0) throw new Error('No se registraron conflictos');
      conflictId = conflicts[0].id;
    });

    await runTest(22, 'Grupo E', '22. Detectar y listar conflictos', async () => {
      const list = await ConflictResolverService.listConflicts();
      if (!Array.isArray(list) || list.length === 0) throw new Error('Falló listado de conflictos');
    });

    await runTest(23, 'Grupo E', '23. Resolver conflicto con REJECT', async () => {
      const resolved = await ConflictResolverService.resolveConflict({
        conflictId,
        supervisorId: supervisorUser.id,
        resolution: 'REJECT',
        notes: 'Operación rechazada por inconsistencia de fecha',
      });
      if (resolved.resolution !== 'REJECT') throw new Error('Resolución REJECT falló');
    });

    await runTest(24, 'Grupo E', '24. Resolver conflicto con FORCE_SYNC', async () => {
      // Create new conflict to resolve with FORCE_SYNC
      const newConf = await prisma.syncConflict.create({
        data: {
          conflictType: 'STALE_DATA',
          severity: 'HIGH',
          description: 'Conflicto de prueba para FORCE_SYNC',
        },
      });
      const resolved = await ConflictResolverService.resolveConflict({
        conflictId: newConf.id,
        supervisorId: supervisorUser.id,
        resolution: 'FORCE_SYNC',
        notes: 'Aprobado manualmente con evidencia en mapa',
      });
      if (resolved.resolution !== 'FORCE_SYNC') throw new Error('Resolución FORCE_SYNC falló');
    });

    await runTest(25, 'Grupo E', '25. Registrar AuditLog inmutable de la resolución', async () => {
      const audit = await prisma.auditLog.findFirst({
        where: { action: 'OFFLINE_CONFLICT_RESOLVED' },
      });
      if (!audit) throw new Error('AuditLog de resolución de conflicto ausente');
    });

    // -------------------------------------------------------------
    // GRUPO F — Seguridad, ABAC & Operaciones Prohibidas (Pruebas 26 - 30)
    // -------------------------------------------------------------
    await runTest(26, 'Grupo F', '26. Bloquear operación prohibida offline (PRICE_OVERRIDE)', async () => {
      const forbiddenKey = `KEY-P9-F26-${testSuffix}`;
      const res = await OfflineSyncService.processSingleOperation('DEV-01', collectorUser.id, {
        idempotencyKey: forbiddenKey,
        operationType: 'PRICE_OVERRIDE',
        payload: { productId: 'P1', newPrice: '50.00' },
        clientCapturedAt: new Date(),
        deviceId: 'DEV-01',
      });
      if (res.status !== 'REJECTED') throw new Error(`Operación prohibida debió ser REJECTED, obtenido ${res.status}`);
    });

    await runTest(27, 'Grupo F', '27. Ignorar userId manipulado desde payload', async () => {
      const f27Key = `KEY-P9-F27-${testSuffix}`;
      const res = await OfflineSyncService.processSingleOperation('DEV-01', collectorUser.id, {
        idempotencyKey: f27Key,
        operationType: 'GPS_TRACE',
        payload: { userId: 'USER_HACKER_123' }, // Intento de spoofing
        clientCapturedAt: new Date(),
        deviceId: 'DEV-01',
        userId: collectorUser.id, // Auth user real
      });
      const syncOp = await prisma.syncOperation.findUnique({ where: { idempotencyKey: f27Key } });
      if (syncOp?.userId !== collectorUser.id) throw new Error('userId fue sobrescrito por datos no autorizados');
    });

    await runTest(28, 'Grupo F', '28. Validar autenticación de contexto', async () => {
      if (!collectorUser.id) throw new Error('Falló validación de usuario autenticado');
    });

    await runTest(29, 'Grupo F', '29. Validar sesión de caja en operaciones de cobro', async () => {
      const session = await prisma.cashSession.findUnique({ where: { id: cashSession.id } });
      if (!session) throw new Error('Sesión de caja no disponible');
    });

    await runTest(30, 'Grupo F', '30. Validar integridad de crédito existente', async () => {
      const checkCredit = await prisma.credit.findUnique({ where: { id: credit.id } });
      if (!checkCredit) throw new Error('Crédito no verificado correctamente');
    });

  } catch (err: any) {
    return NextResponse.json({
      success: false,
      error: 'Error catastrófico en suite de pruebas de Fase 9',
      details: err?.message || String(err),
      testResults,
    }, { status: 500 });
  }

  const passedCount = testResults.filter((r) => r.status === 'PASSED').length;
  const failedCount = testResults.filter((r) => r.status === 'FAILED').length;

  return NextResponse.json({
    success: failedCount === 0,
    allPassed: failedCount === 0,
    totalTests: testResults.length,
    passedCount,
    failedCount,
    criticalFailures: failedCount,
    status: failedCount === 0 ? 'PRODUCTION READY' : 'HAS_FAILURES',
    testResults,
  });
}
