'use client';

import { useState, useMemo, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Cliente, Venta, Abono, Zona, LogAuditoria, Usuario } from '@/types';
import { getClienteEffectiveMorosidad } from '@/lib/dateUtils';
import AuditLogView from './AuditLogView';
import UbicacionCoordenadasModal from './UbicacionCoordenadasModal';
import HistorialAbonosTimeline from './HistorialAbonosTimeline';
import CarteraClientesMapView from './CarteraClientesMapView';
import CentroComunicacionModal from './CentroComunicacionModal';
import ConfirmationModal from './ConfirmationModal';
import ClienteDetailModal from './ClienteDetailModal';
import EditarNotaUrgenteModal from './EditarNotaUrgenteModal';

import {
  Users,
  Search,
  CheckCircle2,
  AlertCircle,
  FileText,
  DollarSign,
  Phone,
  MapPin,
  Calendar,
  Package,
  MessageSquare,
  ShieldAlert,
  Wallet,
  Edit2,
  Trash2,
  X,
  History,
  Map,
  List,
  Sparkles,
  TrendingUp,
  UserCheck,
  BadgeAlert,
  ChevronRight,
  Layers,
  ArrowUpRight,
  ShieldCheck,
  RefreshCw,
  PhoneCall,
  Send,
  SlidersHorizontal,
  Check,
  Pin,
} from 'lucide-react';

// Motion Stagger Variants
const containerVariants = {
  hidden: { opacity: 0 },
  show: {
    opacity: 1,
    transition: {
      staggerChildren: 0.04,
    },
  },
};

const itemVariants = {
  hidden: { opacity: 0, y: 12 },
  show: { opacity: 1, y: 0, transition: { duration: 0.22 } },
};

interface CarteraClientesViewProps {
  clientes: Cliente[];
  ventas: Venta[];
  abonos: Abono[];
  zonas: Zona[];
  auditLogs?: LogAuditoria[];
  currentUser?: Usuario | null;
  onAddAbono?: (nuevoAbono: Abono) => void;
  onUpdateCliente?: (cliente: Cliente) => void;
  onDeleteCliente?: (clienteId: number) => void;
}

// Subcomponente Tarjeta de Cliente con Rediseño Smart-Card y Gestos Táctiles
function SmartClientCard({
  cliente,
  venta,
  abonosCliente,
  onOpenDetail,
  onOpenTimeline,
  onOpenGeo,
  onOpenComunicacion,
  onOpenCobrar,
  onEdit,
  onDelete,
  onOpenNotaUrgente,
}: {
  cliente: Cliente;
  venta?: Venta;
  abonosCliente: Abono[];
  onOpenDetail: () => void;
  onOpenTimeline: () => void;
  onOpenGeo: () => void;
  onOpenComunicacion: () => void;
  onOpenCobrar: () => void;
  onEdit: () => void;
  onDelete: () => void;
  onOpenNotaUrgente?: () => void;
}) {
  const saldoActual = venta !== undefined ? venta.saldoActual : (cliente.deudaCalculada ?? 0);
  const esLiquidado = saldoActual === 0;

  const eff = getClienteEffectiveMorosidad(cliente, venta ? [venta] : []);
  const estadoMorosidadEfectivo = esLiquidado ? 'VERDE' : eff.estadoMorosidad;

  // Semáforo lateral dinámico & badges de estado
  let stripeBg = 'bg-emerald-500 shadow-[0_0_12px_rgba(16,185,129,0.8)]';
  let badgeMorosidadBg = 'bg-emerald-950/90 text-emerald-300 border-emerald-700/80';
  let badgeMorosidadLabel = 'Al Día';
  let statusBorder = 'border-slate-800 hover:border-emerald-500/50';

  if (esLiquidado) {
    stripeBg = 'bg-cyan-400 shadow-[0_0_12px_rgba(34,211,238,0.8)]';
    badgeMorosidadBg = 'bg-cyan-950/90 text-cyan-300 border-cyan-700/80';
    badgeMorosidadLabel = 'Liquidado $0';
    statusBorder = 'border-slate-800 hover:border-cyan-500/50';
  } else if (estadoMorosidadEfectivo === 'AMARILLO') {
    stripeBg = 'bg-amber-500 shadow-[0_0_12px_rgba(245,158,11,0.8)]';
    badgeMorosidadBg = 'bg-amber-950/90 text-amber-300 border-amber-700/80';
    badgeMorosidadLabel = `En Alerta (${eff.diasMora}d)`;
    statusBorder = 'border-slate-800 hover:border-amber-500/50';
  } else if (estadoMorosidadEfectivo === 'ROJO') {
    stripeBg = 'bg-rose-500 shadow-[0_0_14px_rgba(244,63,94,0.9)]';
    badgeMorosidadBg = 'bg-rose-950/90 text-rose-300 border-rose-700/80';
    badgeMorosidadLabel = `Moroso Crítico (${eff.diasMora}d)`;
    statusBorder = 'border-rose-900/50 hover:border-rose-500/60';
  }

  const initials = cliente.nombreCompleto
    ? cliente.nombreCompleto
        .split(' ')
        .filter(Boolean)
        .slice(0, 2)
        .map((n) => n[0])
        .join('')
        .toUpperCase()
    : 'CL';

  const phoneUrl = `tel:${cliente.telefono}`;
  const mensajeWa = `Hola *${cliente.nombreCompleto}*, le saludamos de la plataforma *BITALIS (Productos Naturistas)*.\nLe recordamos que su saldo actual en el contrato *${cliente.folio}* es de *$${saldoActual.toLocaleString('es-MX')} MXN*.\n¿Cuándo podemos pasar por su abono semanal? ¡Muchas gracias!`;
  const waUrl = `https://wa.me/52${cliente.telefono}?text=${encodeURIComponent(mensajeWa)}`;

  return (
    <div className={`relative overflow-hidden rounded-2xl bg-slate-900/90 border ${statusBorder} shadow-xl group transition-all duration-300 hover:shadow-2xl hover:bg-slate-900`}>
      {/* Indicador Lateral de Semáforo Táctil */}
      <div className={`absolute left-0 top-0 bottom-0 w-2.5 sm:w-3 rounded-l-2xl ${stripeBg} z-20`} />

      <div className="p-4 sm:p-5 pl-5 sm:pl-6 space-y-3.5">
        {/* Cabecera de la Tarjeta: Foto/Avatar, Nombre, Folio y Zona */}
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-3">
            {/* Foto de Fachada / Avatar */}
            <div
              onClick={onOpenDetail}
              className="relative w-12 h-12 sm:w-14 sm:h-14 rounded-2xl overflow-hidden border-2 border-indigo-500/40 bg-slate-950 flex items-center justify-center shrink-0 cursor-pointer shadow-md hover:scale-105 transition group-hover:border-indigo-400"
              title="Click para ver expediente completo"
            >
              {cliente.fotoFachada || cliente.fotoIdentificacion ? (
                <img
                  src={cliente.fotoFachada || cliente.fotoIdentificacion}
                  alt={cliente.nombreCompleto}
                  className="w-full h-full object-cover"
                />
              ) : (
                <span className="font-black text-indigo-300 text-sm sm:text-base tracking-wider">{initials}</span>
              )}
              {esLiquidado && (
                <div className="absolute inset-0 bg-cyan-950/60 backdrop-blur-[1px] flex items-center justify-center">
                  <CheckCircle2 className="w-6 h-6 text-cyan-300" />
                </div>
              )}
            </div>

            {/* Información Principal del Cliente */}
            <div onClick={onOpenDetail} className="cursor-pointer space-y-0.5">
              <h3 className="font-black text-white text-base sm:text-lg leading-snug hover:text-indigo-300 transition line-clamp-1">
                {cliente.nombreCompleto}
              </h3>
              <p className="text-xs text-slate-300 flex items-center gap-1">
                <MapPin className="w-3.5 h-3.5 text-indigo-400 shrink-0" />
                <span className="line-clamp-1">
                  {cliente.direccion} {cliente.colonia ? `• Col. ${cliente.colonia}` : ''}
                </span>
              </p>
            </div>
          </div>

          {/* Badges de Folio y Zona */}
          <div className="flex flex-col items-end gap-1 shrink-0">
            <span className="px-2.5 py-0.5 rounded-lg text-[10px] font-mono font-black bg-slate-950 text-amber-300 border border-amber-500/30 shadow-sm">
              {cliente.folio}
            </span>
            <span className="text-[10px] font-bold text-slate-300 bg-slate-950/90 px-2 py-0.5 rounded-md border border-slate-800">
              {cliente.zonaNombre}
            </span>
          </div>
        </div>

        {/* NOTA URGENTE VISUAL BANNER */}
        {cliente.notaUrgente ? (
          <div className="p-2.5 bg-gradient-to-r from-amber-950/90 via-rose-950/80 to-amber-950/90 border-2 border-amber-500 rounded-xl shadow-lg flex items-center justify-between gap-2 animate-pulse">
            <div className="flex items-center gap-2 min-w-0">
              <span className="w-6 h-6 rounded-lg bg-amber-500 text-slate-950 flex items-center justify-center font-black text-xs shrink-0 shadow">
                📌
              </span>
              <div className="min-w-0">
                <span className="text-[9px] font-black text-amber-400 uppercase tracking-wider block">
                  NOTA URGENTE VISUAL
                </span>
                <p className="text-xs font-bold text-white truncate">
                  {cliente.notaUrgente}
                </p>
              </div>
            </div>
            {onOpenNotaUrgente && (
              <button
                type="button"
                onClick={onOpenNotaUrgente}
                className="px-2.5 py-1 bg-amber-500/30 hover:bg-amber-500 text-amber-200 hover:text-slate-950 rounded-lg text-[10px] font-black border border-amber-400/50 transition cursor-pointer shrink-0"
              >
                ✏️ Editar
              </button>
            )}
          </div>
        ) : (
          onOpenNotaUrgente && (
            <div className="flex justify-end">
              <button
                type="button"
                onClick={onOpenNotaUrgente}
                className="text-[10px] font-bold text-slate-400 hover:text-amber-300 flex items-center gap-1 cursor-pointer py-1 px-2.5 rounded-lg bg-slate-950 border border-slate-800 hover:border-amber-500/50 transition"
              >
                📌 + Nota Urgente
              </button>
            </div>
          )
        )}

        {/* PRÓXIMO PAGO AGENDADO BADGE & PLAN DE PAGOS */}
        {(cliente.proximoPagoFecha || (cliente as any).frecuenciaPago) && (
          <div className="px-3 py-2 bg-indigo-950/80 border border-indigo-500/50 rounded-xl text-xs font-bold text-indigo-200 flex flex-wrap items-center justify-between gap-2 shadow-sm">
            <div className="flex items-center gap-2">
              <Calendar className="w-4 h-4 text-amber-400 shrink-0" />
              <span>Próximo cobro: <strong className="text-amber-300 font-mono">{cliente.proximoPagoFecha || 'Por agendar'}</strong></span>
            </div>
            <div className="flex items-center gap-1.5">
              {(cliente as any).frecuenciaPago && (
                <span className="px-2 py-0.5 rounded bg-indigo-900/90 text-indigo-300 font-mono text-[10px] uppercase font-black border border-indigo-700/60">
                  Plan {(cliente as any).frecuenciaPago}
                </span>
              )}
              {cliente.proximoPagoFecha && cliente.proximoPagoFecha > new Date().toISOString().split('T')[0] && (
                <span className="px-2 py-0.5 rounded bg-amber-950/90 text-amber-300 text-[10px] font-bold border border-amber-800">
                  🔒 Oculta en Cobros Hoy
                </span>
              )}
            </div>
          </div>
        )}

        {/* Bloque Financiero Prominente (Protagonista UX) */}
        <div
          onClick={onOpenDetail}
          className="bg-slate-950/90 border border-slate-800 hover:border-indigo-500/50 rounded-xl p-3 sm:p-3.5 shadow-inner flex flex-wrap items-center justify-between gap-3 cursor-pointer transition"
        >
          <div>
            <span className="text-[10px] font-extrabold uppercase text-slate-400 tracking-wider block">
              SALDO PENDIENTE (DEBE):
            </span>
            <div className="flex items-baseline gap-2 mt-0.5">
              <span className={`text-2xl sm:text-3xl font-black font-mono tracking-tight ${esLiquidado ? 'text-cyan-300' : 'text-amber-300'}`}>
                ${saldoActual.toLocaleString('es-MX')} <span className="text-xs font-bold text-slate-400">MXN</span>
              </span>
              {esLiquidado && (
                <span className="text-[10px] font-black text-cyan-300 bg-cyan-950 px-2 py-0.5 rounded border border-cyan-800">
                  LIQUIDADO ✓
                </span>
              )}
            </div>
          </div>

          <div className="text-right">
            <span className="text-[10px] font-bold text-indigo-300 uppercase block">
              Cuota Semanal:
            </span>
            <span className="text-lg font-black text-indigo-200 font-mono">
              ${venta?.pagoSemanal || 100} /sem
            </span>
          </div>

          {/* Detalle del Producto & Badges de Estado */}
          <div className="w-full pt-1 border-t border-slate-900 flex flex-wrap items-center justify-between gap-1.5 text-xs">
            <div className="flex items-center gap-1.5 text-slate-300">
              <Package className="w-3.5 h-3.5 text-indigo-400" />
              <span className="font-semibold text-white">{venta?.productoNombre || 'Producto Naturista BITALIS'}</span>
            </div>

            <span className={`px-2 py-0.5 rounded text-[10px] font-extrabold border ${badgeMorosidadBg}`}>
              {badgeMorosidadLabel}
            </span>
          </div>
        </div>

        {/* Botones de Acción Inferiores Rápida (Touch Optimized Bar) */}
        <div className="flex flex-wrap items-center justify-between pt-1 gap-2 border-t border-slate-800/80">
          <button
            onClick={onOpenDetail}
            className="text-xs font-extrabold text-indigo-400 hover:text-indigo-300 flex items-center gap-1 cursor-pointer transition"
          >
            <FileText className="w-3.5 h-3.5 text-indigo-400" />
            <span>Expediente Completo</span>
            <ChevronRight className="w-3.5 h-3.5" />
          </button>

          <div className="flex items-center gap-1.5 ml-auto">
            {/* Direct Phone Call */}
            <a
              href={phoneUrl}
              className="p-2.5 bg-slate-800 hover:bg-emerald-600 text-slate-200 hover:text-white rounded-xl transition cursor-pointer shadow"
              title={`Llamar a ${cliente.telefono}`}
            >
              <Phone className="w-4 h-4" />
            </a>

            {/* Direct WhatsApp Link */}
            <a
              href={waUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="px-3 py-2 bg-emerald-600/90 hover:bg-emerald-500 text-white rounded-xl text-xs font-bold flex items-center gap-1.5 shadow transition cursor-pointer"
              title="Mandar recordatorio por WhatsApp"
            >
              <MessageSquare className="w-3.5 h-3.5" />
              <span className="hidden xs:inline">WhatsApp</span>
            </a>

            {/* Direct Timeline */}
            <button
              onClick={onOpenTimeline}
              className="p-2.5 bg-slate-800 hover:bg-amber-600 text-slate-200 hover:text-white rounded-xl transition cursor-pointer shadow"
              title="Ver Historial de Abonos"
            >
              <History className="w-4 h-4" />
            </button>

            {/* Direct GPS */}
            <button
              onClick={onOpenGeo}
              className="p-2.5 bg-slate-800 hover:bg-cyan-600 text-slate-200 hover:text-white rounded-xl transition cursor-pointer shadow"
              title="Ubicación GPS"
            >
              <MapPin className="w-4 h-4" />
            </button>

            {/* Direct Cobrar Button */}
            <button
              onClick={onOpenCobrar}
              className="px-3.5 py-2 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white rounded-xl text-xs font-black flex items-center gap-1.5 shadow-md transition cursor-pointer active:scale-95"
            >
              <DollarSign className="w-4 h-4 text-amber-300" />
              <span>Cobrar</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// Subcomponente Formulario de Registro de Abono / Cobrar
function FormularioCobrarAbonoModal({
  cliente,
  venta,
  abonosCliente,
  currentUser,
  onClose,
  onSaveAbono,
}: {
  cliente: Cliente;
  venta?: Venta;
  abonosCliente: Abono[];
  currentUser?: Usuario | null;
  onClose: () => void;
  onSaveAbono: (nuevoAbono: Abono) => void;
}) {
  const saldoActual = venta ? venta.saldoActual : 0;
  const cuotaSemanal = venta?.pagoSemanal || 100;
  const productoNombre = venta?.productoNombre || 'Producto Naturista BITALIS';

  const [montoInput, setMontoInput] = useState<string>(
    String(cuotaSemanal > 0 && cuotaSemanal <= saldoActual ? cuotaSemanal : saldoActual > 0 ? saldoActual : 100)
  );
  const [tipoPago, setTipoPago] = useState<'EFECTIVO' | 'TRANSFERENCIA' | 'MIXTO'>('EFECTIVO');
  const [observaciones, setObservaciones] = useState<string>('Abono registrado desde Cartera de Clientes');
  const [enviarWa, setEnviarWa] = useState<boolean>(true);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const montoNum = parseFloat(montoInput) || 0;
  const nuevoSaldoEstimado = Math.max(0, saldoActual - montoNum);
  const esLiquidadoTotal = nuevoSaldoEstimado === 0 && saldoActual > 0;

  const handleMontoChipClick = (amount: number) => {
    setMontoInput(String(amount));
    setErrorMsg(null);
  };

  const handleSubmitAbono = (e: React.FormEvent) => {
    e.preventDefault();
    if (montoNum <= 0) {
      setErrorMsg('El monto del abono debe ser mayor a $0 MXN.');
      return;
    }

    if (montoNum > saldoActual && saldoActual > 0) {
      const confirmExceso = window.confirm(
        `El monto ingresado ($${montoNum.toLocaleString('es-MX')} MXN) supera el saldo actual del cliente ($${saldoActual.toLocaleString('es-MX')} MXN).\n\n¿Desea registrar el abono por este valor?`
      );
      if (!confirmExceso) return;
    }

    const fechaHoy = new Date().toISOString().split('T')[0];
    const nuevoAbono: Abono = {
      id: Date.now(),
      ventaId: venta ? venta.id : 0,
      clienteId: cliente.id,
      clienteNombre: cliente.nombreCompleto,
      clienteFolio: cliente.folio,
      cobradorId: currentUser?.id || 1,
      cobradorNombre: currentUser?.nombre || 'Administrador / Cobrador',
      monto: montoNum,
      tipoPago,
      semanaNumero: abonosCliente.length + 1,
      observaciones: observaciones.trim() || 'Abono cobrado en Cartera',
      fechaPago: fechaHoy,
      latitudCobro: cliente.latitud || 0,
      longitudCobro: cliente.longitud || 0,
      waEnviado: enviarWa,
    };

    // Save abono
    onSaveAbono(nuevoAbono);

    // If enviarWa is true, launch WhatsApp receipt
    if (enviarWa && cliente.telefono) {
      const mensajeRecibo = `*RECIBO OFICIAL DE ABONO — BITALIS (Productos Naturistas)* 🍃\n\nEstimado/a *${cliente.nombreCompleto}*,\nConfirmamos la recepción de su abono con éxito.\n\n📄 *Contrato/Folio:* ${cliente.folio}\n📦 *Producto:* ${productoNombre}\n💰 *Monto Abonado:* $${montoNum.toLocaleString('es-MX')} MXN (${tipoPago})\n💳 *Saldo Anterior:* $${saldoActual.toLocaleString('es-MX')} MXN\n✅ *Nuevo Saldo Pendiente:* $${nuevoSaldoEstimado.toLocaleString('es-MX')} MXN\n🗓️ *Fecha:* ${new Date().toLocaleDateString('es-MX')}\n\n${esLiquidadoTotal ? '🎉 ¡FELICIDADES! SU CUENTA HA QUEDADO COMPLETAMENTE LIQUIDADA. ¡Gracias por su preferencia!\n\n' : ''}¡Agradecemos su puntualidad y confianza!`;

      const waUrl = `https://wa.me/52${cliente.telefono}?text=${encodeURIComponent(mensajeRecibo)}`;
      window.open(waUrl, '_blank');
    }

    onClose();
  };

  return (
    <div className="fixed inset-0 bg-slate-950/85 z-50 flex items-center justify-center p-3 sm:p-5 backdrop-blur-md animate-in fade-in">
      <div className="bg-slate-900 border border-emerald-500/40 w-full max-w-lg rounded-3xl p-5 sm:p-6 shadow-2xl space-y-4 max-h-[92vh] overflow-y-auto relative">
        {/* Header */}
        <div className="flex justify-between items-start border-b border-slate-800 pb-3.5">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <span className="px-2.5 py-0.5 rounded-full text-[10px] font-mono font-black bg-emerald-950 text-emerald-300 border border-emerald-700/80 uppercase">
                Formulario de Abonos
              </span>
              <span className="px-2.5 py-0.5 rounded-full text-[10px] font-mono font-black bg-amber-950 text-amber-300 border border-amber-700/80">
                {cliente.folio}
              </span>
            </div>
            <h3 className="text-lg sm:text-xl font-black text-white flex items-center gap-2">
              <DollarSign className="w-5 h-5 text-emerald-400" />
              <span>Cobrar a {cliente.nombreCompleto}</span>
            </h3>
            <p className="text-xs text-slate-400 flex items-center gap-1">
              <MapPin className="w-3.5 h-3.5 text-indigo-400" />
              <span>{cliente.direccion} {cliente.colonia ? `• Col. ${cliente.colonia}` : ''} ({cliente.zonaNombre})</span>
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-2 bg-slate-800 text-slate-300 rounded-xl cursor-pointer hover:bg-slate-700 hover:text-white transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Resumen del Contrato / Deuda */}
        <div className="bg-slate-950 rounded-2xl p-3.5 border border-slate-800 grid grid-cols-2 gap-3 text-xs">
          <div>
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Saldo Pendiente Debe:</span>
            <span className="text-xl font-black text-amber-300 font-mono">
              ${saldoActual.toLocaleString('es-MX')} <span className="text-[10px] font-normal text-slate-400">MXN</span>
            </span>
          </div>
          <div className="text-right">
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Cuota Semanal:</span>
            <span className="text-xl font-black text-indigo-300 font-mono">
              ${cuotaSemanal.toLocaleString('es-MX')} <span className="text-[10px] font-normal text-slate-400">/sem</span>
            </span>
          </div>
          <div className="col-span-2 pt-2 border-t border-slate-900 flex justify-between items-center text-slate-300 text-[11px]">
            <span className="flex items-center gap-1"><Package className="w-3.5 h-3.5 text-indigo-400"/> {productoNombre}</span>
            <span className="font-mono font-bold text-emerald-400">{abonosCliente.length} abonos cobrados</span>
          </div>
        </div>

        <form onSubmit={handleSubmitAbono} className="space-y-4">
          {/* Monto Input & Chips */}
          <div className="space-y-2">
            <label className="block text-xs font-bold text-slate-200 uppercase tracking-wider">
              Monto a Cobrar ($ MXN): *
            </label>
            <div className="relative">
              <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-2xl font-black text-emerald-400">$</span>
              <input
                type="number"
                step="1"
                min="1"
                value={montoInput}
                onChange={(e) => {
                  setMontoInput(e.target.value);
                  setErrorMsg(null);
                }}
                placeholder="0.00"
                className="w-full bg-slate-950 border-2 border-emerald-500/50 rounded-2xl pl-9 pr-4 py-3 text-2xl font-black text-white font-mono focus:outline-none focus:border-emerald-400 shadow-inner"
              />
            </div>

            {/* Quick Chips for Standard Amounts */}
            <div className="flex flex-wrap items-center gap-1.5 pt-1">
              <span className="text-[10px] text-slate-400 font-bold uppercase mr-1">Rápidos:</span>
              {cuotaSemanal > 0 && (
                <button
                  type="button"
                  onClick={() => handleMontoChipClick(cuotaSemanal)}
                  className="px-2.5 py-1 bg-indigo-950 hover:bg-indigo-900 border border-indigo-700/80 text-indigo-200 rounded-lg text-xs font-bold transition cursor-pointer"
                >
                  ${cuotaSemanal} (Semanal)
                </button>
              )}
              {cuotaSemanal * 2 <= (saldoActual || 10000) && (
                <button
                  type="button"
                  onClick={() => handleMontoChipClick(cuotaSemanal * 2)}
                  className="px-2.5 py-1 bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-200 rounded-lg text-xs font-bold transition cursor-pointer"
                >
                  ${cuotaSemanal * 2} (Doble)
                </button>
              )}
              {saldoActual > 0 && (
                <button
                  type="button"
                  onClick={() => handleMontoChipClick(saldoActual)}
                  className="px-2.5 py-1 bg-cyan-950 hover:bg-cyan-900 border border-cyan-700/80 text-cyan-200 rounded-lg text-xs font-bold transition cursor-pointer"
                >
                  ${saldoActual.toLocaleString('es-MX')} (Liquidar)
                </button>
              )}
            </div>
          </div>

          {/* Impact Preview Banner */}
          <div className="bg-slate-950/80 border border-slate-800 rounded-xl p-3 flex items-center justify-between text-xs">
            <span className="text-slate-400">Nuevo Saldo tras este abono:</span>
            <span className={`font-mono font-black text-sm ${nuevoSaldoEstimado === 0 ? 'text-cyan-400' : 'text-amber-300'}`}>
              ${nuevoSaldoEstimado.toLocaleString('es-MX')} MXN
            </span>
          </div>

          {/* Forma de Pago */}
          <div className="space-y-1.5">
            <label className="block text-xs font-bold text-slate-200 uppercase tracking-wider">
              Forma de Pago:
            </label>
            <div className="grid grid-cols-3 gap-2">
              {[
                { id: 'EFECTIVO', label: 'Efectivo', icon: Wallet },
                { id: 'TRANSFERENCIA', label: 'Transferencia', icon: RefreshCw },
                { id: 'MIXTO', label: 'Mixto', icon: Layers },
              ].map((method) => {
                const Icon = method.icon;
                const isSelected = tipoPago === method.id;
                return (
                  <button
                    key={method.id}
                    type="button"
                    onClick={() => setTipoPago(method.id as any)}
                    className={`py-2.5 px-2 rounded-xl text-xs font-bold transition flex flex-col items-center justify-center gap-1 cursor-pointer border ${
                      isSelected
                        ? 'bg-emerald-600 text-white border-emerald-400 shadow-md'
                        : 'bg-slate-950 text-slate-400 hover:bg-slate-800 border-slate-800'
                    }`}
                  >
                    <Icon className="w-4 h-4" />
                    <span>{method.label}</span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Observaciones */}
          <div className="space-y-1">
            <label className="block text-xs font-bold text-slate-300">
              Observaciones / Nota de Cobro:
            </label>
            <input
              type="text"
              value={observaciones}
              onChange={(e) => setObservaciones(e.target.value)}
              placeholder="Ej. Entregó dinero completo en efectivo..."
              className="w-full bg-slate-950 border border-slate-700 rounded-xl p-2.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500"
            />
          </div>

          {/* Checkbox WhatsApp Ticket */}
          <div className="bg-slate-950 p-3 rounded-xl border border-slate-800 flex items-center justify-between gap-3">
            <div className="flex items-center gap-2 cursor-pointer" onClick={() => setEnviarWa(!enviarWa)}>
              <div className={`w-5 h-5 rounded-md flex items-center justify-center border transition ${enviarWa ? 'bg-emerald-600 border-emerald-400 text-white' : 'border-slate-700 bg-slate-900'}`}>
                {enviarWa && <Check className="w-3.5 h-3.5" />}
              </div>
              <span className="text-xs font-bold text-slate-200">Enviar Recibo por WhatsApp</span>
            </div>
            <MessageSquare className="w-4 h-4 text-emerald-400 shrink-0" />
          </div>

          {errorMsg && (
            <div className="bg-rose-950/80 border border-rose-800 text-rose-200 text-xs p-2.5 rounded-xl font-semibold flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0 text-rose-400" />
              <span>{errorMsg}</span>
            </div>
          )}

          {/* Submit Button */}
          <div className="pt-2 flex items-center gap-2">
            <button
              type="button"
              onClick={onClose}
              className="w-1/3 py-3 bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold rounded-2xl text-xs transition cursor-pointer"
            >
              Cancelar
            </button>
            <button
              type="submit"
              className="w-2/3 py-3 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white font-black rounded-2xl text-xs shadow-xl transition flex items-center justify-center gap-2 cursor-pointer active:scale-95"
            >
              <DollarSign className="w-4 h-4 text-amber-300" />
              <span>Confirmar y Cobrar (${montoNum.toLocaleString('es-MX')})</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default function CarteraClientesView({
  clientes,
  ventas,
  abonos,
  zonas,
  auditLogs = [],
  currentUser,
  onAddAbono,
  onUpdateCliente,
  onDeleteCliente,
}: CarteraClientesViewProps) {
  // Main View Mode
  const [activeView, setActiveView] = useState<'cartera' | 'liquidados' | 'auditoria'>('cartera');

  // Search & Filter state
  const [carteraDisplayMode, setCarteraDisplayMode] = useState<'lista' | 'mapa'>('lista');
  const [searchTerm, setSearchTerm] = useState<string>('');
  const [selectedZonaId, setSelectedZonaId] = useState<string>('TODAS');
  const [selectedEstadoPago, setSelectedEstadoPago] = useState<'TODOS' | 'PENDIENTE' | 'LIQUIDADO'>('TODOS');
  const [filterChip, setFilterChip] = useState<'TODOS' | 'CON_NOTA' | 'ACTIVOS' | 'ROJO' | 'AMARILLO' | 'VERDE' | 'LIQUIDADOS' | 'ZONA_HOY'>('TODOS');
  const [clienteForNotaModal, setClienteForNotaModal] = useState<Cliente | null>(null);
  const [isNotaModalOpen, setIsNotaModalOpen] = useState<boolean>(false);

  // Pagination for heavy lists
  const [visibleCount, setVisibleCount] = useState<number>(12);

  // Modals state
  const [editingCliente, setEditingCliente] = useState<Partial<Cliente> | null>(null);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [geoClienteModal, setGeoClienteModal] = useState<Cliente | null>(null);
  const [comunicacionCliente, setComunicacionCliente] = useState<Cliente | null>(null);
  const [timelineModalCliente, setTimelineModalCliente] = useState<Cliente | null>(null);
  const [detailModalCliente, setDetailModalCliente] = useState<Cliente | null>(null);
  const [cobroClienteModal, setCobroClienteModal] = useState<Cliente | null>(null);
  const [toastNotice, setToastNotice] = useState<string | null>(null);

  // Destructive Delete Confirmation Modal State
  const [deleteConfirmCliente, setDeleteConfirmCliente] = useState<{
    id: number;
    nombre: string;
    folio: string;
  } | null>(null);

  // Day of week calculation for active zone indicator
  const daysMap = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado'];
  const todayDayName = daysMap[new Date().getDay()];

  const zonasHoy = useMemo(() => {
    return zonas.filter((z) => z.diaCobro && z.diaCobro.toLowerCase().includes(todayDayName.toLowerCase()));
  }, [zonas, todayDayName]);

  // Reset pagination when filter criteria change
  useEffect(() => {
    setVisibleCount(12);
  }, [searchTerm, selectedZonaId, selectedEstadoPago, filterChip]);

  // Filter logic memoized
  const clientesFiltrados = useMemo(() => {
    return clientes.filter((cliente) => {
      // Search text (predictive instant matching)
      const term = searchTerm.trim().toLowerCase();
      const matchesSearch =
        !term ||
        cliente.nombreCompleto.toLowerCase().includes(term) ||
        cliente.folio.toLowerCase().includes(term) ||
        cliente.direccion.toLowerCase().includes(term) ||
        (cliente.colonia && cliente.colonia.toLowerCase().includes(term)) ||
        (cliente.vendedoraNombre && cliente.vendedoraNombre.toLowerCase().includes(term));

      // Zona filter
      const matchesZona = selectedZonaId === 'TODAS' || cliente.zonaId === Number(selectedZonaId);

      // Estado Deuda filter
      const ventasCliente = ventas.filter((v) => v.clienteId === cliente.id);
      const totalSaldoVentas = ventasCliente.reduce((sum, v) => sum + (v.saldoActual ?? 0), 0);
      const saldoActual = ventasCliente.length > 0
        ? totalSaldoVentas
        : (cliente.deudaCalculada !== undefined ? cliente.deudaCalculada : 0);
      const esLiquidado = saldoActual <= 0;

      const eff = getClienteEffectiveMorosidad(cliente, ventas);
      const estadoMorosidadEfectivo = esLiquidado ? 'VERDE' : eff.estadoMorosidad;

      let matchesEstado = true;
      if (selectedEstadoPago === 'PENDIENTE') matchesEstado = !esLiquidado;
      if (selectedEstadoPago === 'LIQUIDADO') matchesEstado = esLiquidado;

      // Filter Chips Bar
      let matchesChip = true;
      if (filterChip === 'ACTIVOS') {
        matchesChip = !esLiquidado;
      } else if (filterChip === 'ZONA_HOY') {
        const zonaIdsHoy = zonasHoy.map((z) => z.id);
        matchesChip = zonaIdsHoy.length > 0 ? zonaIdsHoy.includes(cliente.zonaId) : true;
      } else if (filterChip === 'CON_NOTA') {
        matchesChip = Boolean(cliente.notaUrgente && cliente.notaUrgente.trim().length > 0);
      } else if (filterChip === 'VERDE') {
        matchesChip = estadoMorosidadEfectivo === 'VERDE' && !esLiquidado;
      } else if (filterChip === 'AMARILLO') {
        matchesChip = estadoMorosidadEfectivo === 'AMARILLO' && !esLiquidado;
      } else if (filterChip === 'ROJO') {
        matchesChip = estadoMorosidadEfectivo === 'ROJO' && !esLiquidado;
      } else if (filterChip === 'LIQUIDADOS') {
        matchesChip = esLiquidado;
      }

      return matchesSearch && matchesZona && matchesEstado && matchesChip;
    });
  }, [clientes, searchTerm, selectedZonaId, selectedEstadoPago, filterChip, zonasHoy, ventas]);

  // Calculate portfolio metrics for Bento Grid Header
  const totalCarteraClientes = clientes.length;

  const clientesConSaldo = useMemo(() => {
    return clientes.filter((c) => {
      const v = ventas.find((venta) => venta.clienteId === c.id);
      return v && v.saldoActual > 0;
    }).length;
  }, [clientes, ventas]);

  const clientesConNota = useMemo(() => {
    return clientes.filter((c) => Boolean(c.notaUrgente && c.notaUrgente.trim())).length;
  }, [clientes]);

  const clientesLiquidados = totalCarteraClientes - clientesConSaldo;

  const totalSaldoPendiente = useMemo(() => {
    return ventas.reduce((sum, v) => sum + (v.saldoActual || 0), 0);
  }, [ventas]);

  const totalAbonosRecuperados = useMemo(() => {
    return abonos.reduce((sum, a) => sum + (a.monto || 0), 0);
  }, [abonos]);

  const porcentajeRecuperacion = useMemo(() => {
    const totalInicial = totalSaldoPendiente + totalAbonosRecuperados;
    if (totalInicial === 0) return 0;
    return Math.round((totalAbonosRecuperados / totalInicial) * 100);
  }, [totalSaldoPendiente, totalAbonosRecuperados]);

  // Form Submit handler for Editing Client
  const handleSaveClienteSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingCliente?.id || !editingCliente?.nombreCompleto) return;

    const targetZona = zonas.find((z) => z.id === Number(editingCliente.zonaId));
    const updatedCliente: Cliente = {
      ...(editingCliente as Cliente),
      zonaNombre: targetZona ? targetZona.nombre : editingCliente.zonaNombre || 'Zona General',
    };

    if (onUpdateCliente) onUpdateCliente(updatedCliente);
    setIsEditModalOpen(false);
    setEditingCliente(null);
    alert(`¡Expediente del cliente "${updatedCliente.nombreCompleto}" actualizado con éxito!`);
  };

  return (
    <div className="space-y-6">
      {/* 1. TOP VIEW TOGGLE BAR */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-800 pb-3">
        <div className="flex items-center gap-2">
          <button
            onClick={() => setActiveView('cartera')}
            className={`px-4 py-2 rounded-xl text-xs font-black transition flex items-center gap-2 cursor-pointer ${
              activeView === 'cartera'
                ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-600/30'
                : 'bg-slate-900 text-slate-400 hover:bg-slate-800 hover:text-white'
            }`}
          >
            <Users className="w-4 h-4" />
            <span>Cartera General ({clientesConSaldo} Activas)</span>
          </button>

          <button
            onClick={() => setActiveView('liquidados')}
            className={`px-4 py-2 rounded-xl text-xs font-black transition flex items-center gap-2 cursor-pointer ${
              activeView === 'liquidados'
                ? 'bg-cyan-600 text-white shadow-lg shadow-cyan-600/30'
                : 'bg-slate-900 text-slate-400 hover:bg-slate-800 hover:text-white'
            }`}
          >
            <CheckCircle2 className="w-4 h-4 text-cyan-300" />
            <span>Cuentas Liquidadas ({clientesLiquidados})</span>
          </button>
        </div>

        {/* View Mode Switcher: Lista vs Mapa */}
        {activeView === 'cartera' && (
          <div className="bg-slate-950 border border-slate-800 rounded-xl p-1 flex items-center gap-1">
            <button
              type="button"
              onClick={() => setCarteraDisplayMode('lista')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition flex items-center gap-1.5 cursor-pointer ${
                carteraDisplayMode === 'lista'
                  ? 'bg-indigo-600 text-white shadow'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              <List className="w-3.5 h-3.5" />
              <span>Lista Smart</span>
            </button>

            <button
              type="button"
              onClick={() => setCarteraDisplayMode('mapa')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition flex items-center gap-1.5 cursor-pointer ${
                carteraDisplayMode === 'mapa'
                  ? 'bg-indigo-600 text-white shadow'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              <Map className="w-3.5 h-3.5 text-amber-300" />
              <span>Mapa GPS</span>
            </button>
          </div>
        )}
      </div>

      {activeView === 'liquidados' ? (
        /* VISTA APARTADO DE CUENTAS LIQUIDADAS */
        <div className="space-y-6">
          <div className="bg-gradient-to-r from-cyan-950 via-slate-900 to-indigo-950 border-2 border-cyan-500/40 rounded-2xl p-6 shadow-2xl space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-4">
              <div>
                <div className="flex items-center gap-2 text-cyan-400 font-mono text-xs font-bold uppercase tracking-wider mb-1">
                  <CheckCircle2 className="w-4 h-4 text-cyan-400" />
                  <span>Finiquitos BITALIS • 100% CUMPLIDOS</span>
                </div>
                <h3 className="text-xl sm:text-2xl font-black text-white flex items-center gap-2">
                  <span>Apartado de Cuentas Liquidadas</span>
                </h3>
                <p className="text-xs text-slate-300 mt-1">
                  Clientes que han pagado la totalidad de sus contratos ($0.00 MXN adeudo). Listos para renovación de crédito preferencial.
                </p>
              </div>

              <div className="flex items-center gap-3">
                <div className="bg-slate-900/90 border border-cyan-500/40 p-3 rounded-2xl text-center">
                  <span className="text-[10px] text-slate-400 block font-bold">Total Liquidados</span>
                  <span className="text-2xl font-black text-cyan-400">{clientesLiquidados}</span>
                </div>
                <div className="bg-slate-900/90 border border-emerald-500/40 p-3 rounded-2xl text-center">
                  <span className="text-[10px] text-slate-400 block font-bold">Saldo Restante</span>
                  <span className="text-2xl font-black text-emerald-400">$0.00 MXN</span>
                </div>
              </div>
            </div>

            {/* List of Liquidated Clients */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2">
              {clientes
                .filter((c) => {
                  const v = ventas.find((venta) => venta.clienteId === c.id);
                  return v && v.saldoActual === 0;
                })
                .map((cliente) => {
                  const venta = ventas.find((v) => v.clienteId === cliente.id)!;
                  const abonosCliente = abonos.filter((a) => a.clienteId === cliente.id);
                  const totalPagado = abonosCliente.reduce((sum, a) => sum + a.monto, 0);

                  const mensajeWaFiniquito = `*CARTA FINIQUITO BITALIS (Productos Naturistas)*\n\nEstimado/a *${cliente.nombreCompleto}*,\n\nQueremos felicitarle por completar exitosamente la liquidación total de su crédito *${cliente.folio}* (${venta.productoNombre}).\n\n*Monto Total Liquidado:* $${totalPagado.toLocaleString('es-MX')} MXN\n*Saldo Pendiente:* $0 MXN\n*Estatus:* CUMPLIDO Y LIQUIDADO ✅\n\n¡Gracias por su preferencia! Cuenta con crédito preferencial abierto para renovar cuando guste.`;
                  const waUrl = `https://wa.me/52${cliente.telefono}?text=${encodeURIComponent(mensajeWaFiniquito)}`;

                  return (
                    <div
                      key={cliente.id}
                      className="bg-slate-900/90 border border-cyan-500/40 rounded-2xl p-4 shadow-xl flex flex-col justify-between space-y-3"
                    >
                      <div className="flex justify-between items-start">
                        <div>
                          <span className="px-2 py-0.5 rounded text-[10px] font-mono font-black bg-cyan-950 text-cyan-300 border border-cyan-700">
                            FOLIO: {cliente.folio}
                          </span>
                          <h4 className="font-black text-white text-base mt-1">{cliente.nombreCompleto}</h4>
                          <p className="text-xs text-slate-300">{cliente.direccion} ({cliente.colonia || 'S/C'})</p>
                          <p className="text-xs text-slate-400 mt-1">Zona: {cliente.zonaNombre}</p>
                        </div>
                        <div className="text-right shrink-0">
                          <span className="px-2.5 py-1 rounded-full text-xs font-black bg-cyan-600 text-white shadow inline-flex items-center gap-1">
                            <CheckCircle2 className="w-3.5 h-3.5" /> LIQUIDADO
                          </span>
                          <span className="block text-xs font-bold text-slate-300 mt-1">
                            Total Pagado: ${totalPagado.toLocaleString('es-MX')} MXN
                          </span>
                        </div>
                      </div>

                      <div className="bg-slate-950 p-2.5 rounded-xl border border-slate-800 text-xs text-slate-300 space-y-1 font-mono">
                        <div className="flex justify-between">
                          <span className="text-slate-400 font-sans">Producto:</span>
                          <span className="font-bold text-white">{venta.productoNombre}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-slate-400 font-sans">Fecha Contrato:</span>
                          <span className="text-slate-300">{venta.fechaVenta}</span>
                        </div>
                        <div className="flex justify-between text-cyan-300 font-bold">
                          <span className="font-sans">Saldo Actual:</span>
                          <span>$0.00 MXN</span>
                        </div>
                      </div>

                      <div className="flex items-center gap-2 pt-1">
                        <a
                          href={waUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="flex-1 min-h-[38px] bg-emerald-600 hover:bg-emerald-500 text-white font-bold py-2 px-3 rounded-xl text-xs transition flex items-center justify-center gap-1.5 cursor-pointer shadow"
                        >
                          <MessageSquare className="w-4 h-4" />
                          <span>Carta Finiquito (WA)</span>
                        </a>

                        <button
                          onClick={() => setDetailModalCliente(cliente)}
                          className="min-h-[38px] bg-slate-800 hover:bg-slate-700 text-indigo-300 font-bold py-2 px-3 rounded-xl text-xs border border-slate-700 transition flex items-center justify-center gap-1 cursor-pointer"
                        >
                          <FileText className="w-4 h-4" />
                          <span>Expediente</span>
                        </button>
                      </div>
                    </div>
                  );
                })}

              {clientes.filter((c) => {
                const v = ventas.find((venta) => venta.clienteId === c.id);
                return v && v.saldoActual === 0;
              }).length === 0 && (
                <div className="col-span-full p-8 text-center text-slate-400 text-sm bg-slate-900 rounded-2xl border border-slate-800">
                  Aún no hay cuentas liquidadas archivadas en el sistema.
                </div>
              )}
            </div>
          </div>
        </div>
      ) : (
        /* VISTA PRINCIPAL CARTERA GENERAL */
        <div className="space-y-6">
          {/* 1. HEADER FINANCIERO Y MÉTRICAS (BENTO GRID FIJO FIABLE) */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3.5">
            {/* Card 1: Saldo Total por Cobrar (Protagonista Financiero) */}
            <div className="bg-gradient-to-br from-slate-900 via-indigo-950/60 to-slate-900 border border-indigo-500/40 rounded-2xl p-4 sm:p-5 shadow-xl relative overflow-hidden flex flex-col justify-between">
              <div className="absolute top-0 right-0 w-24 h-24 bg-indigo-500/10 rounded-full blur-2xl pointer-events-none" />
              <div className="flex items-center justify-between border-b border-indigo-500/20 pb-2.5">
                <span className="text-[11px] font-mono font-bold uppercase tracking-wider text-indigo-300 flex items-center gap-1.5">
                  <Wallet className="w-4 h-4 text-indigo-400" />
                  Saldo Total Por Cobrar
                </span>
                <span className="text-[10px] bg-indigo-950 text-indigo-300 border border-indigo-800 px-2 py-0.5 rounded-full font-bold">
                  Sincronizado
                </span>
              </div>
              <div className="mt-3">
                <div className="text-2xl sm:text-3xl font-black font-mono text-white tracking-tight">
                  ${totalSaldoPendiente.toLocaleString('es-MX')}{' '}
                  <span className="text-xs font-bold text-indigo-300">MXN</span>
                </div>
                <p className="text-[11px] text-slate-400 mt-1 flex items-center gap-1">
                  <TrendingUp className="w-3.5 h-3.5 text-indigo-400" />
                  <span>Capital activo circulante en calle</span>
                </p>
              </div>
            </div>

            {/* Card 2: Total Cartera Activa */}
            <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 sm:p-5 shadow-xl flex flex-col justify-between">
              <div className="flex items-center justify-between border-b border-slate-800 pb-2.5">
                <span className="text-[11px] font-mono font-bold uppercase tracking-wider text-amber-400 flex items-center gap-1.5">
                  <Users className="w-4 h-4 text-amber-400" />
                  Cartera Activa
                </span>
                <span className="text-[10px] bg-amber-950 text-amber-300 border border-amber-800 px-2 py-0.5 rounded-full font-bold">
                  {clientesConSaldo} de {totalCarteraClientes}
                </span>
              </div>
              <div className="mt-3">
                <div className="text-2xl sm:text-3xl font-black font-mono text-amber-300 tracking-tight">
                  {clientesConSaldo}{' '}
                  <span className="text-xs font-bold text-slate-400">Clientes</span>
                </div>
                <p className="text-[11px] text-slate-400 mt-1">
                  Cuentas activas con cuotas semanales vigentes
                </p>
              </div>
            </div>

            {/* Card 3: Total Recuperado en Abonos */}
            <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 sm:p-5 shadow-xl flex flex-col justify-between">
              <div className="flex items-center justify-between border-b border-slate-800 pb-2.5">
                <span className="text-[11px] font-mono font-bold uppercase tracking-wider text-emerald-400 flex items-center gap-1.5">
                  <DollarSign className="w-4 h-4 text-emerald-400" />
                  Total Recuperado
                </span>
                <span className="text-[10px] bg-emerald-950 text-emerald-300 border border-emerald-800 px-2 py-0.5 rounded-full font-bold">
                  {porcentajeRecuperacion}% Eficiencia
                </span>
              </div>
              <div className="mt-3">
                <div className="text-2xl sm:text-3xl font-black font-mono text-emerald-400 tracking-tight">
                  ${totalAbonosRecuperados.toLocaleString('es-MX')}{' '}
                  <span className="text-xs font-bold text-slate-400">MXN</span>
                </div>
                <p className="text-[11px] text-slate-400 mt-1">
                  Acumulado histórico de pagos en abonos
                </p>
              </div>
            </div>

            {/* Card 4: Cuentas Liquidadas ($0 Adeudo) */}
            <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 sm:p-5 shadow-xl flex flex-col justify-between">
              <div className="flex items-center justify-between border-b border-slate-800 pb-2.5">
                <span className="text-[11px] font-mono font-bold uppercase tracking-wider text-cyan-400 flex items-center gap-1.5">
                  <CheckCircle2 className="w-4 h-4 text-cyan-400" />
                  Cuentas Liquidadas
                </span>
                <span className="text-[10px] bg-cyan-950 text-cyan-300 border border-cyan-800 px-2 py-0.5 rounded-full font-bold">
                  Finiquitados
                </span>
              </div>
              <div className="mt-3">
                <div className="text-2xl sm:text-3xl font-black font-mono text-cyan-300 tracking-tight">
                  {clientesLiquidados}{' '}
                  <span className="text-xs font-bold text-slate-400">Cumplidos</span>
                </div>
                <p className="text-[11px] text-slate-400 mt-1">
                  Clientes en $0 saldo con derecho a re-crédito
                </p>
              </div>
            </div>
          </div>

          {/* DISPLAY MODE SWITCHER PAGE */}
          {carteraDisplayMode === 'mapa' ? (
            <CarteraClientesMapView
              clientes={clientesFiltrados}
              ventas={ventas}
              abonos={abonos}
              zonas={zonas}
              selectedZonaId={selectedZonaId}
              onSelectZonaId={setSelectedZonaId}
              onOpenGeoModal={(c) => setGeoClienteModal(c)}
            />
          ) : (
            <>
              {/* 2. BARRA DE HERRAMIENTAS Y FILTROS "CHIP-TOUCH" OPTIMIZADOS */}
              <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 shadow-xl space-y-3.5">
                {/* Search Bar & Zone Selector Grid */}
                <div className="grid grid-cols-1 md:grid-cols-12 gap-3 items-center">
                  {/* Predictable Instant Search Box */}
                  <div className="md:col-span-7 relative">
                    <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                    <input
                      type="text"
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                      placeholder="Buscar cliente por nombre, folio (ej. BIT-41419), calle, colonia..."
                      className="w-full bg-slate-950 border border-slate-700/80 rounded-xl pl-10 pr-9 py-2.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500 shadow-inner"
                    />
                    {searchTerm && (
                      <button
                        type="button"
                        onClick={() => setSearchTerm('')}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    )}
                  </div>

                  {/* Compact Zone Selector */}
                  <div className="md:col-span-5">
                    <select
                      value={selectedZonaId}
                      onChange={(e) => setSelectedZonaId(e.target.value)}
                      className="w-full bg-slate-950 border border-slate-700/80 rounded-xl px-3 py-2.5 text-xs text-white font-bold focus:outline-none focus:border-indigo-500 cursor-pointer shadow-inner"
                    >
                      <option value="TODAS">📍 Todas las Zonas ({zonas.length})</option>
                      {zonas.map((z) => (
                        <option key={z.id} value={z.id}>
                          {z.nombre} (Cobro: {z.diaCobro})
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                {/* HORIZONTAL CHIP-TOUCH BAR (Botones Táctiles de Una sola Línea) */}
                <div className="flex items-center gap-2 overflow-x-auto pt-1 pb-1 scrollbar-none">
                  {[
                    { id: 'TODOS', label: `Todos (${clientes.length})`, icon: Users, color: 'indigo' },
                    { id: 'CON_NOTA', label: `📌 Con Nota (${clientesConNota})`, icon: Pin, color: 'amber' },
                    { id: 'ACTIVOS', label: `Cartera Activa (${clientesConSaldo})`, icon: Wallet, color: 'amber' },
                    { id: 'ROJO', label: 'Morosos Críticos', icon: BadgeAlert, color: 'rose' },
                    { id: 'AMARILLO', label: 'En Alerta', icon: AlertCircle, color: 'yellow' },
                    { id: 'VERDE', label: 'Al Día', icon: CheckCircle2, color: 'emerald' },
                    { id: 'LIQUIDADOS', label: `Liquidados (${clientesLiquidados})`, icon: ShieldCheck, color: 'cyan' },
                    { id: 'ZONA_HOY', label: `Zona de Hoy (${todayDayName})`, icon: Calendar, color: 'purple' },
                  ].map((chip) => {
                    const isSelected = filterChip === chip.id;
                    const Icon = chip.icon;

                    let activeClass = 'bg-indigo-600 text-white shadow-indigo-600/30';
                    if (chip.color === 'amber') activeClass = 'bg-amber-600 text-white shadow-amber-600/30';
                    if (chip.color === 'rose') activeClass = 'bg-rose-600 text-white shadow-rose-600/30';
                    if (chip.color === 'yellow') activeClass = 'bg-amber-500 text-slate-950 font-black shadow-amber-500/30';
                    if (chip.color === 'emerald') activeClass = 'bg-emerald-600 text-white shadow-emerald-600/30';
                    if (chip.color === 'cyan') activeClass = 'bg-cyan-600 text-white shadow-cyan-600/30';
                    if (chip.color === 'purple') activeClass = 'bg-purple-600 text-white shadow-purple-600/30';

                    return (
                      <button
                        key={chip.id}
                        type="button"
                        onClick={() => setFilterChip(chip.id as any)}
                        className={`px-3.5 py-2 rounded-xl text-xs font-bold transition whitespace-nowrap cursor-pointer flex items-center gap-1.5 shadow-sm active:scale-95 ${
                          isSelected
                            ? `${activeClass} shadow-md`
                            : 'bg-slate-950 text-slate-300 hover:bg-slate-800 border border-slate-800'
                        }`}
                      >
                        <Icon className="w-3.5 h-3.5 shrink-0" />
                        <span>{chip.label}</span>
                      </button>
                    );
                  })}
                </div>

                {/* Sub-Indicator Banner for Active Route Today */}
                <div className="bg-slate-950 border border-slate-800 rounded-xl p-2.5 px-3.5 flex items-center justify-between text-xs text-slate-300">
                  <div className="flex items-center gap-2">
                    <Calendar className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                    <span>
                      <strong>Ruta Activa del Día ({todayDayName}):</strong>{' '}
                      {zonasHoy.length > 0 ? zonasHoy.map((z) => z.nombre).join(', ') : 'Cobranza General de Cartera'}
                    </span>
                  </div>
                  <span className="text-[10px] font-mono text-emerald-400 bg-emerald-950/80 px-2 py-0.5 rounded border border-emerald-800/80 shrink-0 font-bold">
                    {clientesFiltrados.length} Clientes mostrados
                  </span>
                </div>
              </div>

              {/* 3. TARJETAS DE CLIENTE REDISEÑADAS (SMART-CARDS) */}
              {clientesFiltrados.length === 0 ? (
                <div className="bg-slate-900 border border-slate-800 rounded-2xl p-12 text-center text-slate-400 text-sm shadow-xl space-y-2">
                  <Users className="w-10 h-10 text-slate-600 mx-auto" />
                  <p className="font-bold text-slate-300 text-base">No se encontraron clientes</p>
                  <p className="text-xs text-slate-500">
                    Ningún registro coincide con el término de búsqueda "{searchTerm}" o el filtro seleccionado.
                  </p>
                </div>
              ) : (
                <div className="space-y-4">
                  <motion.div
                    key={`stagger-list-${searchTerm}-${selectedZonaId}-${filterChip}`}
                    variants={containerVariants}
                    initial="hidden"
                    animate="show"
                    className="grid grid-cols-1 md:grid-cols-2 gap-4"
                  >
                    {clientesFiltrados.slice(0, visibleCount).map((cliente) => {
                      const venta = ventas.find((v) => v.clienteId === cliente.id);
                      const abonosCliente = abonos.filter((a) => a.clienteId === cliente.id);

                      return (
                        <motion.div key={cliente.id} variants={itemVariants}>
                          <SmartClientCard
                            cliente={cliente}
                            venta={venta}
                            abonosCliente={abonosCliente}
                            onOpenDetail={() => setDetailModalCliente(cliente)}
                            onOpenTimeline={() => setTimelineModalCliente(cliente)}
                            onOpenGeo={() => setGeoClienteModal(cliente)}
                            onOpenComunicacion={() => setComunicacionCliente(cliente)}
                            onOpenCobrar={() => setCobroClienteModal(cliente)}
                            onOpenNotaUrgente={() => {
                              setClienteForNotaModal(cliente);
                              setIsNotaModalOpen(true);
                            }}
                            onEdit={() => {
                              setEditingCliente(cliente);
                              setIsEditModalOpen(true);
                            }}
                            onDelete={() => {
                              setDeleteConfirmCliente({
                                id: cliente.id,
                                nombre: cliente.nombreCompleto,
                                folio: cliente.folio,
                              });
                            }}
                          />
                        </motion.div>
                      );
                    })}
                  </motion.div>

                  {/* Infinite Batch Pagination Control */}
                  {clientesFiltrados.length > visibleCount && (
                    <div className="text-center pt-3 pb-2">
                      <button
                        type="button"
                        onClick={() => setVisibleCount((prev) => prev + 12)}
                        className="px-6 py-3 bg-slate-900 hover:bg-indigo-600 text-slate-200 hover:text-white font-extrabold text-xs rounded-xl border border-slate-800 hover:border-indigo-500 transition shadow-lg flex items-center gap-2 mx-auto cursor-pointer"
                      >
                        <span>Cargar más clientes ({clientesFiltrados.length - visibleCount} restantes)</span>
                        <ChevronRight className="w-4 h-4" />
                      </button>
                    </div>
                  )}
                </div>
              )}
            </>
          )}
        </div>
      )}

      {/* EDIT CLIENT MODAL */}
      {isEditModalOpen && editingCliente && (
        <div className="fixed inset-0 bg-slate-950/80 z-50 flex items-center justify-center p-4 backdrop-blur-sm animate-in fade-in">
          <form
            onSubmit={handleSaveClienteSubmit}
            className="bg-slate-900 border border-slate-700 w-full max-w-lg rounded-2xl p-6 shadow-2xl space-y-4 max-h-[90vh] overflow-y-auto"
          >
            <div className="flex justify-between items-center border-b border-slate-800 pb-3">
              <h3 className="font-bold text-white text-base flex items-center gap-2">
                <Edit2 className="w-5 h-5 text-indigo-400" />
                Editar Expediente de Cliente ({editingCliente.folio})
              </h3>
              <button
                type="button"
                onClick={() => {
                  setIsEditModalOpen(false);
                  setEditingCliente(null);
                }}
                className="p-1 bg-slate-800 text-slate-300 rounded-lg cursor-pointer hover:bg-slate-700"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-3 text-xs">
              <div>
                <label className="block text-slate-300 font-semibold mb-1">Nombre Completo *</label>
                <input
                  type="text"
                  required
                  value={editingCliente.nombreCompleto || ''}
                  onChange={(e) => setEditingCliente({ ...editingCliente, nombreCompleto: e.target.value })}
                  className="w-full bg-slate-950 border border-slate-700 rounded-xl p-2.5 text-white"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-300 font-semibold mb-1">Folio de Contrato *</label>
                  <input
                    type="text"
                    required
                    value={editingCliente.folio || ''}
                    onChange={(e) => setEditingCliente({ ...editingCliente, folio: e.target.value })}
                    className="w-full bg-slate-950 border border-slate-700 rounded-xl p-2.5 text-white font-mono"
                  />
                </div>

                <div>
                  <label className="block text-slate-300 font-semibold mb-1">Teléfono *</label>
                  <input
                    type="text"
                    required
                    value={editingCliente.telefono || ''}
                    onChange={(e) => setEditingCliente({ ...editingCliente, telefono: e.target.value })}
                    className="w-full bg-slate-950 border border-slate-700 rounded-xl p-2.5 text-white"
                  />
                </div>
              </div>

              <div>
                <label className="block text-slate-300 font-semibold mb-1">Dirección (Calle y Número) *</label>
                <input
                  type="text"
                  required
                  value={editingCliente.direccion || ''}
                  onChange={(e) => setEditingCliente({ ...editingCliente, direccion: e.target.value })}
                  className="w-full bg-slate-950 border border-slate-700 rounded-xl p-2.5 text-white"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-300 font-semibold mb-1">Colonia *</label>
                  <input
                    type="text"
                    required
                    value={editingCliente.colonia || ''}
                    onChange={(e) => setEditingCliente({ ...editingCliente, colonia: e.target.value })}
                    className="w-full bg-slate-950 border border-slate-700 rounded-xl p-2.5 text-white"
                  />
                </div>

                <div>
                  <label className="block text-slate-300 font-semibold mb-1">Zona Asignada</label>
                  <select
                    value={editingCliente.zonaId || zonas[0]?.id || 1}
                    onChange={(e) => {
                      const targetZ = zonas.find((z) => z.id === Number(e.target.value));
                      setEditingCliente({
                        ...editingCliente,
                        zonaId: Number(e.target.value),
                        zonaNombre: targetZ ? targetZ.nombre : editingCliente.zonaNombre,
                      });
                    }}
                    className="w-full bg-slate-950 border border-slate-700 rounded-xl p-2.5 text-white font-bold"
                  >
                    {zonas.map((z) => (
                      <option key={z.id} value={z.id}>
                        {z.nombre} ({z.diaCobro})
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-slate-300 font-semibold mb-1">Referencias del Domicilio</label>
                <textarea
                  rows={2}
                  value={editingCliente.referencias || ''}
                  onChange={(e) => setEditingCliente({ ...editingCliente, referencias: e.target.value })}
                  className="w-full bg-slate-950 border border-slate-700 rounded-xl p-2.5 text-white"
                />
              </div>
            </div>

            <button
              type="submit"
              className="w-full bg-indigo-600 hover:bg-indigo-500 text-white font-bold py-3 rounded-xl text-xs cursor-pointer shadow-lg transition mt-3"
            >
              Guardar Cambios de Cliente
            </button>
          </form>
        </div>
      )}

      {geoClienteModal && (
        <UbicacionCoordenadasModal
          cliente={geoClienteModal}
          onSave={(c) => {
            if (onUpdateCliente) {
              onUpdateCliente(c);
              alert(`¡Coordenadas GPS de ${c.nombreCompleto} guardadas!`);
            }
          }}
          onClose={() => setGeoClienteModal(null)}
        />
      )}

      {comunicacionCliente && (
        <CentroComunicacionModal
          cliente={comunicacionCliente}
          venta={ventas.find((v) => v.clienteId === comunicacionCliente.id)}
          usuarioNombre={currentUser?.nombre || 'Supervisor BITALIS'}
          onClose={() => setComunicacionCliente(null)}
        />
      )}

      {/* CONFIRMATION MODAL FOR CLIENT DELETION */}
      <ConfirmationModal
        isOpen={deleteConfirmCliente !== null}
        title="Eliminar Cliente de Cartera"
        description={
          <>
            ¿Estás seguro de eliminar permanentemente al cliente{' '}
            <strong className="text-white font-bold">{deleteConfirmCliente?.nombre}</strong> (Folio: {deleteConfirmCliente?.folio})? Esta acción eliminará su expediente activo de la cartera.
          </>
        }
        confirmText="Eliminar Cliente"
        cancelText="Cancelar"
        variant="danger"
        onConfirm={() => {
          if (deleteConfirmCliente && onDeleteCliente) {
            onDeleteCliente(deleteConfirmCliente.id);
          }
          setDeleteConfirmCliente(null);
        }}
        onClose={() => setDeleteConfirmCliente(null)}
      />

      {/* FULL PAYMENT HISTORY MODAL WITH ANIMATED TIMELINE */}
      {timelineModalCliente && (
        <div className="fixed inset-0 bg-slate-950/85 z-50 flex items-center justify-center p-3 sm:p-5 backdrop-blur-md animate-fadeIn">
          <div className="bg-slate-900 border border-slate-700 w-full max-w-4xl rounded-3xl p-5 sm:p-6 shadow-2xl space-y-4 max-h-[92vh] overflow-y-auto">
            <div className="flex justify-between items-center border-b border-slate-800 pb-4">
              <div className="space-y-0.5">
                <span className="text-[10px] font-mono font-extrabold text-amber-400 bg-amber-950 px-2 py-0.5 rounded border border-amber-800/80 uppercase tracking-widest">
                  Historial de Pagos BITALIS
                </span>
                <h3 className="text-lg font-bold text-white flex items-center gap-2">
                  <History className="w-5 h-5 text-amber-400" />
                  Línea de Tiempo de Abonos — {timelineModalCliente.nombreCompleto}
                </h3>
                <p className="text-xs text-slate-400">
                  Folio: <strong className="font-mono text-indigo-300">{timelineModalCliente.folio}</strong> • Zona:{' '}
                  <strong className="text-slate-300">{timelineModalCliente.zonaNombre}</strong>
                </p>
              </div>
              <button
                type="button"
                onClick={() => setTimelineModalCliente(null)}
                className="p-2 bg-slate-800 text-slate-300 rounded-xl cursor-pointer hover:bg-slate-700 hover:text-white transition"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <HistorialAbonosTimeline
              cliente={timelineModalCliente}
              venta={ventas.find((v) => v.clienteId === timelineModalCliente.id)}
              abonos={abonos.filter((a) => a.clienteId === timelineModalCliente.id)}
            />
          </div>
        </div>
      )}

      {/* CLIENTE DETAIL EXPEDIENTE MODAL */}
      <ClienteDetailModal
        cliente={detailModalCliente}
        ventas={ventas}
        abonos={abonos}
        isOpen={!!detailModalCliente}
        onClose={() => setDetailModalCliente(null)}
        currentUser={currentUser}
        onUpdateCliente={onUpdateCliente}
      />

      {/* FORMULARIO DE COBRO DE ABONOS MODAL */}
      {cobroClienteModal && (
        <FormularioCobrarAbonoModal
          cliente={cobroClienteModal}
          venta={ventas.find((v) => v.clienteId === cobroClienteModal.id)}
          abonosCliente={abonos.filter((a) => a.clienteId === cobroClienteModal.id)}
          currentUser={currentUser}
          onClose={() => setCobroClienteModal(null)}
          onSaveAbono={(nuevoAbono) => {
            if (onAddAbono) {
              onAddAbono(nuevoAbono);
            }
            setToastNotice(`💰 ¡Abono de $${nuevoAbono.monto.toLocaleString('es-MX')} MXN cobrado y registrado a ${cobroClienteModal.nombreCompleto}!`);
            setTimeout(() => setToastNotice(null), 3500);
          }}
        />
      )}

      {/* TOAST NOTIFICATION DE COBRO EXITOSO */}
      {toastNotice && (
        <div className="fixed bottom-6 right-6 z-50 bg-emerald-950 border-2 border-emerald-500 text-white px-5 py-3.5 rounded-2xl shadow-2xl font-bold text-xs flex items-center gap-3 animate-bounce">
          <CheckCircle2 className="w-5 h-5 text-emerald-400" />
          <span>{toastNotice}</span>
        </div>
      )}

      {/* EDITAR NOTA URGENTE MODAL */}
      <EditarNotaUrgenteModal
        cliente={clienteForNotaModal}
        isOpen={isNotaModalOpen}
        onClose={() => {
          setIsNotaModalOpen(false);
          setClienteForNotaModal(null);
        }}
        onSaveNota={(clienteId, notaText) => {
          const target = clientes.find((c) => c.id === clienteId);
          if (target && onUpdateCliente) {
            onUpdateCliente({
              ...target,
              notaUrgente: notaText,
              fechaNotaUrgente: new Date().toISOString(),
            });
            setToastNotice(notaText ? '📌 ¡Nota urgente guardada!' : '📌 Nota urgente eliminada.');
            setTimeout(() => setToastNotice(null), 3000);
          }
        }}
      />
    </div>
  );
}
