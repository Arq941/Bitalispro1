'use client';

import { useState, useRef } from 'react';
import { Venta, Cliente, CorteCaja, Prospecto, Usuario, DiaSemana, Producto } from '@/types';
import { triggerHaptic } from '@/lib/utils';
import { INITIAL_PRODUCTOS } from '@/lib/store';
import UbicacionCoordenadasModal from './UbicacionCoordenadasModal';
import ImageLightboxModal from './ImageLightboxModal';
import InteractiveMap from './InteractiveMap';
import ConfirmationModal from './ConfirmationModal';
import { compressAndOptimizeImage } from './VendedoraView';
import {
  ShieldCheck,
  Check,
  X,
  FileText,
  Wallet,
  DollarSign,
  Calendar,
  AlertCircle,
  RefreshCw,
  Phone,
  MessageSquare,
  Edit,
  Save,
  MapPin,
  ExternalLink,
  Navigation,
  Search,
  UserPlus,
  Clock,
  CheckCircle2,
  Trash2,
  Camera,
  Plus,
  User,
  Upload,
  Package,
  ZoomIn,
  AlertTriangle,
  Users,
  Map,
  Filter,
  Layers,
  Activity,
  Sparkles
} from 'lucide-react';

interface SupVendedorasViewProps {
  ventas: Venta[];
  clientes: Cliente[];
  cortes: CorteCaja[];
  productos?: Producto[];
  usuarios?: Usuario[];
  currentUser?: Usuario | null;
  onApproveVenta: (ventaId: number) => void;
  onRejectVenta: (ventaId: number) => void;
  onSaveCorte: (corte: CorteCaja) => void;
  onUpdateCliente?: (cliente: Cliente) => void;
  onUpdateVenta?: (venta: Venta) => void;
  onAddClienteVenta?: (cliente: Cliente, venta: Venta) => void;
  onSaveProducto?: (producto: Producto) => void;
  onShowActionNotice?: (title: string, message: string, roleTarget?: string) => void;
}

const INITIAL_PROSPECTOS: Prospecto[] = [];

interface SwipeableApprovalVentaCardProps {
  venta: Venta;
  cliente?: Cliente;
  onApproveVenta: (ventaId: number) => void;
  onRejectVenta: (ventaId: number) => void;
  onShowActionNotice?: (title: string, message: string, roleTarget?: string) => void;
  startEditingCombined: (cliente: Cliente, venta?: Venta) => void;
  setLightboxImage: (img: { url: string; title: string }) => void;
  setGeoModalCliente: (cliente: Cliente) => void;
}

function SwipeableApprovalVentaCard({
  venta,
  cliente,
  onApproveVenta,
  onRejectVenta,
  onShowActionNotice,
  startEditingCombined,
  setLightboxImage,
  setGeoModalCliente,
}: SwipeableApprovalVentaCardProps) {
  const [dragOffset, setDragOffset] = useState<number>(0);
  const [isSwiping, setIsSwiping] = useState<boolean>(false);
  const touchStartX = useRef<number | null>(null);

  const contratoImg = cliente?.fotoContrato || 'https://picsum.photos/seed/contract_sample/600/400';
  const fachadaImg = cliente?.fotoFachada || 'https://picsum.photos/seed/house_sample/600/400';
  const clienteImg = cliente?.fotoCliente || 'https://picsum.photos/seed/person_sample/600/400';

  const handleTouchStart = (e: React.TouchEvent) => {
    const target = e.target as HTMLElement;
    if (target.closest('button, a, input, select, textarea, [role="button"]')) return;
    touchStartX.current = e.touches[0].clientX;
    setIsSwiping(true);
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    if (touchStartX.current === null) return;
    const diff = e.touches[0].clientX - touchStartX.current;
    const clamped = Math.max(-140, Math.min(140, diff));
    setDragOffset(clamped);
  };

  const handleTouchEnd = () => {
    if (dragOffset > 75) {
      triggerHaptic([30, 50, 30]);
      onApproveVenta(venta.id);
      if (onShowActionNotice) {
        onShowActionNotice(
          '✅ Venta Aprobada (Por Gesto)',
          `La solicitud de ${venta.clienteNombre} fue aprobada con éxito.`,
          'VENDEDORA'
        );
      }
    } else if (dragOffset < -75) {
      triggerHaptic([20, 30, 20]);
      onRejectVenta(venta.id);
      if (onShowActionNotice) {
        onShowActionNotice(
          '❌ Venta Rechazada (Por Gesto)',
          `La solicitud de ${venta.clienteNombre} fue rechazada.`,
          'VENDEDORA'
        );
      }
    }
    setDragOffset(0);
    setIsSwiping(false);
    touchStartX.current = null;
  };

  return (
    <div
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
      style={{
        transform: `translateX(${dragOffset}px)`,
        transition: isSwiping ? 'none' : 'transform 0.25s cubic-bezier(0.18, 0.89, 0.32, 1.28)',
      }}
      className="bg-gradient-to-br from-slate-900 via-slate-900 to-indigo-950/40 border-2 border-indigo-500/60 hover:border-indigo-400 rounded-2xl p-5 space-y-4 shadow-2xl relative overflow-hidden transition group"
    >
      {/* Visual Gesture Drag Overlays */}
      {dragOffset > 30 && (
        <div
          style={{ opacity: Math.min(1, dragOffset / 75) }}
          className="absolute inset-0 bg-emerald-600/90 backdrop-blur-sm z-30 flex items-center justify-start px-8 font-black text-white text-base sm:text-lg gap-3"
        >
          <Check className="w-8 h-8 bg-white text-emerald-600 rounded-full p-1 shadow-lg shrink-0" />
          <span>👉 SUELTA PARA APROBAR VENTA</span>
        </div>
      )}
      {dragOffset < -30 && (
        <div
          style={{ opacity: Math.min(1, Math.abs(dragOffset) / 75) }}
          className="absolute inset-0 bg-rose-600/90 backdrop-blur-sm z-30 flex items-center justify-end px-8 font-black text-white text-base sm:text-lg gap-3"
        >
          <span>👈 SUELTA PARA RECHAZAR VENTA</span>
          <X className="w-8 h-8 bg-white text-rose-600 rounded-full p-1 shadow-lg shrink-0" />
        </div>
      )}

      {/* Touch Gesture Hint Bar */}
      <div className="flex flex-wrap items-center justify-between gap-1 text-[11px] font-extrabold text-indigo-300 bg-indigo-950/90 px-3 py-1.5 rounded-xl border border-indigo-800/80">
        <span className="flex items-center gap-1">
          <Sparkles className="w-3.5 h-3.5 text-amber-300" />
          Tarjeta Aprobación con Gestos Táctiles
        </span>
        <span className="text-indigo-200 font-mono text-[10px]">
          👉 Desliza derecha: Aprobar | 👈 Izquierda: Rechazar
        </span>
      </div>

      {/* Card Header & Fast Action Buttons */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-800 pb-3">
        <div>
          <div className="flex items-center gap-2">
            <span className="text-xs text-indigo-300 font-mono font-bold bg-slate-950 px-2 py-0.5 rounded border border-indigo-800">
              {venta.clienteFolio || `CLI-${venta.clienteId}`}
            </span>
            <span className="bg-amber-950 text-amber-300 text-[10px] font-bold px-2.5 py-0.5 rounded-full border border-amber-800 animate-pulse">
              PENDIENTE VALIDACIÓN
            </span>
          </div>
          <h4 className="text-xl font-black text-white mt-1">{venta.clienteNombre}</h4>
          <span className="text-xs text-slate-400">
            Vendedora: <strong className="text-purple-300">{venta.vendedoraNombre || cliente?.vendedoraNombre || 'Vendedora de Campo'}</strong> • Fecha: {venta.fechaVenta}
          </span>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {cliente && (
            <button
              type="button"
              onClick={() => startEditingCombined(cliente, venta)}
              className="bg-indigo-950 hover:bg-indigo-900 text-indigo-200 border border-indigo-700 font-bold px-3 py-2 rounded-xl text-xs flex items-center gap-1.5 cursor-pointer transition shadow-sm"
            >
              <Edit className="w-3.5 h-3.5 text-indigo-400" />
              <span>Editar Expediente</span>
            </button>
          )}

          <button
            type="button"
            onClick={() => {
              onApproveVenta(venta.id);
              if (onShowActionNotice) {
                onShowActionNotice(
                  '✅ Venta Aprobada y Activada',
                  `La solicitud de ${venta.clienteNombre} por $${venta.precioBase} MXN fue aprobada.`,
                  'VENDEDORA'
                );
              }
            }}
            className="bg-emerald-600 hover:bg-emerald-500 text-white font-extrabold px-4 py-2 rounded-xl text-xs flex items-center gap-1.5 cursor-pointer shadow-md transition active:scale-95"
          >
            <Check className="w-4 h-4" />
            Aprobar
          </button>

          <button
            type="button"
            onClick={() => {
              onRejectVenta(venta.id);
              if (onShowActionNotice) {
                onShowActionNotice(
                  '❌ Venta Rechazada',
                  `La solicitud de ${venta.clienteNombre} fue rechazada.`,
                  'VENDEDORA'
                );
              }
            }}
            className="bg-red-950 hover:bg-red-900 text-red-300 border border-red-800 font-bold px-3 py-2 rounded-xl text-xs flex items-center gap-1 cursor-pointer transition active:scale-95"
          >
            <X className="w-3.5 h-3.5" />
            Rechazar
          </button>
        </div>
      </div>

      {/* Main Grid: Highlighted Scanned Contract & Details */}
      <div className="grid grid-cols-1 md:grid-cols-12 gap-4 text-xs">
        {/* DESTACADO: FOTOGRAFÍA DEL CONTRATO ESCANEADO */}
        <div className="md:col-span-5 bg-slate-950 p-3.5 rounded-2xl border-2 border-emerald-500/80 shadow-lg space-y-2.5 flex flex-col justify-between">
          <div className="flex items-center justify-between text-xs font-bold text-emerald-300 border-b border-emerald-900/60 pb-2">
            <span className="flex items-center gap-1.5">
              📄 FOTOGRAFÍA DEL CONTRATO
            </span>
            <span className="text-[10px] font-mono text-emerald-400 bg-emerald-950 px-2 py-0.5 rounded border border-emerald-700">
              EXPEDIENTE
            </span>
          </div>

          <div
            onClick={() => setLightboxImage({ url: contratoImg, title: `Contrato Escaneado — ${venta.clienteNombre}` })}
            className="relative h-48 rounded-xl overflow-hidden bg-black border border-emerald-800/80 cursor-pointer group/img"
          >
            <img src={contratoImg} alt="Contrato Escaneado" className="w-full h-full object-cover group-hover/img:scale-105 transition duration-300" />
            <div className="absolute inset-0 bg-slate-950/40 opacity-0 group-hover/img:opacity-100 flex items-center justify-center text-white font-bold text-xs gap-1 transition backdrop-blur-[2px]">
              <ZoomIn className="w-5 h-5 text-emerald-300" />
              <span>Ampliar Fotografía</span>
            </div>
            <div className="absolute bottom-2 left-2 bg-slate-950/90 border border-emerald-500/70 text-emerald-300 px-2 py-1 rounded-lg text-[10px] font-mono font-bold">
              🔍 Click para zoom completo
            </div>
          </div>

          <div className="flex items-center gap-2 pt-1">
            {cliente && (
              <button
                type="button"
                onClick={() => startEditingCombined(cliente, venta)}
                className="w-full py-2 bg-indigo-900 hover:bg-indigo-800 text-indigo-200 border border-indigo-700 font-extrabold rounded-xl text-[11px] flex items-center justify-center gap-1.5 shadow cursor-pointer transition"
              >
                <Edit className="w-3.5 h-3.5 text-indigo-300" />
                <span>Editar Expediente & Fotos</span>
              </button>
            )}
          </div>
        </div>

        {/* DETALLES DEL CLIENTE & DIRECCIÓN */}
        <div className="md:col-span-4 bg-slate-950 p-3.5 rounded-2xl border border-slate-800 space-y-2.5">
          <span className="font-bold text-indigo-300 text-xs block border-b border-slate-800 pb-1.5">
            📍 Datos del Cliente & Ubicación:
          </span>

          <div className="space-y-1 text-[11px] text-slate-300">
            <p><strong>Dirección:</strong> {cliente?.direccion || 'Ubicación registrada en campo'}</p>
            <p><strong>Colonia:</strong> {cliente?.colonia || 'Centro'}</p>
            <p><strong>Teléfono:</strong> {cliente?.telefono || 'No registrado'}</p>
            <p><strong>Día de Cobro:</strong> <span className="text-amber-300 font-bold">{venta.diaCobroZona || 'Lunes'}</span></p>

            {cliente && (
              <div className="bg-slate-900 p-2 rounded-xl border border-slate-800 mt-2 space-y-1">
                <span className="font-mono text-[10px] text-purple-300 font-bold block">
                  GPS: {cliente.latitud}, {cliente.longitud}
                </span>
                <div className="flex items-center gap-2">
                  <a
                    href={`https://www.google.com/maps/search/?api=1&query=${cliente.latitud},${cliente.longitud}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-[10px] text-indigo-400 hover:underline flex items-center gap-0.5 font-bold"
                  >
                    <span>Abrir en Google Maps</span>
                    <ExternalLink className="w-2.5 h-2.5" />
                  </a>
                  <button
                    type="button"
                    onClick={() => setGeoModalCliente(cliente)}
                    className="text-[10px] bg-purple-950 text-purple-300 px-1.5 py-0.5 rounded border border-purple-800 ml-auto font-bold cursor-pointer"
                  >
                    Editar GPS
                  </button>
                </div>
              </div>
            )}

            {/* OTRAS FOTOS CAPTURADAS */}
            <div className="pt-2">
              <span className="text-[10px] font-bold text-slate-400 block mb-1">Otras Evidencias:</span>
              <div className="grid grid-cols-2 gap-2">
                <div
                  onClick={() => setLightboxImage({ url: fachadaImg, title: `Fachada — ${venta.clienteNombre}` })}
                  className="h-14 bg-slate-900 rounded-lg overflow-hidden border border-slate-700 cursor-pointer relative group/fac"
                >
                  <img src={fachadaImg} alt="Fachada" className="w-full h-full object-cover group-hover/fac:scale-105 transition" />
                  <span className="absolute bottom-0.5 left-0.5 bg-slate-950/80 text-[8px] text-slate-300 px-1 rounded">Fachada</span>
                </div>
                <div
                  onClick={() => setLightboxImage({ url: clienteImg, title: `Cliente / INE — ${venta.clienteNombre}` })}
                  className="h-14 bg-slate-900 rounded-lg overflow-hidden border border-slate-700 cursor-pointer relative group/cli"
                >
                  <img src={clienteImg} alt="Cliente" className="w-full h-full object-cover group-hover/cli:scale-105 transition" />
                  <span className="absolute bottom-0.5 left-0.5 bg-slate-950/80 text-[8px] text-slate-300 px-1 rounded">Cliente/INE</span>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* ESTRUCTURA FINANCIERA & EDICIÓN */}
        <div className="md:col-span-3 bg-slate-950 p-3.5 rounded-2xl border border-slate-800 space-y-2.5 flex flex-col justify-between">
          <div>
            <span className="font-bold text-emerald-400 text-xs block border-b border-slate-800 pb-1.5">
              💰 Condición Financiera:
            </span>

            <div className="space-y-1.5 text-[11px] text-slate-300 mt-2">
              <p><strong>Producto:</strong> <span className="text-white font-bold">{venta.productoNombre || 'General'}</span></p>
              <p><strong>Precio Base:</strong> ${venta.precioBase} MXN</p>
              <p><strong>Enganche:</strong> ${venta.engancheMonto} MXN</p>
              <p className="text-emerald-300"><strong>Desc./Aporte:</strong> ${venta.aporteEmpresa ?? venta.descuentoOtorgado ?? 0} MXN</p>
              <p className="text-emerald-400 font-bold text-xs bg-slate-900 p-1.5 rounded-lg border border-slate-800">
                Saldo Inicial: ${venta.saldoInicial} MXN
              </p>
              <p className="text-amber-300 font-bold">1ª Fecha Cobro: {venta.fechaPrimerPago || venta.fechaVenta}</p>
            </div>
          </div>

          <div className="pt-2">
            {cliente && (
              <button
                type="button"
                onClick={() => startEditingCombined(cliente, venta)}
                className="w-full py-2 bg-indigo-950 hover:bg-indigo-900 border border-indigo-700 text-indigo-200 rounded-xl text-xs font-bold flex items-center justify-center gap-1 cursor-pointer transition shadow"
              >
                <Edit className="w-3.5 h-3.5 text-indigo-400" />
                <span>Ajustar Montos / Cobro</span>
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

export default function SupVendedorasView({
  ventas,
  clientes,
  cortes,
  productos = [],
  usuarios = [],
  currentUser,
  onApproveVenta,
  onRejectVenta,
  onSaveCorte,
  onUpdateCliente,
  onUpdateVenta,
  onAddClienteVenta,
  onSaveProducto,
  onShowActionNotice,
}: SupVendedorasViewProps) {
  const [activeTab, setActiveTab] = useState<'auditoria' | 'cartera' | 'prospectos' | 'renovaciones' | 'liquidas' | 'auditoria_enganches' | 'geolocalizacion' | 'viaticos'>('auditoria');
  const [carteraSubTab, setCarteraSubTab] = useState<'lista' | 'mapa_densidades'>('lista');
  const [liquidasSubTab, setLiquidasSubTab] = useState<'activas' | 'historico'>('activas');
  const [engancheFiltro, setEngancheFiltro] = useState<'HOY' | 'SEMANA' | 'TODOS'>('HOY');
  const [carteraFiltroEstatus, setCarteraFiltroEstatus] = useState<'TODOS' | 'PENDIENTE' | 'LIQUIDADO' | 'MOROSO'>('TODOS');
  const [carteraSearchTerm, setCarteraSearchTerm] = useState<string>('');
  const [fabOpen, setFabOpen] = useState<boolean>(false);
  const [lightboxImage, setLightboxImage] = useState<{ url: string; title: string } | null>(null);

  // Prospectos State
  const [prospectos, setProspectos] = useState<Prospecto[]>(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('bitalis_prospectos');
      if (saved) {
        try {
          return JSON.parse(saved);
        } catch {}
      }
    }
    return INITIAL_PROSPECTOS;
  });

  const [showNewProspectoModal, setShowNewProspectoModal] = useState(false);
  const [editingProspecto, setEditingProspecto] = useState<Prospecto | null>(null);

  // New Prospecto Form State
  const [pNombre, setPNombre] = useState('');
  const [pTel, setPTel] = useState('');
  const [pDir, setPDir] = useState('');
  const [pColonia, setPColonia] = useState('');
  const [pRef, setPRef] = useState('');
  const [pFecha, setPFecha] = useState('2026-08-01');
  const [pNota, setPNota] = useState('');
  const [pProductoInteres, setPProductoInteres] = useState('Colchón Matrimonial Ortopédico Premium');
  const [pFoto, setPFoto] = useState('https://picsum.photos/seed/new_prospect_facade/600/400');
  const [pVendedoraNombre, setPVendedoraNombre] = useState('Ana Lucía Gómez');
  const [pLat, setPLat] = useState(19.4326);
  const [pLng, setPLng] = useState(-99.1332);
  const [isCapturingGps, setIsCapturingGps] = useState(false);

  const handleCaptureGpsForProspecto = () => {
    setIsCapturingGps(true);
    if ('geolocation' in navigator) {
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          const lat = Number(pos.coords.latitude.toFixed(6));
          const lng = Number(pos.coords.longitude.toFixed(6));
          setPLat(lat);
          setPLng(lng);
          const autoCol = `Colonia GPS (${lat.toFixed(3)}, ${lng.toFixed(3)})`;
          setPColonia(autoCol);
          if (!pDir) {
            setPDir(`Ubicación GPS: ${lat}, ${lng}`);
          }
          setIsCapturingGps(false);
          alert(`📍 Coordenadas y Colonia autocompletadas por GPS: ${lat}, ${lng}`);
        },
        (err) => {
          setIsCapturingGps(false);
          alert('⚠️ No se pudo obtener la ubicación GPS automáticamente. Puedes ingresar las coordenadas manualmente.');
        },
        { enableHighAccuracy: true, timeout: 8000 }
      );
    } else {
      setIsCapturingGps(false);
      alert('⚠️ Geolocalización no soportada en este navegador.');
    }
  };

  // Viáticos Form State
  const [viaticosMonto, setViaticosMonto] = useState<number>(150);
  const [observacionesCorte, setObservacionesCorte] = useState<string>('');

  // Confirmation Modal State for Venta approval/rejection
  const [confirmSaleAction, setConfirmSaleAction] = useState<{
    type: 'approve' | 'reject';
    ventaId: number;
    clienteNombre: string;
    monto: number;
  } | null>(null);

  // Legacy Edit Modal State
  const [editingCliente, setEditingCliente] = useState<Cliente | null>(null);
  const [editingVenta, setEditingVenta] = useState<Venta | null>(null);
  const [geoModalCliente, setGeoModalCliente] = useState<Cliente | null>(null);
  const [geoSearchTerm, setGeoSearchTerm] = useState<string>('');

  // Unified Fast Supervisor Client & Sale Editor State
  const [editingCombined, setEditingCombined] = useState<{
    cliente: Cliente;
    venta?: Venta;
  } | null>(null);

  const [editNombreCompleto, setEditNombreCompleto] = useState('');
  const [editTelefono, setEditTelefono] = useState('');
  const [editDireccion, setEditDireccion] = useState('');
  const [editColonia, setEditColonia] = useState('');
  const [editReferencias, setEditReferencias] = useState('');
  const [editLatitud, setEditLatitud] = useState<number>(0);
  const [editLongitud, setEditLongitud] = useState<number>(0);
  const [editVendedoraNombre, setEditVendedoraNombre] = useState('');

  // Supervisor Photo Edit States
  const [editFotoFachada, setEditFotoFachada] = useState<string>('');
  const [editFotoCliente, setEditFotoCliente] = useState<string>('');
  const [editFotoContrato, setEditFotoContrato] = useState<string>('');

  // Venta Form Fields (primer fecha de cobro, aporte de descuento de empresa, etc.)
  const [editFechaPrimerPago, setEditFechaPrimerPago] = useState('');
  const [editAporteEmpresa, setEditAporteEmpresa] = useState<number>(0);
  const [editPrecioBase, setEditPrecioBase] = useState<number>(0);
  const [editEngancheMonto, setEditEngancheMonto] = useState<number>(0);
  const [editPagoSemanal, setEditPagoSemanal] = useState<number>(0);
  const [editDiaCobroZona, setEditDiaCobroZona] = useState<DiaSemana>('Lunes');
  const [editFechaVenta, setEditFechaVenta] = useState('');
  const [editProductoNombre, setEditProductoNombre] = useState('');
  const [isCapturingEditGps, setIsCapturingEditGps] = useState(false);

  // Supervisor Direct Sale Creation Modal State
  const [showDirectSaleModal, setShowDirectSaleModal] = useState(false);
  const [dsTipoVenta, setDsTipoVenta] = useState<'CREDITO' | 'CONTADO'>('CREDITO');
  const [dsMontoACobrarContado, setDsMontoACobrarContado] = useState<number>(1490);
  const [dsNombreCompleto, setDsNombreCompleto] = useState('');
  const [dsTelefono, setDsTelefono] = useState('');
  const [dsDireccion, setDsDireccion] = useState('');
  const [dsColonia, setDsColonia] = useState('');
  const [dsReferencias, setDsReferencias] = useState('');
  const [dsZonaId, setDsZonaId] = useState<number>(1);
  const [dsVendedoraNombre, setDsVendedoraNombre] = useState<string>('Ana Lucía Gómez');
  const [dsLatitud, setDsLatitud] = useState<number>(19.4326);
  const [dsLongitud, setDsLongitud] = useState<number>(-99.1332);

  const [dsSelectedProductId, setDsSelectedProductId] = useState<number | null>(1);
  const [dsProductoNombre, setDsProductoNombre] = useState('Colchón Matrimonial Ortopédico Premium');
  const [dsPrecioBase, setDsPrecioBase] = useState<number>(4500);
  const [dsEngancheMonto, setDsEngancheMonto] = useState<number>(300);
  const [dsAporteEmpresa, setDsAporteEmpresa] = useState<number>(100);
  const [dsPagoSemanal, setDsPagoSemanal] = useState<number>(200);
  const [dsFechaVenta, setDsFechaVenta] = useState<string>(new Date().toISOString().split('T')[0]);
  const [dsFechaPrimerPago, setDsFechaPrimerPago] = useState<string>(new Date().toISOString().split('T')[0]);

  const [dsFotoFachada, setDsFotoFachada] = useState<string>('https://picsum.photos/seed/facade_direct/800/500');
  const [dsFotoCliente, setDsFotoCliente] = useState<string>('https://picsum.photos/seed/client_direct/400/400');
  const [dsFotoContrato, setDsFotoContrato] = useState<string>('https://picsum.photos/seed/contract_direct/800/1000');
  const [isCapturingDsGps, setIsCapturingDsGps] = useState(false);

  const handleCaptureGpsForDirectSale = () => {
    setIsCapturingDsGps(true);
    if ('geolocation' in navigator) {
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          setDsLatitud(Number(pos.coords.latitude.toFixed(6)));
          setDsLongitud(Number(pos.coords.longitude.toFixed(6)));
          setIsCapturingDsGps(false);
          alert(`📍 Coordenadas capturadas: ${pos.coords.latitude.toFixed(6)}, ${pos.coords.longitude.toFixed(6)}`);
        },
        () => {
          setIsCapturingDsGps(false);
          alert('⚠️ No se pudo obtener la ubicación GPS.');
        },
        { enableHighAccuracy: true, timeout: 8000 }
      );
    } else {
      setIsCapturingDsGps(false);
      alert('⚠️ Geolocalización no soportada.');
    }
  };

  const startEditingCombined = (cliente: Cliente, ventaObj?: Venta) => {
    const v = ventaObj || ventas.find((ve) => ve.clienteId === cliente.id);
    setEditingCombined({ cliente, venta: v });
    setEditNombreCompleto(cliente.nombreCompleto);
    setEditTelefono(cliente.telefono);
    setEditDireccion(cliente.direccion);
    setEditColonia(cliente.colonia || '');
    setEditReferencias(cliente.referencias);
    setEditLatitud(cliente.latitud);
    setEditLongitud(cliente.longitud);
    setEditVendedoraNombre(cliente.vendedoraNombre || v?.vendedoraNombre || currentUser?.nombre || 'Vendedora de Campo');
    setEditFotoFachada(cliente.fotoFachada || '');
    setEditFotoCliente(cliente.fotoCliente || '');
    setEditFotoContrato(cliente.fotoContrato || '');

    if (v) {
      setEditFechaPrimerPago(v.fechaPrimerPago || v.fechaVenta || new Date().toISOString().split('T')[0]);
      setEditAporteEmpresa(v.aporteEmpresa ?? v.descuentoOtorgado ?? 0);
      setEditPrecioBase(v.precioBase);
      setEditEngancheMonto(v.engancheMonto ?? 0);
      setEditPagoSemanal(v.pagoSemanal);
      setEditDiaCobroZona(v.diaCobroZona || 'Lunes');
      setEditFechaVenta(v.fechaVenta);
      setEditProductoNombre(v.productoNombre || '');
    } else {
      setEditFechaPrimerPago(new Date().toISOString().split('T')[0]);
      setEditAporteEmpresa(0);
      setEditPrecioBase(0);
      setEditEngancheMonto(0);
      setEditPagoSemanal(0);
      setEditDiaCobroZona('Lunes');
      setEditFechaVenta(new Date().toISOString().split('T')[0]);
      setEditProductoNombre('');
    }
  };

  const handleCaptureGpsForEdit = () => {
    setIsCapturingEditGps(true);
    if ('geolocation' in navigator) {
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          setEditLatitud(Number(pos.coords.latitude.toFixed(6)));
          setEditLongitud(Number(pos.coords.longitude.toFixed(6)));
          setIsCapturingEditGps(false);
          alert(`📍 Coordenadas capturadas: ${pos.coords.latitude.toFixed(6)}, ${pos.coords.longitude.toFixed(6)}`);
        },
        () => {
          setIsCapturingEditGps(false);
          alert('⚠️ No se pudo obtener la ubicación GPS automáticamente.');
        },
        { enableHighAccuracy: true, timeout: 8000 }
      );
    } else {
      setIsCapturingEditGps(false);
      alert('⚠️ Geolocalización no soportada.');
    }
  };

  const handleSaveSupervisorCombined = (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingCombined) return;

    const { cliente, venta } = editingCombined;

    const supervisorNombreActual = currentUser?.nombre || 'Supervisora';
    const fechaActualEdit = new Date().toLocaleDateString('es-MX', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });

    const updatedCliente: Cliente = {
      ...cliente,
      nombreCompleto: editNombreCompleto,
      telefono: editTelefono,
      direccion: editDireccion,
      colonia: editColonia,
      referencias: editReferencias,
      latitud: Number(editLatitud),
      longitud: Number(editLongitud),
      vendedoraNombre: editVendedoraNombre,
      fotoFachada: editFotoFachada,
      fotoCliente: editFotoCliente,
      fotoContrato: editFotoContrato,
      fotosEditadasPorNombre: supervisorNombreActual,
      fotosEditadasFecha: fechaActualEdit,
    };

    let updatedVenta: Venta | undefined = undefined;
    if (venta) {
      const newSaldoInicial = Math.max(0, editPrecioBase - editEngancheMonto - editAporteEmpresa);
      updatedVenta = {
        ...venta,
        productoNombre: editProductoNombre || venta.productoNombre || 'General',
        vendedoraNombre: editVendedoraNombre,
        fechaPrimerPago: editFechaPrimerPago,
        aporteEmpresa: Number(editAporteEmpresa),
        descuentoOtorgado: Number(editAporteEmpresa),
        precioBase: Number(editPrecioBase),
        engancheMonto: Number(editEngancheMonto),
        saldoInicial: newSaldoInicial,
        saldoActual: newSaldoInicial,
        pagoSemanal: Number(editPagoSemanal),
        diaCobroZona: editDiaCobroZona,
        fechaVenta: editFechaVenta,
      };
    }

    const usuarioSesionNombre = currentUser?.nombre || 'Elena Rostro (Supervisora)';

    // Log saleswoman assigned & user in session
    console.log('✏️ [SUPERVISIÓN - EDICIÓN CLIENTE Y VENTA]', {
      usuarioEnSesion: usuarioSesionNombre,
      vendedoraAsignada: editVendedoraNombre,
      clienteId: updatedCliente.id,
      clienteNombre: updatedCliente.nombreCompleto,
      primerFechaCobro: editFechaPrimerPago,
      aporteEmpresa: editAporteEmpresa,
      clienteActualizado: updatedCliente,
      ventaActualizada: updatedVenta,
    });

    if (onUpdateCliente) {
      onUpdateCliente(updatedCliente);
    }
    if (updatedVenta && onUpdateVenta) {
      onUpdateVenta(updatedVenta);
    }

    // Explicit success alert as requested by user
    alert('Cliente y venta guardado con éxito');

    if (onShowActionNotice) {
      onShowActionNotice(
        '✅ Edición de Supervisora',
        'Cliente y venta guardado con éxito',
        'SUPERVISORA'
      );
    }

    setEditingCombined(null);
  };

  const ventasPendientes = ventas.filter((v) => v.estado === 'PENDIENTE_VALIDACION');
  const ventasAprobadas = ventas.filter((v) => v.estado === 'APROBADA');

  // Renewals logic (saldo <= 200)
  const clientesParaRenovacion = clientes.filter((c) => {
    const v = ventas.find((ve) => ve.clienteId === c.id);
    return v && v.saldoActual <= 200;
  });

  // Portfolio metrics calculations
  const clientesConSaldo = clientes.filter((c) => {
    const v = ventas.find((ve) => ve.clienteId === c.id);
    return v ? v.saldoActual > 0 : true;
  });

  const clientesLiquidados = clientes.filter((c) => {
    const v = ventas.find((ve) => ve.clienteId === c.id);
    return v ? v.saldoActual === 0 : false;
  });

  const saldoTotalPendienteSum = clientes.reduce((acc, c) => {
    const v = ventas.find((ve) => ve.clienteId === c.id);
    return acc + (v ? v.saldoActual : 0);
  }, 0);

  const corteVendedoraHoy = cortes.find(
    (c) => c.rolTipo === 'VENDEDORA' && c.fecha === new Date().toISOString().split('T')[0]
  ) || {
    id: 999,
    usuarioId: 1,
    usuarioNombre: 'Ana Lucía Gómez',
    rolTipo: 'VENDEDORA' as const,
    fecha: new Date().toISOString().split('T')[0],
    fondoInicial: 200,
    gastosGasolina: 0,
    viaticos: 150,
    efectivoRecolectado: 300,
    efectivoEntregado: 450,
    diferencia: 0,
    estado: 'ABIERTO' as const,
    observaciones: 'Corte de caja vendedora del día',
  };

  // Reconcile calculation
  const totalEnganchesHoy = ventasAprobadas.reduce((sum, v) => sum + (v.engancheMonto || 0), 0);
  const totalEfectivoEsperado = corteVendedoraHoy.fondoInicial + totalEnganchesHoy - viaticosMonto;

  const handleSaveEditedCliente = (e: React.FormEvent) => {
    e.preventDefault();
    if (editingCliente && onUpdateCliente) {
      onUpdateCliente(editingCliente);
      setEditingCliente(null);
      alert('¡Datos del cliente actualizados correctamente!');
    }
  };

  const handleSaveEditedVenta = (e: React.FormEvent) => {
    e.preventDefault();
    if (editingVenta && onUpdateVenta) {
      onUpdateVenta(editingVenta);
      setEditingVenta(null);
      alert('¡Condiciones de la venta actualizadas!');
    }
  };

  return (
    <div className="space-y-6">
      {/* REAL-TIME DYNAMIC METRICS CARDS (Supervisor Dashboard) */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 sm:gap-4">
        {/* Card 1: Auditoría / Pendientes */}
        <div
          onClick={() => {
            setActiveTab('auditoria');
            if (ventasPendientes.length > 0) {
              const firstVenta = ventasPendientes[0];
              const cliente = clientes.find((c) => c.id === firstVenta.clienteId);
              if (cliente) {
                startEditingCombined(cliente, firstVenta);
              }
            }
          }}
          className={`p-4 rounded-2xl border transition shadow-lg cursor-pointer flex flex-col justify-between ${
            ventasPendientes.length > 0
              ? 'bg-gradient-to-br from-amber-950/80 to-slate-900 border-amber-500/80 hover:border-amber-400'
              : 'bg-slate-900/90 border-slate-700/80 hover:border-slate-600'
          }`}
        >
          <div className="flex items-center justify-between">
            <span className="text-xs text-slate-400 font-bold">Auditoría Pendiente</span>
            <ShieldCheck className={`w-5 h-5 ${ventasPendientes.length > 0 ? 'text-amber-400 animate-pulse' : 'text-slate-400'}`} />
          </div>
          <div className="mt-2">
            <span className="text-2xl sm:text-3xl font-black text-white">{ventasPendientes.length}</span>
            <span className="text-[10px] text-slate-400 block font-medium">
              {ventasPendientes.length > 0 ? '⚡ Toc para validar expediente' : '✅ Todo al día'}
            </span>
          </div>
        </div>

        {/* Card 2: Prospectos */}
        <div
          onClick={() => {
            setActiveTab('prospectos');
            setPNombre('');
            setPTel('');
            setPDir('');
            setPColonia('');
            setPRef('');
            setPFecha('2026-08-01');
            setPNota('');
            setPVendedoraNombre('Ana Lucía Gómez');
            setPFoto('https://picsum.photos/seed/' + Math.floor(Math.random() * 1000) + '/600/400');
            setShowNewProspectoModal(true);
          }}
          className="bg-slate-900/90 border border-slate-700/80 hover:border-purple-500/80 p-4 rounded-2xl transition shadow-lg cursor-pointer flex flex-col justify-between"
        >
          <div className="flex items-center justify-between">
            <span className="text-xs text-slate-400 font-bold">Prospectos</span>
            <UserPlus className="w-5 h-5 text-purple-400" />
          </div>
          <div className="mt-2">
            <span className="text-2xl sm:text-3xl font-black text-white">{prospectos.length}</span>
            <span className="text-[10px] text-purple-300 block font-medium">➕ Toca para registrar nuevo</span>
          </div>
        </div>

        {/* Card 3: Renovaciones */}
        <div
          onClick={() => {
            setActiveTab('renovaciones');
            if (clientesParaRenovacion.length > 0) {
              const firstCliente = clientesParaRenovacion[0];
              const venta = ventas.find((v) => v.clienteId === firstCliente.id);
              startEditingCombined(firstCliente, venta);
            }
          }}
          className="bg-slate-900/90 border border-slate-700/80 hover:border-amber-500/80 p-4 rounded-2xl transition shadow-lg cursor-pointer flex flex-col justify-between"
        >
          <div className="flex items-center justify-between">
            <span className="text-xs text-slate-400 font-bold">Renovaciones</span>
            <RefreshCw className="w-5 h-5 text-amber-400" />
          </div>
          <div className="mt-2">
            <span className="text-2xl sm:text-3xl font-black text-white">{clientesParaRenovacion.length}</span>
            <span className="text-[10px] text-amber-300 block font-medium">🔄 Toca para renovar expediente</span>
          </div>
        </div>

        {/* Card 4: Cartera & Saldo Pendiente */}
        <div
          onClick={() => {
            setActiveTab('cartera');
          }}
          className="bg-slate-900/90 border border-slate-700/80 hover:border-emerald-500/80 p-4 rounded-2xl transition shadow-lg cursor-pointer flex flex-col justify-between"
        >
          <div className="flex items-center justify-between">
            <span className="text-xs text-slate-400 font-bold">Cartera Activa</span>
            <Wallet className="w-5 h-5 text-emerald-400" />
          </div>
          <div className="mt-2">
            <div className="flex items-baseline gap-1">
              <span className="text-2xl sm:text-3xl font-black text-emerald-400">{clientesConSaldo.length}</span>
              <span className="text-xs text-slate-400">({clientesLiquidados.length} liquidados)</span>
            </div>
            <span className="text-[10px] text-emerald-300 block font-medium">
              ${saldoTotalPendienteSum.toLocaleString('es-MX')} MXN pendiente
            </span>
          </div>
        </div>
      </div>

      {/* NAVEGACIÓN DE PESTAÑAS DEL MÓDULO SUPERVISORA */}
      <div className="flex items-center gap-1.5 overflow-x-auto pb-2 scrollbar-none border-b border-slate-700">
        {[
          { id: 'auditoria', label: '🛡️ Auditoría OCR', count: ventasPendientes.length },
          { id: 'liquidas', label: '💵 Líquidas / Contado', count: ventas.filter((v) => v.tipo === 'CONTADO' && !v.archivadoHistorico).length },
          { id: 'auditoria_enganches', label: '📊 Control Enganches', count: undefined },
          { id: 'cartera', label: '📁 Cartera Clientes', count: clientesConSaldo.length },
          { id: 'renovaciones', label: '🔄 Renovaciones (3-4m)', count: clientesParaRenovacion.length },
          { id: 'prospectos', label: '👥 Prospectos Campo', count: prospectos.length },
          { id: 'geolocalizacion', label: '🗺️ Mapa Coordenadas', count: undefined },
          { id: 'viaticos', label: '💼 Viáticos', count: undefined },
        ].map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id as any)}
            className={`px-3.5 py-2.5 rounded-xl text-xs font-black whitespace-nowrap transition cursor-pointer border flex items-center gap-1.5 ${
              activeTab === tab.id
                ? 'bg-gradient-to-r from-indigo-600 to-violet-600 text-white border-indigo-400 shadow-md'
                : 'bg-slate-900/80 text-slate-400 border-slate-800 hover:text-white hover:border-slate-700'
            }`}
          >
            <span>{tab.label}</span>
            {tab.count !== undefined && (
              <span className={`px-1.5 py-0.5 text-[10px] font-mono rounded-full font-bold ${
                activeTab === tab.id ? 'bg-white/20 text-white' : 'bg-slate-800 text-slate-300'
              }`}>
                {tab.count}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* TAB 1: AUDITORÍA DE VENTAS */}
      {activeTab === 'auditoria' && (
        <div className="space-y-6">
          {ventasPendientes.length > 0 ? (
            <div className="bg-slate-800/90 border border-slate-700 rounded-2xl p-6 shadow-xl space-y-5 animate-fadeIn">
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-700 pb-3">
              <div>
                <h3 className="text-xl font-black text-white flex items-center gap-2">
                  <ShieldCheck className="w-6 h-6 text-emerald-400" />
                  Pendientes de Validación (15 Más Recientes)
                </h3>
                <p className="text-xs text-slate-400 mt-1">
                  Revisiones prioritarias enviadas desde campo por vendedoras. Permite edición manual completa de datos y fotografías del expediente antes de su aprobación.
                </p>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                <span className="bg-amber-950 border border-amber-600/80 text-amber-300 font-extrabold text-xs px-3 py-1.5 rounded-full shadow">
                  ⚡ {ventasPendientes.length} Total Pendientes
                </span>

                <button
                  type="button"
                  onClick={() => {
                    setDsNombreCompleto('');
                    setDsTelefono('');
                    setDsDireccion('');
                    setDsColonia('');
                    setDsReferencias('');
                    setDsProductoNombre('Colchón Matrimonial Ortopédico Premium');
                    setDsPrecioBase(4500);
                    setDsEngancheMonto(300);
                    setDsAporteEmpresa(100);
                    setDsPagoSemanal(200);
                    setDsFechaVenta(new Date().toISOString().split('T')[0]);
                    setDsFechaPrimerPago(new Date().toISOString().split('T')[0]);
                    setShowDirectSaleModal(true);
                  }}
                  className="bg-gradient-to-r from-emerald-600 to-indigo-600 hover:from-emerald-500 hover:to-indigo-500 text-white font-extrabold text-xs px-3.5 py-1.5 rounded-xl shadow-lg flex items-center gap-1.5 cursor-pointer transition active:scale-95"
                >
                  <Plus className="w-4 h-4 text-emerald-300" />
                  <span>➕ Levantar Venta Directa (Supervisora)</span>
                </button>
              </div>
            </div>

            <div className="space-y-5">
                {[...ventasPendientes].reverse().slice(0, 15).map((venta) => {
                  const cliente = clientes.find((c) => c.id === venta.clienteId);
                  return (
                    <SwipeableApprovalVentaCard
                      key={venta.id}
                      venta={venta}
                      cliente={cliente}
                      onApproveVenta={onApproveVenta}
                      onRejectVenta={onRejectVenta}
                      onShowActionNotice={onShowActionNotice}
                      startEditingCombined={startEditingCombined}
                      setLightboxImage={setLightboxImage}
                      setGeoModalCliente={setGeoModalCliente}
                    />
                  );
                })}
              </div>
            </div>
          ) : (
            <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-8 text-center text-slate-400 space-y-3 shadow-lg">
              <ShieldCheck className="w-12 h-12 text-emerald-400 mx-auto opacity-80" />
              <h4 className="text-white font-black text-lg">✅ Auditoría al Día</h4>
              <p className="text-xs text-slate-400 max-w-md mx-auto">
                No hay expedientes ni altas pendientes de revisión en este momento. Todas las solicitudes han sido validadas correctamente.
              </p>
              <button
                type="button"
                onClick={() => {
                  setDsNombreCompleto('');
                  setDsTelefono('');
                  setDsDireccion('');
                  setDsColonia('');
                  setDsReferencias('');
                  setDsProductoNombre('Colchón Matrimonial Ortopédico Premium');
                  setDsPrecioBase(4500);
                  setDsEngancheMonto(300);
                  setDsAporteEmpresa(100);
                  setDsPagoSemanal(200);
                  setDsFechaVenta(new Date().toISOString().split('T')[0]);
                  setDsFechaPrimerPago(new Date().toISOString().split('T')[0]);
                  setShowDirectSaleModal(true);
                }}
                className="mt-2 bg-gradient-to-r from-emerald-600 to-indigo-600 hover:from-emerald-500 hover:to-indigo-500 text-white font-extrabold text-xs px-4 py-2.5 rounded-xl shadow-lg inline-flex items-center gap-2 cursor-pointer transition active:scale-95"
              >
                <Plus className="w-4 h-4 text-emerald-200" />
                <span>➕ Levantar Venta Directa (Supervisora)</span>
              </button>
            </div>
          )}
        </div>
      )}

      {/* TAB: LÍQUIDAS / CONTADO (SOPORTE HISTÓRICO Y RENOVACIÓN A 3-4 MESES) */}
      {activeTab === 'liquidas' && (
        <div className="bg-slate-800/90 border border-slate-700 rounded-2xl p-6 shadow-xl space-y-5 animate-fadeIn">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-700 pb-3">
            <div>
              <h3 className="text-xl font-black text-white flex items-center gap-2">
                <DollarSign className="w-6 h-6 text-emerald-400" />
                Módulo Líquidas y Ventas de Contado
              </h3>
              <p className="text-xs text-slate-400 mt-1">
                Registro histórico de operaciones contraentrega o pago único sin plan de abonos. Emite alerta de renovación entre 3 y 4 meses post-compra.
              </p>
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setLiquidasSubTab('activas')}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold transition ${
                  liquidasSubTab === 'activas'
                    ? 'bg-emerald-600 text-white font-black shadow'
                    : 'bg-slate-900 text-slate-400 border border-slate-700'
                }`}
              >
                💵 Líquidas Activas ({ventas.filter(v => v.tipo === 'CONTADO' && !v.archivadoHistorico).length})
              </button>
              <button
                type="button"
                onClick={() => setLiquidasSubTab('historico')}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold transition ${
                  liquidasSubTab === 'historico'
                    ? 'bg-indigo-600 text-white font-black shadow'
                    : 'bg-slate-900 text-slate-400 border border-slate-700'
                }`}
              >
                📥 Archivo Definitivo ({ventas.filter(v => v.tipo === 'CONTADO' && v.archivadoHistorico).length})
              </button>
            </div>
          </div>

          {ventas.filter(v => v.tipo === 'CONTADO' && (liquidasSubTab === 'historico' ? v.archivadoHistorico : !v.archivadoHistorico)).length === 0 ? (
            <div className="p-8 text-center bg-slate-900 border border-slate-800 rounded-2xl text-slate-400 text-xs">
              No hay ventas de contado registradas en este sub-módulo.
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {ventas
                .filter(v => v.tipo === 'CONTADO' && (liquidasSubTab === 'historico' ? v.archivadoHistorico : !v.archivadoHistorico))
                .map((v) => {
                  const cliente = clientes.find((c) => c.id === v.clienteId);
                  const fechaVentaDate = new Date(v.fechaVenta || Date.now());
                  const diffDays = Math.floor((Date.now() - fechaVentaDate.getTime()) / (1000 * 60 * 60 * 24));
                  const esElegibleRenovacion = diffDays >= 90;

                  return (
                    <div key={v.id} className="bg-slate-900 border border-slate-700 hover:border-emerald-500/80 p-4 rounded-2xl space-y-3 shadow-md relative">
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <span className="text-[10px] font-mono font-bold text-emerald-400 bg-emerald-950 px-2 py-0.5 rounded border border-emerald-800">
                            CONTADO / LÍQUIDA
                          </span>
                          <h4 className="font-extrabold text-white text-sm mt-1">{v.clienteNombre || cliente?.nombreCompleto || 'Cliente Contado'}</h4>
                          <p className="text-[11px] text-slate-400">{cliente?.direccion || 'Ubicación registrada'}</p>
                        </div>
                        <div className="text-right font-mono">
                          <span className="text-xs text-slate-400 block">Monto Cobrado</span>
                          <span className="text-lg font-black text-emerald-400">${(v.montoACobrarContado || v.precioBase).toLocaleString('es-MX')} MXN</span>
                        </div>
                      </div>

                      <div className="bg-slate-950 p-2.5 rounded-xl border border-slate-800 text-[11px] grid grid-cols-2 gap-2 text-slate-300">
                        <div>
                          <span className="text-slate-400 block">Producto:</span>
                          <span className="font-bold text-white">{v.productoNombre}</span>
                        </div>
                        <div>
                          <span className="text-slate-400 block">Fecha Compra:</span>
                          <span className="font-mono text-emerald-300">{v.fechaVenta} ({diffDays} días transcurridos)</span>
                        </div>
                      </div>

                      {esElegibleRenovacion && (
                        <div className="p-2.5 bg-amber-950/80 border border-amber-500/80 rounded-xl text-xs text-amber-200 flex items-center justify-between gap-2">
                          <div>
                            <span className="font-bold text-amber-300 block">🔄 RENOVACIÓN SUGERIDA (3-4 Meses)</span>
                            <span className="text-[10px] text-amber-200/80">Han transcurrido {diffDays} días desde su compra.</span>
                          </div>
                          <a
                            href={`https://wa.me/52${cliente?.telefono}?text=${encodeURIComponent(`Hola ${v.clienteNombre}, te saludamos de Bitalis. Han transcurrido ${diffDays} días desde tu compra de ${v.productoNombre}. ¿Te gustaría conocer nuestro catálogo de renovación con entregas preferenciales?`)}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="px-2.5 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg font-bold text-[11px] flex items-center gap-1 shrink-0"
                          >
                            <MessageSquare className="w-3.5 h-3.5" />
                            <span>WhatsApp</span>
                          </a>
                        </div>
                      )}

                      <div className="flex items-center justify-between pt-2 border-t border-slate-800 text-[11px]">
                        <span className="text-slate-400">Vendedora: <strong className="text-slate-200">{v.vendedoraNombre}</strong></span>
                        {onUpdateVenta && (
                          <button
                            type="button"
                            onClick={() => {
                              onUpdateVenta({ ...v, archivadoHistorico: !v.archivadoHistorico });
                            }}
                            className="text-indigo-400 hover:text-indigo-300 font-bold underline cursor-pointer"
                          >
                            {v.archivadoHistorico ? '↩️ Restaurar a Líquidas Activas' : '📥 Trasladar a Archivo Histórico'}
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })}
            </div>
          )}
        </div>
      )}

      {/* TAB: AUDITORÍA Y CONTROL DE ENGANCHES */}
      {activeTab === 'auditoria_enganches' && (
        <div className="bg-slate-800/90 border border-slate-700 rounded-2xl p-6 shadow-xl space-y-5 animate-fadeIn">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-700 pb-3">
            <div>
              <h3 className="text-xl font-black text-white flex items-center gap-2">
                <Sparkles className="w-6 h-6 text-amber-400" />
                Control y Auditoría de Enganches
              </h3>
              <p className="text-xs text-slate-400 mt-1">
                Monitoreo detallado de enganches cobrados en firma (vendedoras/supervisión) vs prórrogas asignadas al cobrador en ruta.
              </p>
            </div>

            <div className="flex items-center gap-2">
              {(['HOY', 'SEMANA', 'TODOS'] as const).map((f) => (
                <button
                  key={f}
                  type="button"
                  onClick={() => setEngancheFiltro(f)}
                  className={`px-3 py-1.5 rounded-xl text-xs font-bold transition ${
                    engancheFiltro === f
                      ? 'bg-amber-500 text-slate-950 font-black shadow'
                      : 'bg-slate-900 text-slate-400 border border-slate-700 hover:text-white'
                  }`}
                >
                  {f === 'HOY' ? '📅 Día de Hoy' : f === 'SEMANA' ? '📆 Esta Semana' : '🗂️ Histórico Completo'}
                </button>
              ))}
            </div>
          </div>

          {/* ENGANCHES METRICS BREAKDOWN */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div className="p-4 bg-slate-900 border border-emerald-500/60 rounded-2xl">
              <span className="text-[11px] text-emerald-300 font-bold block">✓ Enganches Cobrados en Firma</span>
              <span className="text-2xl font-black text-emerald-400 mt-1 block">
                ${ventas.filter(v => v.tipo === 'CREDITO' && (v.engancheMonto || 0) > 0).reduce((acc, v) => acc + (v.engancheMonto || 0), 0).toLocaleString('es-MX')} MXN
              </span>
              <span className="text-[10px] text-slate-400 mt-0.5 block">Ingreso inmediato recibido por vendedora</span>
            </div>

            <div className="p-4 bg-slate-900 border border-amber-500/60 rounded-2xl">
              <span className="text-[11px] text-amber-300 font-bold block">⏳ Enganches en Prórroga (Cobrador)</span>
              <span className="text-2xl font-black text-amber-400 mt-1 block">
                ${ventas.filter(v => v.tipo === 'CREDITO' && v?.engancheEstatus === 'PRORROGA').reduce((acc, v) => acc + (v.engancheMonto || 0), 0).toLocaleString('es-MX')} MXN
              </span>
              <span className="text-[10px] text-slate-400 mt-0.5 block">Por recuperar en 1a semana en ruta</span>
            </div>

            <div className="p-4 bg-slate-900 border border-indigo-500/60 rounded-2xl">
              <span className="text-[11px] text-indigo-300 font-bold block">🎁 Total Bonificación Empresa Grant</span>
              <span className="text-2xl font-black text-indigo-300 mt-1 block">
                ${ventas.reduce((acc, v) => acc + (v.aporteEmpresa || v.descuentoOtorgado || 0), 0).toLocaleString('es-MX')} MXN
              </span>
              <span className="text-[10px] text-slate-400 mt-0.5 block">Capital total bonificado al principal</span>
            </div>
          </div>

          {/* TABLE OF SALES ENGANCHES AUDIT */}
          <div className="bg-slate-950 rounded-2xl border border-slate-800 overflow-x-auto">
            <table className="w-full text-left text-xs text-slate-300">
              <thead className="bg-slate-900 text-slate-400 font-mono text-[11px] border-b border-slate-800">
                <tr>
                  <th className="p-3">Cliente / Folio</th>
                  <th className="p-3">Vendedora</th>
                  <th className="p-3">Enganche Entregado</th>
                  <th className="p-3">Bono Empresa</th>
                  <th className="p-3">Lugar / Estado Cobro</th>
                  <th className="p-3">Primer Cobro</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800">
                {ventas.filter(v => v.tipo === 'CREDITO').map((v) => (
                  <tr key={v.id} className="hover:bg-slate-900/60 transition">
                    <td className="p-3 font-bold text-white">
                      {v.clienteNombre}
                      <span className="block text-[10px] font-mono text-slate-400">ID: #{v.id}</span>
                    </td>
                    <td className="p-3">{v.vendedoraNombre}</td>
                    <td className="p-3 font-mono font-bold text-emerald-400">${v.engancheMonto} MXN</td>
                    <td className="p-3 font-mono font-bold text-indigo-300">+${v.aporteEmpresa || v.descuentoOtorgado || 0} MXN</td>
                    <td className="p-3">
                      <span className={`px-2 py-0.5 rounded font-extrabold text-[10px] border ${
                        v.engancheEstatus === 'PRORROGA'
                          ? 'bg-amber-950 text-amber-300 border-amber-800'
                          : 'bg-emerald-950 text-emerald-300 border-emerald-800'
                      }`}>
                        {v.engancheEstatus === 'PRORROGA' ? '⏳ Prórroga 1a Sem (Cobrador)' : '✓ Pagado en Firma'}
                      </span>
                    </td>
                    <td className="p-3 font-mono text-slate-300">{v.fechaPrimerPago}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* TAB 2: RENOVACIONES EXCLUSIVAS SUPERVISORA */}
      {activeTab === 'renovaciones' && (
        <div className="bg-slate-800/90 border border-slate-700 rounded-2xl p-6 shadow-xl space-y-5">
          <div>
            <h3 className="text-xl font-bold text-white flex items-center gap-2">
              <RefreshCw className="w-6 h-6 text-amber-400" />
              Gestión de Renovaciones de Créditos (Exclusivo Supervisión)
            </h3>
            <p className="text-sm text-slate-400">
              Clientes con saldo congelado o liquidado ( $0 - $200 ) elegibles para una nueva colocación de producto.
            </p>
          </div>

          {clientesParaRenovacion.length === 0 ? (
            <div className="p-8 text-center bg-slate-900 border border-slate-800 rounded-xl text-slate-400 text-sm">
              No hay clientes pendientes de renovación en este momento.
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {clientesParaRenovacion.map((cliente) => {
                const venta = ventas.find((v) => v.clienteId === cliente.id);
                return (
                  <div
                    key={cliente.id}
                    className="bg-slate-900 border-2 border-amber-500/50 rounded-2xl p-4 space-y-3 relative overflow-hidden"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex items-start gap-3">
                        <img
                          src={cliente.fotoCliente || 'https://picsum.photos/seed/person/200/200'}
                          alt={cliente.nombreCompleto}
                          className="w-12 h-12 rounded-xl object-cover border border-slate-700 shrink-0"
                        />
                        <div>
                          <h4 className="font-bold text-white text-base">{cliente.nombreCompleto}</h4>
                          <p className="text-xs text-slate-400">{cliente.direccion}</p>
                          <p className="text-xs text-indigo-300 font-semibold mt-0.5">Tel: {cliente.telefono}</p>
                        </div>
                      </div>

                      <button
                        onClick={() => startEditingCombined(cliente, venta)}
                        className="p-2 bg-indigo-950 hover:bg-indigo-900 border border-indigo-800 rounded-xl text-indigo-300 text-xs font-bold flex items-center gap-1 cursor-pointer"
                      >
                        <Edit className="w-3.5 h-3.5 text-indigo-400" /> Editar Cliente & Venta
                      </button>
                    </div>

                    <div className="bg-slate-950 p-3 rounded-xl border border-slate-800 flex justify-between items-center text-xs">
                      <div>
                        <span className="block text-slate-400">Saldo Restante:</span>
                        <span className="font-black text-amber-400 text-sm">${venta?.saldoActual || 0} MXN</span>
                      </div>
                      <div className="text-right">
                        <span className="block text-slate-400">Día de Cobro:</span>
                        <span className="font-bold text-slate-200">{venta?.diaCobroZona || 'Lunes'}</span>
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-2 pt-1">
                      <a
                        href={`tel:${cliente.telefono}`}
                        className="min-h-[40px] bg-emerald-700 hover:bg-emerald-600 text-white font-bold px-3 py-2 rounded-xl text-xs flex items-center justify-center gap-1.5 cursor-pointer"
                      >
                        <Phone className="w-4 h-4" /> Llamar
                      </a>
                      <a
                        href={`https://wa.me/52${cliente.telefono.replace(/\D/g, '')}?text=${encodeURIComponent(
                          `Hola ${cliente.nombreCompleto}, le saluda la Supervisora de Ventas de BITALIS. Vemos que ya está por terminar su crédito. Nos gustaría ofrecerle una renovación exclusiva con catálogo nuevo.`
                        )}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="min-h-[40px] bg-emerald-600 hover:bg-emerald-500 text-white font-bold px-3 py-2 rounded-xl text-xs flex items-center justify-center gap-1.5 cursor-pointer"
                      >
                        <MessageSquare className="w-4 h-4" /> WhatsApp
                      </a>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* TAB 2: CARTERA DE CLIENTES */}
      {activeTab === 'cartera' && (
        <div className="space-y-6 animate-fadeIn">
          {/* Header & Filters */}
          <div className="bg-slate-800/90 border border-slate-700 rounded-2xl p-5 shadow-xl space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <h3 className="text-xl font-black text-white flex items-center gap-2">
                  <Wallet className="w-6 h-6 text-emerald-400" />
                  Módulo de Cartera de Clientes (Control Total)
                </h3>
                <p className="text-xs text-slate-400 mt-1">
                  Acceso directo a expedientes, llamadas, WhatsApp y edición de cualquier campo con 1 solo toque.
                </p>
              </div>
            </div>

            {/* Filters & Search */}
            <div className="flex flex-wrap items-center justify-between gap-3 pt-2 border-t border-slate-700/80">
              <div className="relative max-w-sm w-full">
                <Search className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
                <input
                  type="text"
                  value={carteraSearchTerm}
                  onChange={(e) => setCarteraSearchTerm(e.target.value)}
                  placeholder="Buscar por cliente, folio, colonia o vendedora..."
                  className="w-full bg-slate-950 border border-slate-700 rounded-xl pl-9 pr-3 py-2 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500"
                />
              </div>

              <div className="flex items-center gap-1.5 overflow-x-auto pb-1">
                <span className="text-xs text-slate-400 font-bold mr-1 flex items-center gap-1">
                  <Filter className="w-3.5 h-3.5 text-indigo-400" /> Filtrar Estatus:
                </span>
                {(['TODOS', 'PENDIENTE', 'LIQUIDADO', 'MOROSO'] as const).map((st) => (
                  <button
                    key={st}
                    type="button"
                    onClick={() => setCarteraFiltroEstatus(st)}
                    className={`px-3 py-1.5 rounded-xl text-xs font-bold transition cursor-pointer ${
                      carteraFiltroEstatus === st
                        ? 'bg-gradient-to-r from-emerald-600 to-indigo-600 text-white shadow-lg'
                        : 'bg-slate-900 text-slate-400 hover:text-white border border-slate-800'
                    }`}
                  >
                    {st === 'TODOS'
                      ? 'Todos'
                      : st === 'PENDIENTE'
                      ? 'Con Saldo'
                      : st === 'LIQUIDADO'
                      ? 'Liquidados'
                      : '🔴 Morosos'}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* DETAILED CLIENT LIST CARDS */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
            {clientes
              .filter((c) => {
                const v = ventas.find((ve) => ve.clienteId === c.id);
                if (carteraFiltroEstatus === 'PENDIENTE' && (!v || v.saldoActual <= 0)) return false;
                if (carteraFiltroEstatus === 'LIQUIDADO' && (v && v.saldoActual > 0)) return false;
                if (carteraFiltroEstatus === 'MOROSO' && c.estadoMorosidad !== 'ROJO') return false;

                if (!carteraSearchTerm) return true;
                const term = carteraSearchTerm.toLowerCase();
                return (
                  (c.nombreCompleto && c.nombreCompleto.toLowerCase().includes(term)) ||
                  (c.folio && c.folio.toLowerCase().includes(term)) ||
                  (c.colonia && c.colonia.toLowerCase().includes(term)) ||
                  (c.direccion && c.direccion.toLowerCase().includes(term)) ||
                  (c.vendedoraNombre && c.vendedoraNombre.toLowerCase().includes(term))
                );
              })
              .map((cliente) => {
                const venta = ventas.find((ve) => ve.clienteId === cliente.id);
                const isLiquidado = venta ? venta.saldoActual === 0 : false;
                const isMoroso = cliente.estadoMorosidad === 'ROJO';
                const saldoVal = venta ? venta.saldoActual : 0;

                // Find matching product in catalog for dynamic AJAX image
                const matchedProduct = (productos || []).find(
                  (p) => p.nombre.toLowerCase() === (venta?.productoNombre || '').toLowerCase()
                );
                const prodImgUrl =
                  matchedProduct?.fotoUrl ||
                  'https://picsum.photos/seed/product_' + cliente.id + '/400/300';

                const foto1 = cliente.fotoFachada || 'https://picsum.photos/seed/facade_' + cliente.id + '/600/400';
                const foto2 = cliente.fotoCliente || 'https://picsum.photos/seed/client_' + cliente.id + '/400/400';
                const foto3 = cliente.fotoContrato || 'https://picsum.photos/seed/contract_' + cliente.id + '/600/800';

                return (
                  <div
                    key={cliente.id}
                    className={`bg-slate-900 rounded-3xl p-5 space-y-4 shadow-2xl transition flex flex-col justify-between border-2 ${
                      isMoroso
                        ? 'border-red-500 shadow-red-950/40 animate-pulse'
                        : isLiquidado
                        ? 'border-emerald-500/90 shadow-emerald-950/30'
                        : 'border-amber-500/90 shadow-amber-950/30'
                    }`}
                  >
                    {/* Top Header */}
                    <div className="space-y-2">
                      <div className="flex items-center justify-between gap-2 border-b border-slate-800 pb-2">
                        <span className="text-xs font-mono font-black text-indigo-300 bg-slate-950 px-2.5 py-1 rounded-xl border border-indigo-900/80 shadow">
                          {cliente.folio}
                        </span>

                        <span
                          className={`text-[10px] font-black px-3 py-1 rounded-full border ${
                            isLiquidado
                              ? 'bg-emerald-950 text-emerald-300 border-emerald-800'
                              : isMoroso
                              ? 'bg-red-950 text-red-300 border-red-800'
                              : 'bg-amber-950 text-amber-300 border-amber-800'
                          }`}
                        >
                          {isLiquidado
                            ? '✅ LIQUIDADO'
                            : isMoroso
                            ? '🔴 MOROSO'
                            : '🟡 SALDO ACTIVO'}
                        </span>
                      </div>

                      <div>
                        <h4 className="font-extrabold text-white text-base leading-snug">{cliente.nombreCompleto}</h4>
                        <p className="text-xs text-slate-300 flex items-center gap-1 mt-0.5">
                          <MapPin className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                          <span>{cliente.direccion} ({cliente.colonia || 'Sin Colonia'})</span>
                        </p>
                        <span className="text-[11px] text-slate-400 block mt-1">
                          Vendedora: <strong className="text-purple-300">{cliente.vendedoraNombre || 'Ana Lucía Gómez'}</strong>
                        </span>
                      </div>
                    </div>

                    {/* PRODUCT DETAILED AJAX SECTION */}
                    <div className="bg-slate-950/90 p-3 rounded-2xl border border-slate-800 flex gap-3 items-center">
                      <div className="w-16 h-16 rounded-xl overflow-hidden bg-slate-900 shrink-0 border border-slate-700 relative">
                        <img
                          src={prodImgUrl}
                          alt={venta?.productoNombre || 'Producto'}
                          className="w-full h-full object-cover"
                        />
                      </div>
                      <div className="flex-1 min-w-0 text-xs space-y-0.5">
                        <span className="text-[10px] text-indigo-400 font-extrabold block uppercase tracking-wider">
                          📦 Producto Adquirido
                        </span>
                        <p className="font-bold text-white text-xs truncate">
                          {venta?.productoNombre || 'Producto en Plan'}
                        </p>
                        <div className="flex items-center justify-between pt-0.5">
                          <span className="text-slate-400 text-[11px]">Cobro Semanal:</span>
                          <span className="font-black text-emerald-400">${venta?.pagoSemanal || 0} MXN</span>
                        </div>
                        <div className="flex items-center justify-between text-[11px]">
                          <span className="text-slate-400">Saldo Restante:</span>
                          <span className={`font-black ${isLiquidado ? 'text-emerald-400' : 'text-amber-300'}`}>
                            ${saldoVal.toLocaleString('es-MX')} MXN
                          </span>
                        </div>
                      </div>
                    </div>

                    {/* 3 PHOTOGRAPHS GALLERY (Fachada, Cliente, Contrato) */}
                    <div className="space-y-1.5 pt-1">
                      <span className="text-[11px] font-extrabold text-slate-400 block uppercase tracking-wider flex items-center gap-1">
                        <Camera className="w-3.5 h-3.5 text-slate-400" />
                        <span>Expediente (3 Fotografías - Toca para ampliar)</span>
                      </span>
                      <div className="grid grid-cols-3 gap-2">
                        {/* Photo 1: Fachada */}
                        <div
                          onClick={() => setLightboxImage({ url: foto1, title: `1. Fachada Domicilio — ${cliente.nombreCompleto}` })}
                          className="group relative h-20 bg-slate-950 rounded-xl overflow-hidden border border-slate-800 cursor-zoom-in hover:border-indigo-500 transition shadow"
                          title="Toca para ver Foto Fachada"
                        >
                          <img src={foto1} alt="Fachada" className="w-full h-full object-cover group-hover:scale-110 transition duration-300" />
                          <div className="absolute inset-x-0 bottom-0 bg-slate-950/80 px-1 py-0.5 text-[9px] font-bold text-slate-300 text-center truncate">
                            1. Fachada
                          </div>
                          <div className="absolute inset-0 bg-slate-950/40 opacity-0 group-hover:opacity-100 transition flex items-center justify-center">
                            <ZoomIn className="w-5 h-5 text-white" />
                          </div>
                        </div>

                        {/* Photo 2: Cliente / INE */}
                        <div
                          onClick={() => setLightboxImage({ url: foto2, title: `2. Cliente / Identificación — ${cliente.nombreCompleto}` })}
                          className="group relative h-20 bg-slate-950 rounded-xl overflow-hidden border border-slate-800 cursor-zoom-in hover:border-indigo-500 transition shadow"
                          title="Toca para ver Foto Cliente"
                        >
                          <img src={foto2} alt="Cliente" className="w-full h-full object-cover group-hover:scale-110 transition duration-300" />
                          <div className="absolute inset-x-0 bottom-0 bg-slate-950/80 px-1 py-0.5 text-[9px] font-bold text-slate-300 text-center truncate">
                            2. Cliente/INE
                          </div>
                          <div className="absolute inset-0 bg-slate-950/40 opacity-0 group-hover:opacity-100 transition flex items-center justify-center">
                            <ZoomIn className="w-5 h-5 text-white" />
                          </div>
                        </div>

                        {/* Photo 3: Contrato */}
                        <div
                          onClick={() => setLightboxImage({ url: foto3, title: `3. Contrato / Pagaré — ${cliente.nombreCompleto}` })}
                          className="group relative h-20 bg-slate-950 rounded-xl overflow-hidden border border-slate-800 cursor-zoom-in hover:border-indigo-500 transition shadow"
                          title="Toca para ver Foto Contrato"
                        >
                          <img src={foto3} alt="Contrato" className="w-full h-full object-cover group-hover:scale-110 transition duration-300" />
                          <div className="absolute inset-x-0 bottom-0 bg-slate-950/80 px-1 py-0.5 text-[9px] font-bold text-slate-300 text-center truncate">
                            3. Contrato
                          </div>
                          <div className="absolute inset-0 bg-slate-950/40 opacity-0 group-hover:opacity-100 transition flex items-center justify-center">
                            <ZoomIn className="w-5 h-5 text-white" />
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Actions: Phone, WhatsApp, Complete Edit */}
                    <div className="space-y-2 pt-2 border-t border-slate-800 text-xs">
                      <div className="grid grid-cols-2 gap-2">
                        <a
                          href={`tel:${cliente.telefono}`}
                          className="min-h-[40px] bg-indigo-950 hover:bg-indigo-900 text-indigo-200 border border-indigo-700/80 font-bold py-2 px-2 rounded-xl flex items-center justify-center gap-1.5 text-xs transition cursor-pointer active:scale-95"
                        >
                          <Phone className="w-4 h-4 text-indigo-400" />
                          <span>Llamar</span>
                        </a>

                        <a
                          href={`https://wa.me/52${cliente.telefono.replace(/\D/g, '')}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="min-h-[40px] bg-emerald-950 hover:bg-emerald-900 text-emerald-200 border border-emerald-700/80 font-bold py-2 px-2 rounded-xl flex items-center justify-center gap-1.5 text-xs transition cursor-pointer active:scale-95"
                        >
                          <MessageSquare className="w-4 h-4 text-emerald-400" />
                          <span>WhatsApp</span>
                        </a>
                      </div>

                      <button
                        type="button"
                        onClick={() => startEditingCombined(cliente, venta)}
                        className="w-full min-h-[42px] bg-gradient-to-r from-purple-700 to-indigo-700 hover:from-purple-600 hover:to-indigo-600 text-white font-extrabold py-2.5 px-3 rounded-xl flex items-center justify-center gap-2 text-xs transition cursor-pointer shadow-lg active:scale-95 border border-purple-500/50"
                      >
                        <Edit className="w-4 h-4 text-purple-200" />
                        <span>Editar Completo Todos los Campos</span>
                      </button>
                    </div>
                  </div>
                );
              })}
          </div>
        </div>
      )}

      {/* TAB 3: PROSPECTOS DE CLIENTES */}
      {activeTab === 'prospectos' && (
        <div className="space-y-6">
          <div className="bg-slate-800/90 border border-slate-700 rounded-2xl p-6 shadow-xl space-y-5">
            <div className="flex flex-wrap items-center justify-between gap-4 border-b border-slate-700 pb-4">
              <div>
                <h3 className="text-xl font-extrabold text-white flex items-center gap-2">
                  <UserPlus className="w-6 h-6 text-purple-400 animate-pulse" />
                  Prospectos de Clientes en Campo
                </h3>
                <p className="text-sm text-slate-400 mt-1">
                  Agenda visitas, guarda la foto de la fachada, geolocalización y notas adicionales para seguimiento de ventas.
                </p>
              </div>

              <button
                type="button"
                onClick={() => {
                  setPNombre('');
                  setPTel('');
                  setPDir('');
                  setPColonia('');
                  setPRef('');
                  setPFecha('2026-08-01');
                  setPNota('');
                  setPFoto('https://picsum.photos/seed/' + Math.random() + '/600/400');
                  setShowNewProspectoModal(true);
                }}
                className="px-5 py-3 bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white font-extrabold text-xs sm:text-sm rounded-xl shadow-lg flex items-center gap-2 cursor-pointer transition active:scale-95"
              >
                <Plus className="w-4 h-4" />
                <span>+ Agendar Nuevo Prospecto</span>
              </button>
            </div>

            {prospectos.length === 0 ? (
              <div className="p-8 text-center bg-slate-900/80 border border-slate-800 rounded-2xl text-slate-400 text-sm space-y-2">
                <UserPlus className="w-8 h-8 text-slate-500 mx-auto" />
                <p>No hay prospectos registrados aún. Haz clic en el botón superior para agregar el primero.</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                {prospectos.map((prospecto) => (
                  <div
                    key={prospecto.id}
                    className="bg-slate-900 border border-slate-700/80 rounded-2xl p-5 space-y-4 shadow-xl flex flex-col justify-between"
                  >
                    <div className="space-y-3">
                      {/* Card Header & Status */}
                      <div className="flex items-start justify-between gap-2 border-b border-slate-800 pb-2">
                        <div>
                          <span className="text-[10px] font-mono text-purple-400 font-bold block">
                            {prospecto.folio || `PROSP-${prospecto.id}`}
                          </span>
                          <h4 className="text-base font-extrabold text-white">{prospecto.nombreCliente}</h4>
                          <span className="text-xs text-slate-400">
                            Vendedora: <strong className="text-indigo-300">{prospecto.vendedoraNombre || 'Ana Lucía Gómez'}</strong>
                          </span>
                        </div>

                        <span
                          className={`px-3 py-1 rounded-full text-[10px] font-extrabold uppercase tracking-wide border ${
                            prospecto.estado === 'AGENDADO'
                              ? 'bg-purple-950 text-purple-300 border-purple-800'
                              : prospecto.estado === 'CONVERTIDO'
                              ? 'bg-emerald-950 text-emerald-300 border-emerald-800'
                              : 'bg-amber-950 text-amber-300 border-amber-800'
                          }`}
                        >
                          {prospecto.estado}
                        </span>
                      </div>

                      {/* Photo & Details */}
                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                        <div className="sm:col-span-1 relative h-32 rounded-xl overflow-hidden bg-slate-950 border border-slate-700">
                          <img
                            src={prospecto.fotoFachada || 'https://picsum.photos/seed/facade/600/400'}
                            alt="Fachada Prospecto"
                            className="w-full h-full object-cover"
                          />
                          <span className="absolute bottom-1 left-1 bg-slate-950/80 text-[10px] text-slate-300 px-1.5 py-0.5 rounded font-bold">
                            Fachada
                          </span>
                        </div>

                        <div className="sm:col-span-2 space-y-1.5 text-xs text-slate-300">
                          <p className="flex items-center gap-1.5 font-semibold text-white">
                            <Phone className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                            <span>{prospecto.telefono || 'Sin teléfono'}</span>
                          </p>
                          <p className="flex items-start gap-1.5">
                            <MapPin className="w-3.5 h-3.5 text-purple-400 shrink-0 mt-0.5" />
                            <span>{prospecto.direccion} ({prospecto.colonia})</span>
                          </p>
                          {prospecto.referencias && (
                            <p className="text-[11px] text-slate-400 italic">
                              Ref: {prospecto.referencias}
                            </p>
                          )}
                          <div className="pt-1 flex items-center justify-between text-[11px] bg-slate-950 p-2 rounded-xl border border-slate-800">
                            <span className="font-bold text-amber-300 flex items-center gap-1">
                              <Calendar className="w-3.5 h-3.5" />
                              Visita: {prospecto.fechaAgendada}
                            </span>
                            <a
                              href={`https://www.google.com/maps/search/?api=1&query=${prospecto.latitud},${prospecto.longitud}`}
                              target="_blank"
                              rel="noreferrer"
                              className="text-indigo-400 hover:underline flex items-center gap-0.5 font-bold"
                            >
                              <span>Ver GPS</span>
                              <ExternalLink className="w-3 h-3" />
                            </a>
                          </div>
                        </div>
                      </div>

                      {/* Additional Note */}
                      {prospecto.notaAdicional && (
                        <div className="bg-slate-950/80 p-2.5 rounded-xl border border-purple-900/50 text-xs text-purple-200 space-y-0.5">
                          <span className="font-bold text-purple-300 block text-[10px] uppercase">Nota Adicional:</span>
                          <p>{prospecto.notaAdicional}</p>
                        </div>
                      )}
                    </div>

                    {/* Action Buttons */}
                    <div className="pt-3 border-t border-slate-800 flex flex-wrap items-center justify-between gap-2">
                      <button
                        type="button"
                        onClick={() => {
                          const updated = prospectos.map((p) =>
                            p.id === prospecto.id ? { ...p, estado: 'CONVERTIDO' as const } : p
                          );
                          setProspectos(updated);
                          if (typeof window !== 'undefined') {
                            localStorage.setItem('bitalis_prospectos', JSON.stringify(updated));
                          }
                          if (onShowActionNotice) {
                            onShowActionNotice(
                              '⚡ Prospecto Convertido en Venta',
                              `El prospecto ${prospecto.nombreCliente} fue activado como cliente potencial de campo.`,
                              'SUPERVISORA'
                            );
                          }
                        }}
                        className="px-3.5 py-2 bg-emerald-600 hover:bg-emerald-500 text-white font-extrabold text-xs rounded-xl flex items-center gap-1.5 cursor-pointer shadow"
                      >
                        <CheckCircle2 className="w-4 h-4" />
                        <span>Convertir en Venta</span>
                      </button>

                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() => {
                            setEditingProspecto(prospecto);
                          }}
                          className="px-3 py-2 bg-slate-800 hover:bg-slate-700 text-indigo-300 font-bold text-xs rounded-xl flex items-center gap-1 cursor-pointer border border-slate-700"
                        >
                          <Edit className="w-3.5 h-3.5" />
                          <span>Editar</span>
                        </button>

                        <button
                          type="button"
                          onClick={() => {
                            const filtered = prospectos.filter((p) => p.id !== prospecto.id);
                            setProspectos(filtered);
                            if (typeof window !== 'undefined') {
                              localStorage.setItem('bitalis_prospectos', JSON.stringify(filtered));
                            }
                            if (onShowActionNotice) {
                              onShowActionNotice(
                                '🗑️ Prospecto Eliminado',
                                `Se removió el prospecto ${prospecto.nombreCliente}.`,
                                'SUPERVISORA'
                              );
                            }
                          }}
                          className="p-2 bg-rose-950/80 hover:bg-rose-900 text-rose-300 rounded-xl cursor-pointer border border-rose-800"
                          title="Eliminar Prospecto"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {activeTab === 'viaticos' && (
        <div className="bg-slate-800/90 border border-slate-700 rounded-2xl p-6 shadow-xl space-y-6">
          <div>
            <h3 className="text-xl font-bold text-white flex items-center gap-2">
              <Wallet className="w-6 h-6 text-emerald-400" />
              Control de Viáticos y Cuadre de Caja Diarios
            </h3>
            <p className="text-sm text-slate-400">
              Asigna viáticos a las vendedoras y realiza el cuadre de efectivo recolectado por enganches al cierre de la jornada.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Asignación de Viáticos */}
            <div className="bg-slate-900 p-5 rounded-2xl border border-slate-700 space-y-4">
              <h4 className="font-bold text-white text-base">Asignación de Viáticos Diarios</h4>

              <div>
                <label className="block text-xs text-slate-300 mb-1">Vendedora Asignada</label>
                <input
                  type="text"
                  disabled
                  value="Ana Lucía Gómez"
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2 text-sm text-slate-300"
                />
              </div>

              <div>
                <label className="block text-xs text-slate-300 mb-1">Monto de Viáticos Asignados ($ MXN)</label>
                <input
                  type="number"
                  value={viaticosMonto}
                  onChange={(e) => setViaticosMonto(Number(e.target.value))}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2 text-sm text-white focus:outline-none focus:border-indigo-500"
                />
              </div>

              <div>
                <label className="block text-xs text-slate-300 mb-1">Observaciones</label>
                <textarea
                  rows={2}
                  value={observacionesCorte}
                  onChange={(e) => setObservacionesCorte(e.target.value)}
                  placeholder="ej. Viáticos de transporte y alimentos en Zona Zapata"
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2 text-xs text-white placeholder-slate-600 focus:outline-none focus:border-indigo-500"
                />
              </div>

              <button
                type="button"
                onClick={() => {
                  onSaveCorte({
                    ...corteVendedoraHoy,
                    viaticos: viaticosMonto,
                    observaciones: observacionesCorte,
                  });
                  alert('¡Viáticos actualizados y corte guardado!');
                }}
                className="w-full bg-indigo-600 hover:bg-indigo-500 text-white font-bold py-2.5 px-4 rounded-xl text-sm transition shadow cursor-pointer"
              >
                Guardar Asignación de Viáticos
              </button>
            </div>

            {/* Cuadre de Caja */}
            <div className="bg-slate-900 p-5 rounded-2xl border border-slate-700 space-y-4">
              <h4 className="font-bold text-white text-base">Cuadre de Efectivo al Cierre de Jornada</h4>

              <div className="space-y-2.5 text-xs">
                <div className="flex justify-between items-center text-slate-300">
                  <span>Fondo Inicial Entregado:</span>
                  <span className="font-bold text-white">${corteVendedoraHoy.fondoInicial} MXN</span>
                </div>

                <div className="flex justify-between items-center text-slate-300">
                  <span>(+) Enganches Recolectados Hoy:</span>
                  <span className="font-bold text-emerald-400">+${totalEnganchesHoy} MXN</span>
                </div>

                <div className="flex justify-between items-center text-slate-300">
                  <span>(-) Viáticos Otorgados:</span>
                  <span className="font-bold text-amber-400">-${viaticosMonto} MXN</span>
                </div>

                <div className="pt-2 border-t border-slate-800 flex justify-between items-center text-sm font-bold text-white">
                  <span>Efectivo Total Esperado en Bolsillo:</span>
                  <span className="text-base text-emerald-400 font-black">${totalEfectivoEsperado} MXN</span>
                </div>
              </div>

              <div className="p-3 bg-indigo-950/60 border border-indigo-800/50 rounded-xl text-xs text-indigo-200">
                El efectivo recolectado por concepto de enganches coincide con las {ventasAprobadas.length} ventas aprobadas hoy.
              </div>
            </div>
          </div>
        </div>
      )}

      {/* TAB 3: GEOLOCALIZACIÓN Y ALTA DE COORDENADAS */}
      {activeTab === 'geolocalizacion' && (
        <div className="bg-slate-800/90 border border-slate-700 rounded-2xl p-6 shadow-xl space-y-6">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div>
              <h3 className="text-xl font-bold text-white flex items-center gap-2">
                <MapPin className="w-6 h-6 text-purple-400" />
                Alta y Gestión de Ubicación por Coordenadas (GPS)
              </h3>
              <p className="text-sm text-slate-400">
                Supervisión puede dar de alta o corregir la ubicación exacta de cualquier cliente ingresando directamente sus coordenadas (Latitud, Longitud).
              </p>
            </div>
          </div>

          {/* Search Box */}
          <div className="relative max-w-md">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
            <input
              type="text"
              value={geoSearchTerm}
              onChange={(e) => setGeoSearchTerm(e.target.value)}
              placeholder="Buscar cliente por nombre, folio o dirección..."
              className="w-full bg-slate-900 border border-slate-700 rounded-xl pl-9 pr-3 py-2 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500"
            />
          </div>

          {/* Client List with Coordinates */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {clientes
              .filter(
                (c) =>
                  !geoSearchTerm ||
                  c.nombreCompleto.toLowerCase().includes(geoSearchTerm.toLowerCase()) ||
                  c.folio.toLowerCase().includes(geoSearchTerm.toLowerCase()) ||
                  c.direccion.toLowerCase().includes(geoSearchTerm.toLowerCase())
              )
              .map((cliente) => (
                <div
                  key={cliente.id}
                  className="bg-slate-900 border border-slate-700 hover:border-slate-600 p-4 rounded-2xl space-y-3 shadow-md flex flex-col justify-between"
                >
                  <div className="space-y-1">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-mono font-bold text-indigo-400">{cliente.folio}</span>
                      <span className="text-[10px] bg-slate-800 text-slate-300 px-2 py-0.5 rounded-full border border-slate-700">
                        Zona ID #{cliente.zonaId}
                      </span>
                    </div>
                    <h4 className="font-bold text-white text-sm">{cliente.nombreCompleto}</h4>
                    <p className="text-xs text-slate-300 truncate">{cliente.direccion}</p>
                  </div>

                  <div className="bg-slate-950 p-2.5 rounded-xl border border-slate-800 space-y-1.5 text-xs">
                    <div className="flex items-center justify-between text-slate-400">
                      <span>Coordenadas Guardadas:</span>
                      <a
                        href={`https://www.google.com/maps/search/?api=1&query=${cliente.latitud},${cliente.longitud}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-indigo-400 hover:underline flex items-center gap-1 font-semibold"
                      >
                        <span>Abrir Maps</span>
                        <ExternalLink className="w-3 h-3" />
                      </a>
                    </div>
                    <p className="font-mono font-bold text-purple-300 text-xs">
                      Lat: {cliente.latitud}, Lng: {cliente.longitud}
                    </p>
                  </div>

                  <button
                    type="button"
                    onClick={() => setGeoModalCliente(cliente)}
                    className="w-full min-h-[40px] bg-indigo-600 hover:bg-indigo-500 text-white font-bold px-3 py-2 rounded-xl text-xs flex items-center justify-center gap-2 cursor-pointer shadow transition"
                  >
                    <MapPin className="w-4 h-4 text-purple-200" />
                    <span>Dar de alta / Editar Coordenadas</span>
                  </button>
                </div>
              ))}
          </div>
        </div>
      )}

      {/* UBICACION COORDENADAS MODAL */}
      {geoModalCliente && (
        <UbicacionCoordenadasModal
          cliente={geoModalCliente}
          onSave={(clienteActualizado) => {
            if (onUpdateCliente) {
              onUpdateCliente(clienteActualizado);
              alert(`¡Coordenadas GPS de ${clienteActualizado.nombreCompleto} actualizadas correctamente!`);
            }
          }}
          onClose={() => setGeoModalCliente(null)}
        />
      )}

      {/* EDIT CLIENTE MODAL */}
      {editingCliente && (
        <div className="fixed inset-0 bg-slate-950/80 z-50 flex items-center justify-center p-4 backdrop-blur-sm overflow-y-auto">
          <div className="bg-slate-900 border border-slate-700 rounded-2xl max-w-lg w-full p-6 space-y-4 shadow-2xl my-auto">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <h3 className="font-bold text-white text-base flex items-center gap-2">
                <Edit className="w-5 h-5 text-indigo-400" /> Editar Todos los Datos del Cliente
              </h3>
              <button
                onClick={() => setEditingCliente(null)}
                className="p-1 rounded-lg text-slate-400 hover:text-white"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveEditedCliente} className="space-y-3 text-xs max-h-[80vh] overflow-y-auto pr-1">
              <div>
                <label className="block text-slate-300 font-semibold mb-1">Nombre Completo del Cliente</label>
                <input
                  type="text"
                  required
                  value={editingCliente.nombreCompleto}
                  onChange={(e) => setEditingCliente({ ...editingCliente, nombreCompleto: e.target.value })}
                  className="w-full min-h-[44px] bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-white text-sm"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-300 font-semibold mb-1">Calle y Número</label>
                  <input
                    type="text"
                    required
                    value={editingCliente.direccion}
                    onChange={(e) => setEditingCliente({ ...editingCliente, direccion: e.target.value })}
                    className="w-full min-h-[44px] bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-white text-sm"
                  />
                </div>
                <div>
                  <label className="block text-slate-300 font-semibold mb-1">Colonia / Suburbio</label>
                  <input
                    type="text"
                    required
                    value={editingCliente.colonia || ''}
                    onChange={(e) => setEditingCliente({ ...editingCliente, colonia: e.target.value })}
                    className="w-full min-h-[44px] bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-white text-sm"
                  />
                </div>
              </div>

              <div>
                <label className="block text-slate-300 font-semibold mb-1">Teléfono Principal (WhatsApp)</label>
                <input
                  type="tel"
                  required
                  value={editingCliente.telefono}
                  onChange={(e) => setEditingCliente({ ...editingCliente, telefono: e.target.value })}
                  className="w-full min-h-[44px] bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-white text-sm"
                />
              </div>

              <div>
                <label className="block text-slate-300 font-semibold mb-1">Referencias de Domicilio y Fachada</label>
                <textarea
                  rows={2}
                  value={editingCliente.referencias}
                  onChange={(e) => setEditingCliente({ ...editingCliente, referencias: e.target.value })}
                  className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-white text-sm"
                  placeholder="Ej: Casa blanca 2 pisos, frente a parque, portón negro"
                />
              </div>

              <div className="grid grid-cols-2 gap-3 bg-slate-950 p-3 rounded-xl border border-slate-800">
                <div>
                  <label className="block text-slate-300 font-semibold mb-1">Latitud GPS</label>
                  <input
                    type="number"
                    step="any"
                    value={editingCliente.latitud}
                    onChange={(e) => setEditingCliente({ ...editingCliente, latitud: parseFloat(e.target.value) || 0 })}
                    className="w-full min-h-[44px] bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-white text-xs font-mono"
                  />
                </div>
                <div>
                  <label className="block text-slate-300 font-semibold mb-1">Longitud GPS</label>
                  <input
                    type="number"
                    step="any"
                    value={editingCliente.longitud}
                    onChange={(e) => setEditingCliente({ ...editingCliente, longitud: parseFloat(e.target.value) || 0 })}
                    className="w-full min-h-[44px] bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-white text-xs font-mono"
                  />
                </div>
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setEditingCliente(null)}
                  className="px-4 py-2 bg-slate-800 text-slate-300 rounded-xl font-bold cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl font-bold flex items-center gap-1.5 cursor-pointer shadow-lg"
                >
                  <Save className="w-4 h-4" /> Guardar Todos los Cambios
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* EDIT COMBINED SUPERVISOR MODAL */}
      {editingCombined && (
        <div className="fixed inset-0 bg-slate-950/85 z-60 flex items-center justify-center p-3 sm:p-4 backdrop-blur-md overflow-y-auto">
          <div className="bg-slate-900 border border-indigo-500/50 rounded-3xl max-w-2xl w-full p-5 sm:p-6 space-y-4 shadow-2xl my-auto">
            {/* Header */}
            <div className="flex items-start justify-between border-b border-slate-800 pb-3">
              <div>
                <span className="text-[10px] font-mono text-indigo-400 font-bold uppercase tracking-wider block">
                  Folio Cliente: {editingCombined.cliente.folio}
                </span>
                <h3 className="font-extrabold text-white text-lg flex items-center gap-2">
                  <Edit className="w-5 h-5 text-indigo-400" />
                  <span>Edición Rápida de Cliente y Venta (Supervisión)</span>
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setEditingCombined(null)}
                className="p-1.5 rounded-lg text-slate-400 hover:text-white bg-slate-800 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Log Session & Saleswoman Header Banner */}
            <div className="bg-slate-950 p-3.5 rounded-2xl border border-indigo-900/60 flex flex-wrap items-center justify-between gap-3 text-xs">
              <div className="flex items-center gap-2">
                <ShieldCheck className="w-4 h-4 text-emerald-400 shrink-0" />
                <span className="text-slate-300">
                  Usuario en Sesión: <strong className="text-white">{currentUser?.nombre || 'Elena Rostro (Supervisora)'}</strong>
                </span>
              </div>
              <div className="flex items-center gap-2">
                <User className="w-4 h-4 text-purple-400 shrink-0" />
                <span className="text-slate-300">
                  Vendedora Asignada: <strong className="text-purple-300">{editVendedoraNombre}</strong>
                </span>
              </div>
            </div>

            <form onSubmit={handleSaveSupervisorCombined} className="space-y-4 text-xs">
              {/* ALERTA DE VALIDACIÓN MANUAL PARA LA SUPERVISORA */}
              {(() => {
                const isPhoneInvalid = Boolean(editTelefono && editTelefono.replace(/\D/g, '').length !== 10);
                const isDireccionShort = Boolean(editDireccion && (editDireccion.trim().length < 5 || !/\d/.test(editDireccion)));
                const isNombreShort = Boolean(editNombreCompleto && editNombreCompleto.trim().split(/\s+/).length < 2);
                const isPrecioInvalid = editPrecioBase <= 0;
                const isEngancheTooHigh = editEngancheMonto > editPrecioBase;
                const calculatedSaldo = editPrecioBase - editEngancheMonto - editAporteEmpresa;
                const isSaldoInvalid = calculatedSaldo < 0;
                const hasAnomalies = isPhoneInvalid || isDireccionShort || isNombreShort || isPrecioInvalid || isEngancheTooHigh || isSaldoInvalid;

                if (!hasAnomalies) return null;

                return (
                  <div className="p-3 bg-amber-950/90 border-2 border-amber-500 rounded-2xl text-amber-200 text-xs space-y-1.5 shadow-xl">
                    <div className="flex items-center gap-2 font-black text-amber-300">
                      <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0 animate-bounce" />
                      <span>Alerta de Validación de Datos (Revisión de Supervisión)</span>
                    </div>
                    <ul className="list-disc list-inside space-y-0.5 text-[11px] text-amber-200/90 font-medium pl-1">
                      {isPhoneInvalid && <li>Teléfono: No cumple formato de 10 dígitos (actualmente {editTelefono.replace(/\D/g, '').length} dígitos).</li>}
                      {isDireccionShort && <li>Dirección: Requiere formato completo (calle y número exterior).</li>}
                      {isNombreShort && <li>Nombre Cliente: Se recomienda capturar nombre y al menos un apellido.</li>}
                      {isPrecioInvalid && <li>Estructura Financiera: El precio base debe ser mayor a $0.</li>}
                      {isEngancheTooHigh && <li>Estructura Financiera: El enganche recibido supera el precio base del producto.</li>}
                      {isSaldoInvalid && <li>Estructura Financiera: El saldo inicial resultante (${calculatedSaldo}) es negativo.</li>}
                    </ul>
                  </div>
                );
              })()}

              {/* Vendedora Asignada Selection */}
              <div>
                <label className="block text-purple-300 font-bold mb-1">🏷️ Vendedora Asignada al Cliente y Venta *</label>
                <select
                  value={editVendedoraNombre}
                  onChange={(e) => setEditVendedoraNombre(e.target.value)}
                  className="w-full bg-slate-950 border border-purple-600/70 rounded-xl p-2.5 text-white font-bold focus:outline-none focus:border-purple-400"
                >
                  {usuarios && usuarios.length > 0 ? (
                    usuarios
                      .filter((u) => u.rol === 'vendedora' || u.rol === 'sup_vendedores' || u.rol === 'admin')
                      .map((u) => (
                        <option key={u.id} value={u.nombre}>
                          {u.nombre} ({u.rol === 'vendedora' ? 'Vendedora' : 'Supervisora'})
                        </option>
                      ))
                  ) : (
                    <>
                      <option value="Ana Lucía Gómez">Ana Lucía Gómez</option>
                      <option value="Rosa Elena Ramos">Rosa Elena Ramos</option>
                      <option value="Sofía Mendoza">Sofía Mendoza</option>
                      <option value="Captura Supervisora Directa">Captura Supervisora Directa</option>
                    </>
                  )}
                </select>
              </div>

              {/* Sección 1: Datos Personales del Cliente */}
              <div className="bg-slate-950/80 p-3.5 rounded-2xl border border-slate-800 space-y-3">
                <div className="flex justify-between items-center">
                  <span className="font-extrabold text-indigo-300 text-xs uppercase tracking-wider block">
                    📋 1. Datos Personales del Cliente
                  </span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-slate-300 font-semibold mb-1 flex items-center justify-between">
                      <span>Nombre Completo del Cliente *</span>
                      {editNombreCompleto && editNombreCompleto.trim().split(/\s+/).length < 2 && (
                        <span className="text-[10px] text-amber-400 font-bold flex items-center gap-0.5">
                          <AlertTriangle className="w-3 h-3 text-amber-400" /> Falta apellido
                        </span>
                      )}
                    </label>
                    <input
                      type="text"
                      required
                      value={editNombreCompleto}
                      onChange={(e) => setEditNombreCompleto(e.target.value)}
                      className={`w-full bg-slate-900 rounded-xl p-2.5 text-white text-sm focus:outline-none transition ${
                        editNombreCompleto && editNombreCompleto.trim().split(/\s+/).length < 2
                          ? 'border-2 border-amber-500/90 bg-amber-950/20'
                          : 'border border-slate-700 focus:border-indigo-500'
                      }`}
                    />
                  </div>

                  <div>
                    <label className="block text-slate-300 font-semibold mb-1 flex items-center justify-between">
                      <span>Teléfono Principal / WhatsApp *</span>
                      {editTelefono && editTelefono.replace(/\D/g, '').length !== 10 && (
                        <span className="text-[10px] text-amber-400 font-bold flex items-center gap-0.5">
                          <AlertTriangle className="w-3 h-3 text-amber-400" /> {editTelefono.replace(/\D/g, '').length}/10 dígitos
                        </span>
                      )}
                    </label>
                    <input
                      type="tel"
                      required
                      value={editTelefono}
                      onChange={(e) => setEditTelefono(e.target.value)}
                      className={`w-full bg-slate-900 rounded-xl p-2.5 text-white text-sm focus:outline-none transition ${
                        editTelefono && editTelefono.replace(/\D/g, '').length !== 10
                          ? 'border-2 border-amber-500/90 bg-amber-950/30 text-amber-200'
                          : 'border border-slate-700 focus:border-indigo-500'
                      }`}
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-slate-300 font-semibold mb-1 flex items-center justify-between">
                      <span>Calle y Número Domicilio *</span>
                      {editDireccion && (editDireccion.trim().length < 5 || !/\d/.test(editDireccion)) && (
                        <span className="text-[10px] text-amber-400 font-bold flex items-center gap-0.5">
                          <AlertTriangle className="w-3 h-3 text-amber-400" /> Falta número o calle
                        </span>
                      )}
                    </label>
                    <input
                      type="text"
                      required
                      value={editDireccion}
                      onChange={(e) => setEditDireccion(e.target.value)}
                      className={`w-full bg-slate-900 rounded-xl p-2.5 text-white focus:outline-none transition ${
                        editDireccion && (editDireccion.trim().length < 5 || !/\d/.test(editDireccion))
                          ? 'border-2 border-amber-500/90 bg-amber-950/20'
                          : 'border border-slate-700 focus:border-indigo-500'
                      }`}
                    />
                  </div>

                  <div>
                    <label className="block text-slate-300 font-semibold mb-1">Colonia / Suburbio</label>
                    <input
                      type="text"
                      value={editColonia}
                      onChange={(e) => setEditColonia(e.target.value)}
                      className="w-full bg-slate-900 border border-slate-700 rounded-xl p-2.5 text-white focus:outline-none focus:border-indigo-500"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-slate-300 font-semibold mb-1">Referencias de Domicilio y Fachada</label>
                  <input
                    type="text"
                    value={editReferencias}
                    onChange={(e) => setEditReferencias(e.target.value)}
                    className="w-full bg-slate-900 border border-slate-700 rounded-xl p-2.5 text-white focus:outline-none focus:border-indigo-500"
                  />
                </div>

                {/* GPS Coordinates & Quick Capture */}
                <div className="bg-slate-900 p-3 rounded-xl border border-slate-800 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-indigo-300 text-xs flex items-center gap-1.5">
                      <MapPin className="w-4 h-4 text-purple-400" /> Coordenadas GPS de la Fachada
                    </span>
                    <button
                      type="button"
                      onClick={handleCaptureGpsForEdit}
                      disabled={isCapturingEditGps}
                      className="px-2.5 py-1 bg-purple-950 hover:bg-purple-900 border border-purple-800 text-purple-300 rounded-lg font-bold text-[11px] flex items-center gap-1 cursor-pointer transition"
                    >
                      <Navigation className={`w-3 h-3 ${isCapturingEditGps ? 'animate-spin' : ''}`} />
                      <span>{isCapturingEditGps ? 'Capturando GPS...' : 'GPS Actual'}</span>
                    </button>
                  </div>
                  <div className="grid grid-cols-2 gap-2 text-[11px]">
                    <div>
                      <span className="text-slate-400 block">Latitud:</span>
                      <input
                        type="number"
                        step="any"
                        value={editLatitud}
                        onChange={(e) => setEditLatitud(Number(e.target.value))}
                        className="w-full bg-slate-950 border border-slate-700 rounded-lg p-1.5 text-white font-mono"
                      />
                    </div>
                    <div>
                      <span className="text-slate-400 block">Longitud:</span>
                      <input
                        type="number"
                        step="any"
                        value={editLongitud}
                        onChange={(e) => setEditLongitud(Number(e.target.value))}
                        className="w-full bg-slate-950 border border-slate-700 rounded-lg p-1.5 text-white font-mono"
                      />
                    </div>
                  </div>
                </div>
              </div>

              {/* Sección 2: Condiciones Especiales de Cobro, Producto y Empresa */}
              <div className="bg-slate-950/80 p-3.5 rounded-2xl border border-emerald-900/50 space-y-3">
                <span className="font-extrabold text-emerald-400 text-xs uppercase tracking-wider block">
                  💲 2. Producto Asignado, Condiciones Financieras, Fecha de Cobro y Aporte Empresa
                </span>

                {/* Product Catalog Dropdown & Custom Product Name Input */}
                <div className="space-y-2">
                  <label className="block text-indigo-300 font-extrabold flex items-center gap-1 text-xs">
                    <Package className="w-4 h-4 text-indigo-400" />
                    <span>Producto del Contrato (Selecciona de Catálogo o Escribe Libremente)</span>
                  </label>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    <select
                      value={(productos || []).some((p) => p.nombre === editProductoNombre) ? editProductoNombre : ''}
                      onChange={(e) => {
                        const selectedName = e.target.value;
                        if (selectedName) {
                          setEditProductoNombre(selectedName);
                          const prodObj = (productos || []).find((p) => p.nombre === selectedName);
                          if (prodObj) {
                            setEditPrecioBase(prodObj.precioBase);
                            setEditAporteEmpresa(prodObj.descuentoEmpresa || 0);
                            setEditEngancheMonto(prodObj.engancheMinimo);
                            setEditPagoSemanal(prodObj.pagoSemanalSugerido);
                          }
                        }
                      }}
                      className="w-full bg-slate-900 border border-indigo-500/80 rounded-xl p-2.5 text-white font-bold focus:outline-none focus:border-indigo-400 text-xs"
                    >
                      <option value="">-- Seleccionar de Catálogo --</option>
                      {(productos || []).map((p) => (
                        <option key={p.id} value={p.nombre}>
                          {p.nombre} — Total: ${p.precioBase} MXN (Stock: {p.stock ?? 0} un.)
                        </option>
                      ))}
                    </select>

                    <input
                      type="text"
                      value={editProductoNombre}
                      onChange={(e) => setEditProductoNombre(e.target.value)}
                      placeholder="o escribe cualquier nombre de producto..."
                      className="w-full bg-slate-900 border border-indigo-500/80 rounded-xl p-2.5 text-white font-bold focus:outline-none focus:border-indigo-400 text-xs"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {/* Primer fecha de cobro */}
                  <div>
                    <label className="block text-amber-300 font-extrabold mb-1 flex items-center gap-1">
                      <Calendar className="w-3.5 h-3.5" />
                      <span>Primer Fecha de Cobro *</span>
                    </label>
                    <input
                      type="date"
                      required
                      value={editFechaPrimerPago}
                      onChange={(e) => setEditFechaPrimerPago(e.target.value)}
                      className="w-full bg-slate-900 border border-amber-500/80 rounded-xl p-2.5 text-white font-extrabold focus:outline-none focus:border-amber-400"
                    />
                  </div>

                  {/* Aporte de descuento de empresa - TOTALMENTE EDITABLE */}
                  <div>
                    <label className="block text-emerald-300 font-extrabold mb-1 flex items-center gap-1">
                      <DollarSign className="w-3.5 h-3.5" />
                      <span>Aporte / Descuento Empresa ($ MXN)</span>
                    </label>
                    <input
                      type="number"
                      min="0"
                      step="any"
                      value={editAporteEmpresa === 0 ? '' : editAporteEmpresa}
                      onChange={(e) => setEditAporteEmpresa(e.target.value === '' ? 0 : Number(e.target.value))}
                      placeholder="0 (Escribe cualquier monto)"
                      className="w-full bg-slate-900 border border-emerald-500/80 rounded-xl p-2.5 text-white font-extrabold focus:outline-none focus:border-emerald-400"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div>
                    <label className="block text-slate-300 font-semibold mb-1 flex items-center justify-between">
                      <span>Precio Base / Total ($)</span>
                      {editPrecioBase <= 0 && (
                        <span className="text-[10px] text-red-400 font-bold">⚠️ Requerido &gt; 0</span>
                      )}
                    </label>
                    <input
                      type="number"
                      min="0"
                      value={editPrecioBase}
                      onChange={(e) => setEditPrecioBase(Number(e.target.value))}
                      className={`w-full bg-slate-900 rounded-xl p-2.5 text-white font-semibold focus:outline-none transition ${
                        editPrecioBase <= 0
                          ? 'border-2 border-red-500/90 bg-red-950/30 text-red-200'
                          : 'border border-slate-700 focus:border-indigo-500'
                      }`}
                    />
                  </div>

                  <div>
                    <label className="block text-slate-300 font-semibold mb-1 flex items-center justify-between">
                      <span>Enganche Recibido ($)</span>
                      {editEngancheMonto > editPrecioBase && (
                        <span className="text-[10px] text-red-400 font-bold">⚠️ Supera total</span>
                      )}
                    </label>
                    <input
                      type="number"
                      min="0"
                      value={editEngancheMonto}
                      onChange={(e) => setEditEngancheMonto(Number(e.target.value))}
                      className={`w-full bg-slate-900 rounded-xl p-2.5 text-white font-semibold focus:outline-none transition ${
                        editEngancheMonto > editPrecioBase
                          ? 'border-2 border-red-500/90 bg-red-950/30 text-red-200'
                          : 'border border-slate-700 focus:border-indigo-500'
                      }`}
                    />
                  </div>

                  <div>
                    <label className="block text-slate-300 font-semibold mb-1 flex items-center justify-between">
                      <span>Pago Semanal ($)</span>
                      {editPagoSemanal <= 0 && (
                        <span className="text-[10px] text-amber-400 font-bold">⚠️ Requerido &gt; 0</span>
                      )}
                    </label>
                    <input
                      type="number"
                      min="0"
                      value={editPagoSemanal}
                      onChange={(e) => setEditPagoSemanal(Number(e.target.value))}
                      className={`w-full bg-slate-900 rounded-xl p-2.5 text-white font-semibold focus:outline-none transition ${
                        editPagoSemanal <= 0
                          ? 'border-2 border-amber-500/90 bg-amber-950/30'
                          : 'border border-slate-700 focus:border-indigo-500'
                      }`}
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-slate-300 font-semibold mb-1">Día de Cobro en Ruta</label>
                    <select
                      value={editDiaCobroZona}
                      onChange={(e) => setEditDiaCobroZona(e.target.value as DiaSemana)}
                      className="w-full bg-slate-900 border border-slate-700 rounded-xl p-2.5 text-white font-semibold"
                    >
                      <option value="Lunes">Lunes</option>
                      <option value="Martes">Martes</option>
                      <option value="Miércoles">Miércoles</option>
                      <option value="Jueves">Jueves</option>
                      <option value="Viernes">Viernes</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-slate-300 font-semibold mb-1">Fecha de Registro / Alta Venta</label>
                    <input
                      type="date"
                      value={editFechaVenta}
                      onChange={(e) => setEditFechaVenta(e.target.value)}
                      className="w-full bg-slate-900 border border-slate-700 rounded-xl p-2.5 text-white"
                    />
                  </div>
                </div>
              </div>

              {/* Sección 3: Fotografías del Expediente */}
              <div className="bg-slate-950/80 p-3.5 rounded-2xl border border-indigo-900/50 space-y-3">
                <span className="font-extrabold text-indigo-300 text-xs uppercase tracking-wider flex items-center gap-1.5">
                  <Camera className="w-4 h-4 text-indigo-400" />
                  <span>3. Fotografías del Expediente (Toca para ver en pantalla completa)</span>
                </span>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  {/* Foto Fachada */}
                  <div className="bg-slate-900 p-2.5 rounded-xl border border-slate-800 space-y-2">
                    <span className="text-xs font-bold text-slate-300 block">Foto Fachada Domicilio</span>
                    <div
                      onClick={() => editFotoFachada && setLightboxImage({ url: editFotoFachada, title: `Foto Fachada — ${editNombreCompleto}` })}
                      className="h-28 bg-slate-950 rounded-lg overflow-hidden border border-slate-800 flex items-center justify-center relative cursor-zoom-in group"
                    >
                      {editFotoFachada ? (
                        <>
                          <img src={editFotoFachada} alt="Fachada" className="w-full h-full object-cover group-hover:scale-110 transition duration-300" />
                          <div className="absolute inset-0 bg-slate-950/40 opacity-0 group-hover:opacity-100 transition flex items-center justify-center">
                            <ZoomIn className="w-6 h-6 text-white drop-shadow" />
                          </div>
                        </>
                      ) : (
                        <span className="text-[10px] text-slate-500">Sin foto</span>
                      )}
                    </div>
                    <label className="w-full py-1.5 bg-slate-800 hover:bg-slate-700 text-indigo-300 border border-slate-700 rounded-lg text-xs font-bold flex items-center justify-center gap-1 cursor-pointer transition">
                      <Upload className="w-3.5 h-3.5" />
                      <span>Reemplazar</span>
                      <input
                        type="file"
                        accept="image/*"
                        className="hidden"
                        onChange={async (e) => {
                          const file = e.target.files?.[0];
                          if (file) {
                            const compressed = await compressAndOptimizeImage(file, 1280, 0.72);
                            setEditFotoFachada(compressed);
                          }
                        }}
                      />
                    </label>
                  </div>

                  {/* Foto Cliente */}
                  <div className="bg-slate-900 p-2.5 rounded-xl border border-slate-800 space-y-2">
                    <span className="text-xs font-bold text-slate-300 block">Foto Cliente / ID</span>
                    <div
                      onClick={() => editFotoCliente && setLightboxImage({ url: editFotoCliente, title: `Foto Cliente / ID — ${editNombreCompleto}` })}
                      className="h-28 bg-slate-950 rounded-lg overflow-hidden border border-slate-800 flex items-center justify-center relative cursor-zoom-in group"
                    >
                      {editFotoCliente ? (
                        <>
                          <img src={editFotoCliente} alt="Cliente" className="w-full h-full object-cover group-hover:scale-110 transition duration-300" />
                          <div className="absolute inset-0 bg-slate-950/40 opacity-0 group-hover:opacity-100 transition flex items-center justify-center">
                            <ZoomIn className="w-6 h-6 text-white drop-shadow" />
                          </div>
                        </>
                      ) : (
                        <span className="text-[10px] text-slate-500">Sin foto</span>
                      )}
                    </div>
                    <label className="w-full py-1.5 bg-slate-800 hover:bg-slate-700 text-indigo-300 border border-slate-700 rounded-lg text-xs font-bold flex items-center justify-center gap-1 cursor-pointer transition">
                      <Upload className="w-3.5 h-3.5" />
                      <span>Reemplazar</span>
                      <input
                        type="file"
                        accept="image/*"
                        className="hidden"
                        onChange={async (e) => {
                          const file = e.target.files?.[0];
                          if (file) {
                            const compressed = await compressAndOptimizeImage(file, 1280, 0.72);
                            setEditFotoCliente(compressed);
                          }
                        }}
                      />
                    </label>
                  </div>

                  {/* Foto Contrato */}
                  <div className="bg-slate-900 p-2.5 rounded-xl border border-slate-800 space-y-2">
                    <span className="text-xs font-bold text-slate-300 block">Foto Contrato / Pagaré</span>
                    <div
                      onClick={() => editFotoContrato && setLightboxImage({ url: editFotoContrato, title: `Foto Contrato / Pagaré — ${editNombreCompleto}` })}
                      className="h-28 bg-slate-950 rounded-lg overflow-hidden border border-slate-800 flex items-center justify-center relative cursor-zoom-in group"
                    >
                      {editFotoContrato ? (
                        <>
                          <img src={editFotoContrato} alt="Contrato" className="w-full h-full object-cover group-hover:scale-110 transition duration-300" />
                          <div className="absolute inset-0 bg-slate-950/40 opacity-0 group-hover:opacity-100 transition flex items-center justify-center">
                            <ZoomIn className="w-6 h-6 text-white drop-shadow" />
                          </div>
                        </>
                      ) : (
                        <span className="text-[10px] text-slate-500">Sin foto</span>
                      )}
                    </div>
                    <div className="flex gap-1.5">
                      <label className="flex-1 py-1.5 bg-slate-800 hover:bg-slate-700 text-indigo-300 border border-slate-700 rounded-lg text-xs font-bold flex items-center justify-center gap-1 cursor-pointer transition">
                        <Upload className="w-3.5 h-3.5" />
                        <span>Reemplazar</span>
                        <input
                          type="file"
                          accept="image/*"
                          className="hidden"
                          onChange={async (e) => {
                            const file = e.target.files?.[0];
                            if (file) {
                              const compressed = await compressAndOptimizeImage(file, 1280, 0.72);
                              setEditFotoContrato(compressed);
                            }
                          }}
                        />
                      </label>
                    </div>
                  </div>
                </div>
              </div>

              {/* Buttons */}
              <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setEditingCombined(null)}
                  className="px-4 py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl font-bold cursor-pointer transition"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="px-6 py-2.5 bg-gradient-to-r from-emerald-600 to-indigo-600 hover:from-emerald-500 hover:to-indigo-500 text-white rounded-xl font-black flex items-center gap-2 cursor-pointer shadow-lg active:scale-95 transition"
                >
                  <Save className="w-4 h-4" />
                  <span>Guardar Todos los Cambios</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
      {/* NEW PROSPECTO MODAL */}
      {showNewProspectoModal && (
        <div className="fixed inset-0 bg-slate-950/85 z-60 flex items-center justify-center p-4 backdrop-blur-md overflow-y-auto">
          <div className="bg-slate-900 border border-purple-500/50 rounded-3xl max-w-lg w-full p-6 space-y-4 shadow-2xl my-auto">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div>
                <h3 className="font-extrabold text-white text-base flex items-center gap-2">
                  <UserPlus className="w-5 h-5 text-purple-400" />
                  <span>Formulario de Captura de Prospecto</span>
                </h3>
                <p className="text-[11px] text-slate-400">Exclusivo para Supervisión y Vendedoras en Campo</p>
              </div>
              <button
                type="button"
                onClick={() => setShowNewProspectoModal(false)}
                className="p-1.5 rounded-lg text-slate-400 hover:text-white bg-slate-800 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form
              onSubmit={(e) => {
                e.preventDefault();
                const newP: Prospecto = {
                  id: Date.now(),
                  folio: `PROSP-2026-${prospectos.length + 1}`,
                  nombreCliente: pColonia ? `Prospecto ${pColonia}` : `Prospecto GPS (${pLat}, ${pLng})`,
                  telefono: pTel || 'Sin Teléfono',
                  direccion: pDir || `Ubicación GPS (${pLat}, ${pLng})`,
                  colonia: pColonia || `Colonia GPS (${pLat.toFixed(2)}, ${pLng.toFixed(2)})`,
                  referencias: pRef,
                  latitud: pLat,
                  longitud: pLng,
                  fotoFachada: pFoto,
                  fechaAgendada: pFecha,
                  notaAdicional: pNota ? `${pNota} (Interés: ${pProductoInteres})` : `Producto de interés: ${pProductoInteres}`,
                  vendedoraNombre: pVendedoraNombre || 'Ana Lucía Gómez',
                  estado: 'AGENDADO',
                  fechaRegistro: new Date().toISOString().split('T')[0],
                };
                const updated = [newP, ...prospectos];
                setProspectos(updated);
                if (typeof window !== 'undefined') {
                  localStorage.setItem('bitalis_prospectos', JSON.stringify(updated));
                }
                setShowNewProspectoModal(false);
                if (onShowActionNotice) {
                  onShowActionNotice(
                    '📍 Prospecto Agendado con Éxito',
                    `Se agendó la visita de prospecto asignado a ${newP.vendedoraNombre}.`,
                    'SUPERVISORA'
                  );
                }
              }}
              className="space-y-3 text-xs"
            >
              <div>
                <label className="block text-slate-300 font-semibold mb-1">Vendedora Asignada *</label>
                <select
                  value={pVendedoraNombre}
                  onChange={(e) => setPVendedoraNombre(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-700 rounded-xl p-2.5 text-white font-semibold focus:outline-none focus:border-purple-500"
                >
                  <option value="Ana Lucía Gómez">Ana Lucía Gómez (Vendedora)</option>
                  <option value="Rosa Elena Ramos">Rosa Elena Ramos (Vendedora)</option>
                  <option value="Captura Supervisora Directa">Captura Supervisora Directa</option>
                </select>
              </div>

              {/* COORDENADAS GPS & AUTO UBICACION */}
              <div className="bg-slate-950 p-3 rounded-2xl border border-purple-500/60 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="font-bold text-purple-300 flex items-center gap-1.5 text-xs">
                    <MapPin className="w-4 h-4 text-purple-400" /> Ubicación & Coordenadas GPS *
                  </span>
                  <button
                    type="button"
                    onClick={handleCaptureGpsForProspecto}
                    disabled={isCapturingGps}
                    className="px-3 py-1.5 bg-gradient-to-r from-purple-700 to-indigo-700 hover:from-purple-600 hover:to-indigo-600 text-white rounded-xl font-black text-xs flex items-center gap-1.5 cursor-pointer shadow-lg transition"
                  >
                    <Navigation className={`w-3.5 h-3.5 ${isCapturingGps ? 'animate-spin' : ''}`} />
                    <span>{isCapturingGps ? 'Obteniendo GPS...' : '📍 GPS Actual (Autollenar)'}</span>
                  </button>
                </div>
                <div className="grid grid-cols-2 gap-2 text-[11px] text-slate-300">
                  <div>
                    <span className="text-slate-400 block">Latitud:</span>
                    <input
                      type="number"
                      step="any"
                      required
                      value={pLat}
                      onChange={(e) => setPLat(Number(e.target.value))}
                      className="w-full bg-slate-900 border border-slate-700 rounded-lg p-1.5 text-white font-mono"
                    />
                  </div>
                  <div>
                    <span className="text-slate-400 block">Longitud:</span>
                    <input
                      type="number"
                      step="any"
                      required
                      value={pLng}
                      onChange={(e) => setPLng(Number(e.target.value))}
                      className="w-full bg-slate-900 border border-slate-700 rounded-lg p-1.5 text-white font-mono"
                    />
                  </div>
                </div>
              </div>

              {/* PRODUCTO DE INTERÉS */}
              <div className="space-y-1.5">
                <label className="block text-indigo-300 font-bold flex items-center gap-1">
                  <Package className="w-4 h-4 text-indigo-400" />
                  <span>Producto de Interés *</span>
                </label>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  <select
                    value={(productos || []).some((p) => p.nombre === pProductoInteres) ? pProductoInteres : ''}
                    onChange={(e) => {
                      if (e.target.value) setPProductoInteres(e.target.value);
                    }}
                    className="w-full bg-slate-950 border border-indigo-500/80 rounded-xl p-2 text-white font-bold text-xs"
                  >
                    <option value="">-- Seleccionar de Catálogo --</option>
                    {(productos || []).map((p) => (
                      <option key={p.id} value={p.nombre}>
                        {p.nombre} (${p.precioBase} MXN)
                      </option>
                    ))}
                  </select>
                  <input
                    type="text"
                    required
                    value={pProductoInteres}
                    onChange={(e) => setPProductoInteres(e.target.value)}
                    placeholder="o escribe el producto..."
                    className="w-full bg-slate-950 border border-indigo-500/80 rounded-xl p-2 text-white font-bold text-xs"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-amber-300 font-bold mb-1">🗓️ Fecha de Probable Visita *</label>
                  <input
                    type="date"
                    required
                    value={pFecha}
                    onChange={(e) => setPFecha(e.target.value)}
                    className="w-full bg-slate-950 border border-amber-500/80 rounded-xl p-2.5 text-white font-bold focus:outline-none focus:border-amber-400"
                  />
                </div>

                <div>
                  <label className="block text-slate-300 font-semibold mb-1">Colonia Detectada / Ingresada *</label>
                  <input
                    type="text"
                    required
                    value={pColonia}
                    onChange={(e) => setPColonia(e.target.value)}
                    placeholder="ej. Col. Centro / Lomas"
                    className="w-full bg-slate-950 border border-slate-700 rounded-xl p-2.5 text-white text-xs font-bold"
                  />
                </div>
              </div>

              <div>
                <label className="block text-slate-300 font-semibold mb-1">Nota Adicional / Comentarios de Campo</label>
                <textarea
                  rows={2}
                  value={pNota}
                  onChange={(e) => setPNota(e.target.value)}
                  placeholder="ej. Visitar preferentemente por la tarde. Casa con portón blanco."
                  className="w-full bg-slate-950 border border-slate-700 rounded-xl p-2.5 text-white focus:outline-none focus:border-purple-500"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setShowNewProspectoModal(false)}
                  className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl font-bold cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white rounded-xl font-black flex items-center gap-1.5 cursor-pointer shadow-lg active:scale-95 transition"
                >
                  <Save className="w-4 h-4" /> Guardar Prospecto
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* EDIT PROSPECTO MODAL */}
      {editingProspecto && (
        <div className="fixed inset-0 bg-slate-950/85 z-60 flex items-center justify-center p-4 backdrop-blur-md overflow-y-auto">
          <div className="bg-slate-900 border border-purple-500/50 rounded-3xl max-w-lg w-full p-6 space-y-4 shadow-2xl my-auto">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <h3 className="font-extrabold text-white text-base flex items-center gap-2">
                <Edit className="w-5 h-5 text-purple-400" />
                <span>Editar Prospecto / Reagendar Visita</span>
              </h3>
              <button
                type="button"
                onClick={() => setEditingProspecto(null)}
                className="p-1.5 rounded-lg text-slate-400 hover:text-white bg-slate-800"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form
              onSubmit={(e) => {
                e.preventDefault();
                const updated = prospectos.map((p) =>
                  p.id === editingProspecto.id ? editingProspecto : p
                );
                setProspectos(updated);
                if (typeof window !== 'undefined') {
                  localStorage.setItem('bitalis_prospectos', JSON.stringify(updated));
                }
                setEditingProspecto(null);
                if (onShowActionNotice) {
                  onShowActionNotice(
                    '✏️ Prospecto Actualizado',
                    `Se re-agendó o actualizó el prospecto ${editingProspecto.nombreCliente}.`,
                    'SUPERVISORA'
                  );
                }
              }}
              className="space-y-3 text-xs"
            >
              <div>
                <label className="block text-slate-300 font-semibold mb-1">Nombre Completo del Prospecto</label>
                <input
                  type="text"
                  required
                  value={editingProspecto.nombreCliente}
                  onChange={(e) => setEditingProspecto({ ...editingProspecto, nombreCliente: e.target.value })}
                  className="w-full bg-slate-950 border border-slate-700 rounded-xl p-2.5 text-white"
                />
              </div>

              <div>
                <label className="block text-amber-300 font-bold mb-1">🗓️ Fecha de Visita Agendada</label>
                <input
                  type="date"
                  required
                  value={editingProspecto.fechaAgendada}
                  onChange={(e) => setEditingProspecto({ ...editingProspecto, fechaAgendada: e.target.value })}
                  className="w-full bg-slate-950 border border-amber-500/80 rounded-xl p-2.5 text-white font-bold"
                />
              </div>

              <div>
                <label className="block text-slate-300 font-semibold mb-1">Nota Adicional / Recordatorio</label>
                <textarea
                  rows={3}
                  value={editingProspecto.notaAdicional || ''}
                  onChange={(e) => setEditingProspecto({ ...editingProspecto, notaAdicional: e.target.value })}
                  className="w-full bg-slate-950 border border-slate-700 rounded-xl p-2.5 text-white"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setEditingProspecto(null)}
                  className="px-4 py-2 bg-slate-800 text-slate-300 rounded-xl font-bold cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 bg-purple-600 hover:bg-purple-500 text-white rounded-xl font-extrabold flex items-center gap-1.5 cursor-pointer shadow-lg"
                >
                  <Save className="w-4 h-4" /> Guardar Cambios
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* FULL-SCREEN LIGHTBOX MODAL */}
      {lightboxImage && (
        <ImageLightboxModal
          imageUrl={lightboxImage.url}
          title={lightboxImage.title}
          onClose={() => setLightboxImage(null)}
        />
      )}

      {/* SUPERVISOR DIRECT SALE MODAL (CON FOTOS EDITABLES & SIN OCR) */}
      {showDirectSaleModal && (
        <div className="fixed inset-0 bg-slate-950/85 z-50 flex items-center justify-center p-2 sm:p-4 backdrop-blur-md overflow-y-auto">
          <div className="bg-slate-900 border border-emerald-500/80 rounded-3xl max-w-2xl w-full my-auto shadow-2xl overflow-hidden flex flex-col max-h-[92vh] select-none">
            {/* MOBILE DRAG HANDLE */}
            <div className="w-12 h-1.5 bg-slate-600/80 hover:bg-slate-500 rounded-full mx-auto my-1.5 shrink-0 cursor-pointer transition" onClick={() => setShowDirectSaleModal(false)} title="Desliza o toca para cerrar" />

            <div className="p-4 bg-gradient-to-r from-emerald-950 via-slate-900 to-slate-900 border-b border-slate-800 flex items-center justify-between shrink-0">
              <div className="flex items-center gap-2">
                <div className="p-2 bg-emerald-900/80 border border-emerald-700 rounded-xl text-emerald-300">
                  <ShieldCheck className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-black text-white text-base">➕ Levantar Venta Directa (Supervisión)</h3>
                  <p className="text-[11px] text-slate-300">Alta de expediente completo con fotografías y plan de pagos automatizado</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowDirectSaleModal(false)}
                className="p-2 rounded-full bg-slate-800 text-slate-400 hover:text-white cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={(e) => {
              e.preventDefault();
              if (!dsNombreCompleto || !dsTelefono || !dsDireccion) {
                alert('⚠️ Por favor completa el Nombre, Teléfono y Dirección del cliente.');
                return;
              }

              const clientId = Date.now();
              const ventaId = clientId + 1;
              const folioStr = `BIT-${String(clientId).slice(-5)}`;
              const supervisorNombre = currentUser?.nombre || 'Supervisora';

              const isContado = dsTipoVenta === 'CONTADO';
              const saldoInicial = isContado ? 0 : Math.max(0, dsPrecioBase - dsEngancheMonto - dsAporteEmpresa);

              const nuevoCliente: Cliente = {
                id: clientId,
                folio: folioStr,
                nombreCompleto: dsNombreCompleto,
                telefono: dsTelefono,
                direccion: dsDireccion,
                colonia: dsColonia,
                entreCalles: '',
                referencias: dsReferencias,
                fotoFachada: dsFotoFachada,
                fotoCliente: dsFotoCliente,
                fotoContrato: dsFotoContrato,
                latitud: dsLatitud,
                longitud: dsLongitud,
                zonaId: dsZonaId,
                zonaNombre: `Zona #${dsZonaId}`,
                diaCobroZona: 'Lunes',
                fechaRegistro: new Date().toISOString().split('T')[0],
                estadoMorosidad: 'VERDE',
                tarjetaImpresa: false,
                creadoPorVendedoraId: 1,
                creadoPorUsuarioNombre: supervisorNombre,
                vendedoraNombre: dsVendedoraNombre,
                fotosEditadasPorNombre: supervisorNombre,
                fotosEditadasFecha: new Date().toLocaleDateString('es-MX'),
              };

              const nuevaVenta: Venta = {
                id: ventaId,
                clienteId: clientId,
                vendedoraId: 1,
                vendedoraNombre: dsVendedoraNombre,
                productoNombre: dsProductoNombre,
                precioBase: isContado ? dsMontoACobrarContado : dsPrecioBase,
                montoACobrarContado: isContado ? dsMontoACobrarContado : undefined,
                engancheMonto: isContado ? 0 : dsEngancheMonto,
                aporteEmpresa: isContado ? 0 : dsAporteEmpresa,
                descuentoOtorgado: isContado ? 0 : dsAporteEmpresa,
                pagoSemanal: isContado ? 0 : dsPagoSemanal,
                saldoInicial: saldoInicial,
                saldoActual: saldoInicial,
                fechaVenta: dsFechaVenta,
                fechaPrimerPago: isContado ? dsFechaVenta : dsFechaPrimerPago,
                diaCobroZona: 'Lunes',
                tipo: isContado ? 'CONTADO' : 'CREDITO',
                estado: 'APROBADA',
                supervisoraAprobadoPor: supervisorNombre,
                fechaAprobacion: new Date().toISOString(),
                comisionVendedora: 150,
              };

              if (onAddClienteVenta) {
                onAddClienteVenta(nuevoCliente, nuevaVenta);
              } else if (onUpdateCliente && onUpdateVenta) {
                onUpdateCliente(nuevoCliente);
                onUpdateVenta(nuevaVenta);
              }

              setShowDirectSaleModal(false);
              alert(`✅ Venta de ${isContado ? 'CONTADO (Líquida)' : 'CRÉDITO'} levantada y aprobada correctamente por supervisión.\nFolio: ${folioStr}\nDestino: ${isContado ? 'Módulo Líquidas' : 'Ruta Cobrador'}`);
            }} className="p-4 sm:p-6 space-y-4 overflow-y-auto text-xs text-slate-300 flex-1">
              {/* SECTION 1: CLIENT GENERAL DATA */}
              <div className="space-y-3 bg-slate-950 p-4 rounded-2xl border border-slate-800">
                <h4 className="font-bold text-emerald-300 text-xs flex items-center gap-1.5 border-b border-slate-800 pb-2">
                  <User className="w-4 h-4 text-emerald-400" />
                  <span>1. Información General del Cliente</span>
                </h4>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div className="sm:col-span-2">
                    <label className="block text-slate-300 font-bold mb-1">Nombre Completo del Cliente *</label>
                    <input
                      type="text"
                      required
                      placeholder="Ej. María de los Ángeles López"
                      value={dsNombreCompleto}
                      onChange={(e) => setDsNombreCompleto(e.target.value)}
                      className="w-full bg-slate-900 border border-slate-700 rounded-xl p-2.5 text-white font-bold"
                    />
                  </div>

                  <div>
                    <label className="block text-slate-300 font-bold mb-1">Teléfono (WhatsApp 10 dígitos) *</label>
                    <input
                      type="tel"
                      required
                      placeholder="5512345678"
                      value={dsTelefono}
                      onChange={(e) => setDsTelefono(e.target.value)}
                      className="w-full bg-slate-900 border border-slate-700 rounded-xl p-2.5 text-white font-mono font-bold"
                    />
                  </div>

                  <div>
                    <label className="block text-purple-300 font-bold mb-1">Vendedora Asignada *</label>
                    <select
                      value={dsVendedoraNombre}
                      onChange={(e) => setDsVendedoraNombre(e.target.value)}
                      className="w-full bg-slate-900 border border-purple-600/80 rounded-xl p-2.5 text-white font-bold"
                    >
                      {usuarios && usuarios.length > 0 ? (
                        usuarios
                          .filter((u) => u.rol === 'vendedora' || u.rol === 'sup_vendedores' || u.rol === 'admin')
                          .map((u) => (
                            <option key={u.id} value={u.nombre}>
                              {u.nombre}
                            </option>
                          ))
                      ) : (
                        <option value="Ana Lucía Gómez">Ana Lucía Gómez</option>
                      )}
                    </select>
                  </div>

                  <div className="sm:col-span-2">
                    <label className="block text-slate-300 font-bold mb-1">Calle y Número Exterior/Interior *</label>
                    <input
                      type="text"
                      required
                      placeholder="Av. Hidalgo #123, Col. Centro"
                      value={dsDireccion}
                      onChange={(e) => setDsDireccion(e.target.value)}
                      className="w-full bg-slate-900 border border-slate-700 rounded-xl p-2.5 text-white font-medium"
                    />
                  </div>

                  <div>
                    <label className="block text-slate-300 font-bold mb-1">Colonia / Fraccionamiento</label>
                    <input
                      type="text"
                      placeholder="Ej. San Juan"
                      value={dsColonia}
                      onChange={(e) => setDsColonia(e.target.value)}
                      className="w-full bg-slate-900 border border-slate-700 rounded-xl p-2.5 text-white"
                    />
                  </div>

                  <div>
                    <label className="block text-slate-300 font-bold mb-1">Referencias de Fachada / Casa</label>
                    <input
                      type="text"
                      placeholder="Casa portón blanco 2 pisos"
                      value={dsReferencias}
                      onChange={(e) => setDsReferencias(e.target.value)}
                      className="w-full bg-slate-900 border border-slate-700 rounded-xl p-2.5 text-white"
                    />
                  </div>
                </div>

                {/* GPS Capture Button */}
                <div className="pt-2 flex flex-wrap items-center justify-between gap-2 border-t border-slate-850">
                  <span className="font-mono text-[11px] text-purple-300">
                    GPS: {dsLatitud.toFixed(6)}, {dsLongitud.toFixed(6)}
                  </span>
                  <button
                    type="button"
                    disabled={isCapturingDsGps}
                    onClick={handleCaptureGpsForDirectSale}
                    className="px-3 py-1.5 bg-purple-950 hover:bg-purple-900 text-purple-200 border border-purple-800 rounded-xl font-bold flex items-center gap-1.5 cursor-pointer shadow"
                  >
                    <Navigation className={`w-3.5 h-3.5 ${isCapturingDsGps ? 'animate-spin' : ''}`} />
                    <span>{isCapturingDsGps ? 'Obteniendo GPS...' : 'Capturar Coordenadas GPS'}</span>
                  </button>
                </div>
              </div>

              {/* SECTION 2: SALE FINANCIAL DATA */}
              <div className="space-y-3 bg-slate-950 p-4 rounded-2xl border border-slate-800">
                <div className="flex items-center justify-between border-b border-slate-800 pb-2">
                  <h4 className="font-bold text-emerald-300 text-xs flex items-center gap-1.5">
                    <DollarSign className="w-4 h-4 text-emerald-400" />
                    <span>2. Tipo de Operación y Financiamiento</span>
                  </h4>
                  <div className="flex items-center gap-1 bg-slate-900 p-1 rounded-xl border border-slate-800">
                    <button
                      type="button"
                      onClick={() => setDsTipoVenta('CREDITO')}
                      className={`px-2.5 py-1 rounded-lg text-xs font-bold transition ${
                        dsTipoVenta === 'CREDITO'
                          ? 'bg-amber-500 text-slate-950 font-black shadow'
                          : 'text-slate-400 hover:text-white'
                      }`}
                    >
                      💳 Crédito / Abonos
                    </button>
                    <button
                      type="button"
                      onClick={() => setDsTipoVenta('CONTADO')}
                      className={`px-2.5 py-1 rounded-lg text-xs font-bold transition ${
                        dsTipoVenta === 'CONTADO'
                          ? 'bg-emerald-600 text-white font-black shadow'
                          : 'text-slate-400 hover:text-white'
                      }`}
                    >
                      💵 Venta de Contado
                    </button>
                  </div>
                </div>

                {dsTipoVenta === 'CONTADO' ? (
                  <div className="space-y-3 bg-emerald-950/40 p-3 rounded-xl border border-emerald-800/80">
                    <span className="text-xs text-emerald-300 font-bold block">
                      💵 Venta de Contado Directa (Se almacenará en Módulo &quot;Líquidas / Contado&quot;)
                    </span>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <div>
                        <label className="block text-slate-300 font-bold mb-1">Producto o Concepto *</label>
                        <input
                          type="text"
                          required
                          value={dsProductoNombre}
                          onChange={(e) => setDsProductoNombre(e.target.value)}
                          className="w-full bg-slate-900 border border-slate-700 rounded-xl p-2.5 text-white font-bold"
                        />
                      </div>
                      <div>
                        <label className="block text-emerald-400 font-bold mb-1">
                          Monto a Cobrar ($ MXN Editable) *
                        </label>
                        <input
                          type="number"
                          required
                          min={1}
                          value={dsMontoACobrarContado}
                          onChange={(e) => setDsMontoACobrarContado(Number(e.target.value))}
                          className="w-full bg-slate-900 border-2 border-emerald-500 rounded-xl p-2.5 text-emerald-300 font-mono font-black text-sm"
                        />
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="space-y-3">
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div className="sm:col-span-2 space-y-2">
                      <div className="flex items-center justify-between">
                        <label className="block text-emerald-300 font-extrabold text-xs flex items-center gap-1.5">
                          <Package className="w-4 h-4 text-emerald-400" />
                          <span>📦 Seleccionar Producto del Catálogo (Tarjetas) *</span>
                        </label>
                        <span className="text-[10px] text-slate-400 font-semibold">
                          {((productos && productos.length > 0) ? productos : INITIAL_PRODUCTOS).length} Productos
                        </span>
                      </div>

                      {/* Visual Cards Grid for Products */}
                      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2.5 max-h-64 overflow-y-auto p-1.5 bg-slate-900/90 rounded-2xl border border-slate-800">
                        {((productos && productos.length > 0) ? productos : INITIAL_PRODUCTOS).map((prod) => {
                          const isSelected = dsSelectedProductId === prod.id || dsProductoNombre === prod.nombre;
                          const eng = prod.engancheMinimo || (prod as any).engancheSugerido || Math.round(prod.precioBase * 0.08) || 200;
                          const desc = prod.descuentoEmpresa || (prod as any).aporteEmpresa || 100;
                          const pag = prod.pagoSemanalSugerido || Math.ceil(Math.max(0, prod.precioBase - eng - desc) / 20) || 150;

                          return (
                            <div
                              key={prod.id}
                              onClick={() => {
                                setDsSelectedProductId(prod.id);
                                setDsProductoNombre(prod.nombre);
                                setDsPrecioBase(prod.precioBase);
                                setDsEngancheMonto(eng);
                                setDsAporteEmpresa(desc);
                                setDsPagoSemanal(pag);
                                setDsMontoACobrarContado(prod.precioBase);
                                triggerHaptic();
                              }}
                              className={`p-3 rounded-xl border text-left cursor-pointer transition flex flex-col justify-between relative shadow-sm ${
                                isSelected
                                  ? 'bg-emerald-950/80 border-emerald-400 ring-2 ring-emerald-500/50 shadow-lg shadow-emerald-950/60'
                                  : 'bg-slate-900 border-slate-700/80 hover:border-slate-500 hover:bg-slate-850'
                              }`}
                            >
                              {isSelected && (
                                <span className="absolute top-2 right-2 bg-emerald-500 text-slate-950 text-[9px] font-black px-1.5 py-0.5 rounded-full flex items-center gap-0.5 shadow">
                                  <Check className="w-3 h-3 stroke-[3]" /> Seleccionado
                                </span>
                              )}

                              <div className="space-y-1 pr-12">
                                <span className="text-[9px] font-mono font-extrabold uppercase text-slate-400 bg-slate-800 px-1.5 py-0.5 rounded inline-block">
                                  {prod.categoria || 'Catálogo'}
                                </span>
                                <h5 className="text-xs font-bold text-white line-clamp-2 leading-tight">{prod.nombre}</h5>
                              </div>

                              <div className="mt-2 pt-2 border-t border-slate-800 space-y-1">
                                <div className="flex items-baseline justify-between">
                                  <span className="text-[10px] text-slate-400 font-medium">Precio Base:</span>
                                  <span className="text-sm font-black text-emerald-400 font-mono">${prod.precioBase.toLocaleString('es-MX')} MXN</span>
                                </div>

                                <div className="flex items-center justify-between text-[10px] bg-slate-950 p-1.5 rounded-lg border border-slate-800/80">
                                  <div className="text-amber-300 font-bold">
                                    Enganche: <strong className="text-amber-200 font-mono">${eng} MXN</strong>
                                  </div>
                                  <div className="text-indigo-300 font-bold">
                                    Pago: <strong className="text-indigo-200 font-mono">${pag}/sem</strong>
                                  </div>
                                </div>
                              </div>
                            </div>
                          );
                        })}

                        {/* Custom product selection card */}
                        <div
                          onClick={() => {
                            setDsSelectedProductId(-1);
                            setDsProductoNombre('Producto Especial Personalizado');
                            triggerHaptic();
                          }}
                          className={`p-3 rounded-xl border border-dashed text-left cursor-pointer transition flex flex-col justify-between ${
                            dsSelectedProductId === -1
                              ? 'bg-indigo-950/80 border-indigo-400 ring-2 ring-indigo-500/50'
                              : 'bg-slate-900/60 border-slate-700 hover:border-indigo-400 hover:bg-slate-850'
                          }`}
                        >
                          <div className="space-y-1">
                            <span className="text-[9px] font-mono font-extrabold uppercase text-indigo-300 bg-indigo-950 px-1.5 py-0.5 rounded border border-indigo-800 inline-block">
                              Personalizado
                            </span>
                            <h5 className="text-xs font-bold text-white">✏️ Otro / Producto Especial</h5>
                            <p className="text-[10px] text-slate-400">Ingresar nombre y montos manualmente</p>
                          </div>
                        </div>
                      </div>

                      <div className="pt-1">
                        <label className="block text-slate-400 font-semibold text-[11px] mb-0.5">Nombre / Concepto del Producto (Editable)</label>
                        <input
                          type="text"
                          required
                          value={dsProductoNombre}
                          onChange={(e) => setDsProductoNombre(e.target.value)}
                          placeholder="Escribe o ajusta la descripción del producto"
                          className="w-full bg-slate-900 border border-slate-700 rounded-xl p-2.5 text-white font-bold"
                        />
                      </div>
                    </div>

                    <div>
                      <label className="block text-slate-300 font-bold mb-1">Precio Base / Total ($ MXN) *</label>
                      <input
                        type="number"
                        required
                        min={100}
                        value={dsPrecioBase}
                        onChange={(e) => setDsPrecioBase(Number(e.target.value))}
                        className="w-full bg-slate-900 border border-slate-700 rounded-xl p-2.5 text-white font-bold text-sm"
                      />
                    </div>

                    <div>
                      <label className="block text-emerald-400 font-bold mb-1">Enganche Recibido ($ MXN) *</label>
                      <input
                        type="number"
                        required
                        min={0}
                        value={dsEngancheMonto}
                        onChange={(e) => setDsEngancheMonto(Number(e.target.value))}
                        className="w-full bg-slate-900 border border-emerald-700 rounded-xl p-2.5 text-emerald-300 font-bold text-sm"
                      />
                    </div>

                    <div>
                      <label className="block text-slate-300 font-bold mb-1">Aporte / Descuento Empresa ($ MXN)</label>
                      <input
                        type="number"
                        min={0}
                        value={dsAporteEmpresa}
                        onChange={(e) => setDsAporteEmpresa(Number(e.target.value))}
                        className="w-full bg-slate-900 border border-slate-700 rounded-xl p-2.5 text-white font-bold"
                      />
                    </div>

                    <div>
                      <label className="block text-emerald-400 font-bold mb-1">Pago Semanal ($ MXN) *</label>
                      <input
                        type="number"
                        required
                        min={10}
                        value={dsPagoSemanal}
                        onChange={(e) => setDsPagoSemanal(Number(e.target.value))}
                        className="w-full bg-slate-900 border border-emerald-700 rounded-xl p-2.5 text-emerald-300 font-extrabold text-sm"
                      />
                    </div>

                    <div>
                      <label className="block text-slate-300 font-bold mb-1">Fecha de la Venta</label>
                      <input
                        type="date"
                        required
                        value={dsFechaVenta}
                        onChange={(e) => setDsFechaVenta(e.target.value)}
                        className="w-full bg-slate-900 border border-slate-700 rounded-xl p-2.5 text-white font-bold"
                      />
                    </div>

                    <div>
                      <label className="block text-emerald-300 font-bold mb-1">📅 Fecha del Primer Pago *</label>
                      <input
                        type="date"
                        required
                      value={dsFechaPrimerPago}
                      onChange={(e) => setDsFechaPrimerPago(e.target.value)}
                      className="w-full bg-slate-900 border border-emerald-500 rounded-xl p-2.5 text-emerald-200 font-bold shadow"
                    />
                    <span className="text-[10px] text-slate-400 block mt-1">
                      * Define el plan de pagos e inicia alertas automáticas de cobro a partir de este día.
                    </span>
                  </div>
                </div>

                {/* Calculation Summary Box */}
                <div className="bg-slate-900 p-3 rounded-xl border border-emerald-900/80 flex items-center justify-between text-xs font-bold">
                  <div>
                    <span className="text-slate-400 block text-[10px]">Total Saldo a Financiar:</span>
                    <span className="text-emerald-400 text-base font-black">
                      ${Math.max(0, dsPrecioBase - dsEngancheMonto - dsAporteEmpresa).toLocaleString('es-MX')} MXN
                    </span>
                  </div>
                  <div className="text-right">
                    <span className="text-slate-400 block text-[10px]">Plazo Estimado:</span>
                    <span className="text-indigo-300 font-black">
                      {dsPagoSemanal > 0
                        ? Math.ceil(Math.max(0, dsPrecioBase - dsEngancheMonto - dsAporteEmpresa) / dsPagoSemanal)
                        : 0}{' '}
                      Semanas
                    </span>
                  </div>
                </div>
              </div>
            )}
          </div>

              {/* SECTION 3: EDITABLE PHOTOGRAPHS */}
              <div className="space-y-3 bg-slate-950 p-4 rounded-2xl border border-slate-800">
                <h4 className="font-bold text-emerald-300 text-xs flex items-center gap-1.5 border-b border-slate-800 pb-2">
                  <Camera className="w-4 h-4 text-emerald-400" />
                  <span>3. Fotografías del Expediente (Carga Directa o Cámara)</span>
                </h4>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  {/* Foto Fachada */}
                  <div className="space-y-1.5 bg-slate-900 p-2.5 rounded-xl border border-slate-800">
                    <span className="font-bold text-slate-200 text-[11px] block">1. Foto Fachada</span>
                    <div className="h-28 bg-slate-950 rounded-lg overflow-hidden border border-slate-800 flex items-center justify-center">
                      {dsFotoFachada ? (
                        <img src={dsFotoFachada} alt="Fachada" className="w-full h-full object-cover" />
                      ) : (
                        <span className="text-[10px] text-slate-500">Sin Foto</span>
                      )}
                    </div>
                    <label className="w-full py-1.5 bg-slate-800 hover:bg-slate-700 text-indigo-300 border border-slate-700 rounded-lg font-bold text-[11px] flex items-center justify-center gap-1 cursor-pointer transition">
                      <Upload className="w-3 h-3" />
                      <span>Subir Foto</span>
                      <input
                        type="file"
                        accept="image/*"
                        className="hidden"
                        onChange={async (e) => {
                          const f = e.target.files?.[0];
                          if (f) {
                            const res = await compressAndOptimizeImage(f, 1280, 0.72);
                            setDsFotoFachada(res);
                          }
                        }}
                      />
                    </label>
                  </div>

                  {/* Foto Cliente */}
                  <div className="space-y-1.5 bg-slate-900 p-2.5 rounded-xl border border-slate-800">
                    <span className="font-bold text-slate-200 text-[11px] block">2. Foto Cliente / INE</span>
                    <div className="h-28 bg-slate-950 rounded-lg overflow-hidden border border-slate-800 flex items-center justify-center">
                      {dsFotoCliente ? (
                        <img src={dsFotoCliente} alt="Cliente" className="w-full h-full object-cover" />
                      ) : (
                        <span className="text-[10px] text-slate-500">Sin Foto</span>
                      )}
                    </div>
                    <label className="w-full py-1.5 bg-slate-800 hover:bg-slate-700 text-indigo-300 border border-slate-700 rounded-lg font-bold text-[11px] flex items-center justify-center gap-1 cursor-pointer transition">
                      <Upload className="w-3 h-3" />
                      <span>Subir Foto</span>
                      <input
                        type="file"
                        accept="image/*"
                        className="hidden"
                        onChange={async (e) => {
                          const f = e.target.files?.[0];
                          if (f) {
                            const res = await compressAndOptimizeImage(f, 1280, 0.72);
                            setDsFotoCliente(res);
                          }
                        }}
                      />
                    </label>
                  </div>

                  {/* Foto Contrato */}
                  <div className="space-y-1.5 bg-slate-900 p-2.5 rounded-xl border border-slate-800">
                    <span className="font-bold text-slate-200 text-[11px] block">3. Foto Contrato Físico</span>
                    <div className="h-28 bg-slate-950 rounded-lg overflow-hidden border border-slate-800 flex items-center justify-center">
                      {dsFotoContrato ? (
                        <img src={dsFotoContrato} alt="Contrato" className="w-full h-full object-cover" />
                      ) : (
                        <span className="text-[10px] text-slate-500">Sin Foto</span>
                      )}
                    </div>
                    <label className="w-full py-1.5 bg-slate-800 hover:bg-slate-700 text-indigo-300 border border-slate-700 rounded-lg font-bold text-[11px] flex items-center justify-center gap-1 cursor-pointer transition">
                      <Upload className="w-3 h-3" />
                      <span>Subir Foto</span>
                      <input
                        type="file"
                        accept="image/*"
                        className="hidden"
                        onChange={async (e) => {
                          const f = e.target.files?.[0];
                          if (f) {
                            const res = await compressAndOptimizeImage(f, 1280, 0.72);
                            setDsFotoContrato(res);
                          }
                        }}
                      />
                    </label>
                  </div>
                </div>
              </div>

              {/* Submit Button Bar */}
              <div className="pt-3 border-t border-slate-800 flex items-center justify-end gap-3 shrink-0">
                <button
                  type="button"
                  onClick={() => setShowDirectSaleModal(false)}
                  className="px-4 py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold rounded-xl text-xs cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="px-6 py-2.5 bg-gradient-to-r from-emerald-600 to-indigo-600 hover:from-emerald-500 hover:to-indigo-500 text-white font-black rounded-xl text-xs flex items-center gap-2 cursor-pointer shadow-lg active:scale-95 transition"
                >
                  <Save className="w-4 h-4" />
                  <span>Guardar y Aprobar Venta Directa</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Confirmation Modal for Sale Approval/Rejection */}
      <ConfirmationModal
        isOpen={!!confirmSaleAction}
        title={confirmSaleAction?.type === 'approve' ? '¿Confirmar Aprobación de Venta?' : '¿Confirmar Rechazo de Venta?'}
        description={
          confirmSaleAction?.type === 'approve' ? (
            <span>
              ¿Deseas aprobar y activar la venta de <strong>{confirmSaleAction.clienteNombre}</strong> por <strong>${confirmSaleAction.monto} MXN</strong>? Esta acción activará las comisiones y pasará la cuenta a cartera de cobro.
            </span>
          ) : (
            <span>
              ¿Deseas rechazar la venta de <strong>{confirmSaleAction?.clienteNombre}</strong>? La venta quedará cancelada/rechazada.
            </span>
          )
        }
        confirmText={confirmSaleAction?.type === 'approve' ? 'Aprobar Venta' : 'Rechazar Venta'}
        variant={confirmSaleAction?.type === 'approve' ? 'info' : 'danger'}
        onConfirm={() => {
          if (!confirmSaleAction) return;
          if (confirmSaleAction.type === 'approve') {
            onApproveVenta(confirmSaleAction.ventaId);
            if (onShowActionNotice) {
              onShowActionNotice(
                '✅ Venta Aprobada y Activada',
                `La solicitud de ${confirmSaleAction.clienteNombre} fue aprobada.`,
                'VENDEDORA'
              );
            }
          } else {
            onRejectVenta(confirmSaleAction.ventaId);
            if (onShowActionNotice) {
              onShowActionNotice(
                '❌ Venta Rechazada',
                `La solicitud de ${confirmSaleAction.clienteNombre} fue rechazada por la Supervisora.`,
                'VENDEDORA'
              );
            }
          }
          setConfirmSaleAction(null);
        }}
        onCancel={() => setConfirmSaleAction(null)}
      />
    </div>
  );
}
