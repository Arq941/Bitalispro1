import type { Cliente, Venta, MorosidadStatus } from '@/types';

/**
 * Timezone-safe date utilities for BITALIS App
 * Prevents UTC offset shifts (e.g. 2026-08-05 becoming 2026-08-04T18:00:00 in local timezone)
 */

export function getTodayLocalDateStr(): string {
  const d = new Date();
  return d.toLocaleDateString('en-CA', { timeZone: 'America/Mexico_City' });
}

/**
 * Obtiene la fecha actual en formato 'YYYY-MM-DD' ajustada a la hora local de México.
 */
export const obtenerFechaLocalHoy = (): string => {
  const hoy = new Date();
  return hoy.toLocaleDateString('en-CA', { timeZone: 'America/Mexico_City' });
};

export function parseLocalDateStr(dateStr: string): Date {
  if (!dateStr) return new Date();
  const parts = dateStr.split('T')[0].split('-');
  if (parts.length < 3) return new Date(dateStr);
  const year = parseInt(parts[0], 10);
  const month = parseInt(parts[1], 10) - 1;
  const day = parseInt(parts[2], 10);
  return new Date(year, month, day, 12, 0, 0); // Noon local time avoids DST shifts
}

export function formatLocalDateStr(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export function addDaysToLocalDateStr(dateStr: string, days: number): string {
  const d = parseLocalDateStr(dateStr);
  d.setDate(d.getDate() + days);
  return formatLocalDateStr(d);
}

/**
 * Suma días de forma segura a una fecha base evitando errores de zona horaria UTC.
 */
export const sumarDiasAFecha = (fechaBase: string, diasASumar: number): string => {
  const [anio, mes, dia] = fechaBase.split('-').map(Number);
  const fecha = new Date(Date.UTC(anio, mes - 1, dia));
  fecha.setUTCDate(fecha.getUTCDate() + diasASumar);
  return fecha.toISOString().split('T')[0];
};

/**
 * Valida y formatea cualquier fecha de agendamiento ingresada manualmente en la UI
 */
export const validarFechaAgendamiento = (fechaSeleccionada: string): { esValida: boolean; mensaje: string } => {
  const hoyStr = obtenerFechaLocalHoy();
  if (fechaSeleccionada < hoyStr) {
    return {
      esValida: false,
      mensaje: "La fecha de agendamiento o prórroga no puede ser anterior al día de hoy."
    };
  }
  return {
    esValida: true,
    mensaje: "Fecha correcta."
  };
};

export interface CuotaPlan {
  numeroCuota: number;
  fechaVencimiento: string;
  montoSugerido: number;
}

/**
 * Genera el plan de pagos periódico para un crédito nuevo.
 */
export const generarPlanPagos = (
  fechaInicio: string, 
  totalCuotas: number, 
  montoCuota: number, 
  periodicidad: 'semanal' | 'quincenal' | 'catorcenal' | 'mensual'
): CuotaPlan[] => {
  const plan: CuotaPlan[] = [];
  let diasSalto = 7;
  if (periodicidad === 'quincenal') diasSalto = 15;
  else if (periodicidad === 'catorcenal') diasSalto = 14;
  else if (periodicidad === 'mensual') diasSalto = 30;

  let fechaActual = fechaInicio;

  for (let i = 1; i <= totalCuotas; i++) {
    plan.push({
      numeroCuota: i,
      fechaVencimiento: fechaActual,
      montoSugerido: montoCuota > 0 ? montoCuota : 100
    });
    fechaActual = sumarDiasAFecha(fechaActual, diasSalto);
  }

  return plan;
};

export function calculateFrequencyDays(frecuencia?: string): number {
  switch (frecuencia?.toUpperCase()) {
    case 'SEMANAL':
      return 7;
    case 'CATORCENAL':
      return 14;
    case 'QUINCENAL':
      return 15;
    case 'MENSUAL':
      return 30;
    default:
      return 7; // Default to weekly cycle
  }
}

export function calculateNextPaymentDate(currentDateStr?: string, frecuencia?: string): string {
  const baseDateStr = currentDateStr || getTodayLocalDateStr();
  const daysToAdd = calculateFrequencyDays(frecuencia);
  return addDaysToLocalDateStr(baseDateStr, daysToAdd);
}

/**
 * Calcula los días de mora basados en la fecha de compromiso/próximo pago.
 * @param {string} fechaProximoPago - Fecha en formato 'YYYY-MM-DD'
 * @returns {number} - Días enteros de atraso (0 si está al corriente)
 */
export const calcularDiasMora = (fechaProximoPago?: string): number => {
  if (!fechaProximoPago) return 0;
  const hoyStr = obtenerFechaLocalHoy();
  
  const fechaHoy = new Date(`${hoyStr}T00:00:00Z`);
  const fechaPago = new Date(`${fechaProximoPago}T00:00:00Z`);

  const diferenciaMs = fechaHoy.getTime() - fechaPago.getTime();
  const milisegundosPorDia = 1000 * 60 * 60 * 24;
  const diasDiferencia = Math.floor(diferenciaMs / milisegundosPorDia);

  return diasDiferencia > 0 ? diasDiferencia : 0;
};

export function calculateDaysOverdue(
  proximoPagoFechaStr?: string,
  estadoMorosidad?: string,
  hasPaidToday?: boolean,
  deudaCalculada?: number
): number {
  if (deudaCalculada !== undefined && deudaCalculada <= 0) return 0;
  if (hasPaidToday) return 0;
  return calcularDiasMora(proximoPagoFechaStr);
}

export function getClienteEffectiveMorosidad(
  cliente: Cliente,
  ventas: Venta[],
  todayStr?: string
): { estadoMorosidad: MorosidadStatus; diasMora: number; esLiquidado: boolean; totalDeuda: number } {
  const hoyStr = todayStr || obtenerFechaLocalHoy();
  const ventasCliente = (ventas || []).filter((v) => v.clienteId === cliente.id);
  const totalSaldoVentas = ventasCliente.reduce((sum, v) => sum + (v.saldoActual ?? 0), 0);
  const totalDeuda = ventasCliente.length > 0
    ? totalSaldoVentas
    : (cliente.deudaCalculada !== undefined ? cliente.deudaCalculada : 0);

  if (totalDeuda <= 0) {
    return {
      estadoMorosidad: 'VERDE',
      diasMora: 0,
      esLiquidado: true,
      totalDeuda: 0,
    };
  }

  const ventaActiva = ventasCliente.find((v) => (v.saldoActual ?? 0) > 0);
  const proxFecha = cliente.proximoPagoFecha || ventaActiva?.fechaPrimerPago;

  const mora = calcularDiasMora(proxFecha);

  if (mora > 7) {
    return { estadoMorosidad: 'ROJO', diasMora: mora, esLiquidado: false, totalDeuda };
  } else if (mora >= 1) {
    return { estadoMorosidad: 'AMARILLO', diasMora: mora, esLiquidado: false, totalDeuda };
  } else {
    return { estadoMorosidad: 'VERDE', diasMora: 0, esLiquidado: false, totalDeuda };
  }
}
