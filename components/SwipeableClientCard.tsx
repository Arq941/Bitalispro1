'use client';

import React, { useState, useRef } from 'react';
import { motion } from 'motion/react';
import {
  DollarSign,
  MessageSquare,
  Phone,
  MapPin,
  MoreVertical,
  Calendar,
  History,
  Navigation,
  PlusCircle,
  Compass,
  ArrowRight,
  Home,
  User,
  FileText,
  Eye,
  Zap,
  Clock,
  Pin
} from 'lucide-react';
import { triggerHaptic } from '@/lib/utils';
import { Cliente, Venta } from '@/types';

export type ClientCardViewRole = 'cobrador' | 'vendedora' | 'cartera' | 'admin';

interface SwipeableClientCardProps {
  cliente: Cliente;
  venta?: Venta;
  isMorosoRojo?: boolean;
  viewRole?: ClientCardViewRole;
  onPayAbono: (cliente: Cliente) => void;
  onSendMessage: (cliente: Cliente) => void;
  onCallPhone?: (telefono: string) => void;
  onAddOtraVenta?: (cliente: Cliente) => void;
  onOpenDetail?: (cliente: Cliente) => void;
  onReagendar?: (cliente: Cliente) => void;
  onEditUbicacion?: (cliente: Cliente) => void;
  onViewPhoto?: (photoUrl: string, title: string) => void;
  onEditNotaUrgente?: (cliente: Cliente) => void;
}

export default function SwipeableClientCard({
  cliente,
  venta,
  isMorosoRojo = false,
  viewRole = 'cobrador',
  onPayAbono,
  onSendMessage,
  onCallPhone,
  onAddOtraVenta,
  onOpenDetail,
  onReagendar,
  onEditUbicacion,
  onViewPhoto,
  onEditNotaUrgente,
}: SwipeableClientCardProps) {
  const [dragOffset, setDragOffset] = useState<number>(0);
  const [isSwiping, setIsSwiping] = useState<boolean>(false);
  const [showSecondaryMenu, setShowSecondaryMenu] = useState<boolean>(false);
  const touchStartX = useRef<number | null>(null);

  // Active Photo Selection (Fachada vs Cliente vs Contrato)
  const getInitialPhotoType = (): 'fachada' | 'cliente' | 'contrato' => {
    if (viewRole === 'cobrador') {
      if (cliente.fotoFachada) return 'fachada';
      if (cliente.fotoCliente) return 'cliente';
      if (cliente.fotoContrato) return 'contrato';
      return 'fachada';
    } else {
      if (cliente.fotoCliente) return 'cliente';
      if (cliente.fotoFachada) return 'fachada';
      if (cliente.fotoContrato) return 'contrato';
      return 'cliente';
    }
  };

  const [activePhotoType, setActivePhotoType] = useState<'fachada' | 'cliente' | 'contrato'>(getInitialPhotoType);
  const [prevClienteId, setPrevClienteId] = useState<number>(cliente.id);

  if (cliente.id !== prevClienteId) {
    setPrevClienteId(cliente.id);
    setActivePhotoType(getInitialPhotoType());
  }

  const saldoActual = venta ? venta.saldoActual : 0;
  const esLiquidado = saldoActual === 0;

  // Determine current active photo URL and title
  const getPhotoDetails = () => {
    switch (activePhotoType) {
      case 'fachada':
        return {
          url: cliente.fotoFachada || cliente.fotoCliente,
          title: `Fachada del Domicilio - ${cliente.nombreCompleto}`,
          label: 'Fachada',
          hasPhoto: Boolean(cliente.fotoFachada),
        };
      case 'cliente':
        return {
          url: cliente.fotoCliente || cliente.fotoFachada,
          title: `Fotografía de Cliente - ${cliente.nombreCompleto}`,
          label: 'Cliente',
          hasPhoto: Boolean(cliente.fotoCliente),
        };
      case 'contrato':
        return {
          url: cliente.fotoContrato,
          title: `Fotografía de Contrato/Pagaré - ${cliente.nombreCompleto}`,
          label: 'Contrato',
          hasPhoto: Boolean(cliente.fotoContrato),
        };
      default:
        return {
          url: cliente.fotoFachada || cliente.fotoCliente,
          title: `Fotografía - ${cliente.nombreCompleto}`,
          label: 'Foto',
          hasPhoto: Boolean(cliente.fotoFachada || cliente.fotoCliente),
        };
    }
  };

  const activePhoto = getPhotoDetails();

  // Color code border on left edge & semáforo status + dynamic glow shadow
  let borderLeftColor = 'border-l-amber-500 shadow-[inset_6px_0_14px_-4px_rgba(245,158,11,0.35)]';
  let chipStatusBg = 'bg-amber-600/90 text-white border-amber-400';
  let statusChipText = `DEBE $${saldoActual.toLocaleString('es-MX')}`;

  if (esLiquidado) {
    borderLeftColor = 'border-l-emerald-500 shadow-[inset_6px_0_14px_-4px_rgba(16,185,129,0.35)]';
    chipStatusBg = 'bg-emerald-600 text-white border-emerald-400';
    statusChipText = '✓ LIQUIDADO';
  } else if (cliente.estadoMorosidad === 'VERDE') {
    borderLeftColor = 'border-l-emerald-500 shadow-[inset_6px_0_14px_-4px_rgba(16,185,129,0.35)]';
    chipStatusBg = 'bg-emerald-600/90 text-white border-emerald-400';
    statusChipText = `🟢 AL CORRIENTE ($${saldoActual.toLocaleString('es-MX')})`;
  } else if (isMorosoRojo || cliente.estadoMorosidad === 'ROJO') {
    borderLeftColor = 'border-l-rose-600 shadow-[inset_6px_0_16px_-3px_rgba(225,29,72,0.45)]';
    chipStatusBg = 'bg-rose-600 text-white font-black animate-pulse border-rose-400';
    statusChipText = '🔴 ATRASADO / EN RIESGO';
  } else if (cliente.estadoMorosidad === 'AMARILLO') {
    borderLeftColor = 'border-l-amber-500 shadow-[inset_6px_0_14px_-4px_rgba(245,158,11,0.35)]';
    chipStatusBg = 'bg-amber-600 text-white font-bold border-amber-400';
    statusChipText = `🟡 PENDIENTE ($${saldoActual.toLocaleString('es-MX')})`;
  }

  // Optimized Touch Swipe Gesture Handlers
  const handleTouchStart = (e: React.TouchEvent) => {
    touchStartX.current = e.touches[0].clientX;
    setIsSwiping(true);
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    if (touchStartX.current === null) return;
    const currentX = e.touches[0].clientX;
    const diff = currentX - touchStartX.current;
    // Damped clamping between -140px and 140px
    const clamped = Math.max(-140, Math.min(140, diff));
    setDragOffset(clamped);
  };

  const handleTouchEnd = () => {
    if (dragOffset > 70) {
      // Swipe Right -> Registrar Pago / Cobrar
      triggerHaptic([30, 50, 30]);
      onPayAbono(cliente);
    } else if (dragOffset < -70) {
      // Swipe Left -> Abrir panel de opciones rápidas (Llamar, GPS, etc)
      triggerHaptic([20, 30, 20]);
      setShowSecondaryMenu(true);
    }
    setDragOffset(0);
    setIsSwiping(false);
    touchStartX.current = null;
  };

  // Photo Thumbnail Swipe Gesture Handlers
  const photoTouchStartX = useRef<number | null>(null);
  const [photoDragOffset, setPhotoDragOffset] = useState<number>(0);
  const [isPhotoSwiping, setIsPhotoSwiping] = useState<boolean>(false);

  const photoTypes: Array<'fachada' | 'cliente' | 'contrato'> = ['fachada', 'cliente', 'contrato'];

  const handlePhotoTouchStart = (e: React.TouchEvent) => {
    e.stopPropagation();
    photoTouchStartX.current = e.touches[0].clientX;
    setIsPhotoSwiping(true);
  };

  const handlePhotoTouchMove = (e: React.TouchEvent) => {
    e.stopPropagation();
    if (photoTouchStartX.current === null) return;
    const diff = e.touches[0].clientX - photoTouchStartX.current;
    setPhotoDragOffset(Math.max(-40, Math.min(40, diff)));
  };

  const handlePhotoTouchEnd = (e: React.TouchEvent) => {
    e.stopPropagation();
    if (photoTouchStartX.current !== null) {
      if (photoDragOffset < -20) {
        // Swipe Left -> Next Photo Type
        triggerHaptic(15);
        setActivePhotoType((prev) => {
          const currentIndex = photoTypes.indexOf(prev);
          const nextIndex = (currentIndex + 1) % photoTypes.length;
          return photoTypes[nextIndex];
        });
      } else if (photoDragOffset > 20) {
        // Swipe Right -> Prev Photo Type
        triggerHaptic(15);
        setActivePhotoType((prev) => {
          const currentIndex = photoTypes.indexOf(prev);
          const prevIndex = (currentIndex - 1 + photoTypes.length) % photoTypes.length;
          return photoTypes[prevIndex];
        });
      }
    }
    setPhotoDragOffset(0);
    setIsPhotoSwiping(false);
    photoTouchStartX.current = null;
  };

  // Get initials for fallback
  const getInitials = (name: string) => {
    const parts = name.trim().split(' ');
    if (parts.length >= 2) return `${parts[0][0]}${parts[1][0]}`.toUpperCase();
    return name.substring(0, 2).toUpperCase();
  };

  const cleanPhone = cliente.telefono ? cliente.telefono.replace(/\D/g, '') : '';

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 15 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.95 }}
      transition={{ type: 'spring', stiffness: 350, damping: 25 }}
      className="relative overflow-hidden rounded-2xl select-none my-2.5 w-full max-w-full shadow-lg"
    >
      {/* Background Swipe Actions Indicators Layer */}
      <div className="absolute inset-0 flex items-center justify-between px-3 bg-slate-950 rounded-2xl pointer-events-none">
        {/* Swipe Right Action Indicator (Green / Cobrar) */}
        <div
          className={`flex items-center gap-2 font-black text-xs text-emerald-300 transition-all duration-150 ${
            dragOffset > 15 ? 'opacity-100 translate-x-1 scale-105' : 'opacity-0 -translate-x-2'
          }`}
        >
          <div className="w-9 h-9 bg-emerald-500 text-slate-950 rounded-xl flex items-center justify-center shadow-lg shadow-emerald-500/30">
            <DollarSign className="w-5 h-5 stroke-[3]" />
          </div>
          <div className="flex flex-col">
            <span className="text-[11px] font-black tracking-wide uppercase text-emerald-400">REGISTRAR PAGO</span>
            <span className="text-[9px] text-emerald-200/80 font-bold">Desliza para abonar</span>
          </div>
        </div>

        {/* Swipe Left Action Indicator (Indigo / Quick Actions & GPS) */}
        <div
          className={`flex items-center gap-2 font-black text-xs text-indigo-300 transition-all duration-150 ${
            dragOffset < -15 ? 'opacity-100 -translate-x-1 scale-105' : 'opacity-0 translate-x-2'
          }`}
        >
          <div className="flex flex-col text-right">
            <span className="text-[11px] font-black tracking-wide uppercase text-indigo-400">ACCIONES RÁPIDAS</span>
            <span className="text-[9px] text-indigo-200/80 font-bold">Llamar • GPS • Menú</span>
          </div>
          <div className="flex items-center gap-1">
            <div className="w-8 h-8 bg-indigo-600 text-white rounded-lg flex items-center justify-center shadow">
              <Phone className="w-4 h-4" />
            </div>
            <div className="w-8 h-8 bg-emerald-600 text-white rounded-lg flex items-center justify-center shadow">
              <Navigation className="w-4 h-4" />
            </div>
          </div>
        </div>
      </div>

      {/* Main Card Container */}
      <div
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
        onClick={() => {
          if (Math.abs(dragOffset) < 10 && onOpenDetail) {
            triggerHaptic(10);
            onOpenDetail(cliente);
          }
        }}
        style={{
          transform: `translateX(${dragOffset}px)`,
          transition: isSwiping ? 'none' : 'transform 0.22s cubic-bezier(0.2, 0.8, 0.2, 1)',
          touchAction: 'pan-y',
        }}
        className={`p-3.5 sm:p-4 rounded-2xl border-l-4 border border-slate-800/90 bg-gradient-to-b from-slate-900 to-slate-950/95 transition-all shadow-md relative z-10 cursor-pointer group hover:border-indigo-500/50 w-full max-w-full overflow-hidden ${borderLeftColor}`}
      >
        {/* TOP STATUS ROW */}
        <div className="flex items-center justify-between gap-1.5 mb-2 flex-wrap">
          <div className="flex items-center gap-1.5 flex-wrap min-w-0">
            {/* Status Chip */}
            <span className={`px-2.5 py-0.5 rounded-full font-black text-[10px] uppercase tracking-wide border shadow-sm ${chipStatusBg}`}>
              {statusChipText}
            </span>

            {/* Zone Tag */}
            <span className="bg-purple-950/80 text-purple-300 border border-purple-800/80 text-[10px] font-black px-2 py-0.5 rounded-md shrink-0">
              📍 {cliente.zonaNombre || `Zona ${cliente.zonaId}`}
            </span>
          </div>

          {/* Client Folio Chip */}
          <div className="bg-indigo-950/90 border border-indigo-700/80 text-indigo-200 font-mono font-extrabold text-[11px] px-2.5 py-0.5 rounded-lg shadow-sm shrink-0">
            {cliente.folio}
          </div>
        </div>

        {/* CLIENT NAME & MAIN INFO */}
        <div className="flex items-start justify-between gap-2 min-w-0 my-1">
          <div className="min-w-0 flex-1">
            <h3 className="font-extrabold text-white text-base sm:text-lg leading-tight truncate group-hover:text-indigo-300 transition">
              {cliente.nombreCompleto}
            </h3>
            <p className="flex items-center gap-1 text-xs text-slate-300 truncate mt-0.5">
              <MapPin className="w-3.5 h-3.5 text-indigo-400 shrink-0" />
              <span className="truncate">{cliente.direccion} {cliente.colonia ? `(${cliente.colonia})` : ''}</span>
            </p>
            {cliente.entreCalles && (
              <p className="flex items-center gap-1 text-[11px] text-slate-400 truncate pl-4">
                <Compass className="w-3 h-3 text-amber-400 shrink-0" />
                <span className="truncate">Entre: {cliente.entreCalles}</span>
              </p>
            )}
          </div>

          {/* HIGH-VISIBILITY FINANCIAL BADGE (CUÁNTO DEBE) */}
          <div className="bg-slate-950 border border-amber-500/40 px-3 py-1.5 rounded-xl text-right shrink-0 shadow-md">
            <span className="text-[10px] uppercase font-black text-amber-400 block tracking-tight">
              DEBE: ${saldoActual.toLocaleString('es-MX')} MXN
            </span>
            <span className="text-xs font-black text-indigo-300 block font-mono">
              Cuota: ${venta?.pagoSemanal || 100}/sem
            </span>
          </div>
        </div>

        {/* NOTA URGENTE VISUAL DESTACADA */}
        {cliente.notaUrgente ? (
          <div className="my-2 p-2 bg-gradient-to-r from-amber-950/90 via-rose-950/80 to-amber-950/90 border-2 border-amber-500 rounded-xl shadow-lg flex items-center justify-between gap-2 animate-pulse">
            <div className="flex items-center gap-2 min-w-0">
              <div className="w-6 h-6 rounded-lg bg-amber-500 text-slate-950 flex items-center justify-center font-black text-xs shrink-0 shadow">
                📌
              </div>
              <div className="min-w-0">
                <span className="text-[9px] font-black text-amber-400 uppercase tracking-wider block">
                  NOTA URGENTE VISUAL
                </span>
                <p className="text-xs font-bold text-white leading-tight truncate">
                  {cliente.notaUrgente}
                </p>
              </div>
            </div>
            {onEditNotaUrgente && (
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  onEditNotaUrgente(cliente);
                }}
                className="px-2 py-1 bg-amber-500/30 hover:bg-amber-500/50 text-amber-200 border border-amber-400/50 rounded-lg text-[10px] font-extrabold shrink-0 cursor-pointer transition active:scale-95"
              >
                ✏️ Editar
              </button>
            )}
          </div>
        ) : (
          onEditNotaUrgente && (
            <div className="my-1 flex justify-end">
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  onEditNotaUrgente(cliente);
                }}
                className="text-[10px] font-bold text-slate-400 hover:text-amber-300 flex items-center gap-1 cursor-pointer py-0.5 px-2 rounded-lg bg-slate-950/80 border border-slate-800 hover:border-amber-500/50 transition active:scale-95"
              >
                📌 + Nota Urgente
              </button>
            </div>
          )
        )}

        {/* ENGANCHE PENDIENTE (PRÓRROGA 1a SEMANA) BADGE */}
        {cliente.enganchePendiente && (
          <div className="my-1 px-2.5 py-1 bg-amber-950/90 border border-amber-500/60 rounded-xl text-[10px] font-extrabold text-amber-300 flex items-center justify-between shadow-sm">
            <div className="flex items-center gap-1.5">
              <span>⏳ Enganche Pendiente (Prórroga):</span>
              <strong className="text-amber-200 font-mono">${cliente.enganchePendienteMonto || 200} MXN</strong>
            </div>
            <span className="text-[9px] bg-amber-900/80 px-1.5 py-0.5 rounded text-amber-200">Reabre en 1a sem</span>
          </div>
        )}

        {/* PRÓXIMO PAGO AGENDADO BADGE */}
        {cliente.proximoPagoFecha && (
          <div className="my-1 px-2.5 py-1 bg-emerald-950/80 border border-emerald-500/50 rounded-xl text-[10px] font-extrabold text-emerald-300 flex items-center gap-1.5 shadow-sm">
            <Calendar className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
            <span>Próximo cobro agendado: {cliente.proximoPagoFecha}</span>
          </div>
        )}

        {/* PHOTOGRAPHS GALLERY STRIP (3 Fotografía Directas: Fachada, Cliente, Contrato) */}
        <div className="my-2.5 grid grid-cols-3 gap-1.5 p-1.5 bg-slate-950/90 rounded-2xl border border-slate-800/90">
          {/* Foto 1: Fachada */}
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              if (onViewPhoto && (cliente.fotoFachada || cliente.fotoCliente)) {
                onViewPhoto(cliente.fotoFachada || cliente.fotoCliente || '', `Foto Fachada — ${cliente.nombreCompleto}`);
              }
            }}
            className="group/p relative h-14 rounded-xl overflow-hidden border border-slate-800 bg-slate-900 flex flex-col items-center justify-center cursor-pointer hover:border-indigo-500 transition active:scale-95"
            title="Ver fotografía de Fachada"
          >
            {cliente.fotoFachada ? (
              <img src={cliente.fotoFachada} alt="Fachada" className="w-full h-full object-cover group-hover/p:scale-105 transition" />
            ) : (
              <Home className="w-5 h-5 text-slate-500" />
            )}
            <div className="absolute inset-x-0 bottom-0 bg-slate-950/85 backdrop-blur text-[9px] font-black text-slate-300 uppercase text-center py-0.5 flex items-center justify-center gap-0.5">
              <span>🏠 Fachada</span>
            </div>
          </button>

          {/* Foto 2: Cliente */}
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              if (onViewPhoto && (cliente.fotoCliente || cliente.fotoFachada)) {
                onViewPhoto(cliente.fotoCliente || cliente.fotoFachada || '', `Foto Cliente — ${cliente.nombreCompleto}`);
              }
            }}
            className="group/p relative h-14 rounded-xl overflow-hidden border border-slate-800 bg-slate-900 flex flex-col items-center justify-center cursor-pointer hover:border-indigo-500 transition active:scale-95"
            title="Ver fotografía del Cliente"
          >
            {cliente.fotoCliente ? (
              <img src={cliente.fotoCliente} alt="Cliente" className="w-full h-full object-cover group-hover/p:scale-105 transition" />
            ) : (
              <User className="w-5 h-5 text-slate-500" />
            )}
            <div className="absolute inset-x-0 bottom-0 bg-slate-950/85 backdrop-blur text-[9px] font-black text-slate-300 uppercase text-center py-0.5 flex items-center justify-center gap-0.5">
              <span>👤 Cliente</span>
            </div>
          </button>

          {/* Foto 3: Contrato */}
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              if (onViewPhoto && cliente.fotoContrato) {
                onViewPhoto(cliente.fotoContrato, `Foto Contrato/Pagaré — ${cliente.nombreCompleto}`);
              }
            }}
            className="group/p relative h-14 rounded-xl overflow-hidden border border-slate-800 bg-slate-900 flex flex-col items-center justify-center cursor-pointer hover:border-indigo-500 transition active:scale-95"
            title="Ver fotografía de Contrato / Pagaré"
          >
            {cliente.fotoContrato ? (
              <img src={cliente.fotoContrato} alt="Contrato" className="w-full h-full object-cover group-hover/p:scale-105 transition" />
            ) : (
              <FileText className="w-5 h-5 text-slate-500" />
            )}
            <div className="absolute inset-x-0 bottom-0 bg-slate-950/85 backdrop-blur text-[9px] font-black text-slate-300 uppercase text-center py-0.5 flex items-center justify-center gap-0.5">
              <span>📄 Contrato</span>
            </div>
          </button>
        </div>

        {/* STREAMLINED ACTION BUTTONS ROW */}
        <div className="flex items-center gap-2 pt-2 border-t border-slate-800/80">
          {/* PRIMARY HIGH VISIBILITY COBRAR BUTTON */}
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              triggerHaptic([30, 50, 30]);
              onPayAbono(cliente);
            }}
            className="flex-1 min-h-[46px] bg-gradient-to-r from-emerald-600 via-teal-600 to-emerald-500 hover:from-emerald-500 hover:to-teal-400 text-white font-black px-4 py-2 rounded-2xl text-xs sm:text-sm flex items-center justify-center gap-2 shadow-xl shadow-emerald-600/30 border border-emerald-400/50 transition cursor-pointer active:scale-95"
          >
            <Zap className="w-4 h-4 fill-amber-300 text-amber-300 animate-bounce" />
            <span>⚡ COBRAR (${venta?.pagoSemanal || 100})</span>
          </button>

          {/* Quick Communication & GPS Icons */}
          {cleanPhone && (
            <a
              href={`tel:${cleanPhone}`}
              onClick={(e) => {
                e.stopPropagation();
                triggerHaptic(15);
              }}
              className="p-3 bg-slate-800 hover:bg-slate-700 text-emerald-400 rounded-2xl border border-slate-700 transition cursor-pointer shrink-0"
              title="Llamar"
            >
              <Phone className="w-4.5 h-4.5" />
            </a>
          )}

          {cleanPhone && (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                triggerHaptic(15);
                onSendMessage(cliente);
              }}
              className="p-3 bg-emerald-950 hover:bg-emerald-900 text-emerald-300 rounded-2xl border border-emerald-800 transition cursor-pointer shrink-0"
              title="WhatsApp"
            >
              <MessageSquare className="w-4.5 h-4.5" />
            </button>
          )}

          {onReagendar && (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                triggerHaptic(15);
                onReagendar(cliente);
              }}
              className="p-3 bg-amber-950/80 hover:bg-amber-900 text-amber-300 rounded-2xl border border-amber-800 transition cursor-pointer shrink-0"
              title="Reagendar"
            >
              <Clock className="w-4.5 h-4.5" />
            </button>
          )}

          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              triggerHaptic(10);
              setShowSecondaryMenu((prev) => !prev);
            }}
            className="p-3 bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white rounded-2xl border border-slate-700 transition cursor-pointer shrink-0"
            title="Más Opciones"
          >
            <MoreVertical className="w-4.5 h-4.5" />
          </button>
        </div>

        {/* SECONDARY ACTIONS DROPDOWN PANEL */}
        {showSecondaryMenu && (
          <div
            className="mt-3 p-3 bg-slate-950 border border-slate-800 rounded-2xl space-y-2 animate-fadeIn"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between text-xs font-bold text-slate-400 pb-1 border-b border-slate-800">
              <span>Más Acciones para {cliente.nombreCompleto}</span>
              <button
                type="button"
                onClick={() => setShowSecondaryMenu(false)}
                className="text-slate-500 hover:text-slate-300 text-[11px]"
              >
                Cerrar
              </button>
            </div>

            <div className="grid grid-cols-2 gap-2 text-xs">
              <button
                type="button"
                onClick={() => {
                  setShowSecondaryMenu(false);
                  if (onOpenDetail) onOpenDetail(cliente);
                }}
                className="p-2.5 bg-slate-900 hover:bg-slate-850 text-slate-200 rounded-xl flex items-center gap-1.5 font-bold border border-slate-800"
              >
                <History className="w-3.5 h-3.5 text-indigo-400" />
                <span>Ver Historial de Pagos</span>
              </button>

              <a
                href={`https://www.google.com/maps/search/?api=1&query=${cliente.latitud},${cliente.longitud}`}
                target="_blank"
                rel="noopener noreferrer"
                onClick={() => setShowSecondaryMenu(false)}
                className="p-2.5 bg-slate-900 hover:bg-slate-850 text-emerald-300 rounded-xl flex items-center gap-1.5 font-bold border border-slate-800"
              >
                <Navigation className="w-3.5 h-3.5 text-emerald-400" />
                <span>Navegar GPS Externo</span>
              </a>

              {onAddOtraVenta && (
                <button
                  type="button"
                  onClick={() => {
                    setShowSecondaryMenu(false);
                    onAddOtraVenta(cliente);
                  }}
                  className="p-2.5 bg-slate-900 hover:bg-slate-850 text-purple-300 rounded-xl flex items-center gap-1.5 font-bold border border-slate-800"
                >
                  <PlusCircle className="w-3.5 h-3.5 text-purple-400" />
                  <span>+ Agregar Nueva Venta</span>
                </button>
              )}

              {onEditUbicacion && (
                <button
                  type="button"
                  onClick={() => {
                    setShowSecondaryMenu(false);
                    onEditUbicacion(cliente);
                  }}
                  className="p-2.5 bg-indigo-950 hover:bg-indigo-900 text-indigo-300 rounded-xl flex items-center gap-1.5 font-bold border border-indigo-800"
                >
                  <MapPin className="w-3.5 h-3.5 text-indigo-400" />
                  <span>Editar Ubicación</span>
                </button>
              )}
            </div>
          </div>
        )}
      </div>
    </motion.div>
  );
}
