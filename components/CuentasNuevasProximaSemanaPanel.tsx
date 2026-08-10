'use client';

import React, { useState, useMemo } from 'react';
import { Cliente, Venta, Abono, Zona, Usuario, DiaSemana } from '@/types';
import {
  Calendar,
  DollarSign,
  Users,
  CheckCircle2,
  Printer,
  MessageSquare,
  Search,
  Filter,
  Clock,
  ArrowRight,
  Building2,
  Tag,
  AlertCircle,
  MapPin,
  Sparkles,
  RefreshCw,
  X,
  Wallet,
  Send,
  Package,
  Check,
  ChevronRight,
  UserCheck,
} from 'lucide-react';

interface CuentasNuevasProximaSemanaPanelProps {
  clientes: Cliente[];
  ventas: Venta[];
  abonos: Abono[];
  zonas: Zona[];
  usuarios: Usuario[];
  currentUser?: Usuario | null;
  onAddAbono?: (nuevoAbono: Abono) => void;
  onMarkCardsAsPrinted?: (clienteIds: number[]) => void;
  onOpenPrintCards?: (clientes: Cliente[]) => void;
}

const DIAS_SEMANA: DiaSemana[] = [
  'Lunes',
  'Martes',
  'Miércoles',
  'Jueves',
  'Viernes',
  'Sábado',
  'Domingo',
];

export default function CuentasNuevasProximaSemanaPanel({
  clientes,
  ventas,
  abonos,
  zonas,
  usuarios,
  currentUser,
  onAddAbono,
  onMarkCardsAsPrinted,
  onOpenPrintCards,
}: CuentasNuevasProximaSemanaPanelProps) {
  // Filters State
  const [diaFiltro, setDiaFiltro] = useState<string>('TODOS');
  const [zonaFiltro, setZonaFiltro] = useState<string>('TODAS');
  const [vendedoraFiltro, setVendedoraFiltro] = useState<string>('TODAS');
  const [criterioNueva, setCriterioNueva] = useState<'RECIENTES_14' | 'SIN_ABONOS' | 'ESTE_MES' | 'TODAS_ACTIVAS'>('RECIENTES_14');
  const [searchTerm, setSearchTerm] = useState<string>('');

  // Modal State for Abono Recording
  const [clienteAbonoModal, setClienteAbonoModal] = useState<Cliente | null>(null);
  const [montoAbonoInput, setMontoAbonoInput] = useState<string>('');
  const [tipoPagoInput, setTipoPagoInput] = useState<'EFECTIVO' | 'TRANSFERENCIA' | 'MIXTO'>('EFECTIVO');
  const [observacionesInput, setObservacionesInput] = useState<string>('Primer cobro - Cuenta nueva BITALIS');
  const [enviarWaAbono, setEnviarWaAbono] = useState<boolean>(true);

  // Toast notification
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  // Helper dates for Next Week Range Calculation
  const { inicioProximaSemana, finProximaSemana, rangoTexto, fechasPorDia } = useMemo(() => {
    const hoy = new Date();
    const diaActualIndex = hoy.getDay(); // 0 is Sun, 1 is Mon, ... 6 is Sat
    // Days remaining to next Monday
    const diasHastaProximoLunes = diaActualIndex === 0 ? 1 : 8 - diaActualIndex;
    
    const proximoLunes = new Date(hoy);
    proximoLunes.setDate(hoy.getDate() + diasHastaProximoLunes);
    proximoLunes.setHours(0, 0, 0, 0);

    const proximoDomingo = new Date(proximoLunes);
    proximoDomingo.setDate(proximoLunes.getDate() + 6);
    proximoDomingo.setHours(23, 59, 59, 999);

    const formatOpts: Intl.DateTimeFormatOptions = { day: 'numeric', month: 'short' };
    const rangoStr = `${proximoLunes.toLocaleDateString('es-MX', formatOpts)} - ${proximoDomingo.toLocaleDateString('es-MX', formatOpts)} ${proximoDomingo.getFullYear()}`;

    // Map dates for each day of next week
    const mapFechas: Record<DiaSemana, string> = {
      Lunes: new Date(proximoLunes.getTime() + 0 * 86400000).toLocaleDateString('es-MX', formatOpts),
      Martes: new Date(proximoLunes.getTime() + 1 * 86400000).toLocaleDateString('es-MX', formatOpts),
      Miércoles: new Date(proximoLunes.getTime() + 2 * 86400000).toLocaleDateString('es-MX', formatOpts),
      Jueves: new Date(proximoLunes.getTime() + 3 * 86400000).toLocaleDateString('es-MX', formatOpts),
      Viernes: new Date(proximoLunes.getTime() + 4 * 86400000).toLocaleDateString('es-MX', formatOpts),
      Sábado: new Date(proximoLunes.getTime() + 5 * 86400000).toLocaleDateString('es-MX', formatOpts),
      Domingo: new Date(proximoLunes.getTime() + 6 * 86400000).toLocaleDateString('es-MX', formatOpts),
    };

    return {
      inicioProximaSemana: proximoLunes,
      finProximaSemana: proximoDomingo,
      rangoTexto: rangoStr,
      fechasPorDia: mapFechas,
    };
  }, []);

  // Filter Sales / Clients matching "Cuentas Nuevas"
  const cuentasNuevasCalculadas = useMemo(() => {
    const hace14Dias = new Date();
    hace14Dias.setDate(hace14Dias.getDate() - 14);
    const hace14DiasStr = hace14Dias.toISOString().split('T')[0];

    const inicioEsteMes = new Date();
    inicioEsteMes.setDate(1);
    const inicioEsteMesStr = inicioEsteMes.toISOString().split('T')[0];

    return clientes.filter((cli) => {
      // Must have active sale
      const ventaCli = ventas.find((v) => v.clienteId === cli.id && v.saldoActual > 0 && v.estado !== 'CANCELADA');
      if (!ventaCli) return false;

      // Abonos count for this client
      const abonosCli = abonos.filter((a) => a.clienteId === cli.id);

      // Criteria matching
      let esNueva = false;
      if (criterioNueva === 'RECIENTES_14') {
        esNueva = (cli.fechaRegistro >= hace14DiasStr) || (ventaCli.fechaVenta >= hace14DiasStr) || abonosCli.length <= 1;
      } else if (criterioNueva === 'SIN_ABONOS') {
        esNueva = abonosCli.length === 0;
      } else if (criterioNueva === 'ESTE_MES') {
        esNueva = (cli.fechaRegistro >= inicioEsteMesStr) || (ventaCli.fechaVenta >= inicioEsteMesStr);
      } else if (criterioNueva === 'TODAS_ACTIVAS') {
        esNueva = true;
      }

      return esNueva;
    });
  }, [clientes, ventas, abonos, criterioNueva]);

  // Filtered dataset based on UI controls
  const cuentasFiltradas = useMemo(() => {
    return cuentasNuevasCalculadas.filter((cli) => {
      const venta = ventas.find((v) => v.clienteId === cli.id);
      const diaCobro = cli.diaCobroZona || venta?.diaCobroZona || 'Lunes';

      // Day filter
      if (diaFiltro !== 'TODOS' && diaCobro !== diaFiltro) return false;

      // Zone filter
      if (zonaFiltro !== 'TODAS' && String(cli.zonaId) !== zonaFiltro && cli.zonaNombre !== zonaFiltro) return false;

      // Vendedora filter
      if (vendedoraFiltro !== 'TODAS') {
        const matchesVendedora =
          (cli.vendedoraNombre && cli.vendedoraNombre.toLowerCase().includes(vendedoraFiltro.toLowerCase())) ||
          (venta?.vendedoraNombre && venta.vendedoraNombre.toLowerCase().includes(vendedoraFiltro.toLowerCase()));
        if (!matchesVendedora) return false;
      }

      // Search term
      if (searchTerm.trim()) {
        const query = searchTerm.toLowerCase();
        const matchesName = cli.nombreCompleto.toLowerCase().includes(query);
        const matchesFolio = cli.folio.toLowerCase().includes(query);
        const matchesColonia = (cli.colonia || '').toLowerCase().includes(query);
        const matchesAddress = cli.direccion.toLowerCase().includes(query);
        const matchesProduct = (venta?.productoNombre || '').toLowerCase().includes(query);
        if (!matchesName && !matchesFolio && !matchesColonia && !matchesAddress && !matchesProduct) {
          return false;
        }
      }

      return true;
    });
  }, [cuentasNuevasCalculadas, ventas, diaFiltro, zonaFiltro, vendedoraFiltro, searchTerm]);

  // Metrics calculations
  const totalMontoCobroProyectado = useMemo(() => {
    return cuentasFiltradas.reduce((sum, cli) => {
      const v = ventas.find((item) => item.clienteId === cli.id);
      return sum + (v?.pagoSemanal || 100);
    }, 0);
  }, [cuentasFiltradas, ventas]);

  const totalSaldoCarteraNueva = useMemo(() => {
    return cuentasFiltradas.reduce((sum, cli) => {
      const v = ventas.find((item) => item.clienteId === cli.id);
      return sum + (v?.saldoActual || 0);
    }, 0);
  }, [cuentasFiltradas, ventas]);

  const tarjetasPendientesCount = useMemo(() => {
    return cuentasFiltradas.filter((cli) => !cli.tarjetaImpresa).length;
  }, [cuentasFiltradas]);

  // Counts by Day of the Week
  const conteoPorDia = useMemo(() => {
    const map: Record<DiaSemana, { count: number; monto: number }> = {
      Lunes: { count: 0, monto: 0 },
      Martes: { count: 0, monto: 0 },
      Miércoles: { count: 0, monto: 0 },
      Jueves: { count: 0, monto: 0 },
      Viernes: { count: 0, monto: 0 },
      Sábado: { count: 0, monto: 0 },
      Domingo: { count: 0, monto: 0 },
    };

    cuentasNuevasCalculadas.forEach((cli) => {
      const v = ventas.find((item) => item.clienteId === cli.id);
      const dia = (cli.diaCobroZona || v?.diaCobroZona || 'Lunes') as DiaSemana;
      if (map[dia]) {
        map[dia].count += 1;
        map[dia].monto += v?.pagoSemanal || 100;
      }
    });

    return map;
  }, [cuentasNuevasCalculadas, ventas]);

  // Unique list of Vendedoras for filter dropdown
  const vendedorasList = useMemo(() => {
    const list = new Set<string>();
    cuentasNuevasCalculadas.forEach((c) => {
      if (c.vendedoraNombre) list.add(c.vendedoraNombre);
    });
    return Array.from(list);
  }, [cuentasNuevasCalculadas]);

  // Handle Abono Form Submission
  const handleOpenAbonoModal = (cli: Cliente) => {
    const v = ventas.find((item) => item.clienteId === cli.id);
    const cuota = v?.pagoSemanal || 100;
    setClienteAbonoModal(cli);
    setMontoAbonoInput(String(cuota <= (v?.saldoActual || 0) ? cuota : v?.saldoActual || 100));
    setTipoPagoInput('EFECTIVO');
    setObservacionesInput('Primer cobro registrado desde Panel de Cuentas Nuevas');
    setEnviarWaAbono(true);
  };

  const handleConfirmAbono = (e: React.FormEvent) => {
    e.preventDefault();
    if (!clienteAbonoModal) return;

    const montoNum = parseFloat(montoAbonoInput) || 0;
    if (montoNum <= 0) {
      alert('El monto a cobrar debe ser mayor a $0 MXN.');
      return;
    }

    const v = ventas.find((item) => item.clienteId === clienteAbonoModal.id);
    const abonosCli = abonos.filter((a) => a.clienteId === clienteAbonoModal.id);

    const nuevoAbono: Abono = {
      id: Date.now(),
      ventaId: v ? v.id : 0,
      clienteId: clienteAbonoModal.id,
      clienteNombre: clienteAbonoModal.nombreCompleto,
      clienteFolio: clienteAbonoModal.folio,
      cobradorId: currentUser?.id || 1,
      cobradorNombre: currentUser?.nombre || 'Administrador / Cobrador',
      monto: montoNum,
      tipoPago: tipoPagoInput,
      semanaNumero: abonosCli.length + 1,
      observaciones: observacionesInput.trim() || 'Primer cobro cuenta nueva',
      fechaPago: new Date().toISOString().split('T')[0],
      latitudCobro: clienteAbonoModal.latitud || 0,
      longitudCobro: clienteAbonoModal.longitud || 0,
      waEnviado: enviarWaAbono,
    };

    if (onAddAbono) {
      onAddAbono(nuevoAbono);
    }

    // Launch WhatsApp receipt if selected
    if (enviarWaAbono && clienteAbonoModal.telefono) {
      const saldoActual = v?.saldoActual || 0;
      const nuevoSaldo = Math.max(0, saldoActual - montoNum);
      const msg = `*RECIBO OFICIAL PRIMER COBRO — BITALIS* 🍃\n\nEstimado/a *${clienteAbonoModal.nombreCompleto}*,\nLe confirmamos con gusto la recepción de su primer abono semanal.\n\n📄 *Contrato:* ${clienteAbonoModal.folio}\n📦 *Producto:* ${v?.productoNombre || 'Producto BITALIS'}\n💰 *Monto Cobrado:* $${montoNum.toLocaleString('es-MX')} MXN (${tipoPagoInput})\n✅ *Nuevo Saldo Restante:* $${nuevoSaldo.toLocaleString('es-MX')} MXN\n🗓️ *Fecha:* ${new Date().toLocaleDateString('es-MX')}\n\n¡Le agradecemos infinitamente su preferencia y confianza!`;
      window.open(`https://wa.me/52${clienteAbonoModal.telefono}?text=${encodeURIComponent(msg)}`, '_blank');
    }

    setToastMessage(`💰 ¡Cobro de $${montoNum.toLocaleString('es-MX')} registrado exitosamente a ${clienteAbonoModal.nombreCompleto}!`);
    setTimeout(() => setToastMessage(null), 4000);
    setClienteAbonoModal(null);
  };

  // WhatsApp welcome / reminder message
  const handleSendWhatsAppReminder = (cli: Cliente) => {
    if (!cli.telefono) {
      alert('El cliente no cuenta con número telefónico registrado.');
      return;
    }
    const v = ventas.find((item) => item.clienteId === cli.id);
    const diaCobro = cli.diaCobroZona || v?.diaCobroZona || 'Lunes';
    const fechaEstimated = fechasPorDia[diaCobro as DiaSemana] || 'la próxima semana';

    const msg = `*RECORDATORIO DE INICIO DE COBROS — BITALIS (Productos Naturistas)* 🍃\n\nHola *${cli.nombreCompleto}*, le saludamos de *BITALIS*.\nLe recordamos que su contrato *${cli.folio}* (*${v?.productoNombre || 'Producto BITALIS'}*) tiene programado su cobro semanal para el día *${diaCobro} (${fechaEstimated})*.\n\n💵 *Cuota Semanal:* $${(v?.pagoSemanal || 100).toLocaleString('es-MX')} MXN\n📍 *Dirección de Visita:* ${cli.direccion}\n\nUn cobrador de nuestro equipo le visitará en su domicilio. ¡Muchas gracias por su preferencia!`;

    window.open(`https://wa.me/52${cli.telefono}?text=${encodeURIComponent(msg)}`, '_blank');
  };

  return (
    <div className="bg-slate-900/90 border border-slate-800 rounded-3xl p-4 sm:p-6 shadow-2xl space-y-6">
      {/* PANEL HEADER */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between border-b border-slate-800 pb-5 gap-4">
        <div className="space-y-1.5">
          <div className="flex flex-wrap items-center gap-2">
            <span className="px-3 py-1 rounded-full text-xs font-mono font-black bg-emerald-950 text-emerald-300 border border-emerald-700/80 flex items-center gap-1.5 uppercase">
              <Calendar className="w-3.5 h-3.5 text-emerald-400" />
              <span>Próxima Semana ({rangoTexto})</span>
            </span>
            <span className="px-3 py-1 rounded-full text-xs font-mono font-bold bg-indigo-950 text-indigo-300 border border-indigo-700/80">
              {cuentasFiltradas.length} cuentas en lista
            </span>
          </div>
          <h2 className="text-xl sm:text-2xl font-black text-white flex items-center gap-2.5">
            <Sparkles className="w-6 h-6 text-emerald-400 animate-pulse" />
            <span>Cuentas Nuevas por Cobrar la Siguiente Semana</span>
          </h2>
          <p className="text-xs text-slate-400 max-w-3xl">
            Control administrativo y visualización de contratos recientes que inician su cobro semanal la próxima semana. Visualiza cobros programados por día, imprime tarjetas o envía recordatorios directo a WhatsApp.
          </p>
        </div>

        {/* Action Buttons */}
        <div className="flex flex-wrap items-center gap-2 shrink-0">
          {tarjetasPendientesCount > 0 && onOpenPrintCards && (
            <button
              type="button"
              onClick={() => {
                const pend = cuentasFiltradas.filter((cli) => !cli.tarjetaImpresa);
                onOpenPrintCards(pend);
              }}
              className="px-3.5 py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs rounded-xl shadow-lg transition flex items-center gap-2 cursor-pointer active:scale-95"
            >
              <Printer className="w-4 h-4" />
              <span>Imprimir {tarjetasPendientesCount} Tarjetas Pendientes</span>
            </button>
          )}

          <button
            type="button"
            onClick={() => {
              window.print();
            }}
            className="px-3 py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-200 font-bold text-xs rounded-xl border border-slate-700 transition flex items-center gap-2 cursor-pointer"
          >
            <Printer className="w-4 h-4 text-slate-400" />
            <span>Exportar / Imprimir Lista</span>
          </button>
        </div>
      </div>

      {/* TOP SUMMARY KPI CARDS */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* KPI 1: TOTAL CUENTAS NUEVAS */}
        <div className="bg-gradient-to-br from-slate-950 to-slate-900 border border-slate-800 p-4 rounded-2xl space-y-2 shadow-lg">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
              <Users className="w-4 h-4 text-emerald-400" />
              Total Cuentas Nuevas
            </span>
            <span className="text-[10px] bg-emerald-950 text-emerald-300 font-mono font-bold px-2 py-0.5 rounded-full border border-emerald-800">
              Próx. Semana
            </span>
          </div>
          <div>
            <span className="text-2xl sm:text-3xl font-black text-white font-mono block">
              {cuentasFiltradas.length} <span className="text-sm font-normal text-slate-400">contratos</span>
            </span>
            <span className="text-[11px] text-slate-400">
              {criterioNueva === 'RECIENTES_14'
                ? 'Registradas en los últimos 14 días'
                : criterioNueva === 'SIN_ABONOS'
                ? 'Sin ningún abono registrado'
                : 'Filtro seleccionado'}
            </span>
          </div>
        </div>

        {/* KPI 2: MONTO COBRO PROYECTADO */}
        <div className="bg-gradient-to-br from-emerald-950/80 to-slate-900 border border-emerald-500/40 p-4 rounded-2xl space-y-2 shadow-lg">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-emerald-400 uppercase tracking-wider flex items-center gap-1.5">
              <DollarSign className="w-4 h-4 text-amber-300" />
              Cobro Semanal Proyectado
            </span>
            <span className="text-[10px] bg-emerald-900/60 text-emerald-200 font-bold px-2 py-0.5 rounded-full border border-emerald-700">
              Recaudación
            </span>
          </div>
          <div>
            <span className="text-2xl sm:text-3xl font-black text-emerald-400 font-mono block">
              ${totalMontoCobroProyectado.toLocaleString('es-MX')}{' '}
              <span className="text-xs font-normal text-slate-300">MXN /sem</span>
            </span>
            <span className="text-[11px] text-emerald-300/80">
              Suma de cuotas semanales a cobrar
            </span>
          </div>
        </div>

        {/* KPI 3: SALDO TOTAL EN CARTERA NUEVA */}
        <div className="bg-gradient-to-br from-indigo-950/80 to-slate-900 border border-indigo-500/40 p-4 rounded-2xl space-y-2 shadow-lg">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-indigo-300 uppercase tracking-wider flex items-center gap-1.5">
              <Wallet className="w-4 h-4 text-indigo-400" />
              Cartera Nueva (Saldo Deuda)
            </span>
            <span className="text-[10px] bg-indigo-900/60 text-indigo-200 font-bold px-2 py-0.5 rounded-full border border-indigo-700">
              Valor Total
            </span>
          </div>
          <div>
            <span className="text-2xl sm:text-3xl font-black text-indigo-300 font-mono block">
              ${totalSaldoCarteraNueva.toLocaleString('es-MX')}{' '}
              <span className="text-xs font-normal text-slate-300">MXN</span>
            </span>
            <span className="text-[11px] text-slate-400">
              Promedio: ${cuentasFiltradas.length > 0 ? Math.round(totalSaldoCarteraNueva / cuentasFiltradas.length).toLocaleString('es-MX') : 0} MXN /cuenta
            </span>
          </div>
        </div>

        {/* KPI 4: TARJETAS PENDIENTES DE IMPRESIÓN */}
        <div className="bg-gradient-to-br from-amber-950/80 to-slate-900 border border-amber-500/40 p-4 rounded-2xl space-y-2 shadow-lg">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-amber-300 uppercase tracking-wider flex items-center gap-1.5">
              <Printer className="w-4 h-4 text-amber-400" />
              Tarjetas Físicas Pendientes
            </span>
            <span className="text-[10px] bg-amber-900/60 text-amber-200 font-bold px-2 py-0.5 rounded-full border border-amber-700">
              Impresión
            </span>
          </div>
          <div>
            <span className="text-2xl sm:text-3xl font-black text-amber-300 font-mono block">
              {tarjetasPendientesCount} <span className="text-xs font-normal text-slate-400">por imprimir</span>
            </span>
            <span className="text-[11px] text-slate-400">
              {tarjetasPendientesCount === 0 ? '✅ Todas las tarjetas están impresas' : 'Requieren tarjeta física de abonos'}
            </span>
          </div>
        </div>
      </div>

      {/* TABS DE FILTRADO POR DÍA DE LA SEMANA PRÓXIMA */}
      <div className="bg-slate-950 p-3 sm:p-4 rounded-2xl border border-slate-800 space-y-3">
        <div className="flex items-center justify-between">
          <span className="text-xs font-bold text-slate-300 uppercase tracking-wider flex items-center gap-2">
            <Clock className="w-4 h-4 text-emerald-400" />
            <span>Programación de Cobro por Día de la Siguiente Semana:</span>
          </span>
          <span className="text-[11px] text-slate-400 font-mono hidden sm:inline">
            Selecciona un día para filtrar las cuentas
          </span>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-8 gap-2">
          {/* Tab Todos */}
          <button
            type="button"
            onClick={() => setDiaFiltro('TODOS')}
            className={`p-2.5 rounded-xl border text-left transition cursor-pointer flex flex-col justify-between ${
              diaFiltro === 'TODOS'
                ? 'bg-emerald-600 text-white border-emerald-400 shadow-md'
                : 'bg-slate-900 text-slate-300 border-slate-800 hover:border-slate-700 hover:bg-slate-800'
            }`}
          >
            <span className="text-[10px] uppercase font-bold text-emerald-200">Toda la sem.</span>
            <span className="text-sm font-black font-mono mt-1">
              {cuentasNuevasCalculadas.length} <span className="text-[10px] font-normal opacity-80">cta.</span>
            </span>
          </button>

          {/* Individual Day Tabs */}
          {DIAS_SEMANA.map((dia) => {
            const dataDia = conteoPorDia[dia];
            const isSelected = diaFiltro === dia;
            const fechaLabel = fechasPorDia[dia];

            return (
              <button
                key={dia}
                type="button"
                onClick={() => setDiaFiltro(dia)}
                className={`p-2.5 rounded-xl border text-left transition cursor-pointer flex flex-col justify-between ${
                  isSelected
                    ? 'bg-emerald-600 text-white border-emerald-400 shadow-md'
                    : dataDia.count > 0
                    ? 'bg-slate-900 text-slate-200 border-emerald-900/60 hover:bg-slate-800 hover:border-emerald-500/50'
                    : 'bg-slate-900/50 text-slate-500 border-slate-800/80 hover:bg-slate-900'
                }`}
              >
                <div className="flex items-center justify-between gap-1">
                  <span className="text-[11px] font-bold truncate">{dia}</span>
                  <span className="text-[9px] font-mono opacity-70">{fechaLabel}</span>
                </div>
                <div className="mt-1 flex items-baseline justify-between">
                  <span className="text-sm font-black font-mono">{dataDia.count}</span>
                  <span className="text-[10px] font-mono font-bold text-amber-300/90">
                    ${dataDia.monto}
                  </span>
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {/* CONTROLES DE BÚSQUEDA Y FILTROS SECUNDARIOS */}
      <div className="bg-slate-950 p-4 rounded-2xl border border-slate-800 space-y-3">
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-12 gap-3 items-center">
          {/* Search Box */}
          <div className="md:col-span-4 relative">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Buscar por cliente, folio CLI-..., colonia o producto..."
              className="w-full bg-slate-900 border border-slate-700 rounded-xl pl-9 pr-8 py-2 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-emerald-500"
            />
            {searchTerm && (
              <button
                onClick={() => setSearchTerm('')}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          {/* Criterio Cuentas Nuevas Filter */}
          <div className="md:col-span-3">
            <select
              value={criterioNueva}
              onChange={(e) => setCriterioNueva(e.target.value as any)}
              className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-xs text-slate-200 font-bold focus:outline-none focus:border-emerald-500"
            >
              <option value="RECIENTES_14">⏱️ Registradas últimos 14 días</option>
              <option value="SIN_ABONOS">⚡ Cero Abonos Registrados (Nuevas sin cobrar)</option>
              <option value="ESTE_MES">📅 Registradas en este mes</option>
              <option value="TODAS_ACTIVAS">📋 Todas las cuentas activas</option>
            </select>
          </div>

          {/* Zone Filter */}
          <div className="md:col-span-2">
            <select
              value={zonaFiltro}
              onChange={(e) => setZonaFiltro(e.target.value)}
              className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-xs text-slate-200 font-bold focus:outline-none focus:border-emerald-500"
            >
              <option value="TODAS">📍 Todas las Zonas</option>
              {zonas.map((z) => (
                <option key={z.id} value={z.nombre}>
                  {z.nombre}
                </option>
              ))}
            </select>
          </div>

          {/* Vendedora Filter */}
          <div className="md:col-span-3">
            <select
              value={vendedoraFiltro}
              onChange={(e) => setVendedoraFiltro(e.target.value)}
              className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-xs text-slate-200 font-bold focus:outline-none focus:border-emerald-500"
            >
              <option value="TODAS">👩‍💼 Todas las Vendedoras</option>
              {vendedorasList.map((v) => (
                <option key={v} value={v}>
                  {v}
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* LIST OF NEW ACCOUNTS (TABLE / CARDS) */}
      {cuentasFiltradas.length === 0 ? (
        <div className="bg-slate-950 border border-dashed border-slate-800 rounded-2xl p-8 text-center space-y-3">
          <AlertCircle className="w-10 h-10 text-slate-500 mx-auto" />
          <h4 className="text-base font-bold text-slate-300">No se encontraron cuentas nuevas con los filtros aplicados</h4>
          <p className="text-xs text-slate-500 max-w-md mx-auto">
            Prueba ajustando el día de cobro, seleccionando otro criterio de novedad o limpiando el texto de búsqueda.
          </p>
          <button
            onClick={() => {
              setDiaFiltro('TODOS');
              setZonaFiltro('TODAS');
              setVendedoraFiltro('TODAS');
              setCriterioNueva('RECIENTES_14');
              setSearchTerm('');
            }}
            className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 font-bold text-xs rounded-xl transition cursor-pointer"
          >
            Restablecer Filtros
          </button>
        </div>
      ) : (
        <div className="space-y-3">
          <div className="flex items-center justify-between text-xs text-slate-400 px-1">
            <span>Mostrando <strong className="text-white">{cuentasFiltradas.length}</strong> cuentas nuevas por cobrar</span>
            <span>Monto total cuotas: <strong className="text-emerald-400 font-mono">${totalMontoCobroProyectado.toLocaleString('es-MX')} MXN</strong></span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {cuentasFiltradas.map((cliente) => {
              const venta = ventas.find((v) => v.clienteId === cliente.id);
              const abonosCliente = abonos.filter((a) => a.clienteId === cliente.id);
              const diaCobro = (cliente.diaCobroZona || venta?.diaCobroZona || 'Lunes') as DiaSemana;
              const fechaEstimadaCobro = fechasPorDia[diaCobro] || '';
              const cuotaSemanal = venta?.pagoSemanal || 100;
              const saldoActual = venta?.saldoActual || 0;
              const productoNombre = venta?.productoNombre || 'Producto BITALIS';

              return (
                <div
                  key={cliente.id}
                  className="bg-slate-950 border border-slate-800 hover:border-emerald-500/60 p-4 rounded-2xl space-y-3 shadow-xl transition flex flex-col justify-between relative group"
                >
                  {/* Top Badge Row */}
                  <div className="flex items-start justify-between gap-2 border-b border-slate-900 pb-2.5">
                    <div className="space-y-0.5">
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-mono font-black bg-indigo-950 text-indigo-300 border border-indigo-700/80 uppercase mr-1.5">
                        {cliente.folio}
                      </span>
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-mono font-bold bg-slate-800 text-slate-300 border border-slate-700">
                        {cliente.zonaNombre || 'Zona General'}
                      </span>
                    </div>

                    <div className="flex items-center gap-1 shrink-0">
                      {abonosCliente.length === 0 ? (
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-950 text-amber-300 border border-amber-800">
                          Sin Abonos (Nueva)
                        </span>
                      ) : (
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-950 text-emerald-300 border border-emerald-800">
                          {abonosCliente.length} abono(s)
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Client Info */}
                  <div className="space-y-1">
                    <h3 className="text-sm font-black text-white group-hover:text-emerald-300 transition flex items-center justify-between">
                      <span>{cliente.nombreCompleto}</span>
                    </h3>
                    <p className="text-xs text-slate-400 flex items-center gap-1.5 line-clamp-1">
                      <MapPin className="w-3.5 h-3.5 text-indigo-400 shrink-0" />
                      <span>
                        {cliente.direccion} {cliente.colonia ? `• Col. ${cliente.colonia}` : ''}
                      </span>
                    </p>
                  </div>

                  {/* Financial Details Box */}
                  <div className="bg-slate-900 p-3 rounded-xl border border-slate-800/80 space-y-1.5 text-xs">
                    <div className="flex justify-between items-center text-slate-300">
                      <span className="flex items-center gap-1 font-semibold text-slate-400">
                        <Package className="w-3.5 h-3.5 text-indigo-400" />
                        {productoNombre}
                      </span>
                    </div>

                    <div className="grid grid-cols-2 gap-2 pt-1 border-t border-slate-800">
                      <div>
                        <span className="text-[10px] text-slate-400 block font-semibold uppercase">Cuota Semanal:</span>
                        <span className="text-sm font-black text-emerald-400 font-mono">
                          ${cuotaSemanal.toLocaleString('es-MX')} <span className="text-[10px] font-normal text-slate-400">/sem</span>
                        </span>
                      </div>
                      <div className="text-right">
                        <span className="text-[10px] text-slate-400 block font-semibold uppercase">Saldo Pendiente:</span>
                        <span className="text-sm font-black text-amber-300 font-mono">
                          ${saldoActual.toLocaleString('es-MX')} <span className="text-[10px] font-normal text-slate-400">MXN</span>
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Schedule & Salesperson info */}
                  <div className="space-y-1 text-[11px] text-slate-400 pt-1">
                    <div className="flex items-center justify-between">
                      <span className="flex items-center gap-1 text-slate-300 font-bold">
                        <Clock className="w-3.5 h-3.5 text-emerald-400" />
                        Día Cobro: <strong className="text-emerald-300">{diaCobro} ({fechaEstimadaCobro})</strong>
                      </span>
                    </div>
                    {cliente.vendedoraNombre && (
                      <div className="flex items-center justify-between text-slate-400 text-[10px]">
                        <span className="flex items-center gap-1">
                          <UserCheck className="w-3 h-3 text-purple-400" />
                          Vendedora: {cliente.vendedoraNombre}
                        </span>
                        <span>Alta: {cliente.fechaRegistro || 'Reciente'}</span>
                      </div>
                    )}
                  </div>

                  {/* Card status indicator */}
                  <div className="flex items-center justify-between text-[10px] pt-1 border-t border-slate-900">
                    <span className="text-slate-400">Tarjeta Física:</span>
                    {cliente.tarjetaImpresa ? (
                      <span className="text-emerald-400 font-bold flex items-center gap-1">
                        <Check className="w-3 h-3" /> Impresa
                      </span>
                    ) : (
                      <span className="text-amber-400 font-bold flex items-center gap-1">
                        ⚠️ Pendiente Impresión
                      </span>
                    )}
                  </div>

                  {/* Quick Action Buttons */}
                  <div className="grid grid-cols-2 gap-2 pt-2 border-t border-slate-800">
                    <button
                      type="button"
                      onClick={() => handleSendWhatsAppReminder(cliente)}
                      className="py-2 px-2 bg-slate-900 hover:bg-slate-800 text-emerald-400 hover:text-emerald-300 border border-emerald-800/80 rounded-xl text-xs font-bold transition flex items-center justify-center gap-1.5 cursor-pointer active:scale-95"
                    >
                      <MessageSquare className="w-3.5 h-3.5" />
                      <span>WhatsApp</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => handleOpenAbonoModal(cliente)}
                      className="py-2 px-2 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white rounded-xl text-xs font-black transition flex items-center justify-center gap-1.5 shadow cursor-pointer active:scale-95"
                    >
                      <DollarSign className="w-3.5 h-3.5 text-amber-300" />
                      <span>Cobrar Abono</span>
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* MODAL DE REGISTRO DE ABONO */}
      {clienteAbonoModal && (
        <div className="fixed inset-0 bg-slate-950/85 z-50 flex items-center justify-center p-3 sm:p-5 backdrop-blur-md animate-in fade-in">
          <div className="bg-slate-900 border border-emerald-500/40 w-full max-w-lg rounded-3xl p-5 sm:p-6 shadow-2xl space-y-4 relative">
            <div className="flex justify-between items-start border-b border-slate-800 pb-3">
              <div>
                <span className="text-[10px] font-bold text-emerald-400 uppercase tracking-wider font-mono block">
                  Cobro de Abono — Cuenta Nueva
                </span>
                <h3 className="text-lg sm:text-xl font-black text-white flex items-center gap-2">
                  <DollarSign className="w-5 h-5 text-emerald-400" />
                  <span>{clienteAbonoModal.nombreCompleto}</span>
                </h3>
                <p className="text-xs text-slate-400">
                  Folio: {clienteAbonoModal.folio} • {clienteAbonoModal.zonaNombre || 'Zona General'}
                </p>
              </div>
              <button
                onClick={() => setClienteAbonoModal(null)}
                className="p-1.5 bg-slate-800 text-slate-300 rounded-xl hover:bg-slate-700 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleConfirmAbono} className="space-y-4">
              <div className="space-y-1.5">
                <label className="block text-xs font-bold text-slate-200 uppercase tracking-wider">
                  Monto a Cobrar ($ MXN):
                </label>
                <div className="relative">
                  <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-2xl font-black text-emerald-400">$</span>
                  <input
                    type="number"
                    step="1"
                    min="1"
                    value={montoAbonoInput}
                    onChange={(e) => setMontoAbonoInput(e.target.value)}
                    className="w-full bg-slate-950 border-2 border-emerald-500/50 rounded-2xl pl-9 pr-4 py-3 text-2xl font-black text-white font-mono focus:outline-none focus:border-emerald-400"
                  />
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="block text-xs font-bold text-slate-200 uppercase tracking-wider">
                  Forma de Pago:
                </label>
                <div className="grid grid-cols-3 gap-2">
                  {[
                    { id: 'EFECTIVO', label: 'Efectivo' },
                    { id: 'TRANSFERENCIA', label: 'Transferencia' },
                    { id: 'MIXTO', label: 'Mixto' },
                  ].map((m) => (
                    <button
                      key={m.id}
                      type="button"
                      onClick={() => setTipoPagoInput(m.id as any)}
                      className={`py-2 px-2 rounded-xl text-xs font-bold transition border cursor-pointer ${
                        tipoPagoInput === m.id
                          ? 'bg-emerald-600 text-white border-emerald-400'
                          : 'bg-slate-950 text-slate-400 border-slate-800 hover:bg-slate-800'
                      }`}
                    >
                      {m.label}
                    </button>
                  ))}
                </div>
              </div>

              <div className="space-y-1">
                <label className="block text-xs font-bold text-slate-300">
                  Observaciones:
                </label>
                <input
                  type="text"
                  value={observacionesInput}
                  onChange={(e) => setObservacionesInput(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-700 rounded-xl p-2.5 text-xs text-white"
                />
              </div>

              <div className="bg-slate-950 p-3 rounded-xl border border-slate-800 flex items-center justify-between gap-3">
                <div
                  className="flex items-center gap-2 cursor-pointer"
                  onClick={() => setEnviarWaAbono(!enviarWaAbono)}
                >
                  <div
                    className={`w-5 h-5 rounded-md flex items-center justify-center border transition ${
                      enviarWaAbono ? 'bg-emerald-600 border-emerald-400 text-white' : 'border-slate-700 bg-slate-900'
                    }`}
                  >
                    {enviarWaAbono && <Check className="w-3.5 h-3.5" />}
                  </div>
                  <span className="text-xs font-bold text-slate-200">Enviar Recibo por WhatsApp</span>
                </div>
                <MessageSquare className="w-4 h-4 text-emerald-400 shrink-0" />
              </div>

              <div className="pt-2 flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setClienteAbonoModal(null)}
                  className="w-1/3 py-3 bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold rounded-2xl text-xs transition cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="w-2/3 py-3 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white font-black rounded-2xl text-xs shadow-xl transition flex items-center justify-center gap-2 cursor-pointer active:scale-95"
                >
                  <DollarSign className="w-4 h-4 text-amber-300" />
                  <span>Confirmar y Cobrar (${parseFloat(montoAbonoInput) || 0})</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* TOAST NOTIFICATION */}
      {toastMessage && (
        <div className="fixed bottom-6 right-6 z-50 bg-emerald-950 border-2 border-emerald-500 text-white px-5 py-3.5 rounded-2xl shadow-2xl font-bold text-xs flex items-center gap-3 animate-bounce">
          <CheckCircle2 className="w-5 h-5 text-emerald-400" />
          <span>{toastMessage}</span>
        </div>
      )}
    </div>
  );
}
