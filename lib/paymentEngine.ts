/**
 * MOTOR DE CÁLCULO DE MOROSIDAD Y DISTRIBUCIÓN DE PAGOS (BITALIS)
 * 
 * Cumple estrictamente con las reglas de negocio financieras:
 * 1. Aplicación cronológica de pagos a cuotas.
 * 2. Cuotas cubiertas por adelantado se marcan como 'pagado'.
 * 3. Días de atraso calculados únicamente sobre la cuota vencida más antigua no cubierta.
 * 4. Si el cliente tiene adelantos que cubren el periodo actual/vencido, días de atraso = 0.
 */

export type EstadoCuota = 'pagado' | 'parcial' | 'pendiente' | 'vencido';

export interface Cuota {
  id?: number;
  venta_id: number;
  numero_cuota: number;
  monto_cuota: number;
  monto_pagado: number;
  fecha_vencimiento: string; // YYYY-MM-DD
  estado: EstadoCuota;
}

export interface Pago {
  id?: number;
  venta_id: number;
  monto_recibido: number;
  fecha_pago: string; // YYYY-MM-DD
}

export interface Venta {
  id: number;
  cliente_id: number;
  monto_total: number;
  saldo_pendiente: number;
  frecuencia_pago: 'semanal' | 'catorcenal' | 'quincenal' | 'mensual';
}

export interface ResultadoCalculoMorosidad {
  saldoPendienteTotal: number;
  diasAtraso: number;
  estadoMorosidad: 'VERDE' | 'AMARILLO' | 'ROJO';
  cuotasProcesadas: Cuota[];
  cuotaVencidaMasAntigua: Cuota | null;
  proximoVencimientoPendiente: string | null;
}

/**
 * Parsea fecha YYYY-MM-DD a medianoche en tiempo local
 */
function parseLocalDate(dateStr: string): Date {
  const [y, m, d] = dateStr.split('T')[0].split('-').map((n) => parseInt(n, 10));
  return new Date(y, m - 1, d, 12, 0, 0);
}

/**
 * Función principal en Node.js / TypeScript para procesar abonos y calcular morosidad real
 */
export function procesarPagosYCalcularMorosidad(
  venta: Venta,
  cuotasOriginales: Cuota[],
  pagos: Pago[],
  fechaActualStr: string
): ResultadoCalculoMorosidad {
  const fechaActual = parseLocalDate(fechaActualStr);

  // 1. Clonar y ordenar cuotas cronológicamente
  const cuotas: Cuota[] = cuotasOriginales
    .map((c) => ({ ...c, monto_pagado: 0, estado: 'pendiente' as EstadoCuota }))
    .sort((a, b) => a.numero_cuota - b.numero_cuota || a.fecha_vencimiento.localeCompare(b.fecha_vencimiento));

  // 2. Ordenar pagos cronológicamente por fecha_pago
  const pagosOrdenados = [...pagos].sort((a, b) => a.fecha_pago.localeCompare(b.fecha_pago));

  // Total acumulado recaudado
  let pozoDisponible = pagosOrdenados.reduce((acc, p) => acc + (p.monto_recibido || 0), 0);

  // 3. Aplicación en cascada de pagos a las cuotas
  for (const cuota of cuotas) {
    if (pozoDisponible <= 0) break;

    const faltaParaCubrir = cuota.monto_cuota - cuota.monto_pagado;
    if (faltaParaCubrir > 0) {
      const abonoAplicado = Math.min(pozoDisponible, faltaParaCubrir);
      cuota.monto_pagado += abonoAplicado;
      pozoDisponible -= abonoAplicado;
    }
  }

  // 4. Actualización de estados por cuota
  for (const cuota of cuotas) {
    const esFechaPasada = cuota.fecha_vencimiento < fechaActualStr;

    if (cuota.monto_pagado >= cuota.monto_cuota) {
      cuota.estado = 'pagado';
    } else if (cuota.monto_pagado > 0) {
      cuota.estado = esFechaPasada ? 'vencido' : 'parcial';
    } else {
      cuota.estado = esFechaPasada ? 'vencido' : 'pendiente';
    }
  }

  // 5. Determinar la cuota vencida más antigua SIN CUBRIR
  const cuotasVencidasPendientes = cuotas.filter(
    (c) => c.fecha_vencimiento < fechaActualStr && c.monto_pagado < c.monto_cuota
  );

  let diasAtraso = 0;
  let cuotaVencidaMasAntigua: Cuota | null = null;

  if (cuotasVencidasPendientes.length > 0) {
    // La primera en la lista ordenada es la más antigua
    cuotaVencidaMasAntigua = cuotasVencidasPendientes[0];
    const fechaVenc = parseLocalDate(cuotaVencidaMasAntigua.fecha_vencimiento);
    const diffMs = fechaActual.getTime() - fechaVenc.getTime();
    diasAtraso = Math.max(0, Math.floor(diffMs / (1000 * 60 * 60 * 24)));
  }

  // 6. Clasificación de Semáforo de Morosidad
  let estadoMorosidad: 'VERDE' | 'AMARILLO' | 'ROJO' = 'VERDE';
  if (diasAtraso >= 15) {
    estadoMorosidad = 'ROJO';
  } else if (diasAtraso >= 1) {
    estadoMorosidad = 'AMARILLO';
  }

  // 7. Saldo Pendiente y Próximo Vencimiento
  const totalMontoCuotas = cuotas.reduce((acc, c) => acc + c.monto_cuota, 0);
  const totalPagadoDistribuido = cuotas.reduce((acc, c) => acc + c.monto_pagado, 0);
  const saldoPendienteTotal = Math.max(0, totalMontoCuotas - totalPagadoDistribuido);

  const proximaCuotaPendiente = cuotas.find((c) => c.monto_pagado < c.monto_cuota);

  return {
    saldoPendienteTotal,
    diasAtraso,
    estadoMorosidad,
    cuotasProcesadas: cuotas,
    cuotaVencidaMasAntigua,
    proximoVencimientoPendiente: proximaCuotaPendiente ? proximaCuotaPendiente.fecha_vencimiento : null,
  };
}

/**
 * Matriz de Bonificación Corporativa por Enganche Inicial (Bitalis)
 * 100 -> +100 bono (Desc total $200)
 * 200 -> +200 bono (Desc total $400)
 * 300+ -> +200 bono máximo (Desc total Enganche + $200)
 */
export function calcularBonoEnganche(montoEnganche: number): { bonoEmpresa: number; descuentoTotalPrincipal: number } {
  if (montoEnganche <= 0) return { bonoEmpresa: 0, descuentoTotalPrincipal: 0 };
  let bonoEmpresa = 0;
  if (montoEnganche < 200) {
    bonoEmpresa = montoEnganche;
  } else {
    bonoEmpresa = 200; // Tope máximo de la empresa
  }
  return {
    bonoEmpresa,
    descuentoTotalPrincipal: montoEnganche + bonoEmpresa,
  };
}
