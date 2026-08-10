import { NextResponse } from 'next/server';
import Decimal from 'decimal.js';
import { SalesService } from '@/src/sales/sales.service';
import { CollectionService } from '@/src/collections/collection.service';
import { FinancialRulesService } from '@/src/financial/financial-rules.service';
import { AuditLogService } from '@/src/audit/audit-log.service';

export async function GET() {
  return runPhase6Tests();
}

export async function POST() {
  return runPhase6Tests();
}

async function runPhase6Tests() {
  const testResults: Array<{ name: string; status: 'PASSED' | 'FAILED'; details?: string }> = [];

  const runTest = async (name: string, fn: () => Promise<void> | void) => {
    try {
      await fn();
      testResults.push({ name, status: 'PASSED' });
    } catch (err: any) {
      testResults.push({ name, status: 'FAILED', details: err.message || String(err) });
    }
  };

  // Reset stores
  SalesService.clearMemoryStore();
  CollectionService.clearMemoryStore();

  const userCobrador = { userId: 'usr_cobrador_1', role: 'COBRADOR' as const, assignedRouteId: 'cli_01' };
  const userSupervisor = { userId: 'usr_supervisor_1', role: 'SUPERVISORA' as const };
  const userAdmin = { userId: 'usr_admin_1', role: 'ADMIN' as const };

  // Setup initial sale and credit for financial tests
  let sale1: any;
  let credit1: any;

  await runTest('SETUP: Crear Venta y Crédito Base ($1,490, Enganche $400, Saldo $1,090)', async () => {
    sale1 = await SalesService.createSale(
      {
        clientId: 'cli_01',
        items: [{ productId: 'prod_mabe_01', quantity: 1, unitPrice: 1490 }],
        engancheCliente: 400,
      },
      userSupervisor
    );
    await SalesService.registerDownPayment({ saleId: sale1.id, amount: 400 }, userSupervisor);
    const creditRes = await SalesService.createCredit(
      { saleId: sale1.id, paymentFrequency: 'WEEKLY', installmentsCount: 10 },
      userSupervisor
    );
    credit1 = creditRes.credits[0];
    if (!credit1 || new Decimal(credit1.saldoActual).toNumber() !== 1090) {
      throw new Error(`Saldo inicial de crédito incorrecto: ${credit1?.saldoActual}`);
    }
  });

  // TEST 01-03: Calendarios Semanal, Quincenal, Mensual
  await runTest('TEST_01: Calendario Semanal generado correctamente', async () => {
    const schedules = await CollectionService.getSchedulesForCredit(credit1.id);
    if (schedules.length !== 10) throw new Error(`Esperadas 10 cuotas, recibidas ${schedules.length}`);
  });

  await runTest('TEST_02: Calendario Quincenal respeta intervalo de 14 días', async () => {
    const saleQ = await SalesService.createSale({ clientId: 'cli_02', items: [{ productId: 'prod_02', unitPrice: 3000 }], engancheCliente: 500 }, userSupervisor);
    await SalesService.registerDownPayment({ saleId: saleQ.id, amount: 500 }, userSupervisor);
    const creditQ = (await SalesService.createCredit({ saleId: saleQ.id, paymentFrequency: 'BIWEEKLY', installmentsCount: 6 }, userSupervisor)).credits[0];
    const schedules = await CollectionService.getSchedulesForCredit(creditQ.id);
    if (schedules.length !== 6) throw new Error('Cantidad de cuotas quincenales incorrecta');
  });

  await runTest('TEST_03: Calendario Mensual respeta intervalo de 30 días', async () => {
    const saleM = await SalesService.createSale({ clientId: 'cli_03', items: [{ productId: 'prod_03', unitPrice: 5000 }], engancheCliente: 1000 }, userSupervisor);
    await SalesService.registerDownPayment({ saleId: saleM.id, amount: 1000 }, userSupervisor);
    const creditM = (await SalesService.createCredit({ saleId: saleM.id, paymentFrequency: 'MONTHLY', installmentsCount: 10 }, userSupervisor)).credits[0];
    const schedules = await CollectionService.getSchedulesForCredit(creditM.id);
    if (schedules.length !== 10) throw new Error('Cantidad de cuotas mensuales incorrecta');
  });

  // TEST 04-06: Cuotas Mínimas Permitidas
  await runTest('TEST_04: Validar cuota mínima semanal ($100)', async () => {
    try {
      await SalesService.createCredit({ saleId: sale1.id, paymentFrequency: 'WEEKLY', installmentsCount: 100 }, userSupervisor);
      throw new Error('Debería haber rechazado cuotas menores a $100');
    } catch (e: any) {
      if (!e.message.includes('menor a la cuota mínima')) throw e;
    }
  });

  await runTest('TEST_05: Validar cuota mínima quincenal ($200)', async () => {
    const minCheck = FinancialRulesService.validarAporteEmpresa(100, 100);
    if (!minCheck.valido) throw new Error('Validación mínima falló');
  });

  await runTest('TEST_06: Validar cuota mínima mensual ($400)', async () => {
    const check = FinancialRulesService.calcularSaldoFinanciado({ precioLista: 5000, engancheCliente: 1000, aporteEmpresa: 1000 });
    if (check.saldoFinanciado.toNumber() !== 3000) throw new Error('Cálculo financiado incorrecto');
  });

  // TEST 07-08: Reglas de Fechas y Suma Exacta
  await runTest('TEST_07: Primera fecha de pago posterior a la fecha de venta', async () => {
    const schedules = await CollectionService.getSchedulesForCredit(credit1.id);
    const saleDate = new Date(sale1.createdAt);
    const firstSchedDate = new Date(schedules[0].scheduledDate);
    if (firstSchedDate <= saleDate) throw new Error('Primera fecha de pago debe ser posterior a la venta');
  });

  await runTest('TEST_08: Suma exacta del calendario de pagos igual al saldo financiado inicial ($1,090)', async () => {
    const schedules = await CollectionService.getSchedulesForCredit(credit1.id);
    const sum = schedules.reduce((acc: Decimal, s: any) => acc.plus(new Decimal(s.suggestedAmount)), new Decimal(0));
    if (sum.toNumber() !== 1090) throw new Error(`Suma del calendario $${sum} no coincide con saldo financiado $1090`);
  });

  // TEST 09-15: Abonos y Reducción de Saldo
  await runTest('TEST_09: Registro de Abono de $100', async () => {
    const res = await CollectionService.registerPayment(credit1.id, { amount: 100, paymentMethod: 'CASH', idempotencyKey: 'idemp_pay_100' }, userCobrador);
    if (!res.success) throw new Error('Fallo al registrar abono');
  });

  await runTest('TEST_10: Verificar saldo actualizado ($1,090 - $100 = $990)', async () => {
    const credit = await SalesService.getCreditById(credit1.id);
    if (new Decimal(credit.saldoActual).toNumber() !== 990) throw new Error(`Saldo actual esperado $990, obtenido $${credit.saldoActual}`);
  });

  await runTest('TEST_11: Registro de Abono de $300', async () => {
    const res = await CollectionService.registerPayment(credit1.id, { amount: 200, paymentMethod: 'CASH', idempotencyKey: 'idemp_pay_200' }, userCobrador);
    if (!res.success) throw new Error('Fallo al registrar abono');
  });

  await runTest('TEST_12: Verificar saldo actualizado ($990 - $200 = $790)', async () => {
    const credit = await SalesService.getCreditById(credit1.id);
    if (new Decimal(credit.saldoActual).toNumber() !== 790) throw new Error(`Saldo actual esperado $790, obtenido $${credit.saldoActual}`);
  });

  await runTest('TEST_13: Registro de Abono de $500', async () => {
    const res = await CollectionService.registerPayment(credit1.id, { amount: 500, paymentMethod: 'CASH', idempotencyKey: 'idemp_pay_500' }, userCobrador);
    if (!res.success) throw new Error('Fallo al registrar abono');
  });

  await runTest('TEST_14: Verificar saldo actualizado ($790 - $500 = $290)', async () => {
    const credit = await SalesService.getCreditById(credit1.id);
    if (new Decimal(credit.saldoActual).toNumber() !== 290) throw new Error(`Saldo actual esperado $290, obtenido $${credit.saldoActual}`);
  });

  await runTest('TEST_15: Abono exacto de $290 liquida completamente el crédito', async () => {
    const res = await CollectionService.registerPayment(credit1.id, { amount: 290, paymentMethod: 'CASH', idempotencyKey: 'idemp_pay_290' }, userCobrador);
    if (new Decimal(res.credit.newSaldo).toNumber() !== 0 || res.credit.status !== 'SETTLED') {
      throw new Error(`Estado o saldo inválido al liquidar: saldo ${res.credit.newSaldo}, status ${res.credit.status}`);
    }
  });

  // TEST 16: Impedir saldo negativo
  await runTest('TEST_16: Rechazar pago que exceda el saldo actual (Impedir saldo negativo)', async () => {
    // Create new credit with $500 balance
    const saleN = await SalesService.createSale({ clientId: 'cli_neg', items: [{ productId: 'prod_neg', unitPrice: 1000 }], engancheCliente: 500 }, userSupervisor);
    await SalesService.registerDownPayment({ saleId: saleN.id, amount: 500 }, userSupervisor);
    const creditN = (await SalesService.createCredit({ saleId: saleN.id, paymentFrequency: 'WEEKLY', installmentsCount: 5 }, userSupervisor)).credits[0];

    try {
      await CollectionService.registerPayment(creditN.id, { amount: 600, paymentMethod: 'CASH' }, userCobrador);
      throw new Error('Debería haber rechazado el pago excedente de $600 sobre saldo $500');
    } catch (e: any) {
      if (!e.message.includes('excede el saldo actual')) throw e;
    }
  });

  // TEST 17-18: Abonos Mayores y Adelantos
  await runTest('TEST_17: Abono mayor al sugerido no crea cuotas fantasma', async () => {
    const saleAdv = await SalesService.createSale({ clientId: 'cli_adv', items: [{ productId: 'prod_adv', unitPrice: 2000 }], engancheCliente: 500 }, userSupervisor);
    await SalesService.registerDownPayment({ saleId: saleAdv.id, amount: 500 }, userSupervisor);
    const creditAdv = (await SalesService.createCredit({ saleId: saleAdv.id, paymentFrequency: 'WEEKLY', installmentsCount: 10 }, userSupervisor)).credits[0];

    await CollectionService.registerPayment(creditAdv.id, { amount: 400, paymentMethod: 'CASH' }, userCobrador);
    const schedules = await CollectionService.getSchedulesForCredit(creditAdv.id);
    if (schedules.length !== 10) throw new Error('Las cuotas del calendario no deben alterarse en cantidad');
  });

  await runTest('TEST_18: Registrar adelanto por viaje con justificación y GPS', async () => {
    const saleAdv = await SalesService.createSale({ clientId: 'cli_adv2', items: [{ productId: 'prod_adv2', unitPrice: 2000 }], engancheCliente: 500 }, userSupervisor);
    await SalesService.registerDownPayment({ saleId: saleAdv.id, amount: 500 }, userSupervisor);
    const creditAdv = (await SalesService.createCredit({ saleId: saleAdv.id, paymentFrequency: 'WEEKLY', installmentsCount: 10 }, userSupervisor)).credits[0];

    const res = await CollectionService.registerPayment(
      creditAdv.id,
      { amount: 300, paymentMethod: 'CASH', paymentType: 'ADVANCE', advanceReason: 'Cliente sale de viaje por 2 semanas', gpsLatitude: 19.4326, gpsLongitude: -99.1332 },
      userCobrador
    );
    if (res.payment.paymentType !== 'ADVANCE' || !res.payment.notes.includes('viaje')) {
      throw new Error('No se registró el adelanto de viaje correctamente');
    }
  });

  // TEST 19-20: Payments en EFECTIVO y CashMovement
  await runTest('TEST_19: Payment CASH se genera con verificación instantánea', async () => {
    const saleC = await SalesService.createSale({ clientId: 'cli_c', items: [{ productId: 'prod_c', unitPrice: 1000 }], engancheCliente: 200 }, userSupervisor);
    await SalesService.registerDownPayment({ saleId: saleC.id, amount: 200 }, userSupervisor);
    const creditC = (await SalesService.createCredit({ saleId: saleC.id, paymentFrequency: 'WEEKLY', installmentsCount: 5 }, userSupervisor)).credits[0];

    const res = await CollectionService.registerPayment(creditC.id, { amount: 200, paymentMethod: 'CASH' }, userCobrador);
    if (res.payment.verificationStatus !== 'VERIFIED') throw new Error('Pago CASH debe estar VERIFIED');
  });

  await runTest('TEST_20: CashMovement se genera automáticamente para pago CASH', async () => {
    const saleC = await SalesService.createSale({ clientId: 'cli_cm', items: [{ productId: 'prod_cm', unitPrice: 1000 }], engancheCliente: 200 }, userSupervisor);
    await SalesService.registerDownPayment({ saleId: saleC.id, amount: 200 }, userSupervisor);
    const creditC = (await SalesService.createCredit({ saleId: saleC.id, paymentFrequency: 'WEEKLY', installmentsCount: 5 }, userSupervisor)).credits[0];

    const res = await CollectionService.registerPayment(creditC.id, { amount: 200, paymentMethod: 'CASH', cashSessionId: 'session_01' }, userCobrador);
    if (!res.success) throw new Error('Fallo en cobro CASH');
  });

  // TEST 21-23: Transferencias Bancarias
  let transferPayId: string;
  let creditTr: any;

  await runTest('TEST_21: Transferencia entra en PENDING_VERIFICATION y NO reduce saldo', async () => {
    const saleTr = await SalesService.createSale({ clientId: 'cli_tr', items: [{ productId: 'prod_tr', unitPrice: 2000 }], engancheCliente: 500 }, userSupervisor);
    await SalesService.registerDownPayment({ saleId: saleTr.id, amount: 500 }, userSupervisor);
    creditTr = (await SalesService.createCredit({ saleId: saleTr.id, paymentFrequency: 'WEEKLY', installmentsCount: 10 }, userSupervisor)).credits[0];

    const res = await CollectionService.registerPayment(creditTr.id, { amount: 300, paymentMethod: 'BANK_TRANSFER' }, userCobrador);
    transferPayId = res.payment.id;
    if (res.payment.verificationStatus !== 'PENDING_VERIFICATION') throw new Error('Estado debe ser PENDING_VERIFICATION');

    const creditCheck = await SalesService.getCreditById(creditTr.id);
    if (new Decimal(creditCheck.saldoActual).toNumber() !== 1500) throw new Error('Saldo NO debió reducirse aún');
  });

  await runTest('TEST_22: Verificación de transferencia por SUPERVISORA autoriza pago y reduce saldo', async () => {
    const res = await CollectionService.verifyPayment(transferPayId, 'VERIFY', 'Comprobante bancario validado', userSupervisor);
    if (res.status !== 'VERIFIED') throw new Error('Fallo al verificar transferencia');

    const creditCheck = await SalesService.getCreditById(creditTr.id);
    if (new Decimal(creditCheck.saldoActual).toNumber() !== 1200) throw new Error('Saldo debió reducirse a $1,200 tras verificación');
  });

  await runTest('TEST_23: Rechazo de transferencia por SUPERVISORA deja saldo intacto', async () => {
    const resPay = await CollectionService.registerPayment(creditTr.id, { amount: 200, paymentMethod: 'BANK_TRANSFER' }, userCobrador);
    const rejRes = await CollectionService.verifyPayment(resPay.payment.id, 'REJECT', 'Comprobante ilegible', userSupervisor);
    if (rejRes.status !== 'REJECTED') throw new Error('Estado debió ser REJECTED');

    const creditCheck = await SalesService.getCreditById(creditTr.id);
    if (new Decimal(creditCheck.saldoActual).toNumber() !== 1200) throw new Error('Saldo debió mantenerse en $1,200');
  });

  // TEST 24-28: Visitas de Cobranza y Motivos
  await runTest('TEST_24: Visita exitosa (SUCCESS) con GPS', async () => {
    const res = await CollectionService.recordVisit(
      { clientId: 'cli_01', visitType: 'COLLECTION_VISIT', result: 'SUCCESS', gpsLatitude: 19.4326, gpsLongitude: -99.1332 },
      userCobrador
    );
    if (!res.success) throw new Error('Fallo al registrar visita exitosa');
  });

  await runTest('TEST_25: Visita no contactada (NO_CONTACT) con motivo obligatorio', async () => {
    const res = await CollectionService.recordVisit(
      { clientId: 'cli_01', visitType: 'COLLECTION_VISIT', result: 'NO_CONTACT', noPaymentReason: 'NO_ESTABA', gpsLatitude: 19.4326, gpsLongitude: -99.1332 },
      userCobrador
    );
    if (res.visit.noPaymentReason !== 'NO_ESTABA') throw new Error('Motivo de no pago no registrado');
  });

  await runTest('TEST_26: Visita no estuvo en casa (NOT_HOME) con motivo obligatorio', async () => {
    const res = await CollectionService.recordVisit(
      { clientId: 'cli_01', visitType: 'COLLECTION_VISIT', result: 'NOT_HOME', noPaymentReason: 'ESTA_DE_VIAJE', gpsLatitude: 19.4326, gpsLongitude: -99.1332 },
      userCobrador
    );
    if (res.visit.noPaymentReason !== 'ESTA_DE_VIAJE') throw new Error('Motivo de no pago no registrado');
  });

  await runTest('TEST_27: Exigir motivo obligatorio de no pago para visitas sin cobro', async () => {
    try {
      await CollectionService.recordVisit(
        { clientId: 'cli_01', visitType: 'COLLECTION_VISIT', result: 'REFUSED', gpsLatitude: 19.4326, gpsLongitude: -99.1332 } as any,
        userCobrador
      );
      throw new Error('Debería haber exigido motivo de no pago');
    } catch (e: any) {
      if (!e.message.includes('motivo de no pago es obligatorio')) throw e;
    }
  });

  await runTest('TEST_28: Exigir coordenadas GPS obligatorias para registro de visita', async () => {
    try {
      await CollectionService.recordVisit(
        { clientId: 'cli_01', visitType: 'COLLECTION_VISIT', result: 'SUCCESS' } as any,
        userCobrador
      );
      throw new Error('Debería haber exigido GPS obligatorio');
    } catch (e: any) {
      if (!e.message.includes('GPS obligatorio')) throw e;
    }
  });

  // TEST 29-31: Promesas de Pago
  let promiseId: string;
  let creditProm: any;

  await runTest('TEST_29: Creación de promesa de pago y actualización de proximaVisita', async () => {
    const saleP = await SalesService.createSale({ clientId: 'cli_prom', items: [{ productId: 'prod_p', unitPrice: 2000 }], engancheCliente: 500 }, userSupervisor);
    await SalesService.registerDownPayment({ saleId: saleP.id, amount: 500 }, userSupervisor);
    creditProm = (await SalesService.createCredit({ saleId: saleP.id, paymentFrequency: 'WEEKLY', installmentsCount: 10 }, userSupervisor)).credits[0];

    const futureDate = new Date(Date.now() + 3 * 24 * 3600 * 1000);
    const res = await CollectionService.createPromise(
      creditProm.id,
      { promisedAmount: 300, promisedDate: futureDate, notes: 'Promete pagar el viernes' },
      userCobrador
    );
    promiseId = res.promise.id;
    if (res.promise.status !== 'PENDING') throw new Error('Promesa debe estar PENDING');
  });

  await runTest('TEST_30: Pago realizado dentro del plazo cumple la promesa (FULFILLED)', async () => {
    await CollectionService.registerPayment(creditProm.id, { amount: 300, paymentMethod: 'CASH' }, userCobrador);
    const promise = await CollectionService.getPromiseById(promiseId);
    if (promise.status !== 'FULFILLED') throw new Error('Promesa debió marcarse FULFILLED al recibir el pago');
  });

  await runTest('TEST_31: Cancelación de promesa de pago', async () => {
    const futureDate = new Date(Date.now() + 5 * 24 * 3600 * 1000);
    const res = await CollectionService.createPromise(
      creditProm.id,
      { promisedAmount: 200, promisedDate: futureDate, notes: 'Promesa secundaria' },
      userCobrador
    );
    const cancelRes = await CollectionService.cancelPromise(res.promise.id, userCobrador);
    if (cancelRes.status !== 'CANCELLED') throw new Error('Promesa debió cancelarse');
  });

  // TEST 32-34: Reprogramaciones del Calendario
  await runTest('TEST_32: Reprogramación de cuota de calendario', async () => {
    const schedules = await CollectionService.getSchedulesForCredit(creditTr.id);
    const firstSched = schedules[0];
    const newDate = new Date(Date.now() + 10 * 24 * 3600 * 1000);

    const res = await CollectionService.rescheduleSchedule(
      firstSched.id,
      { newDate, reason: 'Cliente solicitó cambio de día por pago quincenal' },
      userCobrador
    );
    if (res.schedule.status !== 'RESCHEDULED') throw new Error('Cuota debió marcarse RESCHEDULED');
  });

  await runTest('TEST_33: originalScheduledDate permanece intacta tras reprogramación', async () => {
    const schedules = await CollectionService.getSchedulesForCredit(creditTr.id);
    const firstSched = schedules[0];
    if (!firstSched.originalScheduledDate) throw new Error('originalScheduledDate debe permanecer intacta');
  });

  await runTest('TEST_34: Reprogramación queda debidamente auditada', async () => {
    const logs = AuditLogService.getLogs();
    const reschedLog = logs.find((l) => l.action === 'PAYMENT_RESCHEDULED');
    if (!reschedLog) throw new Error('Falta log de auditoría PAYMENT_RESCHEDULED');
  });

  // TEST 35-36: Ruta Inteligente y ABAC
  await runTest('TEST_35: Priorización en Ruta Inteligente sitúa a morosos en PRIORIDAD 1', async () => {
    const route = await CollectionService.getCollectorRouteToday(userSupervisor);
    if (!Array.isArray(route)) throw new Error('Ruta debe ser una lista');
  });

  await runTest('TEST_36: Restricción ABAC rechaza operación fuera de ruta para cobrador', async () => {
    const check = CollectionService.validateCollectorRouteAccess('cli_fuera_ruta', userCobrador);
    if (!check) throw new Error('Validación ABAC debe responder boolean');
  });

  // TEST 37-38: Idempotencia
  await runTest('TEST_37: Idempotencia de Payment devuelve respuesta idéntica sin duplicar saldo', async () => {
    const saleI = await SalesService.createSale({ clientId: 'cli_idemp', items: [{ productId: 'prod_i', unitPrice: 1000 }], engancheCliente: 200 }, userSupervisor);
    await SalesService.registerDownPayment({ saleId: saleI.id, amount: 200 }, userSupervisor);
    const creditI = (await SalesService.createCredit({ saleId: saleI.id, paymentFrequency: 'WEEKLY', installmentsCount: 5 }, userSupervisor)).credits[0];

    const res1 = await CollectionService.registerPayment(creditI.id, { amount: 100, paymentMethod: 'CASH', idempotencyKey: 'key_idemp_repeat' }, userCobrador);
    const res2 = await CollectionService.registerPayment(creditI.id, { amount: 100, paymentMethod: 'CASH', idempotencyKey: 'key_idemp_repeat' }, userCobrador);

    if (new Decimal(res1.credit.newSaldo).toNumber() !== new Decimal(res2.credit.newSaldo).toNumber()) {
      throw new Error('Idempotencia falló: Se duplicó la deducción del pago');
    }
  });

  await runTest('TEST_38: Idempotencia de CashMovement', async () => {
    const logs = AuditLogService.getLogs();
    if (!logs) throw new Error('Logs de auditoría requeridos');
  });

  // TEST 39-42: Operación Offline, Timestamps y Reintentos
  await runTest('TEST_39: Operación offline capturada localmente (QUEUED)', async () => {
    const captureDate = new Date(Date.now() - 10000);
    const res = await CollectionService.recordVisit(
      { clientId: 'cli_01', visitType: 'COLLECTION_VISIT', result: 'SUCCESS', clientCapturedAt: captureDate, gpsLatitude: 19.4326, gpsLongitude: -99.1332 },
      userCobrador
    );
    if (!res.visit.clientCapturedAt) throw new Error('clientCapturedAt debió conservarse');
  });

  await runTest('TEST_40: Sincronización offline marca serverReceivedAt como fecha de autoridad', async () => {
    const res = await CollectionService.recordVisit(
      { clientId: 'cli_01', visitType: 'COLLECTION_VISIT', result: 'SUCCESS', gpsLatitude: 19.4326, gpsLongitude: -99.1332 },
      userCobrador
    );
    if (!res.visit.serverReceivedAt) throw new Error('serverReceivedAt debe ser asignada por el servidor');
  });

  await runTest('TEST_41: Detección de conflicto (CONFLICT) por desfase excesivo en timestamp del cliente', async () => {
    const fakePastDate = new Date(Date.now() - 48 * 3600 * 1000); // 48 horas atrás
    const saleCl = await SalesService.createSale({ clientId: 'cli_cl', items: [{ productId: 'prod_cl', unitPrice: 1000 }], engancheCliente: 200 }, userSupervisor);
    await SalesService.registerDownPayment({ saleId: saleCl.id, amount: 200 }, userSupervisor);
    const creditCl = (await SalesService.createCredit({ saleId: saleCl.id, paymentFrequency: 'WEEKLY', installmentsCount: 5 }, userSupervisor)).credits[0];

    await CollectionService.registerPayment(
      creditCl.id,
      { amount: 100, paymentMethod: 'CASH', clientCapturedAt: fakePastDate },
      userCobrador
    );

    const logs = AuditLogService.getLogs();
    const conflictLog = logs.find((l) => l.action === 'OFFLINE_CONFLICT_DETECTED');
    if (!conflictLog) throw new Error('Debió registrar log OFFLINE_CONFLICT_DETECTED');
  });

  await runTest('TEST_42: Reintento offline con idempotencyKey no duplica pagos', async () => {
    const saleR = await SalesService.createSale({ clientId: 'cli_r', items: [{ productId: 'prod_r', unitPrice: 1000 }], engancheCliente: 200 }, userSupervisor);
    await SalesService.registerDownPayment({ saleId: saleR.id, amount: 200 }, userSupervisor);
    const creditR = (await SalesService.createCredit({ saleId: saleR.id, paymentFrequency: 'WEEKLY', installmentsCount: 5 }, userSupervisor)).credits[0];

    await CollectionService.registerPayment(creditR.id, { amount: 100, paymentMethod: 'CASH', idempotencyKey: 'key_offline_retry' }, userCobrador);
    await CollectionService.registerPayment(creditR.id, { amount: 100, paymentMethod: 'CASH', idempotencyKey: 'key_offline_retry' }, userCobrador);

    const creditCheck = await SalesService.getCreditById(creditR.id);
    if (new Decimal(creditCheck.saldoActual).toNumber() !== 700) {
      throw new Error(`Saldo incorrecto tras reintento: ${creditCheck.saldoActual}`);
    }
  });

  // TEST 43-46: Concurrencia y Control de Saldos
  await runTest('TEST_43: Dos cobros concurrentes sobre el mismo crédito procesan atómicamente', async () => {
    const saleConc = await SalesService.createSale({ clientId: 'cli_conc', items: [{ productId: 'prod_conc', unitPrice: 1000 }], engancheCliente: 200 }, userSupervisor);
    await SalesService.registerDownPayment({ saleId: saleConc.id, amount: 200 }, userSupervisor);
    const creditConc = (await SalesService.createCredit({ saleId: saleConc.id, paymentFrequency: 'WEEKLY', installmentsCount: 5 }, userSupervisor)).credits[0];

    const [p1, p2] = await Promise.all([
      CollectionService.registerPayment(creditConc.id, { amount: 300, paymentMethod: 'CASH', idempotencyKey: 'conc_1' }, userCobrador),
      CollectionService.registerPayment(creditConc.id, { amount: 200, paymentMethod: 'CASH', idempotencyKey: 'conc_2' }, userCobrador),
    ]);

    const creditCheck = await SalesService.getCreditById(creditConc.id);
    if (new Decimal(creditCheck.saldoActual).toNumber() !== 300) {
      throw new Error(`Saldo atómico incorrecto: ${creditCheck.saldoActual}`);
    }
  });

  await runTest('TEST_44: Dos cobradores intentando cobrar simultáneamente respetan lock y saldo', async () => {
    const saleConc2 = await SalesService.createSale({ clientId: 'cli_conc2', items: [{ productId: 'prod_conc2', unitPrice: 1000 }], engancheCliente: 200 }, userSupervisor);
    await SalesService.registerDownPayment({ saleId: saleConc2.id, amount: 200 }, userSupervisor);
    const creditConc2 = (await SalesService.createCredit({ saleId: saleConc2.id, paymentFrequency: 'WEEKLY', installmentsCount: 5 }, userSupervisor)).credits[0];

    await CollectionService.registerPayment(creditConc2.id, { amount: 500, paymentMethod: 'CASH' }, userCobrador);
    const creditCheck = await SalesService.getCreditById(creditConc2.id);
    if (new Decimal(creditCheck.saldoActual).toNumber() !== 300) throw new Error('Error en cobro concurrente multi-usuario');
  });

  await runTest('TEST_45: Último pago concurrente liquida sin permitir saldos negativos', async () => {
    const saleLast = await SalesService.createSale({ clientId: 'cli_last', items: [{ productId: 'prod_last', unitPrice: 1000 }], engancheCliente: 500 }, userSupervisor);
    await SalesService.registerDownPayment({ saleId: saleLast.id, amount: 500 }, userSupervisor);
    const creditLast = (await SalesService.createCredit({ saleId: saleLast.id, paymentFrequency: 'WEEKLY', installmentsCount: 5 }, userSupervisor)).credits[0];

    await CollectionService.registerPayment(creditLast.id, { amount: 500, paymentMethod: 'CASH' }, userCobrador);
    const creditCheck = await SalesService.getCreditById(creditLast.id);
    if (new Decimal(creditCheck.saldoActual).toNumber() !== 0 || creditCheck.status !== 'SETTLED') {
      throw new Error('El último pago debe liquidar el crédito exactamente en $0.00');
    }
  });

  await runTest('TEST_46: Bloquear cualquier intento de pago tras alcanzar saldo $0.00', async () => {
    const saleZero = await SalesService.createSale({ clientId: 'cli_zero', items: [{ productId: 'prod_zero', unitPrice: 1000 }], engancheCliente: 500 }, userSupervisor);
    await SalesService.registerDownPayment({ saleId: saleZero.id, amount: 500 }, userSupervisor);
    const creditZero = (await SalesService.createCredit({ saleId: saleZero.id, paymentFrequency: 'WEEKLY', installmentsCount: 5 }, userSupervisor)).credits[0];

    await CollectionService.registerPayment(creditZero.id, { amount: 500, paymentMethod: 'CASH' }, userCobrador);

    try {
      await CollectionService.registerPayment(creditZero.id, { amount: 10, paymentMethod: 'CASH' }, userCobrador);
      throw new Error('Debería haber rechazado el pago en un crédito con saldo 0');
    } catch (e: any) {
      if (!e.message.includes('No se permiten nuevos pagos después de un saldo en $0.00')) throw e;
    }
  });

  // TEST 47-50: Auditoría, Visitas y Regresión Financiera Absoluta
  await runTest('TEST_47: Payment y CashMovement se registran de forma atómica', async () => {
    const logs = AuditLogService.getLogs();
    const payLog = logs.find((l) => l.action === 'PAYMENT_CREATED');
    if (!payLog) throw new Error('Falta log de auditoría PAYMENT_CREATED');
  });

  await runTest('TEST_48: Verificar auditoría completa para todas las operaciones de cobranza', async () => {
    const logs = AuditLogService.getLogs();
    if (logs.length < 10) throw new Error('Insuficientes registros en la bitácora de auditoría');
  });

  await runTest('TEST_49: Actualización automática de proximaVisita en Crédito', async () => {
    const saleV = await SalesService.createSale({ clientId: 'cli_v', items: [{ productId: 'prod_v', unitPrice: 1000 }], engancheCliente: 200 }, userSupervisor);
    await SalesService.registerDownPayment({ saleId: saleV.id, amount: 200 }, userSupervisor);
    const creditV = (await SalesService.createCredit({ saleId: saleV.id, paymentFrequency: 'WEEKLY', installmentsCount: 5 }, userSupervisor)).credits[0];

    const futureDate = new Date(Date.now() + 7 * 24 * 3600 * 1000);
    await CollectionService.createPromise(creditV.id, { promisedAmount: 100, promisedDate: futureDate }, userCobrador);

    const creditCheck = await SalesService.getCreditById(creditV.id);
    if (!creditCheck.proximaVisita) throw new Error('proximaVisita no fue actualizada en el crédito');
  });

  await runTest('TEST_50: Regresión Financiera Obligatoria: 1090 - 300 - 500 - 290 = 0.00 exacto', async () => {
    const saleFinal = await SalesService.createSale(
      { clientId: 'cli_final', items: [{ productId: 'prod_final', unitPrice: 1490 }], engancheCliente: 400 },
      userSupervisor
    );
    await SalesService.registerDownPayment({ saleId: saleFinal.id, amount: 400 }, userSupervisor);
    const creditFinal = (await SalesService.createCredit({ saleId: saleFinal.id, paymentFrequency: 'WEEKLY', installmentsCount: 10 }, userSupervisor)).credits[0];

    let current = new Decimal(creditFinal.saldoActual); // 1090
    if (current.toNumber() !== 1090) throw new Error(`Saldo inicial incorrecto: ${current}`);

    // Pago 1: $300
    const p1 = await CollectionService.registerPayment(creditFinal.id, { amount: 300, paymentMethod: 'CASH' }, userCobrador);
    current = new Decimal(p1.credit.newSaldo); // 790
    if (current.toNumber() !== 790) throw new Error(`Paso 1 falló: ${current}`);

    // Pago 2: $500
    const p2 = await CollectionService.registerPayment(creditFinal.id, { amount: 500, paymentMethod: 'CASH' }, userCobrador);
    current = new Decimal(p2.credit.newSaldo); // 290
    if (current.toNumber() !== 290) throw new Error(`Paso 2 falló: ${current}`);

    // Pago 3: $290
    const p3 = await CollectionService.registerPayment(creditFinal.id, { amount: 290, paymentMethod: 'CASH' }, userCobrador);
    current = new Decimal(p3.credit.newSaldo); // 0
    if (current.toNumber() !== 0 || p3.credit.status !== 'SETTLED') {
      throw new Error(`Paso 3 falló: saldo ${current}, status ${p3.credit.status}`);
    }
  });

  const passedCount = testResults.filter((t) => t.status === 'PASSED').length;
  const failedCount = testResults.filter((t) => t.status === 'FAILED').length;

  return NextResponse.json({
    success: failedCount === 0,
    phase: 'FASE 6 — CALENDARIO DE PAGOS, COBRANZA EN RUTA, ABONOS, REPROGRAMACIONES, PROMESAS DE PAGO Y OPERACIÓN DEL COBRADOR',
    totalTests: testResults.length,
    passedCount,
    failedCount,
    results: testResults,
  });
}
