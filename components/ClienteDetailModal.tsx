'use client';

import React, { useState, useEffect } from 'react';
import { Cliente, Venta, Abono, Usuario } from '@/types';
import { getTodayLocalDateStr, parseLocalDateStr } from '@/lib/dateUtils';
import { compressAndOptimizeImage } from '@/components/VendedoraView';
import ImageLightboxModal from './ImageLightboxModal';
import EditarUbicacionModal from './EditarUbicacionModal';
import EditarNotaUrgenteModal from './EditarNotaUrgenteModal';
import { useTouchGestures } from '@/lib/useTouchGestures';
import {
  X,
  Phone,
  MessageSquare,
  MapPin,
  DollarSign,
  User,
  ExternalLink,
  ShoppingBag,
  History,
  Image as ImageIcon,
  Camera,
  Upload,
  Save,
  CheckCircle2,
  ShieldCheck,
  Edit,
  Calendar,
  AlertTriangle,
  Clock,
} from 'lucide-react';

interface ClienteDetailModalProps {
  cliente: Cliente | null;
  ventas?: Venta[];
  abonos?: Abono[];
  isOpen: boolean;
  onClose: () => void;
  onAddAbono?: (cliente: Cliente, venta?: Venta) => void;
  onCobrarAhora?: (cliente: Cliente) => void;
  onAddOtraVenta?: (cliente: Cliente) => void;
  currentUser?: Usuario | null;
  onUpdateCliente?: (cliente: Cliente) => void;
  onUpdateVenta?: (venta: Venta) => void;
}

export default function ClienteDetailModal({
  cliente,
  ventas = [],
  abonos = [],
  isOpen,
  onClose,
  onAddAbono,
  onCobrarAhora,
  onAddOtraVenta,
  currentUser,
  onUpdateCliente,
  onUpdateVenta,
}: ClienteDetailModalProps) {
  const [activeTab, setActiveTab] = useState<'resumen' | 'ventas' | 'plan' | 'abonos' | 'fotos'>('resumen');
  const [selectedPhotoModal, setSelectedPhotoModal] = useState<string | null>(null);

  // Photo Editing State for Supervisor / Admin
  const [isEditingPhotos, setIsEditingPhotos] = useState<boolean>(false);
  const [editFachada, setEditFachada] = useState<string>('');
  const [editClientePhoto, setEditClientePhoto] = useState<string>('');
  const [editContrato, setEditContrato] = useState<string>('');
  const [isSavingPhotos, setIsSavingPhotos] = useState<boolean>(false);
  const [prevClienteId, setPrevClienteId] = useState<number | null>(cliente?.id ?? null);
  const [showEditUbicacionModal, setShowEditUbicacionModal] = useState<boolean>(false);
  const [isNotaModalOpen, setIsNotaModalOpen] = useState<boolean>(false);

  const touchRef = useTouchGestures({
    onSwipeRight: () => onClose(),
    onSwipeDown: () => onClose(),
    enabled: isOpen && !!cliente,
  });

  if (cliente && cliente.id !== prevClienteId) {
    setPrevClienteId(cliente.id);
    setEditFachada(cliente.fotoFachada || '');
    setEditClientePhoto(cliente.fotoCliente || '');
    setEditContrato(cliente.fotoContrato || '');
    setIsEditingPhotos(false);
  }

  if (!isOpen || !cliente) return null;

  // Filter sales for this client
  const clientVentas = ventas.filter((v) => v.clienteId === cliente.id);
  
  // Total balance across client's sales
  const totalSaldoActual = clientVentas.reduce((sum, v) => sum + (v.saldoActual || 0), 0);
  const totalPagoSemanal = clientVentas.reduce((sum, v) => sum + (v.pagoSemanal || 0), 0);
  
  // Filter abonos for this client's sales
  const clientVentaIds = new Set(clientVentas.map((v) => v.id));
  const clientAbonos = abonos.filter((a) => clientVentaIds.has(a.ventaId) || a.clienteId === cliente.id);

  // Semáforo Badge Styling
  let semaforoBadge = 'bg-emerald-950/90 text-emerald-400 border-emerald-800';
  let semaforoText = '🟢 AL CORRIENTE (VERDE)';
  let semaforoHeaderBg = 'from-emerald-950/80 via-slate-900 to-slate-900';

  if (totalSaldoActual === 0 && clientVentas.length > 0) {
    semaforoBadge = 'bg-emerald-600 text-white font-bold border-emerald-400';
    semaforoText = '✓ CUENTA LIQUIDADA';
  } else if (cliente.estadoMorosidad === 'ROJO') {
    semaforoBadge = 'bg-red-600 text-white font-black animate-pulse border-red-400 shadow-lg';
    semaforoText = '🔴 ATRASADO / RIESGO (ROJO)';
    semaforoHeaderBg = 'from-red-950/80 via-slate-900 to-slate-900';
  } else if (cliente.estadoMorosidad === 'AMARILLO') {
    semaforoBadge = 'bg-amber-600 text-white font-bold border-amber-400';
    semaforoText = '🟡 PRÓXIMO A VENCER (AMARILLO)';
    semaforoHeaderBg = 'from-amber-950/80 via-slate-900 to-slate-900';
  }

  const cleanPhone = cliente.telefono ? cliente.telefono.replace(/\D/g, '') : '';
  const fachadaPhoto = cliente.fotoFachada || 'https://picsum.photos/seed/house_default/800/500';
  const clientPhoto = cliente.fotoCliente || 'https://picsum.photos/seed/person_default/300/300';

  return (
    <div className="fixed inset-0 bg-slate-950/85 z-50 flex items-center justify-center p-2 sm:p-4 backdrop-blur-md overflow-y-auto">
      <div ref={touchRef} className="bg-slate-900 border border-slate-700/80 rounded-3xl max-w-2xl w-full my-auto shadow-2xl overflow-hidden flex flex-col max-h-[92vh] relative select-none">
        {/* MOBILE GESTURE PULL HANDLE */}
        <div className="w-12 h-1.5 bg-slate-600/70 hover:bg-slate-500 rounded-full mx-auto my-1.5 shrink-0 z-20 cursor-pointer transition" onClick={onClose} title="Desliza o toca para cerrar" />
        
        {/* HEADER HERO BANNER WITH FACHADA PHOTO */}
        <div className={`relative h-44 sm:h-52 bg-gradient-to-b ${semaforoHeaderBg} overflow-hidden shrink-0`}>
          <img
            src={fachadaPhoto}
            alt="Fachada de la vivienda"
            className="w-full h-full object-cover opacity-40 blur-[1px]"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-slate-900 via-slate-900/60 to-transparent" />

          {/* Close Button */}
          <button
            onClick={onClose}
            className="absolute top-3 right-3 bg-slate-950/70 hover:bg-slate-950 text-white p-2 rounded-full border border-slate-700/80 backdrop-blur transition cursor-pointer z-10"
          >
            <X className="w-5 h-5" />
          </button>

          {/* Client Avatar + Main Title */}
          <div className="absolute bottom-3 left-4 right-4 flex items-end justify-between gap-3 z-10">
            <div className="flex items-center gap-3">
              <div
                onClick={() => setSelectedPhotoModal(clientPhoto)}
                className="relative w-16 h-16 sm:w-20 sm:h-20 rounded-2xl overflow-hidden border-2 border-indigo-400/80 bg-slate-800 shrink-0 shadow-xl cursor-pointer group"
              >
                <img src={clientPhoto} alt={cliente.nombreCompleto} className="w-full h-full object-cover group-hover:scale-105 transition" />
                <div className="absolute inset-0 bg-black/20 group-hover:bg-transparent transition" />
              </div>

              <div>
                <div className="flex items-center gap-2">
                  <span className="bg-indigo-950/90 text-indigo-300 border border-indigo-700/80 font-mono text-[11px] px-2 py-0.5 rounded-md font-bold">
                    {cliente.folio}
                  </span>
                  <span className={`text-[10px] px-2 py-0.5 rounded-full border font-bold ${semaforoBadge}`}>
                    {semaforoText}
                  </span>
                </div>
                <h2 className="text-lg sm:text-xl font-black text-white leading-tight mt-1">
                  {cliente.nombreCompleto}
                </h2>
                <p className="text-xs text-slate-300 flex items-center gap-1 mt-0.5">
                  <MapPin className="w-3.5 h-3.5 text-indigo-400 shrink-0" />
                  <span className="truncate">{cliente.direccion} {cliente.colonia ? `• ${cliente.colonia}` : ''}</span>
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* FINANCIAL SUMMARY HIGHLIGHT BAR */}
        <div className="bg-slate-950/90 border-y border-slate-800 p-3 grid grid-cols-3 gap-2 text-center shrink-0">
          <div className="bg-slate-900/80 p-2 rounded-xl border border-slate-800/80">
            <span className="text-[10px] text-slate-400 block font-semibold">Saldo Actual</span>
            <span className="text-sm sm:text-base font-black text-emerald-400">
              ${totalSaldoActual.toLocaleString('es-MX')} MXN
            </span>
          </div>

          <div className="bg-slate-900/80 p-2 rounded-xl border border-slate-800/80">
            <span className="text-[10px] text-slate-400 block font-semibold">Pago Semanal</span>
            <span className="text-sm sm:text-base font-black text-indigo-300">
              ${totalPagoSemanal.toLocaleString('es-MX')} MXN
            </span>
          </div>

          <div className="bg-slate-900/80 p-2 rounded-xl border border-slate-800/80">
            <span className="text-[10px] text-slate-400 block font-semibold">Zona de Cobro</span>
            <span className="text-xs sm:text-sm font-bold text-slate-200 truncate block">
              {cliente.zonaNombre || 'Zona 1'}
            </span>
          </div>
        </div>

        {/* DIRECT ACTION BUTTONS */}
        <div className="p-3 bg-slate-900 border-b border-slate-800 grid grid-cols-2 sm:grid-cols-4 gap-2 shrink-0">
          <a
            href={`tel:${cleanPhone}`}
            className="bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 rounded-xl px-3 py-2 text-xs font-bold flex items-center justify-center gap-1.5 transition cursor-pointer shadow"
          >
            <Phone className="w-4 h-4 text-emerald-400" />
            <span>Llamar</span>
          </a>

          <a
            href={`https://wa.me/52${cleanPhone}?text=${encodeURIComponent(
              `Hola ${cliente.nombreCompleto}, le saludamos de BITALIS sobre su cuenta ${cliente.folio}.`
            )}`}
            target="_blank"
            rel="noopener noreferrer"
            className="bg-emerald-950/80 hover:bg-emerald-900 text-emerald-200 border border-emerald-800/80 rounded-xl px-3 py-2 text-xs font-bold flex items-center justify-center gap-1.5 transition cursor-pointer shadow"
          >
            <MessageSquare className="w-4 h-4 text-emerald-400" />
            <span>WhatsApp</span>
          </a>

          {onAddOtraVenta && (
            <button
              onClick={() => onAddOtraVenta(cliente)}
              className="bg-indigo-950 hover:bg-indigo-900 text-indigo-200 border border-indigo-800/80 rounded-xl px-3 py-2 text-xs font-bold flex items-center justify-center gap-1.5 transition cursor-pointer shadow"
            >
              <ShoppingBag className="w-4 h-4 text-indigo-400" />
              <span>+ Otra Venta</span>
            </button>
          )}

          {(onAddAbono || onCobrarAhora) && (
            <button
              type="button"
              onClick={() => {
                if (onCobrarAhora) {
                  onCobrarAhora(cliente);
                } else if (onAddAbono) {
                  onAddAbono(cliente, clientVentas[0]);
                }
              }}
              className="bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl px-3 py-2 text-xs font-black flex items-center justify-center gap-1.5 transition cursor-pointer shadow-lg"
            >
              <DollarSign className="w-4 h-4" />
              <span>+ Registrar Cobro</span>
            </button>
          )}

          <button
            type="button"
            onClick={() => setShowEditUbicacionModal(true)}
            className="bg-gradient-to-r from-indigo-900 to-indigo-950 hover:from-indigo-800 hover:to-indigo-900 text-indigo-200 border border-indigo-700/80 rounded-xl px-3 py-2 text-xs font-bold flex items-center justify-center gap-1.5 transition cursor-pointer shadow"
          >
            <MapPin className="w-4 h-4 text-indigo-400" />
            <span>📍 Editar Ubicación & Fachada</span>
          </button>
        </div>

        {/* NAVIGATION TABS */}
        <div className="flex border-b border-slate-800 bg-slate-950/60 px-3 pt-2 gap-1 shrink-0 overflow-x-auto">
          <button
            onClick={() => setActiveTab('resumen')}
            className={`px-3 py-2 rounded-t-xl text-xs font-bold transition flex items-center gap-1.5 cursor-pointer whitespace-nowrap ${
              activeTab === 'resumen'
                ? 'bg-slate-900 text-indigo-400 border-t-2 border-indigo-500'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            <User className="w-3.5 h-3.5" />
            <span>Datos Cliente</span>
          </button>

          <button
            onClick={() => setActiveTab('ventas')}
            className={`px-3 py-2 rounded-t-xl text-xs font-bold transition flex items-center gap-1.5 cursor-pointer whitespace-nowrap ${
              activeTab === 'ventas'
                ? 'bg-slate-900 text-indigo-400 border-t-2 border-indigo-500'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            <ShoppingBag className="w-3.5 h-3.5" />
            <span>Ventas ({clientVentas.length})</span>
          </button>

          <button
            onClick={() => setActiveTab('plan')}
            className={`px-3 py-2 rounded-t-xl text-xs font-bold transition flex items-center gap-1.5 cursor-pointer whitespace-nowrap ${
              activeTab === 'plan'
                ? 'bg-slate-900 text-emerald-400 border-t-2 border-emerald-500'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            <Calendar className="w-3.5 h-3.5 text-emerald-400" />
            <span>Plan de Pagos</span>
          </button>

          <button
            onClick={() => setActiveTab('abonos')}
            className={`px-3 py-2 rounded-t-xl text-xs font-bold transition flex items-center gap-1.5 cursor-pointer whitespace-nowrap ${
              activeTab === 'abonos'
                ? 'bg-slate-900 text-indigo-400 border-t-2 border-indigo-500'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            <History className="w-3.5 h-3.5" />
            <span>Historial Abonos ({clientAbonos.length})</span>
          </button>

          <button
            onClick={() => setActiveTab('fotos')}
            className={`px-3 py-2 rounded-t-xl text-xs font-bold transition flex items-center gap-1.5 cursor-pointer whitespace-nowrap ${
              activeTab === 'fotos'
                ? 'bg-slate-900 text-indigo-400 border-t-2 border-indigo-500'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            <ImageIcon className="w-3.5 h-3.5" />
            <span>Fotos & Documentos</span>
          </button>
        </div>

        {/* TAB CONTENTS (SCROLLABLE) */}
        <div className="p-4 overflow-y-auto space-y-4 text-xs text-slate-300 flex-1">
          
          {/* TAB 1: RESUMEN / CLIENT DATA */}
          {activeTab === 'resumen' && (
            <div className="space-y-4">
              {/* BANNER NOTA URGENTE VISUAL */}
              {cliente.notaUrgente ? (
                <div className="p-3 bg-gradient-to-r from-amber-950/90 via-rose-950/80 to-amber-950/90 border-2 border-amber-500 rounded-2xl shadow-lg flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2 min-w-0">
                    <span className="w-7 h-7 rounded-lg bg-amber-500 text-slate-950 flex items-center justify-center font-black text-sm shrink-0 shadow">
                      📌
                    </span>
                    <div className="min-w-0">
                      <span className="text-[10px] font-black text-amber-400 uppercase tracking-wider block">
                        NOTA URGENTE VISUAL
                      </span>
                      <p className="text-xs font-bold text-white leading-tight">
                        {cliente.notaUrgente}
                      </p>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => setIsNotaModalOpen(true)}
                    className="px-2.5 py-1 bg-amber-500/30 hover:bg-amber-500 text-amber-200 hover:text-slate-950 rounded-lg text-xs font-black border border-amber-400/50 transition cursor-pointer shrink-0"
                  >
                    ✏️ Editar Nota
                  </button>
                </div>
              ) : (
                <div className="flex justify-end">
                  <button
                    type="button"
                    onClick={() => setIsNotaModalOpen(true)}
                    className="px-3 py-1.5 bg-slate-950 hover:bg-slate-800 text-amber-300 font-bold text-xs rounded-xl border border-slate-800 flex items-center gap-1.5 transition cursor-pointer"
                  >
                    <span>📌 + Agregar Nota Urgente Visual</span>
                  </button>
                </div>
              )}

              {/* PRÓXIMO PAGO AGENDADO BADGE */}
              {cliente.proximoPagoFecha && (
                <div className="p-2.5 bg-emerald-950/80 border border-emerald-500/50 rounded-2xl text-xs font-bold text-emerald-300 flex items-center gap-2">
                  <Calendar className="w-4 h-4 text-emerald-400 shrink-0" />
                  <span>Próximo cobro agendado para: <strong>{cliente.proximoPagoFecha}</strong></span>
                </div>
              )}

              <div className="bg-slate-950 p-3.5 rounded-2xl border border-slate-800 space-y-2">
                <div className="flex items-center justify-between">
                  <h4 className="font-bold text-white text-xs flex items-center gap-1.5 text-indigo-300">
                    <MapPin className="w-4 h-4 text-indigo-400" />
                    <span>Ubicación y Dirección de Entrega</span>
                  </h4>
                  <button
                    type="button"
                    onClick={() => setShowEditUbicacionModal(true)}
                    className="px-2.5 py-1 bg-indigo-950 hover:bg-indigo-900 text-indigo-300 border border-indigo-700/60 text-[11px] font-bold rounded-lg flex items-center gap-1 cursor-pointer transition shadow"
                  >
                    <Edit className="w-3 h-3 text-indigo-400" />
                    <span>Editar Ubicación & Fachada</span>
                  </button>
                </div>
                <p><strong>Dirección:</strong> {cliente.direccion}</p>
                <p><strong>Colonia:</strong> {cliente.colonia || 'No especificada'}</p>
                <p><strong>Entre Calles:</strong> {cliente.entreCalles || 'No especificadas'}</p>
                <p><strong>Referencias de casa:</strong> {cliente.referencias || 'Sin referencias'}</p>

                <div className="flex items-center justify-between pt-2 border-t border-slate-850">
                  <span className="font-mono text-[11px] text-purple-300">
                    GPS: {cliente.latitud}, {cliente.longitud}
                  </span>
                  <a
                    href={`https://www.google.com/maps/search/?api=1&query=${cliente.latitud},${cliente.longitud}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="bg-purple-950 hover:bg-purple-900 text-purple-200 px-2.5 py-1 rounded-lg border border-purple-800 flex items-center gap-1 text-[11px] font-bold"
                  >
                    <span>Google Maps</span>
                    <ExternalLink className="w-3 h-3" />
                  </a>
                </div>
              </div>

              <div className="bg-slate-950 p-3.5 rounded-2xl border border-slate-800 space-y-2">
                <h4 className="font-bold text-white text-xs flex items-center gap-1.5 text-indigo-300">
                  <Phone className="w-4 h-4 text-indigo-400" />
                  <span>Información de Contacto y Registro</span>
                </h4>
                <p><strong>Teléfono Principal:</strong> {cliente.telefono}</p>
                <p><strong>Vendedora Responsable:</strong> {cliente.vendedoraNombre || 'Vendedora'}</p>
                <p><strong>Levantado / Registrado por:</strong> {cliente.creadoPorUsuarioNombre || cliente.vendedoraNombre || 'Vendedora de Campo'}</p>
                <p><strong>Fecha de Registro:</strong> {cliente.fechaRegistro}</p>
                {cliente.fotosEditadasPorNombre && (
                  <p className="text-amber-300 font-semibold bg-amber-950/40 p-2 rounded-xl border border-amber-800/60 mt-1">
                    📷 <strong>Fotografías editadas por:</strong> {cliente.fotosEditadasPorNombre} {cliente.fotosEditadasFecha ? `(${cliente.fotosEditadasFecha})` : ''}
                  </p>
                )}
                <p><strong>Estado Tarjeta Impresa:</strong> {cliente.tarjetaImpresa ? 'Impresa y Entregada' : 'Pendiente'}</p>
              </div>
            </div>
          )}

          {/* TAB 2: VENTAS / CONTRATOS */}
          {activeTab === 'ventas' && (
            <div className="space-y-3">
              {clientVentas.length === 0 ? (
                <div className="p-6 text-center bg-slate-950 border border-slate-800 rounded-2xl text-slate-400">
                  No se encontraron ventas registradas para este cliente.
                </div>
              ) : (
                clientVentas.map((v) => (
                  <div key={v.id} className="bg-slate-950 p-3.5 rounded-2xl border border-slate-800 space-y-2">
                    <div className="flex items-center justify-between border-b border-slate-850 pb-2">
                      <div>
                        <span className="font-bold text-white text-sm block">{v.productoNombre || 'Venta Crédito'}</span>
                        <span className="text-[10px] text-slate-400 font-mono">Folio Venta: #{v.id} • Fecha: {v.fechaVenta}</span>
                      </div>
                      <span className={`px-2 py-0.5 rounded-md text-[10px] font-bold border ${
                        v.estado === 'APROBADA' ? 'bg-emerald-950 text-emerald-300 border-emerald-800' : 'bg-amber-950 text-amber-300 border-amber-800'
                      }`}>
                        {v.estado}
                      </span>
                    </div>

                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-[11px] pt-1">
                      <div>
                        <span className="text-slate-400 block">Tipo:</span>
                        <span className="font-bold text-slate-200">{v.tipo}</span>
                      </div>
                      <div>
                        <span className="text-slate-400 block">Precio Total:</span>
                        <span className="font-bold text-slate-200">${v.precioBase} MXN</span>
                      </div>
                      <div>
                        <span className="text-slate-400 block">Enganche:</span>
                        <span className="font-bold text-emerald-400">${v.engancheMonto} MXN</span>
                      </div>
                      <div>
                        <span className="text-slate-400 block">Saldo Actual:</span>
                        <span className="font-black text-emerald-300">${v.saldoActual} MXN</span>
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>
          )}

          {/* TAB: PLAN DE PAGOS DE LA VENTA */}
          {activeTab === 'plan' && (
            <div className="space-y-4">
              {clientVentas.length === 0 ? (
                <div className="p-6 text-center bg-slate-950 border border-slate-800 rounded-2xl text-slate-400">
                  No hay ventas activas para generar un plan de pagos.
                </div>
              ) : (
                clientVentas.map((venta) => {
                  const saldoInicial = venta.saldoInicial || Math.max(0, venta.precioBase - (venta.engancheMonto || 0) - (venta.aporteEmpresa || 0));
                  const pagoSemanal = venta.pagoSemanal || 1;
                  const fechaPrimerPagoStr = (venta.fechaPrimerPago || venta.fechaVenta || getTodayLocalDateStr()).split('T')[0];
                  
                  const totalPagado = clientAbonos.reduce((sum, a) => sum + a.monto, 0);
                  const totalSemanas = Math.max(1, Math.ceil(saldoInicial / pagoSemanal));
                  
                  const hoyStr = getTodayLocalDateStr();
                  const hoyTime = parseLocalDateStr(hoyStr).getTime();
                  const primerPagoTime = parseLocalDateStr(fechaPrimerPagoStr).getTime();

                  const diffDays = Math.max(0, Math.floor((hoyTime - primerPagoTime) / (1000 * 60 * 60 * 24)));
                  const semanasTranscurridas = hoyTime >= primerPagoTime ? Math.floor(diffDays / 7) + 1 : 0;
                  const montoEsperadoAHoy = Math.min(saldoInicial, semanasTranscurridas * pagoSemanal);
                  const montoAtrasado = Math.max(0, Math.min(venta.saldoActual, montoEsperadoAHoy - totalPagado));

                  return (
                    <div key={venta.id} className="bg-slate-950 p-4 rounded-2xl border border-slate-800 space-y-3">
                      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-850 pb-2.5">
                        <div>
                          <h4 className="font-extrabold text-white text-sm">{venta.productoNombre || 'Plan de Crédito'}</h4>
                          <span className="text-[10px] text-slate-400">
                            Primer Pago Programado: <strong className="text-emerald-400 font-mono">{fechaPrimerPagoStr}</strong>
                          </span>
                        </div>
                        <div className="text-right">
                          <span className="text-[10px] text-slate-400 block">Total Financiamiento</span>
                          <span className="font-mono font-black text-indigo-300 text-sm">${saldoInicial.toLocaleString('es-MX')} MXN</span>
                        </div>
                      </div>

                      {/* Financial Metrics */}
                      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-[11px] bg-slate-900/80 p-2.5 rounded-xl border border-slate-800">
                        <div>
                          <span className="text-slate-400 block">Pago Semanal:</span>
                          <span className="font-extrabold text-emerald-400">${pagoSemanal} MXN</span>
                        </div>
                        <div>
                          <span className="text-slate-400 block">Plazo Estimado:</span>
                          <span className="font-extrabold text-slate-200">{totalSemanas} Semanas</span>
                        </div>
                        <div>
                          <span className="text-slate-400 block">Total Pagado:</span>
                          <span className="font-extrabold text-blue-400">${totalPagado} MXN</span>
                        </div>
                        <div>
                          <span className="text-slate-400 block">Monto Atrasado:</span>
                          <span className={`font-black ${montoAtrasado > 0 ? 'text-red-400 animate-pulse' : 'text-emerald-400'}`}>
                            ${montoAtrasado} MXN
                          </span>
                        </div>
                      </div>

                      {/* Payment Schedule Installments List */}
                      <div className="space-y-1.5 pt-1">
                        <span className="text-[11px] font-bold text-slate-300 block flex items-center gap-1">
                          <Clock className="w-3.5 h-3.5 text-indigo-400" />
                          <span>Calendario de Pagos Semanales:</span>
                        </span>

                        <div className="max-h-52 overflow-y-auto space-y-1.5 pr-1 scrollbar-thin">
                          {Array.from({ length: totalSemanas }).map((_, idx) => {
                            const numSemana = idx + 1;
                            const dt = new Date(fechaPrimerPagoStr + 'T00:00:00');
                            dt.setDate(dt.getDate() + idx * 7);
                            const fechaSemanaStr = dt.toISOString().split('T')[0];
                            const montoSemana = Math.min(pagoSemanal, saldoInicial - idx * pagoSemanal);
                            const acumuladoReq = Math.min(saldoInicial, (idx + 1) * pagoSemanal);

                            const yaEstaCubierto = totalPagado >= acumuladoReq;
                            const esSemanaActualOHoy = fechaSemanaStr === hoyStr;
                            const esPasadoSinPagar = fechaSemanaStr < hoyStr && !yaEstaCubierto;

                            return (
                              <div
                                key={idx}
                                className={`p-2 rounded-xl text-[11px] flex items-center justify-between border ${
                                  yaEstaCubierto
                                    ? 'bg-emerald-950/40 border-emerald-800/80 text-emerald-300'
                                    : esPasadoSinPagar
                                    ? 'bg-red-950/40 border-red-800/80 text-red-300 font-bold'
                                    : esSemanaActualOHoy
                                    ? 'bg-amber-950/50 border-amber-700/90 text-amber-200 font-bold'
                                    : 'bg-slate-900 border-slate-800 text-slate-400'
                                }`}
                              >
                                <div className="flex items-center gap-2">
                                  <span className="font-mono text-[10px] px-1.5 py-0.5 rounded bg-slate-950 font-bold border border-slate-800">
                                    Sem #{numSemana}
                                  </span>
                                  <span className="font-mono">{fechaSemanaStr}</span>
                                </div>

                                <div className="flex items-center gap-2">
                                  <span className="font-bold">${montoSemana} MXN</span>
                                  <span className="text-[10px] px-2 py-0.5 rounded-full font-bold">
                                    {yaEstaCubierto
                                      ? '✓ PAGADO'
                                      : esPasadoSinPagar
                                      ? '🔴 PENDIENTE / ATRASADO'
                                      : esSemanaActualOHoy
                                      ? '🟡 COBRO HOY'
                                      : '⏳ FUTURO'}
                                  </span>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          )}

          {/* TAB 3: HISTORIAL DE ABONOS */}
          {activeTab === 'abonos' && (
            <div className="space-y-3">
              {clientAbonos.length === 0 ? (
                <div className="p-6 text-center bg-slate-950 border border-slate-800 rounded-2xl text-slate-400">
                  No hay abonos ni cobros registrados en el historial de este cliente.
                </div>
              ) : (
                clientAbonos.map((a) => (
                  <div key={a.id} className="bg-slate-950 p-3 rounded-2xl border border-slate-800 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="p-2 bg-emerald-950/80 border border-emerald-800 rounded-xl text-emerald-400">
                        <DollarSign className="w-4 h-4" />
                      </div>
                      <div>
                        <span className="font-black text-emerald-400 text-sm block">${a.monto} MXN</span>
                        <span className="text-[10px] text-slate-400 font-mono">
                          Recibo: {(a as any).folioRecibo || `#AB-${a.id}`} • {(a as any).fecha || a.fechaPago || ''}
                        </span>
                      </div>
                    </div>
                    <div className="text-right">
                      <span className="text-[11px] font-bold text-slate-300 block">{(a as any).metodoPago || a.tipoPago || 'Efectivo'}</span>
                      <span className="text-[10px] text-slate-400">Cobrador: {a.cobradorNombre || 'Cobrador'}</span>
                    </div>
                  </div>
                ))
              )}
            </div>
          )}

          {/* TAB 4: FOTOS Y DOCUMENTOS */}
          {activeTab === 'fotos' && (
            <div className="space-y-4">
              {/* Supervisor / Admin Photo Editing Toggle */}
              {['sup_vendedores', 'admin', 'sup_cobradores'].includes(currentUser?.rol || '') && (
                <div className="flex items-center justify-between bg-slate-950 p-3 rounded-2xl border border-indigo-800/80">
                  <div className="flex items-center gap-2">
                    <ShieldCheck className="w-4 h-4 text-indigo-400" />
                    <div>
                      <span className="font-bold text-white text-xs block">Edición de Fotografías (Supervisión)</span>
                      <span className="text-[10px] text-slate-400">Permite actualizar o corregir fotos del expediente</span>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => setIsEditingPhotos(!isEditingPhotos)}
                    className="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-xs font-bold flex items-center gap-1.5 cursor-pointer shadow transition"
                  >
                    <Edit className="w-3.5 h-3.5" />
                    <span>{isEditingPhotos ? 'Cancelar Edición' : 'Editar Fotos'}</span>
                  </button>
                </div>
              )}

              {/* Photos Audit Bar if edited */}
              {cliente.fotosEditadasPorNombre && !isEditingPhotos && (
                <div className="bg-amber-950/40 border border-amber-800/60 p-2.5 rounded-2xl text-[11px] text-amber-300 font-medium">
                  📷 <strong>Última edición de fotos:</strong> {cliente.fotosEditadasPorNombre} {cliente.fotosEditadasFecha ? `(${cliente.fotosEditadasFecha})` : ''}
                </div>
              )}

              {/* READ-ONLY VIEW */}
              {!isEditingPhotos ? (
                <div className="grid grid-cols-2 gap-3">
                  <div className="bg-slate-950 p-2.5 rounded-2xl border border-slate-800 space-y-1.5">
                    <span className="font-bold text-slate-300 text-[11px] block">Foto Fachada</span>
                    <div
                      onClick={() => setSelectedPhotoModal(fachadaPhoto)}
                      className="h-32 rounded-xl overflow-hidden bg-slate-900 cursor-pointer border border-slate-800 hover:border-indigo-500 transition group"
                    >
                      <img src={fachadaPhoto} alt="Fachada" className="w-full h-full object-cover group-hover:scale-105 transition" />
                    </div>
                  </div>

                  <div className="bg-slate-950 p-2.5 rounded-2xl border border-slate-800 space-y-1.5">
                    <span className="font-bold text-slate-300 text-[11px] block">Foto Cliente</span>
                    <div
                      onClick={() => setSelectedPhotoModal(clientPhoto)}
                      className="h-32 rounded-xl overflow-hidden bg-slate-900 cursor-pointer border border-slate-800 hover:border-indigo-500 transition group"
                    >
                      <img src={clientPhoto} alt="Cliente" className="w-full h-full object-cover group-hover:scale-105 transition" />
                    </div>
                  </div>

                  {cliente.fotoContrato && (
                    <div className="col-span-2 bg-slate-950 p-2.5 rounded-2xl border border-slate-800 space-y-1.5">
                      <div className="flex justify-between items-center">
                        <span className="font-bold text-slate-300 text-[11px] block">Foto del Contrato / Pagaré Escaneado</span>
                      </div>
                      <div
                        onClick={() => setSelectedPhotoModal(cliente.fotoContrato || null)}
                        className="h-44 rounded-xl overflow-hidden bg-slate-900 cursor-pointer border border-slate-800 hover:border-indigo-500 transition group"
                      >
                        <img src={cliente.fotoContrato} alt="Contrato" className="w-full h-full object-cover group-hover:scale-105 transition" />
                      </div>
                    </div>
                  )}
                </div>
              ) : (
                /* EDITING VIEW FOR SUPERVISOR */
                <div className="space-y-4 bg-slate-950 p-4 rounded-2xl border border-indigo-700/80">
                  <span className="font-bold text-indigo-300 text-xs block border-b border-slate-800 pb-2">
                    Cargar o reemplazar fotografías del expediente
                  </span>

                  {/* Foto Fachada Edit */}
                  <div className="space-y-2">
                    <label className="font-bold text-slate-200 text-xs block">1. Foto Fachada Domicilio</label>
                    <div className="flex items-center gap-3">
                      <div className="w-20 h-20 bg-slate-900 rounded-xl overflow-hidden border border-slate-800 shrink-0">
                        {editFachada ? (
                          <img src={editFachada} alt="Fachada" className="w-full h-full object-cover" />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center text-slate-600 text-[10px]">Sin foto</div>
                        )}
                      </div>
                      <div className="flex-1 space-y-2">
                        <label className="px-3 py-2 bg-slate-800 hover:bg-slate-700 border border-slate-700 rounded-xl font-bold text-xs text-indigo-300 flex items-center justify-center gap-2 cursor-pointer transition">
                          <Upload className="w-3.5 h-3.5" />
                          <span>Subir / Tomar Foto Fachada</span>
                          <input
                            type="file"
                            accept="image/*"
                            capture="environment"
                            className="hidden"
                            onChange={async (e) => {
                              const f = e.target.files?.[0];
                              if (f) {
                                const compressed = await compressAndOptimizeImage(f, 1280, 0.72);
                                setEditFachada(compressed);
                              }
                            }}
                          />
                        </label>
                      </div>
                    </div>
                  </div>

                  {/* Foto Cliente Edit */}
                  <div className="space-y-2 pt-2 border-t border-slate-850">
                    <label className="font-bold text-slate-200 text-xs block">2. Foto Cliente / Identificación</label>
                    <div className="flex items-center gap-3">
                      <div className="w-20 h-20 bg-slate-900 rounded-xl overflow-hidden border border-slate-800 shrink-0">
                        {editClientePhoto ? (
                          <img src={editClientePhoto} alt="Cliente" className="w-full h-full object-cover" />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center text-slate-600 text-[10px]">Sin foto</div>
                        )}
                      </div>
                      <div className="flex-1 space-y-2">
                        <label className="px-3 py-2 bg-slate-800 hover:bg-slate-700 border border-slate-700 rounded-xl font-bold text-xs text-indigo-300 flex items-center justify-center gap-2 cursor-pointer transition">
                          <Upload className="w-3.5 h-3.5" />
                          <span>Subir / Tomar Foto Cliente</span>
                          <input
                            type="file"
                            accept="image/*"
                            capture="user"
                            className="hidden"
                            onChange={async (e) => {
                              const f = e.target.files?.[0];
                              if (f) {
                                const compressed = await compressAndOptimizeImage(f, 1280, 0.72);
                                setEditClientePhoto(compressed);
                              }
                            }}
                          />
                        </label>
                      </div>
                    </div>
                  </div>

                  {/* Foto Contrato Edit */}
                  <div className="space-y-2 pt-2 border-t border-slate-850">
                    <label className="font-bold text-slate-200 text-xs block">3. Foto del Contrato / Pagaré</label>
                    <div className="flex items-center gap-3">
                      <div className="w-20 h-20 bg-slate-900 rounded-xl overflow-hidden border border-slate-800 shrink-0">
                        {editContrato ? (
                          <img src={editContrato} alt="Contrato" className="w-full h-full object-cover" />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center text-slate-600 text-[10px]">Sin foto</div>
                        )}
                      </div>
                      <div className="flex-1 space-y-2">
                        <label className="px-3 py-2 bg-slate-800 hover:bg-slate-700 border border-slate-700 rounded-xl font-bold text-xs text-indigo-300 flex items-center justify-center gap-2 cursor-pointer transition">
                          <Upload className="w-3.5 h-3.5" />
                          <span>Subir / Tomar Foto Contrato</span>
                          <input
                            type="file"
                            accept="image/*"
                            capture="environment"
                            className="hidden"
                            onChange={async (e) => {
                              const f = e.target.files?.[0];
                              if (f) {
                                const compressed = await compressAndOptimizeImage(f, 1280, 0.72);
                                setEditContrato(compressed);
                              }
                            }}
                          />
                        </label>
                      </div>
                    </div>
                  </div>

                  {/* Save Photo Changes Button */}
                  <div className="pt-3 border-t border-slate-800 flex justify-end gap-2">
                    <button
                      type="button"
                      onClick={() => setIsEditingPhotos(false)}
                      className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl font-bold text-xs cursor-pointer"
                    >
                      Cancelar
                    </button>
                    <button
                      type="button"
                      disabled={isSavingPhotos}
                      onClick={() => {
                        setIsSavingPhotos(true);
                        const editorNombre = currentUser?.nombre || 'Supervisora';
                        const fechaEdit = new Date().toLocaleDateString('es-MX', {
                          year: 'numeric',
                          month: 'short',
                          day: 'numeric',
                          hour: '2-digit',
                          minute: '2-digit'
                        });

                        const updatedCliente: Cliente = {
                          ...cliente,
                          fotoFachada: editFachada,
                          fotoCliente: editClientePhoto,
                          fotoContrato: editContrato,
                          fotosEditadasPorNombre: editorNombre,
                          fotosEditadasFecha: fechaEdit,
                        };

                        if (onUpdateCliente) {
                          onUpdateCliente(updatedCliente);
                        }
                        setIsSavingPhotos(false);
                        setIsEditingPhotos(false);
                        alert(`📸 Fotografías guardadas y registradas correctamente. Auditado por: ${editorNombre}`);
                      }}
                      className="px-5 py-2 bg-emerald-600 hover:bg-emerald-500 text-white font-extrabold rounded-xl text-xs flex items-center gap-1.5 cursor-pointer shadow-lg active:scale-95 transition"
                    >
                      <Save className="w-4 h-4" />
                      <span>{isSavingPhotos ? 'Guardando...' : 'Guardar Fotografías'}</span>
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}

        </div>
      </div>

      {/* FULL PHOTO VIEW MODAL WITH ZOOM & ROTATE CONTROLS */}
      {selectedPhotoModal && (
        <ImageLightboxModal
          isOpen={!!selectedPhotoModal}
          imageUrl={selectedPhotoModal}
          title={`Expediente de ${cliente?.nombreCompleto || 'Cliente'}`}
          description="Fotografía del cliente, fachada o contrato"
          onClose={() => setSelectedPhotoModal(null)}
        />
      )}

      {/* EDITAR UBICACION Y FACHADA MODAL */}
      <EditarUbicacionModal
        isOpen={showEditUbicacionModal}
        onClose={() => setShowEditUbicacionModal(false)}
        cliente={cliente}
        onSave={(clienteActualizado) => {
          if (onUpdateCliente) {
            onUpdateCliente(clienteActualizado);
          }
        }}
      />

      {/* EDITAR NOTA URGENTE MODAL */}
      <EditarNotaUrgenteModal
        cliente={cliente}
        isOpen={isNotaModalOpen}
        onClose={() => setIsNotaModalOpen(false)}
        onSaveNota={(clienteId, notaText) => {
          if (cliente && onUpdateCliente) {
            onUpdateCliente({
              ...cliente,
              notaUrgente: notaText,
              fechaNotaUrgente: new Date().toISOString(),
            });
          }
        }}
      />
    </div>
  );
}
