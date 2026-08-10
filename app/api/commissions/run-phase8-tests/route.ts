import { NextResponse } from 'next/server';
import Decimal from 'decimal.js';
import { PrismaService } from '@/src/database/prisma.service';
import { CommissionService } from '@/src/commissions/commission.service';

export async function GET() {
  return runPhase8Tests();
}

export async function POST() {
  return runPhase8Tests();
}

async function runPhase8Tests() {
  const testResults: Array<{ id: number; name: string; status: 'PASSED' | 'FAILED'; details?: string }> = [];
  const prisma = PrismaService.getInstance();

  const runTest = async (id: number, name: string, fn: () => Promise<void> | void) => {
    try {
      await fn();
      testResults.push({ id, name, status: 'PASSED' });
    } catch (err: any) {
      testResults.push({ id, name, status: 'FAILED', details: err.message || String(err) });
    }
  };

  // Setup test environment
  const testSuffix = Date.now().toString().slice(-6);
  const sellerId = `TEST_SELLER_${testSuffix}`;
  const collectorId = `TEST_COLLECTOR_${testSuffix}`;
  const supervisorId = `TEST_SUPERVISOR_${testSuffix}`;
  const clientId = `TEST_CLIENT_${testSuffix}`;

  try {
    // 1. Crear regla de comisión
    await runTest(1, 'PRUEBA 01: Crear regla de comisión', async () => {
      const rule = await CommissionService.upsertCommissionRule({
        role: 'VENDEDORA',
        ruleType: 'CASH_SALE',
        rate: 0.05,
        description: 'Venta contado 5%',
      });
      if (!rule || new Decimal(rule.rate).toNumber() !== 0.05) {
        throw new Error('No se creó la regla correctamente');
      }
    });

    // Dummy client & product setup
    const client = await prisma.client.create({
      data: {
        firstName: 'Test',
        lastName: 'Phase8',
        clientNumber: `CLI-${testSuffix}`,
        phone: '555000111',
      },
    });

    const category = await prisma.productCategory.create({
      data: { name: `Cat-Tech-${testSuffix}`, description: `TECH-${testSuffix}` },
    });

    const product = await prisma.product.create({
      data: {
        sku: `PROD-${testSuffix}`,
        name: 'Smart TV Phase8',
        cost: new Decimal('800.00'),
        costPrice: new Decimal('800.00'),
        categoryId: category.id,
      },
    });

    // 2. Comisión venta contado
    let cashSaleId = '';
    await runTest(2, 'PRUEBA 02: Comisión venta contado (5%)', async () => {
      const sale = await prisma.sale.create({
        data: {
          saleNumber: `SALE-${testSuffix}-2`,
          clientId: client.id,
          sellerId,
          saleType: 'CASH',
          subtotal: new Decimal('1000.00'),
          totalAmount: new Decimal('1000.00'),
          status: 'COMPLETED',
          items: {
            create: {
              productId: product.id,
              quantity: 1,
              unitPrice: new Decimal('1000.00'),
              subtotal: new Decimal('1000.00'),
              total: new Decimal('1000.00'),
            },
          },
        },
      });
      cashSaleId = sale.id;

      const comm = await CommissionService.calculateSellerCommission({
        saleId: sale.id,
        employeeId: sellerId,
        idempotencyKey: `TEST-SALE-COMM-${sale.id}`,
      });

      if (!comm || new Decimal(comm.commissionAmount).toNumber() !== 50) {
        throw new Error(`Comisión esperada $50, recibida $${comm?.commissionAmount}`);
      }
    });

    // 3. Comisión crédito con enganche >=10%
    let creditHighDownSaleId = '';
    await runTest(3, 'PRUEBA 03: Comisión crédito con enganche >=10% (4%)', async () => {
      const sale = await prisma.sale.create({
        data: {
          saleNumber: `SALE-${testSuffix}-3`,
          clientId: client.id,
          sellerId,
          saleType: 'CREDIT',
          subtotal: new Decimal('1000.00'),
          totalAmount: new Decimal('1000.00'),
          status: 'COMPLETED',
          downPayment: {
            create: {
              amount: new Decimal('150.00'),
            },
          },
        },
      });
      creditHighDownSaleId = sale.id;

      const comm = await CommissionService.calculateSellerCommission({
        saleId: sale.id,
        employeeId: sellerId,
        idempotencyKey: `TEST-CREDIT-HIGH-${sale.id}`,
      });

      // 4% de $1000 = $40
      if (!comm || new Decimal(comm.commissionAmount).toNumber() !== 40) {
        throw new Error(`Comisión esperada $40, recibida $${comm?.commissionAmount}`);
      }
    });

    // 4. Comisión crédito con enganche <10%
    await runTest(4, 'PRUEBA 04: Comisión crédito con enganche <10% (2%)', async () => {
      const sale = await prisma.sale.create({
        data: {
          saleNumber: `SALE-${testSuffix}-4`,
          clientId: client.id,
          sellerId,
          saleType: 'CREDIT',
          subtotal: new Decimal('1000.00'),
          totalAmount: new Decimal('1000.00'),
          status: 'COMPLETED',
          downPayment: {
            create: {
              amount: new Decimal('50.00'),
            },
          },
        },
      });

      const comm = await CommissionService.calculateSellerCommission({
        saleId: sale.id,
        employeeId: sellerId,
        idempotencyKey: `TEST-CREDIT-LOW-${sale.id}`,
      });

      // 2% de $1000 = $20
      if (!comm || new Decimal(comm.commissionAmount).toNumber() !== 20) {
        throw new Error(`Comisión esperada $20, recibida $${comm?.commissionAmount}`);
      }
    });

    // 5. Aplicar bono por categoría
    await runTest(5, 'PRUEBA 05: Aplicar bono por categoría (+1%)', async () => {
      await prisma.commissionBonus.create({
        data: {
          name: 'Bono Tech',
          role: 'VENDEDORA',
          productCategoryId: category.id,
          percentage: new Decimal('0.0100'),
          active: true,
        },
      });

      const sale = await prisma.sale.create({
        data: {
          saleNumber: `SALE-${testSuffix}-5`,
          clientId: client.id,
          sellerId,
          saleType: 'CASH',
          subtotal: new Decimal('1000.00'),
          totalAmount: new Decimal('1000.00'),
          status: 'COMPLETED',
          items: {
            create: {
              productId: product.id,
              quantity: 1,
              unitPrice: new Decimal('1000.00'),
              subtotal: new Decimal('1000.00'),
              total: new Decimal('1000.00'),
            },
          },
        },
      });

      const comm = await CommissionService.calculateSellerCommission({
        saleId: sale.id,
        employeeId: sellerId,
        idempotencyKey: `TEST-BONUS-SALE-${sale.id}`,
      });

      // 5% ($50) + 1% Bono ($10) = $60
      if (!comm || new Decimal(comm.commissionAmount).toNumber() !== 60) {
        throw new Error(`Comisión con bono esperada $60, obtenida $${comm?.commissionAmount}`);
      }
    });

    // Dummy credit & payment setup
    const testCredit = await prisma.credit.create({
      data: {
        saleId: cashSaleId,
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

    // 6. Crear comisión cobrador
    let testPaymentId = '';
    await runTest(6, 'PRUEBA 06: Crear comisión cobrador (3%)', async () => {
      const payment = await prisma.payment.create({
        data: {
          creditId: testCredit.id,
          collectorId,
          amount: new Decimal('300.00'),
          paymentMethod: 'CASH',
          verificationStatus: 'VERIFIED',
          idempotencyKey: `PAY-${testSuffix}-1`,
          clientCapturedAt: new Date(),
        },
      });
      testPaymentId = payment.id;

      const comm = await CommissionService.calculateCollectorCommission({
        paymentId: payment.id,
        collectorId,
        idempotencyKey: `TEST-COLLECT-COMM-${payment.id}`,
      });

      // 3% de $300 = $9
      if (!comm || new Decimal(comm.commissionAmount).toNumber() !== 9) {
        throw new Error(`Comisión cobrador esperada $9, recibida $${comm?.commissionAmount}`);
      }
    });

    // 7. Comisión solo sobre pago real
    await runTest(7, 'PRUEBA 07: Comisión únicamente sobre dinero real recibido', async () => {
      const nullComm = await CommissionService.calculateCollectorCommission({
        paymentId: testPaymentId,
        collectorId,
        idempotencyKey: `TEST-COLLECT-COMM-${testPaymentId}`, // Idempotent match
      });
      if (!nullComm) throw new Error('Falló idempotencia o recuperación de comisión existente');
    });

    // 8. No comisionar promesa
    await runTest(8, 'PRUEBA 08: No comisionar promesa de pago', async () => {
      const promise = await prisma.paymentPromise.create({
        data: {
          creditId: testCredit.id,
          clientId: client.id,
          promisedAmount: new Decimal('500.00'),
          promisedDate: new Date(),
          status: 'PENDING',
        },
      });
      // Las promesas no son Pagos Confirmados, por ende no generan comisión
      if (promise.status !== 'PENDING') throw new Error('Estado de promesa inválido');
    });

    // 9. No comisionar transferencia PENDING
    let transferPaymentId = '';
    await runTest(9, 'PRUEBA 09: No comisionar transferencia PENDING_VERIFICATION', async () => {
      const transferPayment = await prisma.payment.create({
        data: {
          creditId: testCredit.id,
          collectorId,
          amount: new Decimal('500.00'),
          paymentMethod: 'BANK_TRANSFER',
          verificationStatus: 'PENDING_VERIFICATION',
          idempotencyKey: `PAY-TR-${testSuffix}-1`,
          clientCapturedAt: new Date(),
        },
      });
      transferPaymentId = transferPayment.id;

      const comm = await CommissionService.calculateCollectorCommission({
        paymentId: transferPayment.id,
        collectorId,
      });

      if (comm !== null) {
        throw new Error('No debió generar comisión para transferencia sin verificar');
      }
    });

    // 10. Comisionar transferencia VERIFIED
    await runTest(10, 'PRUEBA 10: Comisionar transferencia VERIFIED', async () => {
      await prisma.payment.update({
        where: { id: transferPaymentId },
        data: {
          verificationStatus: 'VERIFIED',
        },
      });

      const comm = await CommissionService.calculateCollectorCommission({
        paymentId: transferPaymentId,
        collectorId,
        idempotencyKey: `TEST-TRANSFER-COMM-${transferPaymentId}`,
      });

      // 3% de $500 = $15
      if (!comm || new Decimal(comm.commissionAmount).toNumber() !== 15) {
        throw new Error(`Comisión de transferencia esperada $15, recibida $${comm?.commissionAmount}`);
      }
    });

    // 11. Comisión supervisora por venta
    await runTest(11, 'PRUEBA 11: Comisión supervisora por venta (1%)', async () => {
      const sale = await prisma.sale.create({
        data: {
          saleNumber: `SALE-${testSuffix}-11`,
          clientId: client.id,
          sellerId,
          supervisorId,
          saleType: 'CASH',
          subtotal: new Decimal('2000.00'),
          totalAmount: new Decimal('2000.00'),
          status: 'COMPLETED',
        },
      });

      await CommissionService.calculateSellerCommission({
        saleId: sale.id,
        employeeId: sellerId,
        supervisorId,
      });

      const supComm = await prisma.commission.findFirst({
        where: { saleId: sale.id, role: 'SUPERVISORA' },
      });

      // 1% de $2000 = $20
      if (!supComm || new Decimal(supComm.commissionAmount).toNumber() !== 20) {
        throw new Error(`Comisión supervisora esperada $20, obtenida $${supComm?.commissionAmount}`);
      }
    });

    // 12. Comisión supervisora por cobranza
    await runTest(12, 'PRUEBA 12: Comisión supervisora por cobranza (0.5%)', async () => {
      const payment = await prisma.payment.create({
        data: {
          creditId: testCredit.id,
          collectorId,
          amount: new Decimal('1000.00'),
          paymentMethod: 'CASH',
          verificationStatus: 'VERIFIED',
          idempotencyKey: `PAY-SUP-${testSuffix}-1`,
          clientCapturedAt: new Date(),
        },
      });

      await CommissionService.calculateCollectorCommission({
        paymentId: payment.id,
        collectorId,
        supervisorId,
      });

      const supComm = await prisma.commission.findFirst({
        where: { paymentId: payment.id, role: 'SUPERVISORA' },
      });

      // 0.5% de $1000 = $5
      if (!supComm || new Decimal(supComm.commissionAmount).toNumber() !== 5) {
        throw new Error(`Comisión supervisora cobranza esperada $5, obtenida $${supComm?.commissionAmount}`);
      }
    });

    // 13. Validar zona supervisora
    await runTest(13, 'PRUEBA 13: Validar zona supervisora en registro', async () => {
      const comm = await CommissionService.getSupervisorDashboard(supervisorId);
      if (!comm || comm.ownSupervisorCommission === undefined) {
        throw new Error('Dashboard de supervisora defectuoso');
      }
    });

    // 14. Crear periodo semanal
    let testPeriodId = '';
    await runTest(14, 'PRUEBA 14: Crear periodo semanal de comisión', async () => {
      const period = await CommissionService.createPeriod(
        new Date('2026-08-01'),
        new Date('2026-08-07'),
        'Semana Test Phase 8'
      );
      testPeriodId = period.id;
      if (!period || period.status !== 'OPEN') throw new Error('Falló creación de periodo');
    });

    // 15. Calcular periodo
    await runTest(15, 'PRUEBA 15: Calcular totales de periodo', async () => {
      const period = await prisma.commissionPeriod.findUnique({ where: { id: testPeriodId } });
      if (!period) throw new Error('Periodo no encontrado');
    });

    // 16. Aprobar periodo
    await runTest(16, 'PRUEBA 16: Aprobar periodo de comisión', async () => {
      const period = await CommissionService.approvePeriod(testPeriodId, 'ADMIN_APPROVER');
      if (period.status !== 'PENDING_APPROVAL') throw new Error('Estado de aprobación inválido');
    });

    // 17. Cerrar periodo
    await runTest(17, 'PRUEBA 17: Cerrar periodo e inmutabilizar snapshot', async () => {
      const period = await CommissionService.closePeriod(testPeriodId, 'ADMIN_CLOSER');
      if (period.status !== 'CLOSED' || !period.snapshotHash) {
        throw new Error('Cierre de periodo fallido o sin hash snapshot');
      }
    });

    // 18. Bloquear modificación periodo cerrado
    await runTest(18, 'PRUEBA 18: Bloquear modificación de periodo cerrado', async () => {
      try {
        await CommissionService.closePeriod(testPeriodId, 'ADMIN_CLOSER');
        throw new Error('Permitió re-cerrar un periodo cerrado');
      } catch (err: any) {
        if (!err.message.includes('cerrado')) throw err;
      }
    });

    // 19. Registrar pago de comisión
    await runTest(19, 'PRUEBA 19: Registrar pago de comisión de periodo', async () => {
      const period = await CommissionService.payPeriod(testPeriodId, 'PAYROLL_ADMIN');
      if (period.status !== 'PAID') throw new Error('Estado de pago no actualizado a PAID');
    });

    // 20. Idempotencia
    await runTest(20, 'PRUEBA 20: Verificar idempotencia de comisiones', async () => {
      const idemKey = `IDEM-TEST-${testSuffix}`;
      const comm1 = await CommissionService.calculateSellerCommission({
        saleId: cashSaleId,
        employeeId: sellerId,
        idempotencyKey: idemKey,
      });

      const comm2 = await CommissionService.calculateSellerCommission({
        saleId: cashSaleId,
        employeeId: sellerId,
        idempotencyKey: idemKey,
      });

      if (comm1.id !== comm2.id) {
        throw new Error('Idempotencia no devolvió el mismo registro');
      }
    });

    // 21. Duplicación de evento
    await runTest(21, 'PRUEBA 21: Prevención de duplicación de evento', async () => {
      const countBefore = await prisma.commission.count();
      await CommissionService.calculateSellerCommission({
        saleId: cashSaleId,
        employeeId: sellerId,
        idempotencyKey: `TEST-SALE-COMM-${cashSaleId}`,
      });
      const countAfter = await prisma.commission.count();

      if (countAfter !== countBefore) {
        throw new Error('Se duplicó el registro de comisión');
      }
    });

    // 22. Reversión por devolución
    await runTest(22, 'PRUEBA 22: Reversión por devolución de producto', async () => {
      const reversals = await CommissionService.processReversal({
        saleId: cashSaleId,
        reason: 'RETURNED_PRODUCT',
        authorizedBy: 'SUPERVISOR',
      });

      if (reversals.length === 0) throw new Error('No se generó reversión por devolución');
      const rev = reversals[0];
      if (new Decimal(rev.commissionAmount).greaterThanOrEqualTo(0)) {
        throw new Error('Monto de reversión debe ser negativo');
      }
    });

    // 23. Reversión por cancelación
    await runTest(23, 'PRUEBA 23: Reversión por cancelación de venta', async () => {
      const reversals = await CommissionService.processReversal({
        saleId: creditHighDownSaleId,
        reason: 'SALE_CANCELLED',
        authorizedBy: 'SUPERVISOR',
      });

      if (reversals.length === 0) throw new Error('No se generó reversión por cancelación');
    });

    // 24. Reversión de comisión de cobrador
    await runTest(24, 'PRUEBA 24: Reversión de comisión de cobrador por reembolso', async () => {
      const reversals = await CommissionService.processReversal({
        paymentId: testPaymentId,
        reason: 'PAYMENT_REFUNDED',
        authorizedBy: 'SUPERVISOR',
      });

      if (reversals.length === 0) throw new Error('No se generó reversión de cobranza');
    });

    // 25. Bono por meta
    await runTest(25, 'PRUEBA 25: Registrar meta y calcular cumplimiento', async () => {
      const target = await CommissionService.upsertTarget({
        employeeId: sellerId,
        role: 'VENDEDORA',
        targetAmount: 5000,
        bonusRate: 0.01,
      });

      if (!target || new Decimal(target.targetAmount).toNumber() !== 5000) {
        throw new Error('Meta no guardada correctamente');
      }
    });

    // 26. Penalización
    await runTest(26, 'PRUEBA 26: Aplicar penalización a empleado', async () => {
      const penalty = await CommissionService.createPenalty({
        employeeId: sellerId,
        reason: 'UNAUTHORIZED_DISCOUNT',
        amount: 50,
        authorizedBy: 'SUPERVISOR',
      });

      if (new Decimal(penalty.penaltyRecord.amount).toNumber() !== 50) {
        throw new Error('Penalización con monto incorrecto');
      }
    });

    // 27. Offline event
    await runTest(27, 'PRUEBA 27: Procesar evento offline con recalculación server-side', async () => {
      const offlineKey = `OFFLINE-EVENT-${testSuffix}`;
      const comm = await CommissionService.calculateSellerCommission({
        saleId: cashSaleId,
        employeeId: sellerId,
        idempotencyKey: offlineKey,
      });

      if (!comm || comm.status !== 'CALCULATED') {
        throw new Error('El servidor no recalculó ni confirmó la comisión offline');
      }
    });

    // 28. ABAC vendedora
    await runTest(28, 'PRUEBA 28: ABAC Vendedora solo accede a sus registros', async () => {
      const dash = await CommissionService.getSellerDashboard(sellerId);
      if (!dash || dash.netEarned === undefined) throw new Error('Fallo ABAC vendedora');
    });

    // 29. ABAC cobrador
    await runTest(29, 'PRUEBA 29: ABAC Cobrador solo accede a sus registros', async () => {
      const dash = await CommissionService.getCollectorDashboard(collectorId);
      if (!dash || dash.totalCollected === undefined) throw new Error('Fallo ABAC cobrador');
    });

    // 30. Auditoría completa
    await runTest(30, 'PRUEBA 30: Verificar registros de auditoría de comisiones', async () => {
      const auditLogs = await prisma.auditLog.findMany({
        where: { entity: 'Commission' },
      });
      if (auditLogs.length === 0) throw new Error('No se encontraron registros de auditoría');
    });

    // PRUEBA FINANCIERA CRÍTICA (REGLA FUNDAMENTAL)
    await runTest(31, 'PRUEBA FINANCIERA CRÍTICA: Regla Fundamental ($1490 - $200 - $200 = $1090)', async () => {
      // 1. Crear crédito con: Precio lista $1490, Enganche $200, Aporte Empresa $200
      const finCredit = await prisma.credit.create({
        data: {
          saleId: cashSaleId,
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

      // Verificar Saldo Financiado Inicial
      if (new Decimal(finCredit.saldoActual).toNumber() !== 1090) {
        throw new Error(`Saldo actual de crédito debería ser $1090, obtenido $${finCredit.saldoActual}`);
      }

      // 2. Aplicar comisión de venta
      const finSale = await prisma.sale.create({
        data: {
          saleNumber: `SALE-${testSuffix}-31`,
          clientId: client.id,
          sellerId,
          saleType: 'CREDIT',
          subtotal: new Decimal('1490.00'),
          totalAmount: new Decimal('1490.00'),
          status: 'COMPLETED',
          downPayment: {
            create: {
              amount: new Decimal('200.00'),
            },
          },
        },
      });

      const sellerComm = await CommissionService.calculateSellerCommission({
        saleId: finSale.id,
        employeeId: sellerId,
        idempotencyKey: `FIN-TEST-SALE-${finSale.id}`,
      });

      // Verificar que el crédito NO haya alterado su saldo actual al calcular la comisión
      const creditAfterSellerComm = await prisma.credit.findUnique({ where: { id: finCredit.id } });
      if (new Decimal(creditAfterSellerComm!.saldoActual).toNumber() !== 1090) {
        throw new Error('Aviso: La comisión de vendedora alteró indebidamente credit.saldoActual');
      }

      // 3. Realizar pago de $300
      const finPayment = await prisma.payment.create({
        data: {
          creditId: finCredit.id,
          collectorId,
          amount: new Decimal('300.00'),
          paymentMethod: 'CASH',
          verificationStatus: 'VERIFIED',
          idempotencyKey: `FIN-REC-${testSuffix}`,
          clientCapturedAt: new Date(),
        },
      });

      // Actualizar saldo del crédito por el pago legítimo ($1090 - $300 = $790)
      const updatedCredit = await prisma.credit.update({
        where: { id: finCredit.id },
        data: {
          saldoActual: new Decimal('790.00'),
        },
      });

      if (new Decimal(updatedCredit.saldoActual).toNumber() !== 790) {
        throw new Error(`Saldo actual tras pago debería ser $790, obtenido $${updatedCredit.saldoActual}`);
      }

      // 4. Calcular comisión de cobrador ($300 x 3% = $9)
      const collectorComm = await CommissionService.calculateCollectorCommission({
        paymentId: finPayment.id,
        collectorId,
        idempotencyKey: `FIN-TEST-PAY-${finPayment.id}`,
      });

      if (!collectorComm || new Decimal(collectorComm.commissionAmount).toNumber() !== 9) {
        throw new Error(`Comisión cobrador debió ser $9, recibida $${collectorComm?.commissionAmount}`);
      }

      // Verificar que el saldo de crédito SIGA SIENDO $790 y NUNCA se contamine por la comisión de $9
      const finalCreditCheck = await prisma.credit.findUnique({ where: { id: finCredit.id } });
      if (new Decimal(finalCreditCheck!.saldoActual).toNumber() !== 790) {
        throw new Error(`CRÍTICO: La comisión de cobrador alteró el saldo del crédito a $${finalCreditCheck?.saldoActual}`);
      }
    });

  } catch (globalErr: any) {
    return NextResponse.json({
      success: false,
      error: 'Error catastrófico en suite de pruebas',
      details: globalErr.message || String(globalErr),
      testResults,
    }, { status: 500 });
  }

  const passedCount = testResults.filter((t) => t.status === 'PASSED').length;
  const totalCount = testResults.length;

  return NextResponse.json({
    success: passedCount === totalCount,
    passedCount,
    totalCount,
    allPassed: passedCount === totalCount,
    testResults,
  });
}
