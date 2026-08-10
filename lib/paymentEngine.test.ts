/**
 * PRUEBAS UNITARIAS PARA EL MOTOR DE COBRANZA Y MOROSIDAD (BITALIS)
 */

import {
  procesarPagosYCalcularMorosidad,
  Venta,
  Cuota,
  Pago,
} from './paymentEngine';

// Venta de Prueba: $1,200 total, 12 cuotas semanales de $100
const ventaBase: Venta = {
  id: 101,
  cliente_id: 501,
  monto_total: 1200,
  saldo_pendiente: 1200,
  frecuencia_pago: 'semanal',
};

// Plan de pagos base: 4 cuotas en Junio/Julio 2026
const cuotasBase: Cuota[] = [
  { venta_id: 101, numero_cuota: 1, monto_cuota: 100, monto_pagado: 0, fecha_vencimiento: '2026-06-01', estado: 'pendiente' },
  { venta_id: 101, numero_cuota: 2, monto_cuota: 100, monto_pagado: 0, fecha_vencimiento: '2026-06-08', estado: 'pendiente' },
  { venta_id: 101, numero_cuota: 3, monto_cuota: 100, monto_pagado: 0, fecha_vencimiento: '2026-06-15', estado: 'pendiente' },
  { venta_id: 101, numero_cuota: 4, monto_cuota: 100, monto_pagado: 0, fecha_vencimiento: '2026-06-22', estado: 'pendiente' },
];

export function runUnitTests() {
  console.log('====================================================');
  console.log(' EJECUTANDO CASOS DE PRUEBA MOTOR DE COBRANZA ');
  console.log('====================================================\n');

  // ----------------------------------------------------
  // CASO A: Cliente al día con pago puntual
  // ----------------------------------------------------
  const fechaHoyA = '2026-06-08'; // Es la fecha de vencimiento de la cuota 2
  const pagosA: Pago[] = [
    { venta_id: 101, monto_recibido: 100, fecha_pago: '2026-06-01' }, // Cuota 1
    { venta_id: 101, monto_recibido: 100, fecha_pago: '2026-06-08' }, // Cuota 2
  ];

  const resA = procesarPagosYCalcularMorosidad(ventaBase, cuotasBase, pagosA, fechaHoyA);
  console.log('--- CASO A: Cliente al día con pago puntual ---');
  console.log(`Días de Atraso: ${resA.diasAtraso} (Esperado: 0)`);
  console.log(`Estado Morosidad: ${resA.estadoMorosidad} (Esperado: VERDE)`);
  console.log(`Saldo Pendiente Total: $${resA.saldoPendienteTotal} (Esperado: $200)`);
  console.log(`Estados Cuotas:`, resA.cuotasProcesadas.map((c) => `C${c.numero_cuota}: ${c.estado} ($${c.monto_pagado}/${c.monto_cuota})`));
  console.log('----------------------------------------------------\n');

  // ----------------------------------------------------
  // CASO B: Cliente que adelanta 2 semanas/cuotas
  // ----------------------------------------------------
  const fechaHoyB = '2026-06-08'; // Fecha actual
  const pagosB: Pago[] = [
    { venta_id: 101, monto_recibido: 400, fecha_pago: '2026-06-01' }, // Pago adelantado de 4 cuotas completas
  ];

  const resB = procesarPagosYCalcularMorosidad(ventaBase, cuotasBase, pagosB, fechaHoyB);
  console.log('--- CASO B: Cliente adelanta cuotas / sobrepago ---');
  console.log(`Días de Atraso: ${resB.diasAtraso} (Esperado: 0)`);
  console.log(`Estado Morosidad: ${resB.estadoMorosidad} (Esperado: VERDE)`);
  console.log(`Saldo Pendiente Total: $${resB.saldoPendienteTotal} (Esperado: $0)`);
  console.log(`Estados Cuotas:`, resB.cuotasProcesadas.map((c) => `C${c.numero_cuota}: ${c.estado} ($${c.monto_pagado}/${c.monto_cuota})`));
  console.log('----------------------------------------------------\n');

  // ----------------------------------------------------
  // CASO C: Cliente con 3 cuotas vencidas sin pagar
  // ----------------------------------------------------
  const fechaHoyC = '2026-06-22'; // 3 semanas después del vencimiento de cuota 1 (2026-06-01)
  const pagosC: Pago[] = []; // No ha realizado ningún pago

  const resC = procesarPagosYCalcularMorosidad(ventaBase, cuotasBase, pagosC, fechaHoyC);
  console.log('--- CASO C: Cliente con 3 cuotas vencidas sin pagar ---');
  console.log(`Cuota vencida más antigua: ${resC.cuotaVencidaMasAntigua?.fecha_vencimiento} (Cuota #${resC.cuotaVencidaMasAntigua?.numero_cuota})`);
  console.log(`Días de Atraso: ${resC.diasAtraso} días (2026-06-22 - 2026-06-01 = 21 días)`);
  console.log(`Estado Morosidad: ${resC.estadoMorosidad} (Esperado: ROJO por >= 15 días)`);
  console.log(`Saldo Pendiente Total: $${resC.saldoPendienteTotal}`);
  console.log(`Estados Cuotas:`, resC.cuotasProcesadas.map((c) => `C${c.numero_cuota}: ${c.estado} ($${c.monto_pagado}/${c.monto_cuota})`));
  console.log('----------------------------------------------------\n');

  return { resA, resB, resC };
}
