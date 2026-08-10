'use client';

import { useState, useMemo } from 'react';
import { Abono, Venta, Cliente } from '@/types';
import {
  Clock,
  Calendar,
  DollarSign,
  CheckCircle2,
  AlertCircle,
  MapPin,
  CreditCard,
  Wallet,
  UserCheck,
  MessageSquare,
  TrendingUp,
  Award,
  Activity,
  FileText,
  List,
  GitCommit,
  ArrowRight,
  ExternalLink,
  ChevronDown,
  ChevronUp,
  Sparkles,
  ShieldCheck,
  Check,
} from 'lucide-react';

interface HistorialAbonosTimelineProps {
  cliente: Cliente;
  venta?: Venta;
  abonos: Abono[];
}

export default function HistorialAbonosTimeline({
  cliente,
  venta,
  abonos,
}: HistorialAbonosTimelineProps) {
  const [viewMode, setViewMode] = useState<'timeline' | 'table'>('timeline');
  const [expandedAbonoId, setExpandedAbonoId] = useState<number | null>(null);

  // Filter and sort abonos chronologically (oldest first for timeline flow, or newest first option)
  const sortedAbonosAsc = useMemo(() => {
    return [...abonos].sort((a, b) => new Date(a.fechaPago).getTime() - new Date(b.fechaPago).getTime());
  }, [abonos]);

  const sortedAbonosDesc = useMemo(() => {
    return [...abonos].sort((a, b) => new Date(b.fechaPago).getTime() - new Date(a.fechaPago).getTime());
  }, [abonos]);

  // Calculate payment frequency and timing statistics
  const frequencyStats = useMemo(() => {
    if (sortedAbonosAsc.length < 2) {
      return {
        promedioDiasIntervalo: 7,
        pagosPuntualesCount: sortedAbonosAsc.length,
        pagosAtrasadosCount: 0,
        porcentajePuntualidad: 100,
        ritmoLabel: 'Inicio de Contrato',
        colorRitmo: 'text-emerald-400 bg-emerald-950 border-emerald-800',
      };
    }

    let totalDiasDiferencia = 0;
    let intervalosCount = 0;
    let pagosPuntuales = 0;
    let pagosAtrasados = 0;

    for (let i = 1; i < sortedAbonosAsc.length; i++) {
      const fechaPrev = new Date(sortedAbonosAsc[i - 1].fechaPago);
      const fechaCurr = new Date(sortedAbonosAsc[i].fechaPago);
      const diffMs = Math.abs(fechaCurr.getTime() - fechaPrev.getTime());
      const diffDias = Math.max(1, Math.round(diffMs / (1000 * 60 * 60 * 24)));

      totalDiasDiferencia += diffDias;
      intervalosCount++;

      if (diffDias <= 8) {
        pagosPuntuales++;
      } else {
        pagosAtrasados++;
      }
    }

    const promedioDias = Math.round((totalDiasDiferencia / (intervalosCount || 1)) * 10) / 10;
    const porcentajePuntualidad = Math.round((pagosPuntuales / (intervalosCount || 1)) * 100);

    let ritmoLabel = 'Ritmo Regular (Semanál)';
    let colorRitmo = 'text-emerald-400 bg-emerald-950 border-emerald-800';

    if (promedioDias < 6) {
      ritmoLabel = 'Ritmo Acelerado (Adelanta Abonos)';
      colorRitmo = 'text-indigo-300 bg-indigo-950 border-indigo-800';
    } else if (promedioDias > 10) {
      ritmoLabel = 'Ritmo Irregular (Atrasos Frecuentes)';
      colorRitmo = 'text-rose-400 bg-rose-950 border-rose-800';
    } else if (promedioDias > 8) {
      ritmoLabel = 'Ritmo Moderado';
      colorRitmo = 'text-amber-300 bg-amber-950 border-amber-800';
    }

    return {
      promedioDiasIntervalo: promedioDias,
      pagosPuntualesCount: pagosPuntuales,
      pagosAtrasadosCount: pagosAtrasados,
      porcentajePuntualidad,
      ritmoLabel,
      colorRitmo,
    };
  }, [sortedAbonosAsc]);

  // Financial summary
  const totalPagado = useMemo(() => {
    return abonos.reduce((sum, a) => sum + a.monto, 0);
  }, [abonos]);

  const saldoInicial = venta ? venta.saldoInicial : 1290;
  const saldoActual = venta ? venta.saldoActual : Math.max(0, saldoInicial - totalPagado);
  const porcentajePagado = saldoInicial > 0 ? Math.min(100, Math.round((totalPagado / saldoInicial) * 100)) : 100;
  const pagoSemanalRequerido = venta ? venta.pagoSemanal : 100;

  // Compute balance history per abono step
  const timelineWithRunningBalance = useMemo(() => {
    return sortedAbonosAsc.map((abono, index) => {
      const runningPaid = sortedAbonosAsc.slice(0, index + 1).reduce((sum, a) => sum + a.monto, 0);
      const saldoRestanteEnEseMomento = Math.max(0, saldoInicial - runningPaid);

      // Days since previous payment
      let diasDesdeAnterior = 0;
      let diasLabel = 'Primer Abono';
      let esPuntual = true;

      if (index > 0) {
        const fechaPrev = new Date(sortedAbonosAsc[index - 1].fechaPago);
        const fechaCurr = new Date(abono.fechaPago);
        const diffMs = Math.abs(fechaCurr.getTime() - fechaPrev.getTime());
        diasDesdeAnterior = Math.round(diffMs / (1000 * 60 * 60 * 24));

        if (diasDesdeAnterior === 0) diasLabel = 'Mismo Día';
        else if (diasDesdeAnterior === 1) diasLabel = '1 día después';
        else diasLabel = `${diasDesdeAnterior} días después`;

        esPuntual = diasDesdeAnterior <= 8;
      }

      // Check if amount paid met weekly expectation
      const esPagoCompleto = abono.monto >= pagoSemanalRequerido;

      return {
        ...abono,
        runningPaid,
        saldoRestanteEnEseMomento,
        diasDesdeAnterior,
        diasLabel,
        esPuntual,
        esPagoCompleto,
      };
    });
  }, [sortedAbonosAsc, saldoInicial, pagoSemanalRequerido]);

  // Reverse timeline order for display (Newest on top for vertical timeline view)
  const timelineDisplay = useMemo(() => {
    return [...timelineWithRunningBalance].reverse();
  }, [timelineWithRunningBalance]);

  return (
    <div className="bg-slate-900 border border-slate-700/90 rounded-2xl p-5 shadow-2xl space-y-5">
      {/* HEADER & ANALYTICS BAR */}
      <div className="flex flex-wrap items-center justify-between gap-4 border-b border-slate-800 pb-4">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <div className="p-2 bg-indigo-600/20 text-indigo-400 rounded-xl border border-indigo-500/40">
              <Activity className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-white flex items-center gap-2">
                Historial de Abonos & Frecuencia de Pago
              </h3>
              <p className="text-xs text-slate-400">
                Línea de tiempo detallada con cálculo automático de periodicidad, puntualidad e intervalos.
              </p>
            </div>
          </div>
        </div>

        {/* View Toggle */}
        <div className="flex items-center bg-slate-950 border border-slate-800 rounded-xl p-1 gap-1 text-xs">
          <button
            type="button"
            onClick={() => setViewMode('timeline')}
            className={`px-3 py-1.5 rounded-lg font-bold flex items-center gap-1.5 transition cursor-pointer ${
              viewMode === 'timeline'
                ? 'bg-indigo-600 text-white shadow'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            <GitCommit className="w-3.5 h-3.5" />
            <span>Línea de Tiempo</span>
          </button>
          <button
            type="button"
            onClick={() => setViewMode('table')}
            className={`px-3 py-1.5 rounded-lg font-bold flex items-center gap-1.5 transition cursor-pointer ${
              viewMode === 'table'
                ? 'bg-indigo-600 text-white shadow'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            <List className="w-3.5 h-3.5" />
            <span>Tabla Resumen</span>
          </button>
        </div>
      </div>

      {/* FREQUENCY & HEALTH METRICS BADGES */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
        <div className="bg-slate-950 p-3 rounded-xl border border-slate-800 space-y-1">
          <span className="text-slate-400 text-[11px] font-medium block">Abonos Registrados:</span>
          <div className="flex items-center gap-1.5">
            <span className="text-lg font-black text-white">{abonos.length} pagos</span>
            <span className="text-[10px] bg-indigo-950 text-indigo-300 border border-indigo-800 px-1.5 py-0.5 rounded font-bold">
              ${totalPagado.toLocaleString()} MXN
            </span>
          </div>
        </div>

        <div className="bg-slate-950 p-3 rounded-xl border border-slate-800 space-y-1">
          <span className="text-slate-400 text-[11px] font-medium block">Promedio entre Pagos:</span>
          <div className="flex items-center gap-1.5">
            <Clock className="w-3.5 h-3.5 text-indigo-400 shrink-0" />
            <span className="text-base font-black text-indigo-300">
              {frequencyStats.promedioDiasIntervalo} días
            </span>
          </div>
          <span className={`text-[10px] px-2 py-0.5 rounded-full border inline-block font-semibold ${frequencyStats.colorRitmo}`}>
            {frequencyStats.ritmoLabel}
          </span>
        </div>

        <div className="bg-slate-950 p-3 rounded-xl border border-slate-800 space-y-1">
          <span className="text-slate-400 text-[11px] font-medium block">Puntualidad en Pagos:</span>
          <div className="flex items-center gap-2">
            <span className="text-base font-black text-emerald-400">
              {frequencyStats.porcentajePuntualidad}%
            </span>
            <span className="text-[10px] text-slate-400">
              ({frequencyStats.pagosPuntualesCount} a tiempo)
            </span>
          </div>
          <div className="w-full bg-slate-800 h-1.5 rounded-full overflow-hidden">
            <div
              className="bg-emerald-400 h-full rounded-full"
              style={{ width: `${frequencyStats.porcentajePuntualidad}%` }}
            />
          </div>
        </div>

        <div className="bg-slate-950 p-3 rounded-xl border border-slate-800 space-y-1">
          <span className="text-slate-400 text-[11px] font-medium block">Progreso de Liquidación:</span>
          <div className="flex items-center justify-between">
            <span className="text-base font-black text-amber-300">{porcentajePagado}%</span>
            <span className="text-[10px] text-slate-400">Resta: ${saldoActual.toLocaleString()} MXN</span>
          </div>
          <div className="w-full bg-slate-800 h-1.5 rounded-full overflow-hidden">
            <div
              className={`h-full rounded-full ${porcentajePagado === 100 ? 'bg-emerald-400' : 'bg-amber-400'}`}
              style={{ width: `${porcentajePagado}%` }}
            />
          </div>
        </div>
      </div>

      {/* TIMELINE DISPLAY MODE */}
      {viewMode === 'timeline' && (
        <div className="space-y-4 pt-2">
          {abonos.length === 0 ? (
            <div className="p-8 text-center text-xs text-slate-400 bg-slate-950 rounded-xl border border-slate-800 space-y-2">
              <Calendar className="w-8 h-8 text-slate-600 mx-auto" />
              <p className="font-semibold text-white">Sin historial de abonos aún</p>
              <p className="text-slate-400 max-w-sm mx-auto">
                El cobrador registrará el primer abono cuando visite al cliente en su domicilio en el día programado.
              </p>
            </div>
          ) : (
            <div className="relative pl-6 sm:pl-8 space-y-6 before:absolute before:left-3 sm:before:left-4 before:top-3 before:bottom-3 before:w-0.5 before:bg-gradient-to-b before:from-indigo-500 before:via-purple-500 before:to-emerald-500">
              {timelineDisplay.map((item, index) => {
                const isExpanded = expandedAbonoId === item.id;
                const dateObj = new Date(item.fechaPago);
                const dateStrFormatted = dateObj.toLocaleDateString('es-MX', {
                  weekday: 'short',
                  day: 'numeric',
                  month: 'short',
                  year: 'numeric',
                });

                return (
                  <div key={item.id} className="relative group">
                    {/* Node Dot Icon */}
                    <div
                      className={`absolute -left-6 sm:-left-8 top-1.5 w-6 h-6 sm:w-8 sm:h-8 rounded-full border-2 flex items-center justify-center text-xs font-black shadow-lg transition-transform group-hover:scale-110 z-10 ${
                        item.esPagoCompleto
                          ? 'bg-emerald-950 border-emerald-400 text-emerald-300'
                          : 'bg-amber-950 border-amber-400 text-amber-300'
                      }`}
                    >
                      <Check className="w-3.5 h-3.5" />
                    </div>

                    {/* Content Box */}
                    <div className="bg-slate-950/90 border border-slate-800 hover:border-slate-700 p-4 rounded-2xl shadow-lg space-y-3 transition">
                      {/* Top Header of Node */}
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="px-2.5 py-0.5 rounded-full text-xs font-black bg-indigo-600/30 text-indigo-300 border border-indigo-500/40">
                            Semana #{item.semanaNumero}
                          </span>

                          <span className="text-xs text-white font-bold flex items-center gap-1">
                            <Calendar className="w-3.5 h-3.5 text-slate-400" />
                            {dateStrFormatted}
                          </span>

                          {item.diasDesdeAnterior > 0 && (
                            <span
                              className={`text-[10px] px-2 py-0.5 rounded-full border font-semibold flex items-center gap-1 ${
                                item.esPuntual
                                  ? 'bg-emerald-950/80 text-emerald-300 border-emerald-800'
                                  : 'bg-rose-950/80 text-rose-300 border-rose-800'
                              }`}
                            >
                              <Clock className="w-3 h-3" />
                              <span>{item.diasLabel}</span>
                            </span>
                          )}
                        </div>

                        {/* Amount Pill */}
                        <div className="flex items-center gap-2">
                          <span className="text-base font-black text-emerald-400">
                            +${item.monto.toLocaleString()} MXN
                          </span>
                          <span className="text-[10px] bg-slate-900 border border-slate-700 px-2 py-0.5 rounded-full text-slate-300 uppercase font-semibold">
                            {item.tipoPago}
                          </span>
                        </div>
                      </div>

                      {/* Financial Step Indicator & Details */}
                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 bg-slate-900/80 p-2.5 rounded-xl border border-slate-800/80 text-xs">
                        <div>
                          <span className="text-slate-400 text-[10px] block">Abono Acumulado:</span>
                          <span className="font-bold text-slate-200">${item.runningPaid.toLocaleString()} MXN</span>
                        </div>
                        <div>
                          <span className="text-slate-400 text-[10px] block">Saldo Restante Post-Pago:</span>
                          <span className={`font-bold ${item.saldoRestanteEnEseMomento === 0 ? 'text-emerald-400' : 'text-amber-300'}`}>
                            ${item.saldoRestanteEnEseMomento.toLocaleString()} MXN
                          </span>
                        </div>
                        <div>
                          <span className="text-slate-400 text-[10px] block">Registrado por:</span>
                          <span className="font-semibold text-slate-300 truncate block">
                            {item.cobradorNombre || 'Cobrador BITALIS'}
                          </span>
                        </div>
                      </div>

                      {/* Expand Details Button / Notes */}
                      <div className="flex items-center justify-between text-xs pt-1 border-t border-slate-900">
                        <div className="flex items-center gap-3 text-slate-400">
                          {item.latitudCobro && item.longitudCobro && (
                            <a
                              href={`https://www.google.com/maps/search/?api=1&query=${item.latitudCobro},${item.longitudCobro}`}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-indigo-400 hover:underline flex items-center gap-1 font-semibold text-[11px]"
                            >
                              <MapPin className="w-3 h-3" />
                              <span>Coordenadas GPS de Cobro</span>
                              <ExternalLink className="w-2.5 h-2.5" />
                            </a>
                          )}

                          {item.waEnviado && (
                            <span className="text-emerald-400 flex items-center gap-1 text-[11px] font-semibold">
                              <MessageSquare className="w-3 h-3" />
                              <span>WhatsApp enviado</span>
                            </span>
                          )}
                        </div>

                        {item.observaciones && (
                          <span className="text-slate-300 italic text-[11px] truncate max-w-xs">
                            &quot;{item.observaciones}&quot;
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}

              {/* CONTRACT CREATION START NODE */}
              <div className="relative">
                <div className="absolute -left-6 sm:-left-8 top-1 w-6 h-6 sm:w-8 sm:h-8 rounded-full bg-indigo-950 border-2 border-indigo-500 text-indigo-300 flex items-center justify-center text-xs font-black shadow-md z-10">
                  <Sparkles className="w-3.5 h-3.5" />
                </div>

                <div className="bg-indigo-950/40 border border-indigo-800/60 p-3.5 rounded-2xl text-xs space-y-1">
                  <div className="flex items-center justify-between text-indigo-200 font-bold">
                    <span>Apertura de Contrato de Venta #{venta?.id || cliente.id}</span>
                    <span>{venta?.fechaVenta || cliente.fechaRegistro}</span>
                  </div>
                  <p className="text-slate-400">
                    Monto Total: ${saldoInicial} MXN • Enganche Inicial: ${venta?.engancheMonto || 100} MXN • Pago Semanal: ${pagoSemanalRequerido} MXN/semana
                  </p>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* COMPACT TABLE DISPLAY MODE */}
      {viewMode === 'table' && (
        <div className="overflow-x-auto pt-2">
          {abonos.length === 0 ? (
            <div className="p-6 text-center text-xs text-slate-400 bg-slate-950 rounded-xl border border-slate-800">
              Aún no se han registrado abonos en el sistema.
            </div>
          ) : (
            <table className="w-full text-left text-xs text-slate-300 border-collapse">
              <thead className="bg-slate-950 text-slate-400 uppercase text-[10px] font-bold border-b border-slate-800">
                <tr>
                  <th className="px-3.5 py-2.5">Semana</th>
                  <th className="px-3.5 py-2.5">Fecha</th>
                  <th className="px-3.5 py-2.5">Intervalo</th>
                  <th className="px-3.5 py-2.5">Monto</th>
                  <th className="px-3.5 py-2.5">Método</th>
                  <th className="px-3.5 py-2.5">Cobrador</th>
                  <th className="px-3.5 py-2.5">Saldo Restante</th>
                  <th className="px-3.5 py-2.5">Notas</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/80 bg-slate-950/50">
                {timelineDisplay.map((abono) => (
                  <tr key={abono.id} className="hover:bg-slate-850 transition">
                    <td className="px-3.5 py-2.5 font-bold text-indigo-300">
                      Sem. #{abono.semanaNumero}
                    </td>
                    <td className="px-3.5 py-2.5 font-mono text-slate-200">
                      {abono.fechaPago}
                    </td>
                    <td className="px-3.5 py-2.5">
                      <span
                        className={`px-2 py-0.5 rounded text-[10px] font-semibold ${
                          abono.esPuntual
                            ? 'bg-emerald-950 text-emerald-300 border border-emerald-800'
                            : 'bg-rose-950 text-rose-300 border border-rose-800'
                        }`}
                      >
                        {abono.diasLabel}
                      </span>
                    </td>
                    <td className="px-3.5 py-2.5 font-black text-emerald-400">
                      ${abono.monto.toLocaleString()} MXN
                    </td>
                    <td className="px-3.5 py-2.5">
                      <span className="bg-slate-900 border border-slate-700 px-2 py-0.5 rounded text-[10px]">
                        {abono.tipoPago}
                      </span>
                    </td>
                    <td className="px-3.5 py-2.5 text-slate-300">
                      {abono.cobradorNombre || 'Cobrador'}
                    </td>
                    <td className="px-3.5 py-2.5 font-bold text-amber-300">
                      ${abono.saldoRestanteEnEseMomento.toLocaleString()} MXN
                    </td>
                    <td className="px-3.5 py-2.5 text-slate-400 truncate max-w-[180px]">
                      {abono.observaciones || '-'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}
    </div>
  );
}
