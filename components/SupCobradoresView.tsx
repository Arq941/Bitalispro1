'use client';

import { useState } from 'react';
import { Abono, CorteCaja, Cliente, Venta } from '@/types';
import UbicacionCoordenadasModal from './UbicacionCoordenadasModal';
import { TrendingUp, ShieldCheck, DollarSign, CheckCircle2, UserCheck, PieChart, MapPin, ExternalLink, Search, Clock, Target, Zap, Activity } from 'lucide-react';

interface SupCobradoresViewProps {
  abonos: Abono[];
  cortes: CorteCaja[];
  clientes: Cliente[];
  ventas: Venta[];
  onAuditCorteCobrador: (corteId: number) => void;
  onUpdateCliente?: (cliente: Cliente) => void;
}

export default function SupCobradoresView({
  abonos,
  cortes,
  clientes,
  ventas,
  onAuditCorteCobrador,
  onUpdateCliente,
}: SupCobradoresViewProps) {
  const [selectedGeoCliente, setSelectedGeoCliente] = useState<Cliente | null>(null);
  const [searchTerm, setSearchTerm] = useState<string>('');

  const cortesCobrador = cortes.filter((c) => c.rolTipo === 'COBRADOR');

  // Real-time KPI calculations
  const hoyStr = new Date().toISOString().split('T')[0];
  const diasSemana = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado'];
  const dayIdx = new Date().getDay();
  const hoyNombreDia = diasSemana[dayIdx] === 'Domingo' ? 'Lunes' : diasSemana[dayIdx];

  // 1. Efectivo Recaudado Hoy
  const abonosHoy = abonos.filter((a) => a.fechaPago && a.fechaPago.startsWith(hoyStr));
  const efectivoRecaudadoHoy = abonosHoy.reduce((sum, a) => sum + a.monto, 0);

  // 2. Clientes en Ruta Pendientes
  const clientesEnRutaHoy = clientes.filter((c) => (c.diaCobroZona || 'Lunes') === hoyNombreDia);
  const clientesCobradosHoy = clientesEnRutaHoy.filter((c) => abonosHoy.some((a) => a.clienteId === c.id));
  const clientesPendientesRuta = Math.max(0, clientesEnRutaHoy.length - clientesCobradosHoy.length);

  // 3. Porcentaje de Cumplimiento de Meta
  const metaDiariaTotal =
    clientesEnRutaHoy.reduce((sum, c) => {
      const v = ventas.find((vent) => vent.clienteId === c.id && vent.saldoActual > 0);
      return sum + (v?.pagoSemanal || 0);
    }, 0) || 1;

  const pctCumplimientoMeta = Math.min(100, Math.round((efectivoRecaudadoHoy / metaDiariaTotal) * 100));

  // Legacy Global Metrics
  const totalRecuperadoAbonos = abonos.reduce((sum, a) => sum + a.monto, 0);
  const totalCarteraActual = ventas.reduce((sum, v) => sum + v.saldoActual, 0);
  const porcentajeRecuperacion = Math.round(
    (totalRecuperadoAbonos / (totalRecuperadoAbonos + totalCarteraActual || 1)) * 100
  );

  return (
    <div className="space-y-6">
      {/* PANEL DE KPIS EN TIEMPO REAL - SUPERVISIÓN DE COBRANZA */}
      <div className="bg-gradient-to-r from-slate-900 via-slate-800 to-indigo-950 border-2 border-indigo-600/80 rounded-2xl p-5 shadow-2xl space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-indigo-900/60 pb-3">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-indigo-600/30 text-indigo-400 rounded-xl border border-indigo-500/50 animate-pulse">
              <Activity className="w-6 h-6 text-indigo-400" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-lg sm:text-xl font-black text-white">KPIs en Tiempo Real - Cobranza del Día</h3>
                <span className="px-2.5 py-0.5 rounded-full text-[10px] font-black bg-emerald-950 text-emerald-300 border border-emerald-600 uppercase tracking-wider">
                  EN VIVO
                </span>
              </div>
              <p className="text-xs text-indigo-200">
                Seguimiento directo del avance de recaudación y efectividad en campo ({hoyNombreDia}).
              </p>
            </div>
          </div>
        </div>

        {/* TARJETAS DE KPIS PRINCIPALES */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {/* KPI 1: Efectivo Recaudado Hoy */}
          <div className="bg-slate-950/90 border border-emerald-600/60 p-4 rounded-2xl shadow-xl space-y-2 relative overflow-hidden">
            <div className="absolute top-0 right-0 w-20 h-20 bg-emerald-500/10 rounded-full blur-xl pointer-events-none" />
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-slate-300 flex items-center gap-1.5">
                <DollarSign className="w-4 h-4 text-emerald-400" />
                Efectivo Recaudado Hoy
              </span>
              <span className="px-2 py-0.5 bg-emerald-950 border border-emerald-700 text-emerald-300 text-[10px] font-black rounded-lg">
                HOY
              </span>
            </div>
            <div>
              <span className="text-2xl sm:text-3xl font-black text-emerald-400 font-mono block">
                ${efectivoRecaudadoHoy.toLocaleString()} MXN
              </span>
              <p className="text-[11px] text-slate-400 mt-1 font-medium">
                {abonosHoy.length} {abonosHoy.length === 1 ? 'abono registrado' : 'abonos registrados'} hoy en sistema
              </p>
            </div>
          </div>

          {/* KPI 2: Clientes en Ruta Pendientes */}
          <div className="bg-slate-950/90 border border-amber-500/60 p-4 rounded-2xl shadow-xl space-y-2 relative overflow-hidden">
            <div className="absolute top-0 right-0 w-20 h-20 bg-amber-500/10 rounded-full blur-xl pointer-events-none" />
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-slate-300 flex items-center gap-1.5">
                <Clock className="w-4 h-4 text-amber-400" />
                Clientes en Ruta Pendientes
              </span>
              <span className="px-2 py-0.5 bg-amber-950 border border-amber-700 text-amber-300 text-[10px] font-black rounded-lg">
                {hoyNombreDia}
              </span>
            </div>
            <div>
              <span className="text-2xl sm:text-3xl font-black text-amber-300 font-mono block">
                {clientesPendientesRuta} <span className="text-sm text-slate-400 font-sans font-bold">de {clientesEnRutaHoy.length}</span>
              </span>
              <p className="text-[11px] text-slate-400 mt-1 font-medium">
                {clientesCobradosHoy.length} cobrados • {clientesPendientesRuta} por cobrar hoy
              </p>
            </div>
          </div>

          {/* KPI 3: Porcentaje de Cumplimiento de Meta */}
          <div className="bg-slate-950/90 border border-indigo-500/60 p-4 rounded-2xl shadow-xl space-y-2 relative overflow-hidden">
            <div className="absolute top-0 right-0 w-20 h-20 bg-indigo-500/10 rounded-full blur-xl pointer-events-none" />
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-slate-300 flex items-center gap-1.5">
                <Target className="w-4 h-4 text-indigo-400" />
                Porcentaje Cumplimiento Meta
              </span>
              <span className="px-2 py-0.5 bg-indigo-950 border border-indigo-700 text-indigo-300 text-[10px] font-black rounded-lg">
                META DÍA
              </span>
            </div>
            <div>
              <div className="flex items-baseline justify-between">
                <span className="text-2xl sm:text-3xl font-black text-indigo-300 font-mono">
                  {pctCumplimientoMeta}%
                </span>
                <span className="text-[10px] font-mono text-slate-400">
                  Meta: ${metaDiariaTotal.toLocaleString()} MXN
                </span>
              </div>

              {/* Progress bar */}
              <div className="w-full bg-slate-800 h-2.5 rounded-full overflow-hidden mt-2 border border-slate-700">
                <div
                  className="bg-gradient-to-r from-indigo-500 to-emerald-400 h-full rounded-full transition-all duration-500"
                  style={{ width: `${Math.min(100, pctCumplimientoMeta)}%` }}
                />
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="bg-slate-800/90 border border-slate-700 rounded-2xl p-6 shadow-xl space-y-6">
        <div>
          <h3 className="text-xl font-bold text-white flex items-center gap-2">
            <PieChart className="w-6 h-6 text-indigo-400" />
            Auditoría de Cartera y Rendimiento de Cobranza
          </h3>
          <p className="text-sm text-slate-400">
            Supervisa la efectividad de cobro en ruta, recuperaciones acumuladas y cortes de caja de cobradores.
          </p>
        </div>

        {/* Global KPIs */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div className="bg-slate-900 border border-slate-700 p-4 rounded-xl text-xs space-y-1">
            <span className="text-slate-400 block font-semibold">Total Cobrado Acumulado (Abonos):</span>
            <span className="text-2xl font-black text-emerald-400">${totalRecuperadoAbonos.toLocaleString()} MXN</span>
          </div>

          <div className="bg-slate-900 border border-slate-700 p-4 rounded-xl text-xs space-y-1">
            <span className="text-slate-400 block font-semibold">Total Cartera Activa:</span>
            <span className="text-2xl font-black text-indigo-300">${totalCarteraActual.toLocaleString()} MXN</span>
          </div>

          <div className="bg-slate-900 border border-slate-700 p-4 rounded-xl text-xs space-y-1">
            <span className="text-slate-400 block font-semibold">% Efectividad Recuperación:</span>
            <span className="text-2xl font-black text-amber-400">{porcentajeRecuperacion}%</span>
          </div>
        </div>

        {/* Auditoría de Cortes de Caja Cobrador */}
        <div className="space-y-4">
          <h4 className="font-bold text-white text-base">Cortes de Caja de Cobradores en Campo</h4>

          <div className="space-y-3">
            {cortesCobrador.map((corte) => (
              <div
                key={corte.id}
                className="bg-slate-900 border border-slate-700 p-4 rounded-xl flex flex-wrap items-center justify-between gap-4 text-xs"
              >
                <div>
                  <span className="font-bold text-white text-sm block">{corte.usuarioNombre}</span>
                  <span className="text-slate-400">Fecha: {corte.fecha} • Estado: {corte.estado}</span>
                </div>

                <div className="flex items-center gap-6 text-slate-300">
                  <div>
                    <span className="block text-slate-400">Fondo Inicial:</span>
                    <span className="font-bold text-white">${corte.fondoInicial}</span>
                  </div>
                  <div>
                    <span className="block text-slate-400">Cobrado Hoy:</span>
                    <span className="font-bold text-emerald-400">${corte.efectivoRecolectado}</span>
                  </div>
                  <div>
                    <span className="block text-slate-400">Efectivo Entregado:</span>
                    <span className="font-bold text-indigo-300">${corte.efectivoEntregado}</span>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => onAuditCorteCobrador(corte.id)}
                  className="bg-emerald-600 hover:bg-emerald-500 text-white font-bold px-4 py-2 rounded-xl text-xs flex items-center gap-1.5 shadow transition cursor-pointer"
                >
                  <CheckCircle2 className="w-4 h-4" />
                  Auditar y Validar
                </button>
              </div>
            ))}
          </div>
        </div>

        {/* Asignación y Corrección de Ubicación por Coordenadas */}
        <div className="pt-6 border-t border-slate-700/80 space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h4 className="font-bold text-white text-base flex items-center gap-2">
                <MapPin className="w-5 h-5 text-purple-400" />
                Asignación de Ubicación por Coordenadas GPS
              </h4>
              <p className="text-xs text-slate-400">
                Ajusta o registra la geolocalización exacta de clientes en cobranza usando sólo sus coordenadas (Latitud / Longitud).
              </p>
            </div>

            <div className="relative w-full sm:w-64">
              <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-2.5" />
              <input
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="Buscar cliente..."
                className="w-full bg-slate-900 border border-slate-700 rounded-xl pl-8 pr-3 py-1.5 text-xs text-white focus:outline-none focus:border-indigo-500"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
            {clientes
              .filter(
                (c) =>
                  !searchTerm ||
                  c.nombreCompleto.toLowerCase().includes(searchTerm.toLowerCase()) ||
                  c.folio.toLowerCase().includes(searchTerm.toLowerCase())
              )
              .slice(0, 6)
              .map((cliente) => (
                <div
                  key={cliente.id}
                  className="bg-slate-900 border border-slate-700 p-3 rounded-xl flex items-center justify-between gap-2 text-xs"
                >
                  <div className="truncate">
                    <span className="font-bold text-white block truncate">{cliente.nombreCompleto}</span>
                    <span className="text-[11px] font-mono text-purple-300 block">
                      {cliente.latitud}, {cliente.longitud}
                    </span>
                  </div>

                  <button
                    type="button"
                    onClick={() => setSelectedGeoCliente(cliente)}
                    className="px-3 py-2 bg-indigo-600 hover:bg-indigo-500 text-white font-bold rounded-xl text-xs flex items-center gap-1 shrink-0 cursor-pointer shadow"
                  >
                    <MapPin className="w-3.5 h-3.5" />
                    <span>Coordenadas</span>
                  </button>
                </div>
              ))}
          </div>
        </div>
      </div>

      {selectedGeoCliente && (
        <UbicacionCoordenadasModal
          cliente={selectedGeoCliente}
          onSave={(c) => {
            if (onUpdateCliente) {
              onUpdateCliente(c);
              alert(`Coordenadas de ${c.nombreCompleto} actualizadas.`);
            }
          }}
          onClose={() => setSelectedGeoCliente(null)}
        />
      )}
    </div>
  );
}
