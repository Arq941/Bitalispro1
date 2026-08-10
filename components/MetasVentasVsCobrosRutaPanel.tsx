'use client';

import { useState, useMemo } from 'react';
import { Venta, Abono, Zona, Cliente } from '@/types';
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  PieChart,
  Pie,
  Cell,
} from 'recharts';
import {
  BarChart3,
  PieChart as PieIcon,
  Target,
  TrendingUp,
  Award,
  AlertTriangle,
  CheckCircle2,
  MapPin,
  Calendar,
  Layers,
  ArrowUpRight,
  ArrowDownRight,
  Sparkles,
} from 'lucide-react';

interface MetasVentasVsCobrosRutaPanelProps {
  ventas: Venta[];
  abonos: Abono[];
  zonas: Zona[];
  clientes: Cliente[];
}

const ROUTE_PALETTE = [
  '#6366f1', // Indigo
  '#10b981', // Emerald
  '#f59e0b', // Amber
  '#ec4899', // Pink
  '#8b5cf6', // Purple
  '#06b6d4', // Cyan
  '#f97316', // Orange
  '#3b82f6', // Blue
  '#14b8a6', // Teal
  '#eab308', // Yellow
];

export default function MetasVentasVsCobrosRutaPanel({
  ventas,
  abonos,
  zonas,
  clientes,
}: MetasVentasVsCobrosRutaPanelProps) {
  const [selectedView, setSelectedView] = useState<'all' | 'bar' | 'pie'>('all');
  const [pieFocus, setPieFocus] = useState<'metas' | 'cobros'>('metas');

  // Compute Route Metrics (Metas de Ventas Semanales vs. Cobros Reales Obtenidos por Ruta)
  const analyticsData = useMemo(() => {
    const routesList = zonas.map((zona, idx) => {
      // Find clients belonging to this route/zone
      const clientsInZone = clientes.filter((c) => c.zonaId === zona.id);
      const clientIds = new Set(clientsInZone.map((c) => c.id));

      // Active sales in this zone
      const salesInZone = ventas.filter(
        (v) => clientIds.has(v.clienteId) && v.estado !== 'RECHAZADA'
      );

      // Meta de ventas/cobro semanal esperada en esta ruta (sum of active weekly commitments)
      const metaSemanal =
        salesInZone.reduce((sum, v) => sum + (v.saldoActual > 0 ? v.pagoSemanal : 0), 0) || 1200;

      // Abonos realmente cobrados en esta ruta
      const abonosInZone = abonos.filter((a) => clientIds.has(a.clienteId));
      const cobroReal = abonosInZone.reduce((sum, a) => sum + a.monto, 0);

      const porcentajeCumplimiento =
        metaSemanal > 0 ? Math.round((cobroReal / metaSemanal) * 100) : 0;

      const brecha = cobroReal - metaSemanal;

      return {
        zonaId: zona.id,
        nombreRuta: zona.nombre,
        diaCobro: zona.diaCobro,
        cuadrante: zona.cuadrante || 'Cuadrante General',
        totalClientes: clientsInZone.length,
        totalVentasContratos: salesInZone.length,
        metaSemanal,
        cobroReal,
        porcentajeCumplimiento,
        brecha,
        color: ROUTE_PALETTE[idx % ROUTE_PALETTE.length],
      };
    });

    const globalMetasSum = routesList.reduce((sum, r) => sum + r.metaSemanal, 0);
    const globalCobrosSum = routesList.reduce((sum, r) => sum + r.cobroReal, 0);

    const totalMetasGlobal = globalMetasSum || 1;
    const totalCobrosGlobal = globalCobrosSum || 1;

    // Attach Percentage Share of Global for Pie Charts
    const routesWithShare = routesList.map((r) => ({
      ...r,
      metaPctGlobal: Math.round((r.metaSemanal / totalMetasGlobal) * 100),
      cobroPctGlobal: Math.round((r.cobroReal / totalCobrosGlobal) * 100),
    }));

    // Data for Pie Chart 1: Metas Semanales por Ruta
    const pieMetasData = routesWithShare.map((r) => ({
      name: r.nombreRuta,
      value: r.metaSemanal,
      color: r.color,
      pctShare: Math.round((r.metaSemanal / totalMetasGlobal) * 100),
    }));

    // Data for Pie Chart 2: Cobros Reales Obtenidos por Ruta
    const pieCobrosData = routesWithShare.map((r) => ({
      name: r.nombreRuta,
      value: r.cobroReal > 0 ? r.cobroReal : 100, // Visual slice minimum
      realValue: r.cobroReal,
      color: r.color,
      pctShare: Math.round((r.cobroReal / totalCobrosGlobal) * 100),
    }));

    // Top route & Risk route
    const sortedByCumplimiento = [...routesWithShare].sort(
      (a, b) => b.porcentajeCumplimiento - a.porcentajeCumplimiento
    );
    const topRoute = sortedByCumplimiento[0];
    const riskRoute = sortedByCumplimiento[sortedByCumplimiento.length - 1];

    const cumplimientoGlobalPct = Math.round((globalCobrosSum / totalMetasGlobal) * 100);

    return {
      routes: routesWithShare,
      pieMetasData,
      pieCobrosData,
      totalMetasGlobal: globalMetasSum,
      totalCobrosGlobal: globalCobrosSum,
      cumplimientoGlobalPct,
      topRoute,
      riskRoute,
    };
  }, [zonas, clientes, ventas, abonos]);

  return (
    <div className="bg-slate-900 border border-indigo-900/60 rounded-3xl p-6 shadow-2xl space-y-6 text-white">
      {/* PANEL HEADER WITH VIEW CONTROLS */}
      <div className="flex flex-wrap items-center justify-between gap-4 border-b border-slate-800 pb-5">
        <div className="space-y-1">
          <div className="flex items-center gap-2.5">
            <div className="p-2.5 bg-gradient-to-tr from-indigo-600 to-purple-600 rounded-2xl shadow-lg shadow-indigo-500/20 text-white">
              <BarChart3 className="w-6 h-6" />
            </div>
            <div>
              <h2 className="text-xl font-black tracking-tight text-white flex items-center gap-2">
                Panel de Metas de Ventas Semanales vs. Cobros Reales por Ruta
                <span className="text-[10px] bg-emerald-500/20 text-emerald-300 font-extrabold px-2.5 py-0.5 rounded-full border border-emerald-500/40">
                  Recharts Analytics
                </span>
              </h2>
              <p className="text-xs text-slate-300">
                Monitoreo comparativo en tiempo real de metas semanales proyectadas frente al dinero real recaudado en cada ruta de cobro.
              </p>
            </div>
          </div>
        </div>

        {/* CONTROLS TOGGLE */}
        <div className="flex items-center gap-2 bg-slate-950 p-1.5 rounded-2xl border border-slate-800 text-xs font-bold">
          <button
            onClick={() => setSelectedView('all')}
            className={`px-3.5 py-2 rounded-xl transition cursor-pointer flex items-center gap-1.5 ${
              selectedView === 'all'
                ? 'bg-gradient-to-r from-indigo-600 to-purple-600 text-white shadow-md'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            <Layers className="w-3.5 h-3.5" />
            <span>Vista Completa</span>
          </button>
          <button
            onClick={() => setSelectedView('bar')}
            className={`px-3.5 py-2 rounded-xl transition cursor-pointer flex items-center gap-1.5 ${
              selectedView === 'bar'
                ? 'bg-gradient-to-r from-indigo-600 to-purple-600 text-white shadow-md'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            <BarChart3 className="w-3.5 h-3.5" />
            <span>Gráfica de Barras</span>
          </button>
          <button
            onClick={() => setSelectedView('pie')}
            className={`px-3.5 py-2 rounded-xl transition cursor-pointer flex items-center gap-1.5 ${
              selectedView === 'pie'
                ? 'bg-gradient-to-r from-indigo-600 to-purple-600 text-white shadow-md'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            <PieIcon className="w-3.5 h-3.5" />
            <span>Gráficas de Pastel</span>
          </button>
        </div>
      </div>

      {/* TOP SUMMARY KPI CARDS */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* KPI 1: META GLOBAL SEMANIAL */}
        <div className="bg-slate-950/80 p-4 rounded-2xl border border-indigo-500/30 space-y-1.5 shadow-lg relative overflow-hidden group">
          <div className="flex items-center justify-between text-xs font-bold text-slate-400">
            <span className="flex items-center gap-1.5 text-indigo-300">
              <Target className="w-4 h-4 text-indigo-400" />
              Meta Semanal Global
            </span>
            <span className="text-[10px] bg-indigo-950 text-indigo-300 font-black px-2 py-0.5 rounded-full border border-indigo-800">
              {zonas.length} Rutas
            </span>
          </div>
          <div className="text-2xl sm:text-3xl font-black text-indigo-300">
            ${analyticsData.totalMetasGlobal.toLocaleString('en-US')}{' '}
            <span className="text-xs font-normal text-slate-400">MXN</span>
          </div>
          <p className="text-[11px] text-slate-400 font-medium flex items-center justify-between">
            <span>Proyección de pagos semanales</span>
            <span className="text-indigo-400 font-bold">100% Objetivo</span>
          </p>
        </div>

        {/* KPI 2: COBROS REALES OBTENIDOS */}
        <div className="bg-slate-950/80 p-4 rounded-2xl border border-emerald-500/30 space-y-1.5 shadow-lg relative overflow-hidden group">
          <div className="flex items-center justify-between text-xs font-bold text-slate-400">
            <span className="flex items-center gap-1.5 text-emerald-400">
              <TrendingUp className="w-4 h-4 text-emerald-400" />
              Cobros Reales Obtenidos
            </span>
            <span className="text-[10px] bg-emerald-950 text-emerald-300 font-black px-2 py-0.5 rounded-full border border-emerald-800">
              Efectivo + SPEI
            </span>
          </div>
          <div className="text-2xl sm:text-3xl font-black text-emerald-400">
            ${analyticsData.totalCobrosGlobal.toLocaleString('en-US')}{' '}
            <span className="text-xs font-normal text-slate-400">MXN</span>
          </div>
          <p className="text-[11px] text-slate-400 font-medium flex items-center justify-between">
            <span>Recaudación real en abonos</span>
            <span className="text-emerald-300 font-extrabold">
              {analyticsData.cumplimientoGlobalPct}% Alcanzado
            </span>
          </p>
        </div>

        {/* KPI 3: RUTA CON MEJOR RENDIMIENTO */}
        <div className="bg-slate-950/80 p-4 rounded-2xl border border-amber-500/30 space-y-1.5 shadow-lg relative overflow-hidden group">
          <div className="flex items-center justify-between text-xs font-bold text-slate-400">
            <span className="flex items-center gap-1.5 text-amber-300">
              <Award className="w-4 h-4 text-amber-400" />
              Ruta Líder
            </span>
            <span className="text-[10px] bg-amber-950 text-amber-300 font-black px-2 py-0.5 rounded-full border border-amber-800">
              Top 1
            </span>
          </div>
          <div className="text-lg font-black text-amber-300 truncate">
            {analyticsData.topRoute?.nombreRuta || 'Sin datos'}
          </div>
          <p className="text-[11px] text-slate-400 font-medium flex items-center justify-between">
            <span>Cumplimiento meta:</span>
            <span className="text-amber-400 font-extrabold">
              {analyticsData.topRoute?.porcentajeCumplimiento || 0}%
            </span>
          </p>
        </div>

        {/* KPI 4: RUTA EN RIESGO / ATENCIÓN */}
        <div className="bg-slate-950/80 p-4 rounded-2xl border border-rose-500/30 space-y-1.5 shadow-lg relative overflow-hidden group">
          <div className="flex items-center justify-between text-xs font-bold text-slate-400">
            <span className="flex items-center gap-1.5 text-rose-400">
              <AlertTriangle className="w-4 h-4 text-rose-400" />
              Ruta en Riesgo
            </span>
            <span className="text-[10px] bg-rose-950 text-rose-300 font-black px-2 py-0.5 rounded-full border border-rose-800">
              Atención
            </span>
          </div>
          <div className="text-lg font-black text-rose-300 truncate">
            {analyticsData.riskRoute?.nombreRuta || 'Sin datos'}
          </div>
          <p className="text-[11px] text-slate-400 font-medium flex items-center justify-between">
            <span>Avance de cobro:</span>
            <span className="text-rose-400 font-extrabold">
              {analyticsData.riskRoute?.porcentajeCumplimiento || 0}%
            </span>
          </p>
        </div>
      </div>

      {/* SECTION 1: RECHARTS BAR CHART (METAS SEMANALES VS COBROS REALES POR RUTA) */}
      {(selectedView === 'all' || selectedView === 'bar') && (
        <div className="bg-slate-950/90 border border-slate-800 rounded-2xl p-5 space-y-4 shadow-xl">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-800/80 pb-3">
            <div>
              <h3 className="text-base font-bold text-white flex items-center gap-2">
                <BarChart3 className="w-5 h-5 text-indigo-400" />
                Gráfica de Barras Comparativa: Metas Semanales vs. Cobros Reales Obtenidos por Ruta
              </h3>
              <p className="text-xs text-slate-400">
                Visualización de barras pareadas para cada ruta operativa mostrando la meta semanal estimada frente al dinero cobrado.
              </p>
            </div>

            <div className="flex items-center gap-4 text-xs font-semibold">
              <span className="flex items-center gap-1.5 text-indigo-300">
                <span className="w-3 h-3 bg-indigo-500 rounded-sm inline-block" /> Meta Semanal ($)
              </span>
              <span className="flex items-center gap-1.5 text-emerald-400">
                <span className="w-3 h-3 bg-emerald-500 rounded-sm inline-block" /> Cobro Real Obtenido ($)
              </span>
            </div>
          </div>

          <div className="w-full h-80 pt-2">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart
                data={analyticsData.routes}
                margin={{ top: 15, right: 15, left: -10, bottom: 5 }}
              >
                <CartesianGrid strokeDasharray="3 3" stroke="#334155" opacity={0.6} />
                <XAxis
                  dataKey="nombreRuta"
                  stroke="#94a3b8"
                  tick={{ fill: '#94a3b8', fontSize: 11 }}
                />
                <YAxis
                  stroke="#94a3b8"
                  tick={{ fill: '#94a3b8', fontSize: 11 }}
                  tickFormatter={(val) => `$${val}`}
                />
                <Tooltip
                  contentStyle={{
                    backgroundColor: '#0f172a',
                    borderColor: '#334155',
                    borderRadius: '12px',
                    boxShadow: '0 10px 25px -5px rgba(0, 0, 0, 0.5)',
                    color: '#fff',
                    fontSize: '12px',
                  }}
                  formatter={(value: any, name: any) => [
                    `$${Number(value).toLocaleString('en-US')} MXN`,
                    name === 'metaSemanal'
                      ? 'Meta Semanal Proyectada'
                      : name === 'cobroReal'
                      ? 'Cobro Real Obtenido'
                      : name,
                  ]}
                  labelFormatter={(lbl) => `Ruta: ${lbl}`}
                />
                <Legend wrapperStyle={{ fontSize: '11px', color: '#94a3b8', paddingTop: '10px' }} />

                <Bar
                  dataKey="metaSemanal"
                  name="Meta Semanal ($)"
                  fill="#6366f1"
                  radius={[6, 6, 0, 0]}
                  barSize={22}
                />
                <Bar
                  dataKey="cobroReal"
                  name="Cobro Real ($)"
                  fill="#10b981"
                  radius={[6, 6, 0, 0]}
                  barSize={22}
                />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}

      {/* SECTION 2: RECHARTS PIE CHARTS (DISTRIBUCIÓN PORCENTUAL DE METAS VS COBROS POR RUTA) */}
      {(selectedView === 'all' || selectedView === 'pie') && (
        <div className="bg-slate-950/90 border border-slate-800 rounded-2xl p-5 space-y-4 shadow-xl">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-800/80 pb-3">
            <div>
              <h3 className="text-base font-bold text-white flex items-center gap-2">
                <PieIcon className="w-5 h-5 text-purple-400" />
                Gráficas de Pastel: Distribución Porcentual por Ruta
              </h3>
              <p className="text-xs text-slate-400">
                Comparativa de participación porcentual de cada ruta dentro del total global de Metas vs. Cobros Reales.
              </p>
            </div>

            {/* TOGGLE FOCUS BETWEEN METAS AND COBROS */}
            <div className="flex items-center gap-1.5 bg-slate-900 border border-slate-800 p-1 rounded-xl text-xs font-bold">
              <button
                onClick={() => setPieFocus('metas')}
                className={`px-3 py-1 rounded-lg transition cursor-pointer ${
                  pieFocus === 'metas'
                    ? 'bg-indigo-600 text-white shadow'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                Distribución Metas
              </button>
              <button
                onClick={() => setPieFocus('cobros')}
                className={`px-3 py-1 rounded-lg transition cursor-pointer ${
                  pieFocus === 'cobros'
                    ? 'bg-emerald-600 text-white shadow'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                Distribución Cobros Reales
              </button>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 items-center">
            {/* PIE CHART 1: METAS SEMANALES */}
            <div
              className={`p-4 rounded-2xl border transition-all ${
                pieFocus === 'metas'
                  ? 'bg-indigo-950/30 border-indigo-500/50 shadow-lg shadow-indigo-500/10'
                  : 'bg-slate-900/60 border-slate-800 opacity-80'
              }`}
            >
              <div className="flex items-center justify-between border-b border-slate-800 pb-2 mb-2">
                <h4 className="font-bold text-sm text-indigo-300 flex items-center gap-2">
                  <Target className="w-4 h-4 text-indigo-400" />
                  Metas Semanales Proyectadas
                </h4>
                <span className="text-xs font-extrabold text-indigo-400">
                  Total: ${analyticsData.totalMetasGlobal.toLocaleString()} MXN
                </span>
              </div>

              <div className="w-full h-60 relative flex items-center justify-center">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={analyticsData.pieMetasData}
                      cx="50%"
                      cy="50%"
                      innerRadius={50}
                      outerRadius={75}
                      paddingAngle={4}
                      dataKey="value"
                    >
                      {analyticsData.pieMetasData.map((entry, index) => (
                        <Cell key={`cell-meta-${index}`} fill={entry.color} />
                      ))}
                    </Pie>
                    <Tooltip
                      contentStyle={{
                        backgroundColor: '#0f172a',
                        borderColor: '#334155',
                        borderRadius: '12px',
                        color: '#fff',
                        fontSize: '12px',
                      }}
                      formatter={(val: any, name: any, item: any) => [
                        `$${Number(val).toLocaleString()} MXN (${item?.payload?.pctShare || 0}% del total)`,
                        'Meta Semanal',
                      ]}
                    />
                  </PieChart>
                </ResponsiveContainer>
                <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                  <span className="text-xl font-black text-indigo-300">
                    {analyticsData.routes.length}
                  </span>
                  <span className="text-[10px] text-slate-400 font-semibold">Rutas</span>
                </div>
              </div>

              {/* Legend Grid */}
              <div className="grid grid-cols-2 gap-2 text-xs pt-1">
                {analyticsData.routes.map((r) => (
                  <div
                    key={`legend-m-${r.zonaId}`}
                    className="flex items-center justify-between bg-slate-950/80 p-2 rounded-xl border border-slate-800"
                  >
                    <div className="flex items-center gap-1.5 truncate">
                      <span
                        className="w-2.5 h-2.5 rounded-full shrink-0"
                        style={{ backgroundColor: r.color }}
                      />
                      <span className="text-slate-300 text-[11px] truncate">{r.nombreRuta}</span>
                    </div>
                    <span className="font-bold text-indigo-300 text-[11px]">
                      {r.metaPctGlobal}%
                    </span>
                  </div>
                ))}
              </div>
            </div>

            {/* PIE CHART 2: COBROS REALES OBTENIDOS */}
            <div
              className={`p-4 rounded-2xl border transition-all ${
                pieFocus === 'cobros'
                  ? 'bg-emerald-950/30 border-emerald-500/50 shadow-lg shadow-emerald-500/10'
                  : 'bg-slate-900/60 border-slate-800 opacity-80'
              }`}
            >
              <div className="flex items-center justify-between border-b border-slate-800 pb-2 mb-2">
                <h4 className="font-bold text-sm text-emerald-300 flex items-center gap-2">
                  <TrendingUp className="w-4 h-4 text-emerald-400" />
                  Cobros Reales Obtenidos
                </h4>
                <span className="text-xs font-extrabold text-emerald-400">
                  Total: ${analyticsData.totalCobrosGlobal.toLocaleString()} MXN
                </span>
              </div>

              <div className="w-full h-60 relative flex items-center justify-center">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={analyticsData.pieCobrosData}
                      cx="50%"
                      cy="50%"
                      innerRadius={50}
                      outerRadius={75}
                      paddingAngle={4}
                      dataKey="value"
                    >
                      {analyticsData.pieCobrosData.map((entry, index) => (
                        <Cell key={`cell-cobro-${index}`} fill={entry.color} />
                      ))}
                    </Pie>
                    <Tooltip
                      contentStyle={{
                        backgroundColor: '#0f172a',
                        borderColor: '#334155',
                        borderRadius: '12px',
                        color: '#fff',
                        fontSize: '12px',
                      }}
                      formatter={(val: any, name: any, item: any) => [
                        `$${Number(item?.payload?.realValue || 0).toLocaleString()} MXN (${item?.payload?.pctShare || 0}% del cobrado)`,
                        'Cobro Real Obtenido',
                      ]}
                    />
                  </PieChart>
                </ResponsiveContainer>
                <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                  <span className="text-xl font-black text-emerald-300">
                    {analyticsData.cumplimientoGlobalPct}%
                  </span>
                  <span className="text-[10px] text-slate-400 font-semibold">Efectividad</span>
                </div>
              </div>

              {/* Legend Grid */}
              <div className="grid grid-cols-2 gap-2 text-xs pt-1">
                {analyticsData.routes.map((r) => (
                  <div
                    key={`legend-c-${r.zonaId}`}
                    className="flex items-center justify-between bg-slate-950/80 p-2 rounded-xl border border-slate-800"
                  >
                    <div className="flex items-center gap-1.5 truncate">
                      <span
                        className="w-2.5 h-2.5 rounded-full shrink-0"
                        style={{ backgroundColor: r.color }}
                      />
                      <span className="text-slate-300 text-[11px] truncate">{r.nombreRuta}</span>
                    </div>
                    <span className="font-bold text-emerald-300 text-[11px]">
                      {r.cobroPctGlobal}%
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* DETAILED TABLE & METRICS BREAKDOWN BY ROUTE */}
      <div className="bg-slate-950/90 border border-slate-800 rounded-2xl p-5 space-y-4 shadow-xl">
        <div className="flex items-center justify-between border-b border-slate-800/80 pb-3">
          <div>
            <h3 className="text-base font-bold text-white flex items-center gap-2">
              <MapPin className="w-5 h-5 text-indigo-400" />
              Detalle y Evaluación de Desempeño por Ruta
            </h3>
            <p className="text-xs text-slate-400">
              Cálculo de brecha financiera y porcentaje de avance de la meta semanal en cada zona operativa.
            </p>
          </div>
          <span className="text-xs text-slate-400 font-bold">
            {analyticsData.routes.length} Rutas Registradas
          </span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3.5 text-xs">
          {analyticsData.routes.map((r) => (
            <div
              key={r.zonaId}
              className="bg-slate-900 border border-slate-800 p-4 rounded-2xl space-y-3 hover:border-slate-700 transition"
            >
              <div className="flex items-center justify-between font-bold">
                <span className="flex items-center gap-2 text-white">
                  <span
                    className="w-3 h-3 rounded-full shrink-0"
                    style={{ backgroundColor: r.color }}
                  />
                  {r.nombreRuta}
                </span>
                <span
                  className={`px-2.5 py-0.5 rounded-full text-[10px] font-black border ${
                    r.porcentajeCumplimiento >= 100
                      ? 'bg-emerald-950 text-emerald-300 border-emerald-800'
                      : r.porcentajeCumplimiento >= 65
                      ? 'bg-amber-950 text-amber-300 border-amber-800'
                      : 'bg-rose-950 text-rose-300 border-rose-800'
                  }`}
                >
                  {r.porcentajeCumplimiento}% Meta
                </span>
              </div>

              {/* Progress Bar */}
              <div className="space-y-1">
                <div className="flex justify-between text-[11px] text-slate-400 font-semibold">
                  <span>Progreso de Cobro:</span>
                  <span className="text-white">${r.cobroReal.toLocaleString()} / ${r.metaSemanal.toLocaleString()} MXN</span>
                </div>
                <div className="w-full bg-slate-950 h-2.5 rounded-full overflow-hidden p-0.5 border border-slate-800">
                  <div
                    className={`h-full rounded-full transition-all duration-500 ${
                      r.porcentajeCumplimiento >= 100
                        ? 'bg-emerald-500'
                        : r.porcentajeCumplimiento >= 65
                        ? 'bg-amber-500'
                        : 'bg-rose-500'
                    }`}
                    style={{ width: `${Math.min(100, r.porcentajeCumplimiento)}%` }}
                  />
                </div>
              </div>

              {/* Stats Row */}
              <div className="grid grid-cols-2 gap-2 text-[11px] pt-1">
                <div className="bg-slate-950/80 p-2 rounded-xl border border-slate-800">
                  <span className="text-slate-400 block text-[10px]">Día de Cobro:</span>
                  <span className="font-bold text-indigo-300 flex items-center gap-1">
                    <Calendar className="w-3 h-3" />
                    {r.diaCobro}
                  </span>
                </div>
                <div className="bg-slate-950/80 p-2 rounded-xl border border-slate-800">
                  <span className="text-slate-400 block text-[10px]">Diferencia / Brecha:</span>
                  <span
                    className={`font-bold flex items-center gap-0.5 ${
                      r.brecha >= 0 ? 'text-emerald-400' : 'text-rose-400'
                    }`}
                  >
                    {r.brecha >= 0 ? (
                      <ArrowUpRight className="w-3 h-3" />
                    ) : (
                      <ArrowDownRight className="w-3 h-3" />
                    )}
                    ${Math.abs(r.brecha).toLocaleString()} MXN
                  </span>
                </div>
              </div>

              <div className="flex justify-between items-center text-[11px] text-slate-400 pt-1 border-t border-slate-800">
                <span>{r.totalClientes} Clientes Asignados</span>
                <span>{r.totalVentasContratos} Contratos Activos</span>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
