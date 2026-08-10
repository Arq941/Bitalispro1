'use client';

import { useState, useMemo } from 'react';
import { Abono, Venta, Usuario } from '@/types';
import {
  DollarSign,
  Calendar,
  UserCheck,
  MapPin,
  Filter,
  Users,
  Search,
  CheckCircle2,
  PieChart,
  BarChart2,
  ArrowUpRight,
  Receipt,
  Award,
  Wallet,
} from 'lucide-react';

export interface ResumenAbonosEnganchesPanelProps {
  abonos: Abono[];
  ventas: Venta[];
  usuarios?: Usuario[];
}

export type DateFilterType =
  | 'HOY'
  | 'AYER'
  | 'ESTA_SEMANA'
  | 'ESTE_MES'
  | 'DIA_ESPECIFICO'
  | 'RANGO'
  | 'TODOS';

export default function ResumenAbonosEnganchesPanel({
  abonos,
  ventas,
  usuarios = [],
}: ResumenAbonosEnganchesPanelProps) {
  // Date Filter State
  const [dateFilter, setDateFilter] = useState<DateFilterType>('HOY');
  const [specificDate, setSpecificDate] = useState<string>(
    () => new Date().toISOString().split('T')[0]
  );
  const [startDate, setStartDate] = useState<string>(
    () => new Date().toISOString().split('T')[0]
  );
  const [endDate, setEndDate] = useState<string>(
    () => new Date().toISOString().split('T')[0]
  );

  // Grouping View Tab: 'VENDEDORAS' | 'COBRADORES' | 'COMBINADO'
  const [viewGroup, setViewGroup] = useState<'VENDEDORAS' | 'COBRADORES' | 'COMBINADO'>('COMBINADO');
  const [searchQuery, setSearchQuery] = useState<string>('');

  // 1. Filtered Abonos and Ventas by selected date/range
  const filteredData = useMemo(() => {
    const todayStr = new Date().toISOString().split('T')[0];

    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    const yesterdayStr = yesterday.toISOString().split('T')[0];

    // Filter Abonos
    const filteredAbonos = abonos.filter((ab) => {
      const aDate = (ab.fechaPago || '').split('T')[0];

      if (dateFilter === 'HOY') return aDate === todayStr;
      if (dateFilter === 'AYER') return aDate === yesterdayStr;
      if (dateFilter === 'DIA_ESPECIFICO') return aDate === specificDate;
      if (dateFilter === 'RANGO') {
        if (!startDate && !endDate) return true;
        if (startDate && !endDate) return aDate >= startDate;
        if (!startDate && endDate) return aDate <= endDate;
        return aDate >= startDate && aDate <= endDate;
      }
      if (dateFilter === 'ESTA_SEMANA') {
        const now = new Date();
        const d = new Date(ab.fechaPago);
        const diffDays = (now.getTime() - d.getTime()) / (1000 * 3600 * 24);
        return diffDays >= 0 && diffDays <= 7;
      }
      if (dateFilter === 'ESTE_MES') {
        const now = new Date();
        const d = new Date(ab.fechaPago);
        return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
      }
      return true; // 'TODOS'
    });

    // Filter Ventas (for down payments / enganches)
    const filteredVentas = ventas.filter((v) => {
      const vDate = (v.fechaAprobacion || v.fechaVenta || '').split('T')[0];

      if (dateFilter === 'HOY') return vDate === todayStr;
      if (dateFilter === 'AYER') return vDate === yesterdayStr;
      if (dateFilter === 'DIA_ESPECIFICO') return vDate === specificDate;
      if (dateFilter === 'RANGO') {
        if (!startDate && !endDate) return true;
        if (startDate && !endDate) return vDate >= startDate;
        if (!startDate && endDate) return vDate <= endDate;
        return vDate >= startDate && vDate <= endDate;
      }
      if (dateFilter === 'ESTA_SEMANA') {
        const now = new Date();
        const d = new Date(v.fechaVenta);
        const diffDays = (now.getTime() - d.getTime()) / (1000 * 3600 * 24);
        return diffDays >= 0 && diffDays <= 7;
      }
      if (dateFilter === 'ESTE_MES') {
        const now = new Date();
        const d = new Date(v.fechaVenta);
        return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
      }
      return true; // 'TODOS'
    });

    return { filteredAbonos, filteredVentas };
  }, [abonos, ventas, dateFilter, specificDate, startDate, endDate]);

  // 2. Metrics & Grouped Aggregations
  const stats = useMemo(() => {
    const { filteredAbonos, filteredVentas } = filteredData;

    // Fast map of ventas for looking up vendedora from abonos
    const ventasMap = new Map<number, Venta>();
    ventas.forEach((v) => ventasMap.set(v.id, v));

    // Identify Enganches:
    // A) From Abonos with esEnganche = true
    const abonosEnganche = filteredAbonos.filter((a) => a.esEnganche);
    // B) Regular Abonos (non-enganche)
    const abonosRegulares = filteredAbonos.filter((a) => !a.esEnganche);

    // Sum totals
    const totalAbonosRegularesMonto = abonosRegulares.reduce((sum, a) => sum + a.monto, 0);
    const totalAbonosRegularesCount = abonosRegulares.length;

    // Enganches total from abonos + from ventas if not already in abonos
    let totalEnganchesMonto = abonosEnganche.reduce((sum, a) => sum + a.monto, 0);
    let totalEnganchesCount = abonosEnganche.length;

    // Check if there are sales with engancheCobrado where enganche wasn't generated as an abono
    filteredVentas.forEach((v) => {
      if ((v.engancheCobrado || v.enganchePagado) && (v.engancheMonto || 0) > 0) {
        // check if this sale has a matching abono with esEnganche
        const hasAbonoEnganche = filteredAbonos.some(
          (a) => a.ventaId === v.id && a.esEnganche
        );
        if (!hasAbonoEnganche) {
          totalEnganchesMonto += v.engancheMonto || 0;
          totalEnganchesCount += 1;
        }
      }
    });

    const totalAbonosMonto = totalAbonosRegularesMonto;
    const totalAbonosCount = totalAbonosRegularesCount;
    const granTotalMonto = totalAbonosMonto + totalEnganchesMonto;
    const granTotalCount = totalAbonosCount + totalEnganchesCount;

    // --- AGGREGATION BY VENDEDORA ---
    const vendedoraMap = new Map<
      string,
      {
        nombre: string;
        enganchesMonto: number;
        enganchesCount: number;
        abonosMonto: number;
        abonosCount: number;
        totalMonto: number;
      }
    >();

    // Add Enganches by Vendedora from Ventas
    filteredVentas.forEach((v) => {
      const vendName = v.vendedoraNombre || 'Vendedora No Asignada';
      if (!vendedoraMap.has(vendName)) {
        vendedoraMap.set(vendName, {
          nombre: vendName,
          enganchesMonto: 0,
          enganchesCount: 0,
          abonosMonto: 0,
          abonosCount: 0,
          totalMonto: 0,
        });
      }
      const entry = vendedoraMap.get(vendName)!;
      if ((v.engancheCobrado || v.enganchePagado) && (v.engancheMonto || 0) > 0) {
        entry.enganchesMonto += v.engancheMonto || 0;
        entry.enganchesCount += 1;
        entry.totalMonto += v.engancheMonto || 0;
      }
    });

    // Add Abonos (and Abonos Enganches) by Vendedora
    filteredAbonos.forEach((a) => {
      const v = ventasMap.get(a.ventaId);
      const vendName = v?.vendedoraNombre || a.cobradorNombre || 'Sin Vendedora';

      if (!vendedoraMap.has(vendName)) {
        vendedoraMap.set(vendName, {
          nombre: vendName,
          enganchesMonto: 0,
          enganchesCount: 0,
          abonosMonto: 0,
          abonosCount: 0,
          totalMonto: 0,
        });
      }
      const entry = vendedoraMap.get(vendName)!;
      if (a.esEnganche) {
        // Avoid double counting if already added from filteredVentas
        const hasVentaInFiltered = filteredVentas.some((fv) => fv.id === a.ventaId);
        if (!hasVentaInFiltered) {
          entry.enganchesMonto += a.monto;
          entry.enganchesCount += 1;
          entry.totalMonto += a.monto;
        }
      } else {
        entry.abonosMonto += a.monto;
        entry.abonosCount += 1;
        entry.totalMonto += a.monto;
      }
    });

    const listVendedoras = Array.from(vendedoraMap.values())
      .map((item) => ({
        ...item,
        porcentaje: granTotalMonto > 0 ? Math.round((item.totalMonto / granTotalMonto) * 100) : 0,
      }))
      .sort((a, b) => b.totalMonto - a.totalMonto);

    // --- AGGREGATION BY COBRADOR ---
    const cobradorMap = new Map<
      string,
      {
        nombre: string;
        abonosMonto: number;
        abonosCount: number;
        enganchesMonto: number;
        enganchesCount: number;
        totalMonto: number;
      }
    >();

    filteredAbonos.forEach((a) => {
      const cobName = a.cobradorNombre || 'Cobrador Sin Nombre';
      if (!cobradorMap.has(cobName)) {
        cobradorMap.set(cobName, {
          nombre: cobName,
          abonosMonto: 0,
          abonosCount: 0,
          enganchesMonto: 0,
          enganchesCount: 0,
          totalMonto: 0,
        });
      }
      const entry = cobradorMap.get(cobName)!;
      if (a.esEnganche) {
        entry.enganchesMonto += a.monto;
        entry.enganchesCount += 1;
      } else {
        entry.abonosMonto += a.monto;
        entry.abonosCount += 1;
      }
      entry.totalMonto += a.monto;
    });

    // Also include sales with engancheCobrado if cobradorName is associated or if collected in field
    filteredVentas.forEach((v) => {
      if ((v.engancheCobrado || v.enganchePagado) && (v.engancheMonto || 0) > 0) {
        const hasAbonoInFiltered = filteredAbonos.some(
          (a) => a.ventaId === v.id && a.esEnganche
        );
        if (!hasAbonoInFiltered) {
          const cobName = v.supervisoraAprobadoPor || 'Oficina / Vendedora';
          if (!cobradorMap.has(cobName)) {
            cobradorMap.set(cobName, {
              nombre: cobName,
              abonosMonto: 0,
              abonosCount: 0,
              enganchesMonto: 0,
              enganchesCount: 0,
              totalMonto: 0,
            });
          }
          const entry = cobradorMap.get(cobName)!;
          entry.enganchesMonto += v.engancheMonto || 0;
          entry.enganchesCount += 1;
          entry.totalMonto += v.engancheMonto || 0;
        }
      }
    });

    const listCobradores = Array.from(cobradorMap.values())
      .map((item) => ({
        ...item,
        porcentaje: granTotalMonto > 0 ? Math.round((item.totalMonto / granTotalMonto) * 100) : 0,
      }))
      .sort((a, b) => b.totalMonto - a.totalMonto);

    return {
      totalAbonosMonto,
      totalAbonosCount,
      totalEnganchesMonto,
      totalEnganchesCount,
      granTotalMonto,
      granTotalCount,
      listVendedoras,
      listCobradores,
    };
  }, [filteredData, ventas]);

  // Filter list by search query
  const query = searchQuery.trim().toLowerCase();
  const vendedorasFiltradas = stats.listVendedoras.filter((v) =>
    !query || v.nombre.toLowerCase().includes(query)
  );
  const cobradoresFiltrados = stats.listCobradores.filter((c) =>
    !query || c.nombre.toLowerCase().includes(query)
  );

  return (
    <div className="bg-slate-900 border-2 border-indigo-500/50 rounded-3xl p-6 shadow-2xl space-y-6">
      {/* HEADER TITLE */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-800 pb-5">
        <div>
          <div className="flex items-center gap-2 text-indigo-400 font-mono text-xs font-bold uppercase tracking-wider mb-1">
            <PieChart className="w-4 h-4 text-indigo-400" />
            <span>Consola de Inteligencia Financiera BITALIS</span>
          </div>
          <h3 className="text-xl sm:text-2xl font-black text-white flex items-center gap-2">
            <span>Filtro & Total de Abonos y Enganches</span>
          </h3>
          <p className="text-xs text-slate-300 mt-1">
            Consulta los ingresos desglosados por <strong className="text-indigo-300">Vendedora</strong>, <strong className="text-emerald-300">Cobrador</strong> y <strong className="text-amber-300">Gran Total General</strong> filtrados por cualquier periodo de tiempo.
          </p>
        </div>

        {/* Global Summary Badge */}
        <div className="bg-gradient-to-r from-slate-950 via-indigo-950/80 to-slate-950 border border-indigo-500/40 p-4 rounded-2xl text-right shrink-0 shadow-xl">
          <span className="text-[11px] text-slate-400 font-bold block uppercase tracking-wider">
            Gran Total Recaudado (Selección):
          </span>
          <span className="text-2xl sm:text-3xl font-black text-emerald-400 block">
            ${stats.granTotalMonto.toLocaleString('en-US')}{' '}
            <span className="text-xs font-bold text-slate-300">MXN</span>
          </span>
          <span className="text-[10px] text-slate-400 block mt-0.5">
            {stats.granTotalCount} operaciones registradas en el periodo
          </span>
        </div>
      </div>

      {/* FILTROS POR FECHA INTERACTIVOS */}
      <div className="bg-slate-950/90 border border-slate-800 rounded-2xl p-4 space-y-4 shadow-inner">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2 text-xs font-bold text-slate-300">
            <Calendar className="w-4 h-4 text-indigo-400" />
            <span>Seleccionar Rango de Fecha / Día:</span>
          </div>

          <div className="flex flex-wrap items-center gap-1.5">
            {[
              { id: 'HOY', label: '📅 Hoy' },
              { id: 'AYER', label: '🗓️ Ayer' },
              { id: 'ESTA_SEMANA', label: '📊 Esta Semana' },
              { id: 'ESTE_MES', label: '📆 Este Mes' },
              { id: 'DIA_ESPECIFICO', label: '📌 Día Específico' },
              { id: 'RANGO', label: '📐 Rango de Fechas' },
              { id: 'TODOS', label: '🌐 Todo el Histórico' },
            ].map((btn) => (
              <button
                type="button"
                key={btn.id}
                onClick={() => setDateFilter(btn.id as DateFilterType)}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold transition cursor-pointer shadow-sm ${
                  dateFilter === btn.id
                    ? 'bg-indigo-600 text-white border border-indigo-400 shadow-indigo-600/30'
                    : 'bg-slate-900 text-slate-400 border border-slate-800 hover:bg-slate-800 hover:text-white'
                }`}
              >
                {btn.label}
              </button>
            ))}
          </div>
        </div>

        {/* CONTROLES SECUNDARIOS CUANDO SE SELECCIONA DÍA ESPECÍFICO O RANGO */}
        {dateFilter === 'DIA_ESPECIFICO' && (
          <div className="flex items-center gap-3 bg-slate-900 border border-indigo-500/40 p-3 rounded-xl w-full sm:w-auto text-xs">
            <span className="text-slate-300 font-bold shrink-0">Seleccionar Día:</span>
            <input
              type="date"
              value={specificDate}
              onChange={(e) => setSpecificDate(e.target.value)}
              className="bg-slate-950 border border-slate-700 text-white font-mono px-3 py-1.5 rounded-lg focus:outline-none focus:border-indigo-500"
            />
            <span className="text-[11px] text-indigo-300 font-medium">
              Consultando fecha: {new Date(specificDate + 'T00:00:00').toLocaleDateString('es-MX', { dateStyle: 'full' })}
            </span>
          </div>
        )}

        {dateFilter === 'RANGO' && (
          <div className="flex flex-wrap items-center gap-3 bg-slate-900 border border-indigo-500/40 p-3 rounded-xl text-xs">
            <div className="flex items-center gap-2">
              <span className="text-slate-300 font-bold">Desde:</span>
              <input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="bg-slate-950 border border-slate-700 text-white font-mono px-3 py-1.5 rounded-lg focus:outline-none focus:border-indigo-500"
              />
            </div>
            <div className="flex items-center gap-2">
              <span className="text-slate-300 font-bold">Hasta:</span>
              <input
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                className="bg-slate-950 border border-slate-700 text-white font-mono px-3 py-1.5 rounded-lg focus:outline-none focus:border-indigo-500"
              />
            </div>
          </div>
        )}
      </div>

      {/* 4 CARDS RESUMEN EJECUTIVO */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* CARD 1: TOTAL ABONOS */}
        <div className="bg-slate-950/80 border border-emerald-500/40 p-4 rounded-2xl shadow-xl space-y-2">
          <div className="flex items-center justify-between text-xs text-emerald-400 font-bold">
            <span className="flex items-center gap-1.5 uppercase tracking-wider">
              <Receipt className="w-4 h-4" />
              Total Abonos (Cobranza)
            </span>
            <span className="bg-emerald-950 text-emerald-300 border border-emerald-800 px-2 py-0.5 rounded-full text-[10px]">
              {stats.totalAbonosCount} cobros
            </span>
          </div>
          <div>
            <span className="text-2xl font-black text-emerald-400 block">
              ${stats.totalAbonosMonto.toLocaleString('en-US')}{' '}
              <span className="text-xs text-slate-400 font-normal">MXN</span>
            </span>
            <span className="text-[11px] text-slate-400 block mt-0.5">
              Abonos semanales / cuotas colectadas
            </span>
          </div>
        </div>

        {/* CARD 2: TOTAL ENGANCHES */}
        <div className="bg-slate-950/80 border border-indigo-500/40 p-4 rounded-2xl shadow-xl space-y-2">
          <div className="flex items-center justify-between text-xs text-indigo-300 font-bold">
            <span className="flex items-center gap-1.5 uppercase tracking-wider">
              <Award className="w-4 h-4" />
              Total Enganches (Ventas)
            </span>
            <span className="bg-indigo-950 text-indigo-300 border border-indigo-800 px-2 py-0.5 rounded-full text-[10px]">
              {stats.totalEnganchesCount} enganches
            </span>
          </div>
          <div>
            <span className="text-2xl font-black text-indigo-300 block">
              ${stats.totalEnganchesMonto.toLocaleString('en-US')}{' '}
              <span className="text-xs text-slate-400 font-normal">MXN</span>
            </span>
            <span className="text-[11px] text-slate-400 block mt-0.5">
              Anticipos cobrados en ventas iniciales
            </span>
          </div>
        </div>

        {/* CARD 3: GRAN TOTAL RECAUDADO */}
        <div className="bg-slate-950/80 border border-amber-500/40 p-4 rounded-2xl shadow-xl space-y-2">
          <div className="flex items-center justify-between text-xs text-amber-400 font-bold">
            <span className="flex items-center gap-1.5 uppercase tracking-wider">
              <Wallet className="w-4 h-4" />
              Gran Total
            </span>
            <span className="bg-amber-950 text-amber-300 border border-amber-800 px-2 py-0.5 rounded-full text-[10px]">
              100% Recaudación
            </span>
          </div>
          <div>
            <span className="text-2xl font-black text-amber-300 block">
              ${stats.granTotalMonto.toLocaleString('en-US')}{' '}
              <span className="text-xs text-slate-400 font-normal">MXN</span>
            </span>
            <span className="text-[11px] text-slate-400 block mt-0.5">
              Suma total Abonos + Enganches
            </span>
          </div>
        </div>

        {/* CARD 4: PROMEDIO POR OPERACIÓN */}
        <div className="bg-slate-950/80 border border-cyan-500/40 p-4 rounded-2xl shadow-xl space-y-2">
          <div className="flex items-center justify-between text-xs text-cyan-300 font-bold">
            <span className="flex items-center gap-1.5 uppercase tracking-wider">
              <BarChart2 className="w-4 h-4" />
              Promedio por Cobro
            </span>
            <span className="bg-cyan-950 text-cyan-300 border border-cyan-800 px-2 py-0.5 rounded-full text-[10px]">
              Ticket Promedio
            </span>
          </div>
          <div>
            <span className="text-2xl font-black text-cyan-300 block">
              $
              {stats.granTotalCount > 0
                ? Math.round(stats.granTotalMonto / stats.granTotalCount).toLocaleString('en-US')
                : 0}{' '}
              <span className="text-xs text-slate-400 font-normal">MXN</span>
            </span>
            <span className="text-[11px] text-slate-400 block mt-0.5">
              Monto promedio por recibo registrado
            </span>
          </div>
        </div>
      </div>

      {/* CONTROLES DE VISTA DE TABLA Y BÚSQUEDA DE PERSONAL */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 pt-2">
        <div className="flex items-center bg-slate-950 border border-slate-800 rounded-xl p-1 gap-1 text-xs font-bold">
          <button
            type="button"
            onClick={() => setViewGroup('COMBINADO')}
            className={`px-3 py-1.5 rounded-lg transition cursor-pointer flex items-center gap-1.5 ${
              viewGroup === 'COMBINADO'
                ? 'bg-gradient-to-r from-indigo-600 to-emerald-600 text-white shadow-md'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            <Users className="w-3.5 h-3.5" />
            <span>Vista Combinada (Total)</span>
          </button>

          <button
            type="button"
            onClick={() => setViewGroup('VENDEDORAS')}
            className={`px-3 py-1.5 rounded-lg transition cursor-pointer flex items-center gap-1.5 ${
              viewGroup === 'VENDEDORAS'
                ? 'bg-indigo-600 text-white shadow-md'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            <UserCheck className="w-3.5 h-3.5" />
            <span>Por Vendedora</span>
          </button>

          <button
            type="button"
            onClick={() => setViewGroup('COBRADORES')}
            className={`px-3 py-1.5 rounded-lg transition cursor-pointer flex items-center gap-1.5 ${
              viewGroup === 'COBRADORES'
                ? 'bg-emerald-600 text-white shadow-md'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            <MapPin className="w-3.5 h-3.5" />
            <span>Por Cobrador</span>
          </button>
        </div>

        {/* Buscador de personal */}
        <div className="relative w-full sm:w-64">
          <Search className="w-3.5 h-3.5 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Filtrar por nombre de vendedora o cobrador..."
            className="w-full bg-slate-950 border border-slate-800 rounded-xl pl-8 pr-3 py-1.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500"
          />
        </div>
      </div>

      {/* TABLAS DETALLADAS SEGÚN LA VISTA SELECCIONADA */}
      <div className="bg-slate-950/80 border border-slate-800 rounded-2xl overflow-hidden shadow-2xl">
        {/* VISTA 1: COMBINADA (TODOS) */}
        {viewGroup === 'COMBINADO' && (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="bg-slate-900 border-b border-slate-800 text-slate-400 font-mono text-[11px] uppercase">
                  <th className="py-3 px-4">Personal / Colaborador</th>
                  <th className="py-3 px-4">Rol en Sistema</th>
                  <th className="py-3 px-4 text-right">Enganches Cobrados</th>
                  <th className="py-3 px-4 text-right">Abonos Recaudados</th>
                  <th className="py-3 px-4 text-right">Total General</th>
                  <th className="py-3 px-4 text-center">% Participación</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/80 text-slate-200">
                {/* Vendedoras Row Map */}
                {vendedorasFiltradas.map((v) => (
                  <tr key={`vend-${v.nombre}`} className="hover:bg-slate-900/60 transition">
                    <td className="py-3 px-4 font-bold text-white flex items-center gap-2">
                      <div className="w-6 h-6 rounded-full bg-indigo-900/80 text-indigo-300 border border-indigo-700 flex items-center justify-center text-[10px]">
                        V
                      </div>
                      <span>{v.nombre}</span>
                    </td>
                    <td className="py-3 px-4">
                      <span className="bg-indigo-950 text-indigo-300 border border-indigo-800 px-2 py-0.5 rounded-md text-[10px] font-bold">
                        Vendedora Campo
                      </span>
                    </td>
                    <td className="py-3 px-4 text-right font-mono font-bold text-indigo-300">
                      ${v.enganchesMonto.toLocaleString('en-US')}{' '}
                      <span className="text-[10px] text-slate-400 font-normal">({v.enganchesCount})</span>
                    </td>
                    <td className="py-3 px-4 text-right font-mono font-bold text-emerald-400">
                      ${v.abonosMonto.toLocaleString('en-US')}{' '}
                      <span className="text-[10px] text-slate-400 font-normal">({v.abonosCount})</span>
                    </td>
                    <td className="py-3 px-4 text-right font-mono font-black text-amber-300 text-sm">
                      ${v.totalMonto.toLocaleString('en-US')} MXN
                    </td>
                    <td className="py-3 px-4">
                      <div className="flex items-center gap-2 justify-center">
                        <div className="w-16 bg-slate-800 h-2 rounded-full overflow-hidden">
                          <div
                            className="bg-indigo-500 h-full rounded-full"
                            style={{ width: `${Math.min(100, v.porcentaje)}%` }}
                          />
                        </div>
                        <span className="font-bold text-[11px] text-slate-300">{v.porcentaje}%</span>
                      </div>
                    </td>
                  </tr>
                ))}

                {/* Cobradores Row Map */}
                {cobradoresFiltrados.map((c) => (
                  <tr key={`cob-${c.nombre}`} className="hover:bg-slate-900/60 transition">
                    <td className="py-3 px-4 font-bold text-white flex items-center gap-2">
                      <div className="w-6 h-6 rounded-full bg-emerald-900/80 text-emerald-300 border border-emerald-700 flex items-center justify-center text-[10px]">
                        C
                      </div>
                      <span>{c.nombre}</span>
                    </td>
                    <td className="py-3 px-4">
                      <span className="bg-emerald-950 text-emerald-300 border border-emerald-800 px-2 py-0.5 rounded-md text-[10px] font-bold">
                        Cobrador Ruta
                      </span>
                    </td>
                    <td className="py-3 px-4 text-right font-mono font-bold text-indigo-300">
                      ${c.enganchesMonto.toLocaleString('en-US')}{' '}
                      <span className="text-[10px] text-slate-400 font-normal">({c.enganchesCount})</span>
                    </td>
                    <td className="py-3 px-4 text-right font-mono font-bold text-emerald-400">
                      ${c.abonosMonto.toLocaleString('en-US')}{' '}
                      <span className="text-[10px] text-slate-400 font-normal">({c.abonosCount})</span>
                    </td>
                    <td className="py-3 px-4 text-right font-mono font-black text-amber-300 text-sm">
                      ${c.totalMonto.toLocaleString('en-US')} MXN
                    </td>
                    <td className="py-3 px-4">
                      <div className="flex items-center gap-2 justify-center">
                        <div className="w-16 bg-slate-800 h-2 rounded-full overflow-hidden">
                          <div
                            className="bg-emerald-500 h-full rounded-full"
                            style={{ width: `${Math.min(100, c.porcentaje)}%` }}
                          />
                        </div>
                        <span className="font-bold text-[11px] text-slate-300">{c.porcentaje}%</span>
                      </div>
                    </td>
                  </tr>
                ))}

                {vendedorasFiltradas.length === 0 && cobradoresFiltrados.length === 0 && (
                  <tr>
                    <td colSpan={6} className="py-8 text-center text-slate-400">
                      No hay registros de abonos ni enganches para el periodo seleccionado.
                    </td>
                  </tr>
                )}

                {/* TOTAL ROW HIGHLIGHT */}
                <tr className="bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 border-t-2 border-indigo-500 font-black text-white text-sm">
                  <td className="py-4 px-4 uppercase tracking-wider text-amber-300 flex items-center gap-2">
                    <Award className="w-4 h-4 text-amber-400" />
                    <span>GRAN TOTAL GENERAL</span>
                  </td>
                  <td className="py-4 px-4 text-xs font-normal text-slate-300">Todos los Colaboradores</td>
                  <td className="py-4 px-4 text-right font-mono text-indigo-300 text-sm">
                    ${stats.totalEnganchesMonto.toLocaleString('en-US')}{' '}
                    <span className="text-xs text-slate-400 font-normal">({stats.totalEnganchesCount})</span>
                  </td>
                  <td className="py-4 px-4 text-right font-mono text-emerald-400 text-sm">
                    ${stats.totalAbonosMonto.toLocaleString('en-US')}{' '}
                    <span className="text-xs text-slate-400 font-normal">({stats.totalAbonosCount})</span>
                  </td>
                  <td className="py-4 px-4 text-right font-mono text-amber-300 text-base">
                    ${stats.granTotalMonto.toLocaleString('en-US')} MXN
                  </td>
                  <td className="py-4 px-4 text-center font-mono text-emerald-400">100%</td>
                </tr>
              </tbody>
            </table>
          </div>
        )}

        {/* VISTA 2: DESGLOSE POR VENDEDORA */}
        {viewGroup === 'VENDEDORAS' && (
          <div className="p-4 space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {vendedorasFiltradas.map((v) => (
                <div
                  key={v.nombre}
                  className="bg-slate-900 border border-slate-800 rounded-2xl p-4 space-y-3 relative hover:border-indigo-500/60 transition shadow-lg"
                >
                  <div className="flex items-center justify-between border-b border-slate-800 pb-2.5">
                    <div className="flex items-center gap-2">
                      <div className="w-8 h-8 rounded-xl bg-indigo-600/30 border border-indigo-500/50 text-indigo-300 flex items-center justify-center font-bold">
                        <UserCheck className="w-4 h-4" />
                      </div>
                      <div>
                        <h4 className="font-black text-white text-sm">{v.nombre}</h4>
                        <span className="text-[10px] text-indigo-400 font-bold">Vendedora Campo</span>
                      </div>
                    </div>
                    <span className="bg-indigo-950 text-indigo-300 border border-indigo-800 px-2 py-0.5 rounded-full text-xs font-black">
                      {v.porcentaje}% del Total
                    </span>
                  </div>

                  <div className="space-y-2 text-xs">
                    <div className="flex justify-between items-center bg-slate-950/80 p-2.5 rounded-xl border border-slate-800">
                      <span className="text-slate-400">Enganches Cobrados:</span>
                      <span className="font-mono font-bold text-indigo-300 text-sm">
                        ${v.enganchesMonto.toLocaleString('en-US')}{' '}
                        <span className="text-[10px] text-slate-500 font-normal">({v.enganchesCount})</span>
                      </span>
                    </div>

                    <div className="flex justify-between items-center bg-slate-950/80 p-2.5 rounded-xl border border-slate-800">
                      <span className="text-slate-400">Abonos de Sus Clientes:</span>
                      <span className="font-mono font-bold text-emerald-400 text-sm">
                        ${v.abonosMonto.toLocaleString('en-US')}{' '}
                        <span className="text-[10px] text-slate-500 font-normal">({v.abonosCount})</span>
                      </span>
                    </div>

                    <div className="flex justify-between items-center bg-indigo-950/50 p-3 rounded-xl border border-indigo-500/40 text-sm font-black">
                      <span className="text-indigo-200">Total Generado:</span>
                      <span className="font-mono text-amber-300 text-base">
                        ${v.totalMonto.toLocaleString('en-US')} MXN
                      </span>
                    </div>
                  </div>
                </div>
              ))}
            </div>

            {vendedorasFiltradas.length === 0 && (
              <p className="text-center py-6 text-slate-400 text-xs">
                No se encontraron vendedoras con ingresos en este periodo.
              </p>
            )}
          </div>
        )}

        {/* VISTA 3: DESGLOSE POR COBRADOR */}
        {viewGroup === 'COBRADORES' && (
          <div className="p-4 space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {cobradoresFiltrados.map((c) => (
                <div
                  key={c.nombre}
                  className="bg-slate-900 border border-slate-800 rounded-2xl p-4 space-y-3 relative hover:border-emerald-500/60 transition shadow-lg"
                >
                  <div className="flex items-center justify-between border-b border-slate-800 pb-2.5">
                    <div className="flex items-center gap-2">
                      <div className="w-8 h-8 rounded-xl bg-emerald-600/30 border border-emerald-500/50 text-emerald-300 flex items-center justify-center font-bold">
                        <MapPin className="w-4 h-4" />
                      </div>
                      <div>
                        <h4 className="font-black text-white text-sm">{c.nombre}</h4>
                        <span className="text-[10px] text-emerald-400 font-bold">Cobrador de Ruta</span>
                      </div>
                    </div>
                    <span className="bg-emerald-950 text-emerald-300 border border-emerald-800 px-2 py-0.5 rounded-full text-xs font-black">
                      {c.porcentaje}% del Total
                    </span>
                  </div>

                  <div className="space-y-2 text-xs">
                    <div className="flex justify-between items-center bg-slate-950/80 p-2.5 rounded-xl border border-slate-800">
                      <span className="text-slate-400">Abonos Cobrados en Ruta:</span>
                      <span className="font-mono font-bold text-emerald-400 text-sm">
                        ${c.abonosMonto.toLocaleString('en-US')}{' '}
                        <span className="text-[10px] text-slate-500 font-normal">({c.abonosCount})</span>
                      </span>
                    </div>

                    <div className="flex justify-between items-center bg-slate-950/80 p-2.5 rounded-xl border border-slate-800">
                      <span className="text-slate-400">Enganches Recolectados:</span>
                      <span className="font-mono font-bold text-indigo-300 text-sm">
                        ${c.enganchesMonto.toLocaleString('en-US')}{' '}
                        <span className="text-[10px] text-slate-500 font-normal">({c.enganchesCount})</span>
                      </span>
                    </div>

                    <div className="flex justify-between items-center bg-emerald-950/50 p-3 rounded-xl border border-emerald-500/40 text-sm font-black">
                      <span className="text-emerald-200">Total Recaudado en Ruta:</span>
                      <span className="font-mono text-amber-300 text-base">
                        ${c.totalMonto.toLocaleString('en-US')} MXN
                      </span>
                    </div>
                  </div>
                </div>
              ))}
            </div>

            {cobradoresFiltrados.length === 0 && (
              <p className="text-center py-6 text-slate-400 text-xs">
                No se encontraron cobradores con recaudaciones en este periodo.
              </p>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
