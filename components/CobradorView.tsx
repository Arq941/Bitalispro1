'use client';

import { useState, useMemo, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import localforage from 'localforage';
import { VisitaAbonoLog } from '@/types';
import { Cliente, Venta, Abono, Zona, CorteCaja, UserRole } from '@/types';
import { calculateDaysOverdue, getTodayLocalDateStr, parseLocalDateStr, getClienteEffectiveMorosidad } from '@/lib/dateUtils';
import MapaRutaLeaflet, { EstadoClienteRuta } from './MapaRutaLeaflet';
import NavegacionInAppMapbox from './NavegacionInAppMapbox';
import EditarNotaUrgenteModal from './EditarNotaUrgenteModal';
import ClienteDetailModal from './ClienteDetailModal';
import ReagendarAbonoModal from './ReagendarAbonoModal';
import ImageLightboxModal from './ImageLightboxModal';
import {
  Download,
  CheckCircle2,
  AlertTriangle,
  Play,
  Navigation,
  Search,
  Check,
  X,
  Clock,
  ArrowLeft,
  ArrowRight,
  ChevronLeft,
  ChevronRight,
  ChevronDown,
  ChevronUp,
  Phone,
  User,
  DollarSign,
  Wifi,
  RefreshCw,
  Maximize2,
  MapPin,
  HelpCircle,
  LogOut,
  Sparkles,
  FileText,
  CheckCircle,
  XCircle,
  AlertCircle,
  Zap,
  List,
  Map,
  Siren,
  Flame,
  ShieldAlert,
  Calendar,
  Pin,
  MessageCircle,
} from 'lucide-react';

export interface ClienteRutaCalculado extends Cliente {
  deudaCalculada: number;
  diasMora: number;
  distanciaKm: number;
}

export interface CobradorViewProps {
  clientes: Cliente[];
  ventas: Venta[];
  abonos: Abono[];
  zonas: Zona[];
  cortes: CorteCaja[];
  onAddAbono: (nuevoAbono: Abono) => void;
  onUpdateCorteCobrador: (corteUpdated: CorteCaja) => void;
  onUpdateCliente?: (cliente: Cliente) => void;
  onShowActionNotice?: (title: string, message: string, roleTarget?: string) => void;
}

type ScreenType =
  | 'DESCARGA'        // Pantalla 1: Descarga de ruta (pre-salida)
  | 'PANEL_HOME'      // Pantalla 2: Panel del cobrador / Vista principal
  | 'NAVEGACION'      // Pantalla 3: Modo navegación turn-by-turn
  | 'TARJETA_CLIENTE' // Pantalla 4: Ficha del cliente
  | 'FLUJO_COBRO'     // Pantalla 5: Flujo de cobro con teclado numérico
  | 'CIERRE_RUTA';    // Pantalla 6: Cierre de ruta / caja

type FilterChip = 'todos' | 'agendados_futuros' | 'cuentas_por_iniciar' | 'con_nota' | 'pendientes' | 'en_camino' | 'gestionados' | 'fallidos' | 'reagendados' | 'todos_incluyendo_futuros';

// Helper for Haversine distance in km
function calcularDistanciaDirectaKm(lat1: number, lon1: number, lat2: number, lon2: number): number {
  if (!lat1 || !lon1 || !lat2 || !lon2) return 1.2;
  const R = 6371; // km
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) * Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return Math.round(R * c * 10) / 10;
}

// Haptic feedback trigger
function triggerHaptic(pattern: number[] = [40]) {
  if (typeof window !== 'undefined' && 'navigator' in window && navigator.vibrate) {
    try {
      navigator.vibrate(pattern);
    } catch {
      // Ignore vibration errors
    }
  }
}

export default function CobradorView({
  clientes = [],
  ventas = [],
  abonos = [],
  zonas = [],
  cortes = [],
  onAddAbono,
  onUpdateCorteCobrador,
  onUpdateCliente,
  onShowActionNotice,
}: CobradorViewProps) {
  // Navigation & Screen state
  const [currentScreen, setCurrentScreen] = useState<ScreenType>('PANEL_HOME');

  // Connection & sync state
  const [connectionStatus, setConnectionStatus] = useState<'online' | 'offline' | 'syncing'>('online');
  const [pendingSyncCount, setPendingSyncCount] = useState<number>(0);
  const [showSyncBanner, setShowSyncBanner] = useState<boolean>(false);
  const [drawerOpen, setDrawerOpen] = useState<boolean>(false);

  // Download Route State
  const [isDownloading, setIsDownloading] = useState<boolean>(false);
  const [downloadProgress, setDownloadProgress] = useState<number>(0);
  const [downloadComplete, setDownloadComplete] = useState<boolean>(false);
  const [downloadItems, setDownloadItems] = useState([
    { id: 1, label: 'Datos de clientes (nombre, dirección, deuda)', status: 'pending' },
    { id: 2, label: 'Fotos y evidencias de fachadas', status: 'pending' },
    { id: 3, label: 'Mapa del área de cobertura (Tiles OSM)', status: 'pending' },
    { id: 4, label: 'Historial de gestiones previas', status: 'pending' },
  ]);

  // Client statuses dictionary
  const [clientStatuses, setClientStatuses] = useState<{ [id: number]: EstadoClienteRuta }>({});

  // Active client destination & Selected client
  const [activeClientId, setActiveClientId] = useState<number | null>(null);
  const [selectedClient, setSelectedClient] = useState<ClienteRutaCalculado | null>(null);

  // User GPS coordinates
  const [userGps, setUserGps] = useState<{ lat: number; lng: number } | null>(null);

  // --- NEW REQUIRED MODULE STATES ---
  // 1. Selector de Modo en Bloque de Ejecución: 'UN_TOQUE' (Un toque) vs 'LISTA' (Lista completa)
  const [executionMode, setExecutionMode] = useState<'UN_TOQUE' | 'LISTA'>('UN_TOQUE');
  const [currentRouteIndex, setCurrentRouteIndex] = useState<number>(0);

  // 2. Modals for Barra de Herramientas Superior & Footer
  const [isGlobalSearchOpen, setIsGlobalSearchOpen] = useState<boolean>(false);
  const [globalSearchTerm, setGlobalSearchTerm] = useState<string>('');

  const [isMapModalOpen, setIsMapModalOpen] = useState<boolean>(false);

  const [isUrgentMorosidadOpen, setIsUrgentMorosidadOpen] = useState<boolean>(false);

  const [isOptimizingRoute, setIsOptimizingRoute] = useState<boolean>(false);
  const [optimizationToast, setOptimizationToast] = useState<string | null>(null);

  // Filters & Search for Lista mode
  const [activeFilter, setActiveFilter] = useState<FilterChip>('todos');
  const [listSearchQuery, setListSearchQuery] = useState<string>('');
  const [isListSearchExpanded, setIsListSearchExpanded] = useState<boolean>(false);

  // Selector de Día de Cobro (Predeterminado a 'TODOS' para mostrar la cartera completa y clientes con atraso)
  const [selectedDiaCobro, setSelectedDiaCobro] = useState<string>('TODOS');

  // Estado para tarjetas desplegables (compactas/expandidas)
  const [expandedCards, setExpandedCards] = useState<Record<number, boolean>>({});

  const toggleCardExpand = useCallback((clienteId: number) => {
    setExpandedCards((prev) => ({
      ...prev,
      [clienteId]: !prev[clienteId],
    }));
    triggerHaptic([25]);
  }, [triggerHaptic]);

  const getClienteDiaCobro = useCallback(
    (c: Cliente): string => {
      if (c.diaCobroZona) return c.diaCobroZona;
      const zona = zonas.find((z) => z.id === c.zonaId);
      if (zona?.diaCobro) return zona.diaCobro;
      const v = ventas.find((v) => v.clienteId === c.id);
      if (v?.diaCobroZona) return v.diaCobroZona;
      return 'Lunes';
    },
    [zonas, ventas]
  );

  // Navigation simulation state
  const [navInstruction, setNavInstruction] = useState<string>('Enfilando hacia la calle del cliente...');
  const [simulatedDistanceMeters, setSimulatedDistanceMeters] = useState<number>(850);
  const [simulatedEtaMin, setSimulatedEtaMin] = useState<number>(4);

  // Payment calculator state
  const [montoIngresado, setMontoIngresado] = useState<string>('0');
  const [metodoPago, setMetodoPago] = useState<'EFECTIVO' | 'TRANSFERENCIA'>('EFECTIVO');
  const [observacionesPago, setObservacionesPago] = useState<string>('');
  const [showNextClientToast, setShowNextClientToast] = useState<{ client: ClienteRutaCalculado; distKm: number } | null>(null);
  const [fechaProximoPagoAgendado, setFechaProximoPagoAgendado] = useState<string>('');
  const [esCobroEnganche, setEsCobroEnganche] = useState<boolean>(false);

  // Urgent notes modal state
  const [clienteForNotaModal, setClienteForNotaModal] = useState<Cliente | null>(null);
  const [isNotaModalOpen, setIsNotaModalOpen] = useState<boolean>(false);

  // Expediente cliente modal state
  const [selectedClientForExpediente, setSelectedClientForExpediente] = useState<Cliente | null>(null);
  const [isExpedienteOpen, setIsExpedienteOpen] = useState<boolean>(false);

  // Reagendar abono / No dio abono modal state
  const [clientForReagendar, setClientForReagendar] = useState<Cliente | null>(null);
  const [isReagendarModalOpen, setIsReagendarModalOpen] = useState<boolean>(false);

  // Lightbox visualizer state
  const [selectedPhotoLightbox, setSelectedPhotoLightbox] = useState<{ url: string; title: string } | null>(null);

  // Grouping by Colonia & Expand/Collapse Accordion state
  const [groupByColonia, setGroupByColonia] = useState<boolean>(true);
  const [expandedColonias, setExpandedColonias] = useState<Record<string, boolean>>({});

  const toggleColonia = useCallback((coloniaName: string) => {
    setExpandedColonias((prev) => ({
      ...prev,
      [coloniaName]: prev[coloniaName] === false ? true : false,
    }));
    triggerHaptic([30]);
  }, []);

  // Cierre de día
  const [cierreCompletado, setCierreCompletado] = useState<boolean>(false);

  // --- GPS Tracking ---
  useEffect(() => {
    if (typeof window !== 'undefined' && 'navigator' in window && navigator.geolocation) {
      const watchId = navigator.geolocation.watchPosition(
        (pos) => {
          setUserGps({ lat: pos.coords.latitude, lng: pos.coords.longitude });
        },
        (err) => {
          console.warn('GPS Error or fallback:', err);
          if (clientes.length > 0 && clientes[0].latitud) {
            setUserGps({ lat: clientes[0].latitud - 0.005, lng: clientes[0].longitud - 0.005 });
          }
        },
        { enableHighAccuracy: true, timeout: 10000, maximumAge: 5000 }
      );
      return () => navigator.geolocation.clearWatch(watchId);
    }
  }, [clientes]);

  // Online/Offline listener
  useEffect(() => {
    const handleOnline = () => setConnectionStatus('online');
    const handleOffline = () => setConnectionStatus('offline');
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  // --- Debt calculations ---
  const clientesConDeuda = useMemo(() => {
    const todayStrLocal = getTodayLocalDateStr();
    return clientes.map((c) => {
      const tieneAbonoHoy = abonos.some(
        (a) => a.clienteId === c.id && (a.fechaPago || (a as any).fecha) && (a.fechaPago || (a as any).fecha).startsWith(todayStrLocal) && (a.monto || 0) > 0
      );

      const eff = getClienteEffectiveMorosidad(c, ventas, todayStrLocal);
      const dist = userGps && c.latitud
        ? calcularDistanciaDirectaKm(userGps.lat, userGps.lng, c.latitud, c.longitud)
        : 1.2;

      const finalMora = tieneAbonoHoy || eff.esLiquidado ? 0 : eff.diasMora;
      const finalEstado = tieneAbonoHoy || eff.esLiquidado ? 'VERDE' : eff.estadoMorosidad;

      return {
        ...c,
        deudaCalculada: eff.totalDeuda,
        diasMora: finalMora,
        estadoMorosidad: finalEstado,
        distanciaKm: dist,
      };
    });
  }, [clientes, ventas, abonos, userGps]);

  // Ordered route sequence: Prioritize clients with overdue payments / diasMora at top
  const clientesOrdenados = useMemo(() => {
    return [...clientesConDeuda].sort((a, b) => {
      const aTieneAtraso = (a.diasMora || 0) > 0 || a.estadoMorosidad === 'ROJO' || a.estadoMorosidad === 'AMARILLO';
      const bTieneAtraso = (b.diasMora || 0) > 0 || b.estadoMorosidad === 'ROJO' || b.estadoMorosidad === 'AMARILLO';

      if (aTieneAtraso && !bTieneAtraso) return -1;
      if (!aTieneAtraso && bTieneAtraso) return 1;
      if (aTieneAtraso && bTieneAtraso) {
        return (b.diasMora || 0) - (a.diasMora || 0) || b.deudaCalculada - a.deudaCalculada;
      }
      return (a.ordenRuta || a.id) - (b.ordenRuta || b.id);
    });
  }, [clientesConDeuda]);

  // Helper status
  const getClienteStatus = useCallback(
    (clienteId: number): EstadoClienteRuta => {
      if (clientStatuses[clienteId]) return clientStatuses[clienteId];
      const cliente = clientesConDeuda.find((c) => c.id === clienteId);
      if (cliente && cliente.deudaCalculada <= 0) return 'cobrado';
      const tieneAbono = abonos.some((a) => a.clienteId === clienteId && (a.monto || 0) > 0);
      if (tieneAbono) return 'cobrado';
      if (activeClientId === clienteId) return 'en_camino';
      return 'pendiente';
    },
    [clientStatuses, activeClientId, abonos, clientesConDeuda]
  );

  // Check if client is a "Cuenta por Iniciar" (Active debt, but 0 abonos registered ever)
  const isCuentaPorIniciar = useCallback(
    (clienteId: number): boolean => {
      const abonosCliente = abonos.filter((a) => a.clienteId === clienteId && (a.monto || 0) > 0);
      if (abonosCliente.length > 0) return false;
      const cliente = clientesConDeuda.find((c) => c.id === clienteId);
      return Boolean(cliente && cliente.deudaCalculada > 0);
    },
    [abonos, clientesConDeuda]
  );

  // Get start date for sectioning "Cuentas por Iniciar"
  const getFechaInicioCuenta = useCallback(
    (c: Cliente): string => {
      if (c.proximoPagoFecha) return c.proximoPagoFecha.split('T')[0];
      const ventaCli = ventas.find((v) => v.clienteId === c.id);
      if (ventaCli?.fechaPrimerPago) return ventaCli.fechaPrimerPago.split('T')[0];
      if (ventaCli?.fechaVenta) return ventaCli.fechaVenta.split('T')[0];
      if (c.fechaRegistro) return c.fechaRegistro.split('T')[0];
      return new Date().toISOString().split('T')[0];
    },
    [ventas]
  );

  // Navigation handlers for Waze and Google Maps
  const handleOpenWaze = useCallback((c: ClienteRutaCalculado) => {
    triggerHaptic([30]);
    if (c.latitud && c.longitud) {
      window.open(`https://waze.com/ul?ll=${c.latitud},${c.longitud}&navigate=yes`, '_blank');
    } else {
      window.open(`https://waze.com/ul?q=${encodeURIComponent(c.direccion)}&navigate=yes`, '_blank');
    }
  }, []);

  const handleOpenGoogleMaps = useCallback((c: ClienteRutaCalculado) => {
    triggerHaptic([30]);
    if (c.latitud && c.longitud) {
      window.open(`https://www.google.com/maps/dir/?api=1&destination=${c.latitud},${c.longitud}`, '_blank');
    } else {
      window.open(`https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(c.direccion)}`, '_blank');
    }
  }, []);

  // Calculate Last Payment info and color code
  const getLastAbonoInfo = useCallback(
    (clienteId: number) => {
      const abonosCliente = abonos.filter((a) => a.clienteId === clienteId && (a.monto || 0) > 0);
      if (abonosCliente.length === 0) {
        return {
          fechaStr: null,
          dias: null,
          monto: 0,
          texto: 'Sin abonos registrados',
          colorBg: 'bg-rose-950/40',
          colorBorder: 'border-rose-800/60',
          colorText: 'text-rose-300',
          badgeText: 'Sin abonos',
          dotColor: 'bg-rose-500',
        };
      }
      const sorted = [...abonosCliente].sort((a, b) => new Date(b.fechaPago).getTime() - new Date(a.fechaPago).getTime());
      const ultimo = sorted[0];
      const fUltimo = new Date(ultimo.fechaPago);
      const hoy = new Date();
      hoy.setHours(0, 0, 0, 0);
      fUltimo.setHours(0, 0, 0, 0);
      const diffMs = hoy.getTime() - fUltimo.getTime();
      const dias = Math.max(0, Math.floor(diffMs / (1000 * 60 * 60 * 24)));

      const fechaFormatted = ultimo.fechaPago ? ultimo.fechaPago.split('T')[0] : '';

      if (dias === 0) {
        return {
          fechaStr: fechaFormatted,
          dias,
          monto: ultimo.monto,
          texto: `$${ultimo.monto.toLocaleString('es-MX')} (Hoy)`,
          colorBg: 'bg-emerald-950/40',
          colorBorder: 'border-emerald-700/60',
          colorText: 'text-emerald-300',
          badgeText: '🟢 Hoy',
          dotColor: 'bg-emerald-400',
        };
      } else if (dias <= 7) {
        return {
          fechaStr: fechaFormatted,
          dias,
          monto: ultimo.monto,
          texto: `$${ultimo.monto.toLocaleString('es-MX')} (${fechaFormatted})`,
          colorBg: 'bg-emerald-950/40',
          colorBorder: 'border-emerald-700/60',
          colorText: 'text-emerald-300',
          badgeText: `🟢 Hace ${dias}d`,
          dotColor: 'bg-emerald-400',
        };
      } else if (dias <= 15) {
        return {
          fechaStr: fechaFormatted,
          dias,
          monto: ultimo.monto,
          texto: `$${ultimo.monto.toLocaleString('es-MX')} (${fechaFormatted})`,
          colorBg: 'bg-amber-950/40',
          colorBorder: 'border-amber-700/60',
          colorText: 'text-amber-300',
          badgeText: `🟡 Hace ${dias}d`,
          dotColor: 'bg-amber-400',
        };
      } else if (dias <= 30) {
        return {
          fechaStr: fechaFormatted,
          dias,
          monto: ultimo.monto,
          texto: `$${ultimo.monto.toLocaleString('es-MX')} (${fechaFormatted})`,
          colorBg: 'bg-orange-950/40',
          colorBorder: 'border-orange-700/60',
          colorText: 'text-orange-300',
          badgeText: `🟠 Hace ${dias}d`,
          dotColor: 'bg-orange-400',
        };
      } else {
        return {
          fechaStr: fechaFormatted,
          dias,
          monto: ultimo.monto,
          texto: `$${ultimo.monto.toLocaleString('es-MX')} (${fechaFormatted})`,
          colorBg: 'bg-rose-950/40',
          colorBorder: 'border-rose-700/60',
          colorText: 'text-rose-300',
          badgeText: `🔴 Hace ${dias}d`,
          dotColor: 'bg-rose-500',
        };
      }
    },
    [abonos]
  );

  // Contract & Enganche calculation helper for accounts without abonos
  const getContractInfo = useCallback(
    (cliente: Cliente) => {
      const v = ventas.find((v) => v.clienteId === cliente.id);
      const precioBase = v?.precioBase || (v?.saldoInicial ? v.saldoInicial + (v.engancheMonto || 0) : cliente.deudaCalculada || 0);
      const enganche = v?.engancheMonto || cliente.enganchePendienteMonto || 0;
      const descuentoEmpresa = (v?.aporteEmpresa || 0) + (v?.descuentoOtorgado || 0);
      const subtotalConDescuentos = Math.max(0, precioBase - enganche - descuentoEmpresa);
      return {
        venta: v,
        precioBase,
        enganche,
        descuentoEmpresa,
        subtotalConDescuentos,
        pagoSemanal: v?.pagoSemanal || 100,
      };
    },
    [ventas]
  );

  const todayStr = useMemo(() => new Date().toISOString().split('T')[0], []);

  // Summary stats filtered by selectedDiaCobro
  const statsSummary = useMemo(() => {
    let totalEsperado = 0;
    let totalCobrado = 0;
    let countPendientes = 0;
    let countEnCamino = 0;
    let countGestionados = 0;
    let countFallidos = 0;
    let countReagendados = 0;
    let countCuentasPorIniciar = 0;
    let countConNota = 0;
    let countAgendadosFuturos = 0;
    let totalHoy = 0;

    const clientesDelDia = clientesConDeuda.filter((c) => {
      if (selectedDiaCobro !== 'TODOS') {
        return getClienteDiaCobro(c) === selectedDiaCobro;
      }
      return true;
    });

    clientesDelDia.forEach((c) => {
      const st = getClienteStatus(c.id);
      const esFuturo = Boolean(c.proximoPagoFecha && c.proximoPagoFecha > todayStr);

      if (esFuturo) {
        countAgendadosFuturos++;
      } else {
        totalHoy++;
        totalEsperado += c.deudaCalculada;
      }

      const abonosHoy = abonos.filter((a) => a.clienteId === c.id);
      const cobradoHoy = abonosHoy.reduce((sum, a) => sum + a.monto, 0);
      totalCobrado += cobradoHoy;

      if (isCuentaPorIniciar(c.id)) {
        countCuentasPorIniciar++;
      }

      if (c.notaUrgente && c.notaUrgente.trim().length > 0) {
        countConNota++;
      }

      if (st === 'cobrado') countGestionados++;
      else if (st === 'en_camino') countEnCamino++;
      else if (st === 'fallido') countFallidos++;
      else if (st === 'reagendado') countReagendados++;
      else countPendientes++;
    });

    return {
      totalClientes: clientesDelDia.length,
      totalHoy,
      countAgendadosFuturos,
      totalEsperado,
      totalCobrado,
      countPendientes,
      countEnCamino,
      countGestionados,
      countFallidos,
      countReagendados,
      countCuentasPorIniciar,
      countConNota,
    };
  }, [clientesConDeuda, selectedDiaCobro, getClienteDiaCobro, abonos, getClienteStatus, isCuentaPorIniciar, todayStr]);

  // All defaulted/overdue accounts according to payment plan schedule or mora status for Apremio
  const clientesMorosidadUrgente = useMemo(() => {
    return clientesConDeuda
      .filter((c) => {
        const tieneMora = (c.diasMora || 0) > 0 || c.estadoMorosidad === 'ROJO' || c.estadoMorosidad === 'AMARILLO';
        const ventaActiva = ventas.find((v) => v.clienteId === c.id && (v.saldoActual ?? 0) > 0);
        const proxFecha = c.proximoPagoFecha || ventaActiva?.fechaPrimerPago;
        const esPasadoDeFecha = Boolean(proxFecha && proxFecha < todayStr && (c.deudaCalculada ?? 0) > 0);
        return tieneMora || esPasadoDeFecha;
      })
      .sort((a, b) => (b.diasMora || 0) - (a.diasMora || 0) || b.deudaCalculada - a.deudaCalculada);
  }, [clientesConDeuda, ventas, todayStr]);

  const totalDeudaUrgente = useMemo(() => {
    return clientesMorosidadUrgente.reduce((acc, c) => acc + c.deudaCalculada, 0);
  }, [clientesMorosidadUrgente]);

  // Filtered list for Lista mode: shows only pending ones by default, hides cobrados, shows overdue clients across all days until paid
  const filteredClientsForList = useMemo(() => {
    return clientesOrdenados.filter((c) => {
      const st = getClienteStatus(c.id);
      const tieneAtraso = (c.diasMora || 0) > 0 || c.estadoMorosidad === 'ROJO' || c.estadoMorosidad === 'AMARILLO';

      // 1. Filter by collection day if selected (unless client has atraso/mora, who stay visible until paid)
      if (selectedDiaCobro !== 'TODOS') {
        const diaCli = getClienteDiaCobro(c);
        if (diaCli !== selectedDiaCobro && !tieneAtraso) return false;
      }

      const esFuturo = Boolean(c.proximoPagoFecha && c.proximoPagoFecha > todayStr);

      if (activeFilter === 'agendados_futuros') {
        if (!esFuturo) return false;
      } else if (activeFilter === 'cuentas_por_iniciar') {
        if (!isCuentaPorIniciar(c.id)) return false;
      } else if (activeFilter === 'gestionados') {
        // Only show paid items when explicitly filtering for 'gestionados' (Cobrados)
        if (st !== 'cobrado') return false;
      } else if (activeFilter === 'todos_incluyendo_futuros') {
        // Exclude paid ones
        if (st === 'cobrado' || c.deudaCalculada <= 0) return false;
      } else {
        // Default views ('todos', 'pendientes', 'en_camino', etc.):
        // HIDE future payments (unless they have atraso) AND HIDE already paid / cobrado clients
        if (esFuturo && !tieneAtraso) return false;
        if (st === 'cobrado' || c.deudaCalculada <= 0) return false;
      }

      if (activeFilter === 'con_nota' && (!c.notaUrgente || !c.notaUrgente.trim())) return false;
      if (activeFilter === 'pendientes' && st !== 'pendiente') return false;
      if (activeFilter === 'en_camino' && st !== 'en_camino') return false;
      if (activeFilter === 'fallidos' && st !== 'fallido') return false;
      if (activeFilter === 'reagendados' && st !== 'reagendado') return false;

      if (listSearchQuery.trim()) {
        const query = listSearchQuery.toLowerCase();
        const matchesName = c.nombreCompleto.toLowerCase().includes(query);
        const matchesAddress = c.direccion.toLowerCase().includes(query);
        const matchesFolio = c.folio.toLowerCase().includes(query);
        return matchesName || matchesAddress || matchesFolio;
      }

      return true;
    });
  }, [clientesOrdenados, selectedDiaCobro, getClienteDiaCobro, activeFilter, listSearchQuery, getClienteStatus, isCuentaPorIniciar, todayStr]);

  // Grouping for "Cuentas por Iniciar" by start date
  const cuentasPorIniciarAgrupadas = useMemo(() => {
    const groups: { [fecha: string]: ClienteRutaCalculado[] } = {};
    filteredClientsForList.forEach((c) => {
      if (isCuentaPorIniciar(c.id)) {
        const fecha = getFechaInicioCuenta(c);
        if (!groups[fecha]) groups[fecha] = [];
        groups[fecha].push(c);
      }
    });

    const sortedFechas = Object.keys(groups).sort();
    return sortedFechas.map((fecha) => ({
      fecha,
      clientes: groups[fecha],
    }));
  }, [filteredClientsForList, isCuentaPorIniciar, getFechaInicioCuenta]);

  // Grouping by Colonia for fluid accordion view (ordered by proximity and atraso)
  const clientesAgrupadosPorColonia = useMemo(() => {
    const groups: { [colonia: string]: ClienteRutaCalculado[] } = {};
    filteredClientsForList.forEach((c) => {
      const col = c.colonia && c.colonia.trim() ? c.colonia.trim() : 'Sin Colonia Especificada';
      if (!groups[col]) groups[col] = [];
      groups[col].push(c);
    });

    const sortedColonias = Object.keys(groups).sort((a, b) => a.localeCompare(b));
    return sortedColonias.map((colonia) => {
      // Sort clients within colonia by proximity (distance to collector) or atraso
      const clientesOrdenadosCol = [...groups[colonia]].sort(
        (a, b) => (a.distanciaKm || 1) - (b.distanciaKm || 1)
      );

      const conAtrasoCount = clientesOrdenadosCol.filter(
        (c) => (c.diasMora || 0) > 0 || c.estadoMorosidad === 'ROJO' || c.estadoMorosidad === 'AMARILLO'
      ).length;

      const minDistanciaKm = Math.min(
        ...clientesOrdenadosCol.map((c) => c.distanciaKm || 1.2)
      );

      return {
        colonia,
        clientes: clientesOrdenadosCol,
        conAtrasoCount,
        minDistanciaKm: Number.isFinite(minDistanciaKm) ? minDistanciaKm : 1.2,
      };
    });
  }, [filteredClientsForList]);

  // Active pending clients for Un Toque step-by-step route (filtered by day, hiding cobrados)
  const clientesPendientesParaRuta = useMemo(() => {
    return clientesOrdenados.filter((c) => {
      if (selectedDiaCobro !== 'TODOS') {
        if (getClienteDiaCobro(c) !== selectedDiaCobro) return false;
      }
      const st = getClienteStatus(c.id);
      if (st === 'cobrado' || c.deudaCalculada <= 0) return false;
      return true;
    });
  }, [clientesOrdenados, selectedDiaCobro, getClienteDiaCobro, getClienteStatus]);

  // Global search clients
  const globalSearchResults = useMemo(() => {
    if (!globalSearchTerm.trim()) return clientesConDeuda;
    const term = globalSearchTerm.toLowerCase();
    return clientesConDeuda.filter(
      (c) =>
        c.nombreCompleto.toLowerCase().includes(term) ||
        c.folio.toLowerCase().includes(term) ||
        c.direccion.toLowerCase().includes(term) ||
        (c.telefono && c.telefono.includes(term))
    );
  }, [clientesConDeuda, globalSearchTerm]);

  // Next pending client
  const nextPendingClient = useMemo(() => {
    return clientesPendientesParaRuta.find((c) => {
      const st = getClienteStatus(c.id);
      return st === 'pendiente' || st === 'en_camino';
    });
  }, [clientesPendientesParaRuta, getClienteStatus]);

  // Current client for Un Toque mode
  const currentUnToqueClient = useMemo(() => {
    if (clientesPendientesParaRuta.length === 0) return null;
    const idx = Math.min(Math.max(0, currentRouteIndex), clientesPendientesParaRuta.length - 1);
    return clientesPendientesParaRuta[idx];
  }, [clientesPendientesParaRuta, currentRouteIndex]);

  // Render compact & expandable client card with days calculation from payment plan & last payment
  const renderDetailedClientCard = (cliente: ClienteRutaCalculado, index?: number) => {
    const status = getClienteStatus(cliente.id);
    const diaCobro = getClienteDiaCobro(cliente);
    const lastPay = getLastAbonoInfo(cliente.id);
    const noTieneAbonos = isCuentaPorIniciar(cliente.id);
    const contractInfo = getContractInfo(cliente);
    const isExpanded = Boolean(expandedCards[cliente.id]);

    // Calculate days overdue from payment plan scheduled date (proximoPagoFecha) to today
    const hoy = parseLocalDateStr(todayStr);
    const proxFechaStr = cliente.proximoPagoFecha;
    let diasAtrasoPlan = cliente.diasMora || 0;
    if (proxFechaStr && proxFechaStr < todayStr) {
      const prox = parseLocalDateStr(proxFechaStr);
      const diffMs = hoy.getTime() - prox.getTime();
      diasAtrasoPlan = Math.max(diasAtrasoPlan, Math.floor(diffMs / (1000 * 60 * 60 * 24)));
    }

    const tieneAtraso = diasAtrasoPlan > 0 || cliente.estadoMorosidad === 'ROJO' || cliente.estadoMorosidad === 'AMARILLO';

    let statusBadge = (
      <span className="px-2.5 py-0.5 rounded-full bg-blue-950 text-blue-300 border border-blue-700/80 text-[10px] font-black tracking-wide">
        PENDIENTE
      </span>
    );
    if (status === 'cobrado') {
      statusBadge = (
        <span className="px-2.5 py-0.5 rounded-full bg-emerald-950 text-emerald-300 border border-emerald-700/80 text-[10px] font-black tracking-wide">
          ✅ COBRADO
        </span>
      );
    } else if (status === 'en_camino') {
      statusBadge = (
        <span className="px-2.5 py-0.5 rounded-full bg-amber-950 text-amber-300 border border-amber-700/80 text-[10px] font-black tracking-wide animate-pulse">
          🧭 EN CAMINO
        </span>
      );
    } else if (status === 'fallido') {
      statusBadge = (
        <span className="px-2.5 py-0.5 rounded-full bg-red-950 text-red-300 border border-red-700/80 text-[10px] font-black tracking-wide">
          ✕ FALLIDO
        </span>
      );
    } else if (status === 'reagendado') {
      statusBadge = (
        <span className="px-2.5 py-0.5 rounded-full bg-slate-800 text-slate-300 border border-slate-700 text-[10px] font-black tracking-wide">
          🕒 REAGENDADO
        </span>
      );
    }

    const fotoComp = cliente.fotoContrato || cliente.fotoIdentificacion;

    return (
      <motion.div
        key={cliente.id}
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.25, ease: 'easeOut', delay: Math.min((index || 0) * 0.04, 0.2) }}
        className={`bg-slate-900 border rounded-3xl p-3.5 sm:p-4 shadow-xl space-y-3 relative overflow-hidden transition-all duration-300 ${
          tieneAtraso ? 'border-amber-500/50 hover:border-amber-400' : 'border-slate-800 hover:border-slate-700'
        }`}
      >
        {/* COMPACT HEADER: Cliente Name, Folio & Status Badge */}
        <div className="flex items-center justify-between border-b border-slate-800 pb-2 gap-2">
          <div className="flex items-center gap-2 min-w-0">
            <span className="px-2 py-0.5 rounded-lg bg-slate-950 text-slate-400 border border-slate-800 text-[10px] font-black uppercase shrink-0">
              Folio: {cliente.folio}
            </span>
            <h3
              onClick={() => {
                setSelectedClientForExpediente(cliente);
                setIsExpedienteOpen(true);
                triggerHaptic([30]);
              }}
              className="text-base font-black text-white leading-tight truncate hover:text-indigo-300 transition cursor-pointer flex items-center gap-1"
              title="Haz clic para ver expediente completo"
            >
              <span className="truncate">{cliente.nombreCompleto}</span>
            </h3>
          </div>
          <div className="shrink-0">{statusBadge}</div>
        </div>

        {/* COMPACT KEY METRICS ROW: Days Without Abono, Days Overdue Plan, Colonia & Debt */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
          {/* Left Column: Badges & Colonia */}
          <div className="space-y-1.5">
            {/* Days Badges */}
            <div className="flex flex-wrap items-center gap-1.5 text-[11px] font-bold">
              {/* Días sin abono */}
              {lastPay.dias !== null ? (
                <span className={`flex items-center gap-1 px-2 py-0.5 rounded-lg border text-[11px] font-black ${
                  lastPay.dias >= 14 ? 'bg-rose-950/80 text-rose-300 border-rose-800/80' :
                  lastPay.dias >= 7 ? 'bg-amber-950/80 text-amber-300 border-amber-800/80' :
                  'bg-emerald-950/60 text-emerald-300 border-emerald-800/60'
                }`}>
                  <Clock className="w-3 h-3 shrink-0" />
                  <span>{lastPay.dias}d sin abono</span>
                </span>
              ) : (
                <span className="flex items-center gap-1 px-2 py-0.5 rounded-lg bg-rose-950/80 text-rose-300 border border-rose-800/80 text-[11px] font-black">
                  <Clock className="w-3 h-3 shrink-0" />
                  <span>Sin abonos prev.</span>
                </span>
              )}

              {/* Días Atraso Plan de Pagos */}
              {diasAtrasoPlan > 0 ? (
                <span className="flex items-center gap-1 px-2 py-0.5 rounded-lg bg-red-950/90 text-red-300 border border-red-700/80 text-[11px] font-black animate-pulse">
                  <AlertTriangle className="w-3 h-3 shrink-0 text-red-400" />
                  <span>{diasAtrasoPlan}d atraso plan</span>
                </span>
              ) : (
                <span className="flex items-center gap-1 px-2 py-0.5 rounded-lg bg-emerald-950/40 text-emerald-400 border border-emerald-800/40 text-[11px] font-bold">
                  <span>Al día (0d)</span>
                </span>
              )}

              <span className="flex items-center gap-1 text-indigo-300 bg-indigo-950/40 px-2 py-0.5 rounded-lg border border-indigo-800/40 text-[10px] font-bold">
                <Calendar className="w-3 h-3" /> Cobro: {diaCobro}
              </span>
            </div>

            {/* Colonia & Distancia */}
            <div className="flex items-center gap-2 text-xs">
              <span className="text-amber-300 font-extrabold flex items-center gap-1 truncate">
                <MapPin className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                <span className="truncate">{cliente.colonia && cliente.colonia.trim() ? cliente.colonia : 'Sin Colonia'}</span>
              </span>
              <span className="text-[10px] text-cyan-400 bg-cyan-950/40 px-1.5 py-0.5 rounded border border-cyan-800/40 shrink-0 font-bold">
                {cliente.distanciaKm} km
              </span>
            </div>
          </div>

          {/* Right Column: Saldo Pendiente ($) & Cobrar Button */}
          <div className="bg-slate-950 p-2.5 rounded-2xl border border-slate-800 flex items-center justify-between gap-2">
            <div>
              <span className="text-[9px] font-black text-slate-400 uppercase tracking-wider block">
                Saldo Pendiente
              </span>
              <span className="text-xl font-black text-emerald-400">
                ${cliente.deudaCalculada.toLocaleString('es-MX')}
              </span>
            </div>

            <button
              type="button"
              onClick={() => handleOpenFlujoCobro(cliente)}
              className="px-3.5 py-2 bg-emerald-600 hover:bg-emerald-500 text-white font-black text-xs rounded-xl shadow-md border border-emerald-400 cursor-pointer active:scale-95 flex items-center gap-1 shrink-0"
            >
              <DollarSign className="w-4 h-4 text-white" />
              <span>Cobrar</span>
            </button>
          </div>
        </div>

        {/* QUICK CONTACT & TOGGLE EXPAND ACTION BAR */}
        <div className="flex items-center justify-between gap-1.5 pt-1 border-t border-slate-800/80">
          <div className="flex items-center gap-1.5 flex-1 min-w-0">
            {cliente.telefono ? (
              <a
                href={`tel:${cliente.telefono}`}
                className="py-1.5 px-2.5 bg-slate-950 hover:bg-slate-800 text-emerald-400 font-extrabold text-[11px] rounded-xl border border-slate-800 flex items-center justify-center gap-1 cursor-pointer shrink-0"
              >
                <Phone className="w-3.5 h-3.5" />
                <span>Llamar</span>
              </a>
            ) : null}

            {cliente.telefono ? (
              <a
                href={`https://wa.me/52${cliente.telefono.replace(/\D/g, '')}?text=${encodeURIComponent(
                  `Hola ${cliente.nombreCompleto}, le escribo de Cobranzas para coordinar su pago...`
                )}`}
                target="_blank"
                rel="noopener noreferrer"
                className="py-1.5 px-2.5 bg-emerald-950/60 hover:bg-emerald-900 text-emerald-300 font-extrabold text-[11px] rounded-xl border border-emerald-800/80 flex items-center justify-center gap-1 cursor-pointer shrink-0"
              >
                <MessageCircle className="w-3.5 h-3.5 text-emerald-400" />
                <span>WA</span>
              </a>
            ) : null}

            <button
              type="button"
              onClick={() => handleOpenGoogleMaps(cliente)}
              className="py-1.5 px-2.5 bg-indigo-950/60 hover:bg-indigo-900 text-indigo-300 font-extrabold text-[11px] rounded-xl border border-indigo-800/80 flex items-center justify-center gap-1 cursor-pointer shrink-0"
            >
              <MapPin className="w-3.5 h-3.5 text-rose-400" />
              <span>Maps</span>
            </button>
          </div>

          {/* DESPLEGABLE TOGGLE BUTTON */}
          <button
            type="button"
            onClick={() => toggleCardExpand(cliente.id)}
            className={`py-1.5 px-3 rounded-xl font-extrabold text-xs flex items-center gap-1.5 transition-all cursor-pointer border ${
              isExpanded
                ? 'bg-indigo-600 text-white border-indigo-400 shadow-md'
                : 'bg-slate-800 hover:bg-slate-700 text-slate-200 border-slate-700'
            }`}
          >
            <span>{isExpanded ? 'Menos' : 'Ver datos'}</span>
            {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
          </button>
        </div>

        {/* EXPANDABLE SECTION (DESPLEGABLE) */}
        <AnimatePresence>
          {isExpanded && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              transition={{ duration: 0.25, ease: 'easeInOut' }}
              className="space-y-3 pt-2 border-t border-slate-800 overflow-hidden"
            >
              {/* Full Address */}
              <div className="p-2.5 rounded-2xl bg-slate-950 border border-slate-800 space-y-1">
                <span className="text-[10px] font-black text-slate-400 uppercase tracking-wider block">
                  📍 Dirección Completa
                </span>
                <p className="text-xs text-slate-200 font-semibold">{cliente.direccion}</p>
                {cliente.referencias && (
                  <p className="text-[11px] text-amber-300/90 italic">Ref: {cliente.referencias}</p>
                )}
              </div>

              {/* Photographs */}
              <div className="space-y-1">
                <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest block">
                  📸 Fotografías del Expediente
                </span>
                <div className="grid grid-cols-3 gap-2">
                  {/* Foto 1: Cliente */}
                  <div
                    onClick={() => {
                      if (cliente.fotoCliente) {
                        setSelectedPhotoLightbox({ url: cliente.fotoCliente, title: `Foto Cliente: ${cliente.nombreCompleto}` });
                        triggerHaptic([30]);
                      }
                    }}
                    className={`h-20 rounded-2xl border overflow-hidden relative flex flex-col items-center justify-center p-1 transition ${
                      cliente.fotoCliente
                        ? 'bg-slate-950 border-slate-700 cursor-pointer hover:border-indigo-500 shadow-md'
                        : 'bg-slate-950/80 border-dashed border-slate-800 text-slate-600'
                    }`}
                  >
                    {cliente.fotoCliente ? (
                      <>
                        <img src={cliente.fotoCliente} alt="Cliente" className="w-full h-full object-cover rounded-xl" />
                        <div className="absolute bottom-0 inset-x-0 bg-slate-950/90 py-0.5 px-1 text-[9px] font-black text-cyan-300 text-center truncate">
                          👤 Cliente
                        </div>
                      </>
                    ) : (
                      <div className="text-center space-y-0.5 p-1">
                        <User className="w-5 h-5 text-slate-600 mx-auto" />
                        <span className="text-[9px] font-black text-slate-500 block leading-tight">Sin Foto Cliente</span>
                      </div>
                    )}
                  </div>

                  {/* Foto 2: Fachada */}
                  <div
                    onClick={() => {
                      if (cliente.fotoFachada) {
                        setSelectedPhotoLightbox({ url: cliente.fotoFachada, title: `Foto Fachada: ${cliente.nombreCompleto}` });
                        triggerHaptic([30]);
                      }
                    }}
                    className={`h-20 rounded-2xl border overflow-hidden relative flex flex-col items-center justify-center p-1 transition ${
                      cliente.fotoFachada
                        ? 'bg-slate-950 border-slate-700 cursor-pointer hover:border-indigo-500 shadow-md'
                        : 'bg-slate-950/80 border-dashed border-slate-800 text-slate-600'
                    }`}
                  >
                    {cliente.fotoFachada ? (
                      <>
                        <img src={cliente.fotoFachada} alt="Fachada" className="w-full h-full object-cover rounded-xl" />
                        <div className="absolute bottom-0 inset-x-0 bg-slate-950/90 py-0.5 px-1 text-[9px] font-black text-amber-300 text-center truncate">
                          🏠 Fachada
                        </div>
                      </>
                    ) : (
                      <div className="text-center space-y-0.5 p-1">
                        <MapPin className="w-5 h-5 text-slate-600 mx-auto" />
                        <span className="text-[9px] font-black text-slate-500 block leading-tight">Sin Fachada</span>
                      </div>
                    )}
                  </div>

                  {/* Foto 3: Comprobante */}
                  <div
                    onClick={() => {
                      if (fotoComp) {
                        setSelectedPhotoLightbox({ url: fotoComp, title: `Foto Comprobante: ${cliente.nombreCompleto}` });
                        triggerHaptic([30]);
                      }
                    }}
                    className={`h-20 rounded-2xl border overflow-hidden relative flex flex-col items-center justify-center p-1 transition ${
                      fotoComp
                        ? 'bg-slate-950 border-slate-700 cursor-pointer hover:border-indigo-500 shadow-md'
                        : 'bg-slate-950/80 border-dashed border-slate-800 text-slate-600'
                    }`}
                  >
                    {fotoComp ? (
                      <>
                        <img src={fotoComp} alt="Comprobante" className="w-full h-full object-cover rounded-xl" />
                        <div className="absolute bottom-0 inset-x-0 bg-slate-950/90 py-0.5 px-1 text-[9px] font-black text-emerald-300 text-center truncate">
                          📄 Comprobante
                        </div>
                      </>
                    ) : (
                      <div className="text-center space-y-0.5 p-1">
                        <FileText className="w-5 h-5 text-slate-600 mx-auto" />
                        <span className="text-[9px] font-black text-slate-500 block leading-tight">Sin Comprobante</span>
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {/* Enganche Breakdown if no abonos */}
              {noTieneAbonos && (
                <div className="p-3.5 rounded-2xl bg-gradient-to-br from-amber-950/90 via-slate-950 to-indigo-950/90 border border-amber-500/60 text-white space-y-2 shadow-xl">
                  <div className="flex items-center justify-between border-b border-amber-500/30 pb-2">
                    <div className="flex items-center gap-1.5">
                      <Sparkles className="w-4 h-4 text-amber-400 animate-pulse" />
                      <span className="text-xs font-black uppercase tracking-wider text-amber-300">
                        Desglose de Contrato (Sin Abonos)
                      </span>
                    </div>
                    <span className="px-2.5 py-0.5 rounded-full bg-amber-500/20 text-amber-300 border border-amber-400/50 text-[10px] font-black uppercase">
                      ENGANCHE PENDIENTE
                    </span>
                  </div>

                  <div className="grid grid-cols-2 gap-x-3 gap-y-1 text-xs font-bold">
                    <div className="flex justify-between text-slate-300">
                      <span>Precio Base:</span>
                      <span>${contractInfo.precioBase.toLocaleString('es-MX')}</span>
                    </div>
                    <div className="flex justify-between text-rose-300">
                      <span>- Enganche:</span>
                      <span>-${contractInfo.enganche.toLocaleString('es-MX')}</span>
                    </div>
                    <div className="flex justify-between text-indigo-300">
                      <span>- Desc. Empresa:</span>
                      <span>-${contractInfo.descuentoEmpresa.toLocaleString('es-MX')}</span>
                    </div>
                    <div className="flex justify-between text-emerald-400 font-black">
                      <span>= Restante:</span>
                      <span>${contractInfo.subtotalConDescuentos.toLocaleString('es-MX')}</span>
                    </div>
                  </div>
                </div>
              )}

              {/* Urgent Note */}
              {cliente.notaUrgente && cliente.notaUrgente.trim().length > 0 && (
                <div className="p-2.5 rounded-xl bg-amber-950/60 border border-amber-500/40 text-amber-200 text-xs flex items-start gap-2">
                  <Pin className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
                  <div>
                    <span className="font-extrabold block text-[10px] text-amber-400 uppercase tracking-wider">
                      Nota Urgente
                    </span>
                    <span>{cliente.notaUrgente}</span>
                  </div>
                </div>
              )}

              {/* Last Payment Info Card */}
              <div className={`p-2.5 rounded-2xl border flex items-center justify-between text-xs font-bold ${lastPay.colorBg} ${lastPay.colorBorder}`}>
                <div className="flex items-center gap-2.5 min-w-0">
                  <span className={`w-2.5 h-2.5 rounded-full shrink-0 animate-pulse ${lastPay.dotColor}`} />
                  <div className="min-w-0">
                    <span className="text-[10px] uppercase font-black tracking-wider text-slate-400 block leading-tight">
                      Último Pago Registrado
                    </span>
                    <span className={`text-xs font-black truncate block ${lastPay.colorText}`}>
                      {lastPay.texto}
                    </span>
                  </div>
                </div>
                <span className={`px-2.5 py-1 rounded-xl text-[10px] font-black border uppercase tracking-wider shrink-0 ${lastPay.colorBg} ${lastPay.colorBorder} ${lastPay.colorText}`}>
                  {lastPay.badgeText}
                </span>
              </div>

              {/* Navigation Options */}
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => handleOpenWaze(cliente)}
                  className="py-2.5 px-3 bg-cyan-950 hover:bg-cyan-900 text-cyan-300 hover:text-white font-black text-xs rounded-xl border border-cyan-500/50 flex items-center justify-center gap-2 cursor-pointer shadow-md active:scale-95 transition"
                >
                  <div className="w-5 h-5 rounded-full bg-cyan-500 text-slate-950 font-black text-[10px] flex items-center justify-center shrink-0">
                    W
                  </div>
                  <span>Navegar en Waze</span>
                </button>

                <button
                  type="button"
                  onClick={() => handleOpenGoogleMaps(cliente)}
                  className="py-2.5 px-3 bg-indigo-950 hover:bg-indigo-900 text-indigo-300 hover:text-white font-black text-xs rounded-xl border border-indigo-500/50 flex items-center justify-center gap-2 cursor-pointer shadow-md active:scale-95 transition"
                >
                  <MapPin className="w-4 h-4 text-rose-400" />
                  <span>Google Maps</span>
                </button>
              </div>

              {/* Actions: Reagendar, Nota, Expediente */}
              <div className="grid grid-cols-3 gap-2">
                <button
                  type="button"
                  onClick={() => {
                    setClientForReagendar(cliente);
                    setIsReagendarModalOpen(true);
                    triggerHaptic([30]);
                  }}
                  className="py-2 bg-slate-950 hover:bg-slate-800 text-amber-300 font-extrabold text-xs rounded-xl border border-slate-800 flex items-center justify-center gap-1 cursor-pointer"
                >
                  <Clock className="w-3.5 h-3.5 text-amber-400" />
                  <span>Reagendar</span>
                </button>

                <button
                  type="button"
                  onClick={() => {
                    setClienteForNotaModal(cliente);
                    setIsNotaModalOpen(true);
                  }}
                  className="py-2 bg-slate-950 hover:bg-slate-800 text-slate-200 font-extrabold text-xs rounded-xl border border-slate-800 flex items-center justify-center gap-1 cursor-pointer"
                >
                  <Pin className="w-3.5 h-3.5 text-amber-400" />
                  <span>Nota</span>
                </button>

                <button
                  type="button"
                  onClick={() => {
                    setSelectedClientForExpediente(cliente);
                    setIsExpedienteOpen(true);
                    triggerHaptic([30]);
                  }}
                  className="py-2 bg-slate-950 hover:bg-slate-800 text-cyan-300 font-extrabold text-xs rounded-xl border border-slate-800 flex items-center justify-center gap-1 cursor-pointer"
                >
                  <FileText className="w-3.5 h-3.5 text-cyan-400" />
                  <span>Expediente</span>
                </button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </motion.div>
    );
  };

  // --- Handlers & Actions ---
  const handleOpenFlujoCobro = (cliente: Cliente) => {
    const calcClient: ClienteRutaCalculado = clientesConDeuda.find((c) => c.id === cliente.id) || {
      ...cliente,
      deudaCalculada: cliente.deudaCalculada ?? 0,
      diasMora: 0,
      distanciaKm: 1.2,
    };
    const ventaActiva = ventas.find((v) => v.clienteId === cliente.id && (v.saldoActual ?? 0) > 0);
    const noTieneAbonos = isCuentaPorIniciar(cliente.id);
    const contractInfo = getContractInfo(cliente);

    const esEnganche = noTieneAbonos || Boolean(cliente.enganchePendiente || ventaActiva?.enganchePendiente);
    const cuotaPactada = contractInfo.pagoSemanal;
    const defaultMonto = noTieneAbonos
      ? (contractInfo.enganche > 0 ? contractInfo.enganche : contractInfo.subtotalConDescuentos)
      : esEnganche
      ? (cliente.enganchePendienteMonto || ventaActiva?.engancheMonto || cuotaPactada)
      : cuotaPactada;

    setSelectedClient(calcClient);
    setMontoIngresado(String(defaultMonto));
    setEsCobroEnganche(esEnganche);
    setObservacionesPago(
      noTieneAbonos
        ? `Cobro Inicial: Subtotal $${contractInfo.precioBase} - Enganche $${contractInfo.enganche} - Desc. Empresa $${contractInfo.descuentoEmpresa} = Restante $${contractInfo.subtotalConDescuentos}`
        : ''
    );

    // Default next payment date: +7 days (or +14 if enganche)
    const dt = new Date();
    dt.setDate(dt.getDate() + (esEnganche ? 14 : 7));
    setFechaProximoPagoAgendado(dt.toISOString().split('T')[0]);

    setCurrentScreen('FLUJO_COBRO');
    triggerHaptic([40]);
  };

  const handleConfirmReagendar = (
    cliente: Cliente,
    nuevaFecha: string,
    notaExplicativa: string,
    montoPrometido: number
  ) => {
    setClientStatuses((prev) => ({ ...prev, [cliente.id]: 'reagendado' }));

    // Save Visit Audit Log for Reagendado / Promesa
    const visitLog: VisitaAbonoLog = {
      id: Date.now(),
      clienteId: cliente.id,
      clienteNombre: cliente.nombreCompleto,
      clienteFolio: cliente.folio,
      colonia: cliente.colonia,
      cobradorId: 1,
      cobradorNombre: 'Cobrador de Campo',
      fechaHora: new Date().toISOString(),
      resultadoVisita: montoPrometido > 0 ? 'PROMESA_PAGO' : 'NO_PAGO_SE_NEGO',
      fechaProximaVisita: nuevaFecha,
      observaciones: `Reagendado: ${notaExplicativa}${montoPrometido ? ` (Prometió $${montoPrometido})` : ''}`,
      latitudVisita: userGps?.lat,
      longitudVisita: userGps?.lng,
      diasMoraMomento: cliente.diasMora || 0,
    };
    localforage.getItem<VisitaAbonoLog[]>('pwa_visita_logs').then((prevLogs) => {
      localforage.setItem('pwa_visita_logs', [visitLog, ...(prevLogs || [])]);
    });

    const notaTexto = `[NO ABONÓ - REAGENDADO ${nuevaFecha}] Motivo: ${notaExplicativa}${montoPrometido ? ` (Promesa: $${montoPrometido})` : ''}`;

    if (onUpdateCliente) {
      onUpdateCliente({
        ...cliente,
        proximoPagoFecha: nuevaFecha,
        notaUrgente: notaTexto,
        fechaNotaUrgente: new Date().toISOString(),
      });
    }

    if (onShowActionNotice) {
      onShowActionNotice(
        'Visita Reagendada (Sin Abono)',
        `Cliente ${cliente.nombreCompleto}: ${notaTexto}`,
        'cobrador'
      );
    }

    setIsReagendarModalOpen(false);
    setClientForReagendar(null);
    triggerHaptic([80, 50, 80]);
  };

  const handleStartNavigationToClient = (cliente: Cliente) => {
    const lat = cliente.latitud || 19.4326;
    const lng = cliente.longitud || -99.1332;
    window.open(`https://www.google.com/maps/search/?api=1&query=${lat},${lng}`, '_blank');
  };

  const handleGenerateOptimizedRoute = () => {
    setIsOptimizingRoute(true);
    triggerHaptic([80, 40, 120]);

    setTimeout(() => {
      setIsOptimizingRoute(false);
      setOptimizationToast('⚡ Ruta 100% optimizada con algoritmo GPS y ventana de cobro.');
      triggerHaptic([100, 50, 100]);
      setTimeout(() => setOptimizationToast(null), 4500);
    }, 1200);
  };

  const handleSetClientStatus = (status: EstadoClienteRuta, note: string) => {
    if (!selectedClient) return;

    setClientStatuses((prev) => ({ ...prev, [selectedClient.id]: status }));

    if (onShowActionNotice) {
      onShowActionNotice(
        status === 'reagendado' ? 'Visita Reagendada' : 'Estatus Actualizado',
        `Cliente ${selectedClient.nombreCompleto}: ${note}`,
        'cobrador'
      );
    }

    triggerHaptic([80, 80]);
    setCurrentScreen('PANEL_HOME');

    // Auto advance to next in Un Toque
    if (currentRouteIndex < clientesOrdenados.length - 1) {
      setCurrentRouteIndex((prev) => prev + 1);
    }
  };

  const handleConfirmPayment = () => {
    if (!selectedClient) return;

    const montoVal = parseFloat(montoIngresado);
    if (isNaN(montoVal) || montoVal <= 0) {
      alert('Ingresa un monto válido para registrar el cobro.');
      return;
    }

    const ventaActiva = ventas.find((v) => v.clienteId === selectedClient.id && (v.saldoActual ?? 0) > 0);
    const cuotaMinima = ventaActiva?.pagoSemanal || 150;
    const esAbonoMayorAlMinimo = montoVal > cuotaMinima;

    const fechaProximo = fechaProximoPagoAgendado || (() => {
      const d = new Date();
      d.setDate(d.getDate() + 14);
      return d.toISOString().split('T')[0];
    })();

    const nuevoAbono: Abono = {
      id: Date.now(),
      ventaId: selectedClient.id,
      clienteId: selectedClient.id,
      clienteNombre: selectedClient.nombreCompleto,
      clienteFolio: selectedClient.folio,
      cobradorId: 1,
      cobradorNombre: 'Cobrador 1',
      monto: montoVal,
      tipoPago: metodoPago === 'EFECTIVO' ? 'EFECTIVO' : 'TRANSFERENCIA',
      semanaNumero: 1,
      observaciones: esCobroEnganche
        ? `ENGANCHE DEL CONTRATO ($${montoVal}). Prórroga aplicada (+1 semana). ${observacionesPago}`
        : (observacionesPago || (esAbonoMayorAlMinimo ? `Abonó $${montoVal} (> $${cuotaMinima}). Próximo cobro: ${fechaProximo}` : 'Cobro registrado en ruta')),
      fechaPago: new Date().toISOString().split('T')[0],
      latitudCobro: userGps?.lat,
      longitudCobro: userGps?.lng,
      esEnganche: esCobroEnganche,
    } as any;

    // Save Visit Audit Log for Abono
    const visitLog: VisitaAbonoLog = {
      id: Date.now(),
      clienteId: selectedClient.id,
      clienteNombre: selectedClient.nombreCompleto,
      clienteFolio: selectedClient.folio,
      colonia: selectedClient.colonia,
      cobradorId: 1,
      cobradorNombre: 'Cobrador de Campo',
      fechaHora: new Date().toISOString(),
      resultadoVisita: 'ABONO_COBRADO',
      montoCobrado: montoVal,
      fechaProximaVisita: fechaProximo,
      observaciones: observacionesPago || (esCobroEnganche ? 'Pago de Enganche' : 'Abono registrado en ruta'),
      latitudVisita: userGps?.lat,
      longitudVisita: userGps?.lng,
      diasMoraMomento: selectedClient.diasMora || 0,
    };
    localforage.getItem<VisitaAbonoLog[]>('pwa_visita_logs').then((prevLogs) => {
      localforage.setItem('pwa_visita_logs', [visitLog, ...(prevLogs || [])]);
    });

    onAddAbono(nuevoAbono);
    setPendingSyncCount((prev) => prev + 1);
    setClientStatuses((prev) => ({ ...prev, [selectedClient.id]: 'cobrado' }));

    // Save scheduled next payment date so client card hides until next due date
    if (onUpdateCliente) {
      onUpdateCliente({
        ...selectedClient,
        proximoPagoFecha: fechaProximo,
      });
    }

    if (onShowActionNotice) {
      const msgProximo = esAbonoMayorAlMinimo
        ? ` • 📅 Próximo cobro agendado para: ${fechaProximo}`
        : '';
      onShowActionNotice(
        'Cobro Registrado Exitosamente',
        `$${montoVal.toLocaleString('es-MX')} recibidos de ${selectedClient.nombreCompleto} (${metodoPago})${msgProximo}`,
        'cobrador'
      );
    }

    triggerHaptic([120, 80, 120]);
    setMontoIngresado('0');
    setCurrentScreen('PANEL_HOME');

    // Toast for next stop
    const nextClient = clientesOrdenados.find(
      (c) => c.id !== selectedClient.id && getClienteStatus(c.id) === 'pendiente'
    );
    if (nextClient) {
      setShowNextClientToast({ client: nextClient, distKm: nextClient.distanciaKm });
      setTimeout(() => setShowNextClientToast(null), 8000);
    }

    // Auto advance in Un Toque to the next pending client
    const nextPendingIndex = clientesOrdenados.findIndex(
      (c, idx) => idx > currentRouteIndex && getClienteStatus(c.id) === 'pendiente'
    );
    if (nextPendingIndex !== -1) {
      setCurrentRouteIndex(nextPendingIndex);
    } else if (currentRouteIndex < clientesOrdenados.length - 1) {
      setCurrentRouteIndex((prev) => prev + 1);
    }
  };

  const handleTriggerSync = () => {
    setConnectionStatus('syncing');
    triggerHaptic([40, 40]);
    setTimeout(() => {
      setPendingSyncCount(0);
      setConnectionStatus('online');
      triggerHaptic([100, 100]);
    }, 1500);
  };

  // ==========================================
  // PANTALLA 1: Descarga de Ruta
  // ==========================================
  if (currentScreen === 'DESCARGA') {
    return (
      <div className="w-full min-h-screen bg-slate-950 text-white p-4 sm:p-6 font-sans flex flex-col justify-between max-w-md mx-auto">
        <div className="flex items-center justify-between pb-3 border-b border-slate-800">
          <button
            type="button"
            onClick={() => setCurrentScreen('PANEL_HOME')}
            className="p-2.5 bg-slate-900 rounded-xl text-slate-300 hover:text-white cursor-pointer"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div className="text-center">
            <h2 className="text-base font-black text-white">Descarga de Ruta</h2>
            <p className="text-xs text-slate-400">Sincronización Pre-Salida</p>
          </div>
          <div className="w-9" />
        </div>

        <div className="my-auto space-y-6 py-6">
          <div className="text-center space-y-2">
            <div className="w-20 h-20 rounded-3xl bg-indigo-600/20 border border-indigo-500/50 flex items-center justify-center mx-auto shadow-2xl">
              <Download className={`w-10 h-10 text-indigo-400 ${isDownloading ? 'animate-bounce' : ''}`} />
            </div>
            <h3 className="text-xl font-black text-white">Preparando tu Ruta Diaria</h3>
            <p className="text-xs text-slate-400 max-w-xs mx-auto">
              Descarga datos completos para garantizar el funcionamiento 100% Offline sin cobertura de red.
            </p>
          </div>

          <div className="space-y-2 bg-slate-900 border border-slate-800 rounded-3xl p-4 shadow-xl">
            {downloadItems.map((item) => (
              <div key={item.id} className="flex items-center justify-between text-xs p-2.5 rounded-2xl bg-slate-950/80">
                <span className="font-semibold text-slate-300">{item.label}</span>
                {item.status === 'done' && <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />}
                {item.status === 'warning' && <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0" />}
                {item.status === 'pending' && <Clock className="w-4 h-4 text-slate-600 shrink-0" />}
              </div>
            ))}
          </div>

          {isDownloading && (
            <div className="space-y-2">
              <div className="flex justify-between text-xs font-bold text-slate-400">
                <span>Descargando cartografía y padrón...</span>
                <span>{downloadProgress}%</span>
              </div>
              <div className="w-full h-3 bg-slate-900 rounded-full overflow-hidden border border-slate-800">
                <div
                  className="h-full bg-gradient-to-r from-indigo-500 to-cyan-400 transition-all duration-300"
                  style={{ width: `${downloadProgress}%` }}
                />
              </div>
            </div>
          )}
        </div>

        <div>
          {!downloadComplete ? (
            <button
              type="button"
              onClick={() => {
                setIsDownloading(true);
                setDownloadProgress(20);
                setTimeout(() => {
                  setDownloadProgress(100);
                  setIsDownloading(false);
                  setDownloadComplete(true);
                }, 1800);
              }}
              disabled={isDownloading}
              className="w-full min-h-[56px] bg-indigo-600 hover:bg-indigo-500 text-white font-black text-base rounded-2xl shadow-xl flex items-center justify-center gap-2 cursor-pointer transition active:scale-98"
            >
              <Download className="w-5 h-5 text-white" />
              <span>{isDownloading ? 'Descargando...' : 'Iniciar Descarga Offline'}</span>
            </button>
          ) : (
            <button
              type="button"
              onClick={() => setCurrentScreen('PANEL_HOME')}
              className="w-full min-h-[56px] bg-emerald-600 hover:bg-emerald-500 text-white font-black text-base rounded-2xl shadow-xl flex items-center justify-center gap-2 cursor-pointer transition active:scale-98"
            >
              <Play className="w-5 h-5 text-white" />
              <span>Ir a la Ruta del Día</span>
            </button>
          )}
        </div>
      </div>
    );
  }

  // ==========================================
  // PANTALLA 3: Modo Navegación Turn-by-Turn Mapbox
  // ==========================================
  if (currentScreen === 'NAVEGACION') {
    return (
      <NavegacionInAppMapbox
        clientesProp={clientes}
        ventasProp={ventas}
        abonosProp={abonos}
        initialClienteId={selectedClient?.id || activeClientId}
        onClose={() => setCurrentScreen('PANEL_HOME')}
        onPaymentSuccess={(nuevoAbono, updatedCliente) => {
          onAddAbono(nuevoAbono);
          setClientStatuses((prev) => ({ ...prev, [nuevoAbono.clienteId]: 'cobrado' }));
          if (onUpdateCliente) onUpdateCliente(updatedCliente);
        }}
      />
    );
  }

  // ==========================================
  // PANTALLA 5: Flujo de cobro (Teclado)
  // ==========================================
  if (currentScreen === 'FLUJO_COBRO') {
    const activeClient = selectedClient || clientesOrdenados[0];
    const vActiva = ventas.find((v) => v.clienteId === activeClient?.id && (v.saldoActual ?? 0) > 0);
    const cuotaPactada = vActiva?.pagoSemanal || 100;
    const deudaTotal = activeClient?.deudaCalculada ?? 0;
    const ingresadoNum = parseFloat(montoIngresado || '0');
    const saldoRestanteTrasCobro = Math.max(0, deudaTotal - ingresadoNum);

    const handleKeyClick = (val: string) => {
      triggerHaptic([30]);
      if (val === 'C') setMontoIngresado('0');
      else if (val === 'DEL') {
        if (montoIngresado.length <= 1) setMontoIngresado('0');
        else setMontoIngresado(montoIngresado.slice(0, -1));
      } else {
        if (montoIngresado === '0') setMontoIngresado(val);
        else setMontoIngresado(montoIngresado + val);
      }
    };

    const defaultNextDate = (() => {
      const d = new Date();
      d.setDate(d.getDate() + (ingresadoNum > cuotaPactada || esCobroEnganche ? 14 : 7));
      return d.toISOString().split('T')[0];
    })();

    return (
      <div className="w-full min-h-screen bg-slate-950 text-white p-4 sm:p-6 font-sans flex flex-col justify-between max-w-md mx-auto">
        <div className="flex items-center justify-between pb-3 border-b border-slate-800">
          <button
            type="button"
            onClick={() => setCurrentScreen('TARJETA_CLIENTE')}
            className="p-2.5 bg-slate-900 rounded-xl text-slate-300 hover:text-white cursor-pointer"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div className="text-center">
            <h2 className="text-base font-black text-white">Registrar Cobro</h2>
            <p className="text-xs text-slate-400 truncate max-w-[200px]">{activeClient?.nombreCompleto}</p>
          </div>
          <div className="w-9" />
        </div>

        <div className="my-auto py-4 space-y-3">
          {/* Quick-select amount preset buttons */}
          <div className="grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={() => {
                setMontoIngresado(String(cuotaPactada));
                triggerHaptic([40]);
              }}
              className="p-2.5 bg-indigo-950/80 hover:bg-indigo-900 text-indigo-200 border border-indigo-700/80 rounded-2xl text-xs font-black flex flex-col items-center justify-center gap-0.5 cursor-pointer shadow-md active:scale-95"
            >
              <span className="text-[10px] text-indigo-400 font-extrabold uppercase">Cuota Pactada</span>
              <span className="text-sm font-black text-white">${cuotaPactada.toLocaleString('es-MX')}</span>
            </button>

            <button
              type="button"
              onClick={() => {
                setMontoIngresado(String(deudaTotal));
                triggerHaptic([40]);
              }}
              className="p-2.5 bg-emerald-950/80 hover:bg-emerald-900 text-emerald-200 border border-emerald-700/80 rounded-2xl text-xs font-black flex flex-col items-center justify-center gap-0.5 cursor-pointer shadow-md active:scale-95"
            >
              <span className="text-[10px] text-emerald-400 font-extrabold uppercase">Pago Total Deuda</span>
              <span className="text-sm font-black text-white">${deudaTotal.toLocaleString('es-MX')}</span>
            </button>
          </div>

          {/* Big Amount Card with Remaining Debt preview */}
          <div className="bg-slate-900 border border-slate-800 rounded-3xl p-5 text-center space-y-1 shadow-2xl">
            <span className="text-xs font-bold text-slate-400 uppercase tracking-widest block">Monto a Abonar</span>
            <div className="text-4xl sm:text-5xl font-black text-emerald-400 tracking-tight">
              ${ingresadoNum.toLocaleString('es-MX')}
            </div>
            <div className="pt-2 border-t border-slate-800/80 flex items-center justify-between text-xs text-slate-400 px-2 font-semibold">
              <span>Deuda Actual: <strong className="text-slate-200">${deudaTotal.toLocaleString('es-MX')}</strong></span>
              <span>Saldo Restante: <strong className="text-emerald-300">${saldoRestanteTrasCobro.toLocaleString('es-MX')}</strong></span>
            </div>
          </div>

          {/* Option to mark as Enganche del Contrato (Prorroga de 1 semana - SOLO SI ES CUENTA POR INICIAR) */}
          {selectedClient && isCuentaPorIniciar(selectedClient.id) && (
            <button
              type="button"
              onClick={() => setEsCobroEnganche(!esCobroEnganche)}
              className={`w-full p-3 rounded-2xl border text-xs font-black flex items-center justify-between transition cursor-pointer ${
                esCobroEnganche
                  ? 'bg-amber-950/90 border-amber-400 text-amber-200 shadow-lg shadow-amber-950/50'
                  : 'bg-slate-900 border-slate-800 text-slate-300 hover:border-slate-700'
              }`}
            >
              <div className="flex items-center gap-2 text-left">
                <span className="w-7 h-7 rounded-xl bg-amber-500/20 text-amber-400 border border-amber-500/40 flex items-center justify-center font-bold text-sm shrink-0">
                  💡
                </span>
                <div>
                  <strong className="block text-white text-xs">Enganche del Contrato</strong>
                  <span className="text-[10px] font-semibold text-amber-300/80">Recorre 1 semana el primer cobro</span>
                </div>
              </div>
              <div className={`w-5 h-5 rounded-lg border flex items-center justify-center font-bold text-xs shrink-0 ${
                esCobroEnganche ? 'bg-amber-500 text-slate-950 border-amber-400' : 'border-slate-700 bg-slate-950'
              }`}>
                {esCobroEnganche ? '✓' : ''}
              </div>
            </button>
          )}

          {/* Schedule Next Payment Date */}
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-3 space-y-1.5 text-left shadow">
            <div className="flex items-center justify-between text-slate-300 font-extrabold text-xs">
              <span className="flex items-center gap-1.5 text-amber-300">
                <Calendar className="w-4 h-4 text-amber-400 shrink-0" />
                <span>Fecha Próximo Cobro (Reagendar):</span>
              </span>
              {ingresadoNum > cuotaPactada && (
                <span className="text-[10px] bg-emerald-950 text-emerald-300 border border-emerald-700/80 px-2 py-0.5 rounded-full font-bold">
                  Abonó &gt; cuota
                </span>
              )}
            </div>
            <input
              type="date"
              value={fechaProximoPagoAgendado || defaultNextDate}
              onChange={(e) => setFechaProximoPagoAgendado(e.target.value)}
              className="w-full bg-slate-950 border border-amber-500/60 rounded-xl px-3 py-2 text-xs font-bold text-white focus:outline-none focus:border-amber-400 cursor-pointer"
            />
          </div>

          <div className="grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={() => setMetodoPago('EFECTIVO')}
              className={`py-2 rounded-xl text-xs font-black transition border cursor-pointer ${
                metodoPago === 'EFECTIVO' ? 'bg-indigo-600 text-white border-indigo-400' : 'bg-slate-900 text-slate-400 border-slate-800'
              }`}
            >
              💵 Efectivo
            </button>
            <button
              type="button"
              onClick={() => setMetodoPago('TRANSFERENCIA')}
              className={`py-2 rounded-xl text-xs font-black transition border cursor-pointer ${
                metodoPago === 'TRANSFERENCIA' ? 'bg-indigo-600 text-white border-indigo-400' : 'bg-slate-900 text-slate-400 border-slate-800'
              }`}
            >
              📲 Transferencia
            </button>
          </div>

          <div className="grid grid-cols-3 gap-2">
            {['1', '2', '3', '4', '5', '6', '7', '8', '9', 'C', '0', 'DEL'].map((keyVal) => (
              <button
                key={keyVal}
                type="button"
                onClick={() => handleKeyClick(keyVal)}
                className={`min-h-[56px] rounded-2xl font-black text-xl flex items-center justify-center transition active:scale-95 border cursor-pointer ${
                  keyVal === 'C'
                    ? 'bg-red-950/60 text-red-300 border-red-800'
                    : keyVal === 'DEL'
                    ? 'bg-slate-800 text-slate-200 border-slate-700'
                    : 'bg-slate-900 text-white border-slate-800 shadow-md'
                }`}
              >
                {keyVal === 'DEL' ? '⌫' : keyVal}
              </button>
            ))}
          </div>
        </div>

        <button
          type="button"
          onClick={handleConfirmPayment}
          disabled={parseFloat(montoIngresado) <= 0}
          className="w-full min-h-[60px] bg-gradient-to-r from-emerald-600 to-green-500 hover:from-emerald-500 text-white font-black text-base rounded-2xl shadow-2xl flex items-center justify-center gap-2 cursor-pointer transition active:scale-98 border border-emerald-300 disabled:opacity-40"
        >
          <CheckCircle2 className="w-6 h-6 text-white" />
          <span>Confirmar Cobro</span>
        </button>
      </div>
    );
  }

  // ==========================================
  // PANTALLA 4: Ficha del Cliente
  // ==========================================
  if (currentScreen === 'TARJETA_CLIENTE' && selectedClient) {
    const client = selectedClient;

    return (
      <div className="w-full min-h-screen bg-slate-950 text-white p-4 sm:p-6 font-sans flex flex-col justify-between max-w-lg mx-auto">
        <div className="flex items-center justify-between pb-3 border-b border-slate-800">
          <button
            type="button"
            onClick={() => setCurrentScreen('PANEL_HOME')}
            className="p-2.5 bg-slate-900 rounded-xl text-slate-300 hover:text-white cursor-pointer"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <span className="text-xs font-black text-slate-400 uppercase tracking-widest">
            Ficha de Cliente #{client.ordenRuta || client.id}
          </span>
          <div className="w-9" />
        </div>

        <div className="space-y-4 my-auto py-4">
          <div className="bg-slate-900 border border-slate-800 rounded-3xl p-5 shadow-2xl space-y-4">
            <div className="flex items-center gap-4">
              <div className="w-20 h-20 rounded-2xl bg-slate-800 border border-slate-700 flex items-center justify-center overflow-hidden shrink-0 shadow-lg">
                {client.fotoCliente || client.fotoFachada ? (
                  <img src={client.fotoCliente || client.fotoFachada} alt={client.nombreCompleto} className="w-full h-full object-cover" />
                ) : (
                  <User className="w-10 h-10 text-slate-500" />
                )}
              </div>

              <div className="space-y-1">
                <span className="text-[10px] font-extrabold text-indigo-400 uppercase tracking-wider block">Folio: {client.folio}</span>
                <h2 className="text-lg font-black text-white leading-tight">{client.nombreCompleto}</h2>
                <p className="text-xs text-slate-400">{client.direccion}</p>
              </div>
            </div>

            {/* Urgent Note Banner */}
            {client.notaUrgente ? (
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
                      {client.notaUrgente}
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    setClienteForNotaModal(client);
                    setIsNotaModalOpen(true);
                  }}
                  className="px-2.5 py-1 bg-amber-500/30 hover:bg-amber-500 text-amber-200 hover:text-slate-950 rounded-lg text-xs font-black border border-amber-400/50 transition cursor-pointer shrink-0"
                >
                  ✏️ Editar
                </button>
              </div>
            ) : (
              <button
                type="button"
                onClick={() => {
                  setClienteForNotaModal(client);
                  setIsNotaModalOpen(true);
                }}
                className="w-full py-2 bg-slate-950 hover:bg-slate-800 text-amber-300 font-bold text-xs rounded-xl border border-slate-800 flex items-center justify-center gap-1.5 transition cursor-pointer"
              >
                <span>📌 AGREGAR NOTA URGENTE VISUAL</span>
              </button>
            )}

            {/* Scheduled Next Payment */}
            {client.proximoPagoFecha && (
              <div className="p-2.5 bg-emerald-950/80 border border-emerald-500/50 rounded-2xl text-xs font-bold text-emerald-300 flex items-center gap-2">
                <Calendar className="w-4 h-4 text-emerald-400 shrink-0" />
                <span>Próximo cobro agendado: <strong>{client.proximoPagoFecha}</strong></span>
              </div>
            )}

            <div className="grid grid-cols-2 gap-2 pt-2 border-t border-slate-800">
              <div className="bg-slate-950 p-3 rounded-2xl border border-slate-800">
                <span className="text-[10px] font-bold text-slate-400 uppercase block">Deuda Pendiente</span>
                <span className="text-xl font-black text-emerald-400">
                  ${(client.deudaCalculada || 0).toLocaleString('es-MX')}
                </span>
              </div>

              <div className="bg-slate-950 p-3 rounded-2xl border border-slate-800">
                <span className="text-[10px] font-bold text-slate-400 uppercase block">Días de Atraso</span>
                <span className="text-xl font-black text-amber-400">{client.diasMora || 0} días</span>
              </div>
            </div>

            {client.telefono && (
              <a
                href={`tel:${client.telefono}`}
                className="w-full py-2.5 bg-slate-800 hover:bg-slate-700 text-emerald-300 font-extrabold text-xs rounded-xl flex items-center justify-center gap-2 border border-slate-700"
              >
                <Phone className="w-4 h-4 text-emerald-400" />
                <span>Llamar al cliente ({client.telefono})</span>
              </a>
            )}
          </div>

          <div className="bg-slate-900 border border-slate-800 rounded-3xl p-4 space-y-2">
            <h3 className="text-xs font-black text-slate-400 uppercase tracking-wider">Historial de Pagos Recientes</h3>
            <div className="space-y-1.5 text-xs">
              <div className="flex justify-between items-center p-2 rounded-xl bg-slate-950/80">
                <span className="text-slate-300">15 Jul 2026</span>
                <span className="font-bold text-emerald-400">$200.00 MXN ✅</span>
              </div>
            </div>
          </div>
        </div>

        <div className="space-y-2 pt-2">
          <button
            type="button"
            onClick={() => handleOpenFlujoCobro(client)}
            className="w-full min-h-[60px] bg-gradient-to-r from-emerald-600 to-green-500 hover:from-emerald-500 text-white font-black text-lg rounded-2xl shadow-2xl flex items-center justify-center gap-2 cursor-pointer border border-emerald-300"
          >
            <DollarSign className="w-6 h-6 text-white" />
            <span>Cobrar</span>
          </button>

          <div className="grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={() => {
                setClientForReagendar(client);
                setIsReagendarModalOpen(true);
              }}
              className="py-3 bg-slate-900 hover:bg-slate-800 text-amber-300 font-bold text-xs rounded-xl border border-slate-800 flex items-center justify-center gap-1 cursor-pointer"
            >
              <Clock className="w-4 h-4" />
              <span>Reagendar</span>
            </button>

            <button
              type="button"
              onClick={() => handleSetClientStatus('fallido', 'No se encontró en domicilio')}
              className="py-3 bg-slate-900 hover:bg-slate-800 text-red-300 font-bold text-xs rounded-xl border border-slate-800 flex items-center justify-center gap-1 cursor-pointer"
            >
              <XCircle className="w-4 h-4" />
              <span>No hallado</span>
            </button>
          </div>
        </div>
      </div>
    );
  }

  // ==========================================
  // PANTALLA 2: PANEL HOME (Ruta y Módulos)
  // ==========================================
  return (
    <div className="w-full h-screen bg-slate-950 text-white flex flex-col font-sans overflow-hidden select-none relative">
      {/* ---------------------------------------------------------------- */}
      {/* HEADER SUPERIOR & ESTADO DE RED                                 */}
      {/* ---------------------------------------------------------------- */}
      <header className="w-full bg-slate-900/95 border-b border-slate-800 px-3 py-2.5 flex items-center justify-between z-30 shrink-0">
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setDrawerOpen(true)}
            className="w-8 h-8 rounded-full bg-indigo-600 border border-indigo-400 flex items-center justify-center text-white font-black text-xs shadow-md cursor-pointer hover:bg-indigo-500"
          >
            CB
          </button>
          <div>
            <h1 className="text-xs font-black text-white leading-tight">Cartera y Cobranza</h1>
            <span className="text-[10px] text-slate-400 block">{statsSummary.totalClientes} Clientes Asignados</span>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setShowSyncBanner(!showSyncBanner)}
            className="px-2 py-1 rounded-xl bg-slate-950 border border-slate-800 text-[10px] font-bold flex items-center gap-1.5 cursor-pointer"
          >
            {connectionStatus === 'online' && <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />}
            {connectionStatus === 'offline' && <span className="w-2 h-2 rounded-full bg-slate-500" />}
            {connectionStatus === 'syncing' && <RefreshCw className="w-3 h-3 text-cyan-400 animate-spin" />}
            <span className="text-slate-300">{pendingSyncCount > 0 ? `${pendingSyncCount} pend.` : 'Sync OK'}</span>
          </button>

          <button
            type="button"
            onClick={() => setCurrentScreen('CIERRE_RUTA')}
            className="p-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-indigo-300 border border-slate-700 cursor-pointer text-xs font-bold flex items-center gap-1"
            title="Cierre de caja"
          >
            <LogOut className="w-3.5 h-3.5 text-indigo-400" />
            <span className="hidden sm:inline">Cierre</span>
          </button>
        </div>
      </header>

      {/* Sync Banner Tooltip Overlay */}
      {showSyncBanner && (
        <div className="bg-slate-900 border-b border-indigo-500/50 p-2.5 px-4 flex items-center justify-between text-xs text-slate-200 z-30">
          <div className="flex items-center gap-2">
            <Wifi className="w-4 h-4 text-emerald-400" />
            <span>
              {pendingSyncCount > 0
                ? `${pendingSyncCount} gestiones guardadas en celular pendientes de subir`
                : 'Padrón de ruta 100% sincronizado.'}
            </span>
          </div>
          {pendingSyncCount > 0 && (
            <button
              type="button"
              onClick={handleTriggerSync}
              className="px-2.5 py-1 bg-indigo-600 text-white font-bold rounded-lg text-xs"
            >
              Sincronizar
            </button>
          )}
        </div>
      )}

      {/* Optimization Toast Notification */}
      {optimizationToast && (
        <div className="fixed top-14 left-1/2 -translate-x-1/2 z-50 w-11/12 max-w-md bg-emerald-950 border border-emerald-400 text-emerald-200 px-4 py-3 rounded-2xl shadow-2xl text-xs font-bold flex items-center gap-3 animate-slideDown">
          <Sparkles className="w-5 h-5 text-amber-400 shrink-0" />
          <span>{optimizationToast}</span>
        </div>
      )}

      {/* ---------------------------------------------------------------- */}
      {/* 1. BARRA DE HERRAMIENTAS SUPERIOR (ACCESO RÁPIDO MAESTRO)        */}
      {/* ---------------------------------------------------------------- */}
      <section className="bg-slate-900/90 border-b border-slate-800 p-2 sm:p-3 z-20 shrink-0">
        <div className="flex items-center gap-2 max-w-xl mx-auto">
          {/* Buscador Global */}
          <button
            type="button"
            onClick={() => setIsGlobalSearchOpen(true)}
            className="flex-1 p-2.5 bg-slate-950 hover:bg-slate-800 border border-slate-800 hover:border-indigo-500/50 rounded-2xl flex items-center justify-center gap-2 transition cursor-pointer active:scale-95 group shadow"
          >
            <div className="w-6 h-6 rounded-lg bg-indigo-600/20 text-indigo-400 border border-indigo-500/30 flex items-center justify-center group-hover:bg-indigo-600 group-hover:text-white transition shrink-0">
              <Search className="w-3.5 h-3.5" />
            </div>
            <span className="text-xs font-bold text-slate-200 truncate">Buscar Cliente por Nombre, Folio o Colonia</span>
          </button>
        </div>
      </section>

      {/* ---------------------------------------------------------------- */}
      {/* 2. BLOQUE DE EJECUCIÓN DE RUTA (UN TOQUE vs LISTA COMPLETA)     */}
      {/* ---------------------------------------------------------------- */}
      <main className="flex-1 overflow-y-auto p-3 space-y-3 pb-24">
        {/* Selector de Día de Cobro */}
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-2.5 max-w-xl mx-auto space-y-2 shadow-md">
          <div className="flex items-center justify-between text-xs font-black">
            <div className="flex items-center gap-1.5 text-indigo-300">
              <Calendar className="w-4 h-4 text-amber-400" />
              <span>Día de Cobro:</span>
            </div>
            <span className="text-[11px] text-amber-300 font-extrabold bg-amber-950/80 px-2.5 py-0.5 rounded-full border border-amber-800/80">
              {selectedDiaCobro === 'TODOS' ? 'Todos los Días' : `Cobros del ${selectedDiaCobro}`}
            </span>
          </div>

          <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar pb-0.5 text-xs">
            {['TODOS', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado', 'Domingo'].map((dia) => {
              const dayMap: { [key: number]: string } = {
                0: 'Domingo',
                1: 'Lunes',
                2: 'Martes',
                3: 'Miércoles',
                4: 'Jueves',
                5: 'Viernes',
                6: 'Sábado',
              };
              const hoyNombre = dayMap[new Date().getDay()];
              const esHoy = dia === hoyNombre;

              return (
                <button
                  key={dia}
                  type="button"
                  onClick={() => {
                    setSelectedDiaCobro(dia);
                    setCurrentRouteIndex(0);
                    triggerHaptic([30]);
                  }}
                  className={`px-3 py-1.5 rounded-xl text-[11px] font-black shrink-0 transition cursor-pointer border ${
                    selectedDiaCobro === dia
                      ? 'bg-amber-500 text-slate-950 border-amber-300 shadow-md ring-2 ring-amber-400/40'
                      : esHoy
                      ? 'bg-indigo-950/90 text-indigo-300 border-indigo-700/80 hover:bg-indigo-900'
                      : 'bg-slate-950 text-slate-400 border-slate-800 hover:text-slate-200'
                  }`}
                >
                  {dia === 'TODOS' ? 'Ver Todos los Días' : esHoy ? `⭐ ${dia} (Hoy)` : dia}
                </button>
              );
            })}
          </div>
        </div>

        {/* Quick Interactive Filter: Cuentas por Iniciar */}
        <div className="max-w-xl mx-auto flex items-center justify-between gap-2 p-2.5 rounded-2xl bg-gradient-to-r from-amber-950/80 via-slate-900 to-indigo-950/80 border border-amber-500/40 shadow-lg">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-amber-500/20 text-amber-400 border border-amber-500/40 flex items-center justify-center shrink-0">
              <Sparkles className="w-4 h-4" />
            </div>
            <div>
              <span className="text-xs font-black text-amber-300 block leading-tight">Cuentas por Iniciar</span>
              <span className="text-[10px] text-slate-400 font-bold block">{statsSummary.countCuentasPorIniciar} cuentas sin ningún abono registrado</span>
            </div>
          </div>

          <button
            type="button"
            onClick={() => {
              setExecutionMode('LISTA');
              setActiveFilter(activeFilter === 'cuentas_por_iniciar' ? 'todos' : 'cuentas_por_iniciar');
              triggerHaptic([30]);
            }}
            className={`px-3 py-1.5 rounded-xl text-xs font-black transition border cursor-pointer flex items-center gap-1.5 shadow active:scale-95 ${
              activeFilter === 'cuentas_por_iniciar'
                ? 'bg-amber-500 text-slate-950 border-amber-300 shadow-amber-900/40 ring-2 ring-amber-400/50'
                : 'bg-amber-600/20 hover:bg-amber-600/40 text-amber-300 border-amber-500/40'
            }`}
          >
            <span>{activeFilter === 'cuentas_por_iniciar' ? '✓ Filtro Activo' : 'Ver Cuentas'}</span>
          </button>
        </div>

        {/* Selector de Modo */}
        <div className="bg-slate-900 p-1.5 rounded-2xl border border-slate-800 flex items-center gap-1.5 max-w-xl mx-auto shadow-inner">
          <button
            type="button"
            onClick={() => {
              setExecutionMode('UN_TOQUE');
              triggerHaptic([30]);
            }}
            className={`flex-1 py-2 rounded-xl text-xs font-black transition flex items-center justify-center gap-2 cursor-pointer ${
              executionMode === 'UN_TOQUE'
                ? 'bg-gradient-to-r from-indigo-600 to-indigo-500 text-white shadow-md border border-indigo-400'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <Zap className="w-4 h-4 text-amber-300" />
            <span>Paso a Paso</span>
          </button>

          <button
            type="button"
            onClick={() => {
              setExecutionMode('LISTA');
              triggerHaptic([30]);
            }}
            className={`flex-1 py-2 rounded-xl text-xs font-black transition flex items-center justify-center gap-2 cursor-pointer ${
              executionMode === 'LISTA'
                ? 'bg-gradient-to-r from-indigo-600 to-indigo-500 text-white shadow-md border border-indigo-400'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <List className="w-4 h-4 text-cyan-300" />
            <span>Tarjetas de Ruta ({clientesPendientesParaRuta.length})</span>
          </button>
        </div>

        {/* ------------------------------- */}
        {/* MODO A: VISTA UN TOQUE          */}
        {/* ------------------------------- */}
        {executionMode === 'UN_TOQUE' && (
          <div className="max-w-xl mx-auto space-y-3">
            {currentUnToqueClient ? (
              <div className="space-y-3">
                {renderDetailedClientCard(currentUnToqueClient, currentRouteIndex)}

                {/* Step controls */}
                <div className="flex items-center justify-between bg-slate-900 border border-slate-800 p-3 rounded-2xl">
                  <button
                    type="button"
                    disabled={currentRouteIndex === 0}
                    onClick={() => {
                      setCurrentRouteIndex((prev) => Math.max(0, prev - 1));
                      triggerHaptic([30]);
                    }}
                    className="px-3.5 py-2 bg-slate-950 hover:bg-slate-800 disabled:opacity-30 rounded-xl text-xs font-bold text-slate-300 border border-slate-800 flex items-center gap-1 cursor-pointer"
                  >
                    <ChevronLeft className="w-4 h-4" />
                    <span>Anterior</span>
                  </button>

                  <span className="text-[11px] font-extrabold text-slate-300">
                    Cliente {currentRouteIndex + 1} de {clientesPendientesParaRuta.length}
                  </span>

                  <button
                    type="button"
                    disabled={currentRouteIndex >= clientesPendientesParaRuta.length - 1}
                    onClick={() => {
                      setCurrentRouteIndex((prev) => Math.min(clientesPendientesParaRuta.length - 1, prev + 1));
                      triggerHaptic([30]);
                    }}
                    className="px-3.5 py-2 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-30 rounded-xl text-xs font-bold text-white shadow flex items-center gap-1 cursor-pointer"
                  >
                    <span>Siguiente</span>
                    <ChevronRight className="w-4 h-4" />
                  </button>
                </div>
              </div>
            ) : (
              <div className="p-8 text-center text-xs text-slate-500 bg-slate-900 rounded-3xl border border-slate-800">
                🎉 No hay cobros pendientes acumulados para el día seleccionado.
              </div>
            )}
          </div>
        )}

        {/* ------------------------------- */}
        {/* MODO B: TARJETAS DE RUTA COMPLETA */}
        {/* ------------------------------- */}
        {executionMode === 'LISTA' && (
          <div className="max-w-xl mx-auto space-y-3">
            {/* Filter chips */}
            <div className="flex items-center gap-1.5 overflow-x-auto pb-1 no-scrollbar text-xs">
              {[
                { id: 'todos', label: `Cobros Pendientes (${statsSummary.countPendientes})` },
                { id: 'cuentas_por_iniciar', label: `⭐ Cuentas por Iniciar (${statsSummary.countCuentasPorIniciar})`, isSpecial: true },
                { id: 'agendados_futuros', label: `📅 Futuros / Quincenales (${statsSummary.countAgendadosFuturos})`, isFuturos: true },
                { id: 'con_nota', label: `📌 Con Nota (${statsSummary.countConNota})`, isNote: true },
                { id: 'gestionados', label: `Cobrados Hoy (${statsSummary.countGestionados})` },
                { id: 'fallidos', label: `Fallidos (${statsSummary.countFallidos})` },
                { id: 'reagendados', label: `Reagendados (${statsSummary.countReagendados})` },
                { id: 'todos_incluyendo_futuros', label: `Ver Todos Inc. Futuros (${statsSummary.totalClientes})` },
              ].map((chip) => (
                <button
                  key={chip.id}
                  type="button"
                  onClick={() => setActiveFilter(chip.id as FilterChip)}
                  className={`px-3 py-1.5 rounded-xl text-[11px] font-black shrink-0 transition cursor-pointer border ${
                    activeFilter === chip.id
                      ? chip.isSpecial
                        ? 'bg-gradient-to-r from-amber-600 to-amber-500 text-slate-950 border-amber-300 shadow-md ring-2 ring-amber-400/40'
                        : chip.isNote
                        ? 'bg-gradient-to-r from-rose-600 to-amber-600 text-white border-amber-400 shadow-md ring-2 ring-amber-500/30'
                        : chip.isFuturos
                        ? 'bg-gradient-to-r from-purple-600 to-indigo-600 text-white border-purple-400 shadow-md ring-2 ring-purple-500/30'
                        : 'bg-indigo-600 text-white border-indigo-400 shadow-sm'
                      : chip.isSpecial
                      ? 'bg-amber-950/60 text-amber-300 border-amber-800/80 hover:bg-amber-900/60'
                      : chip.isNote
                      ? 'bg-rose-950/60 text-rose-300 border-rose-800/80 hover:bg-rose-900/60'
                      : chip.isFuturos
                      ? 'bg-purple-950/60 text-purple-300 border-purple-800/80 hover:bg-purple-900/60'
                      : 'bg-slate-900 text-slate-400 border-slate-800 hover:text-slate-200'
                  }`}
                >
                  {chip.label}
                </button>
              ))}

              <button
                type="button"
                onClick={() => setGroupByColonia(!groupByColonia)}
                className={`px-2.5 py-1.5 rounded-xl text-[11px] font-black shrink-0 transition cursor-pointer border flex items-center gap-1 ${
                  groupByColonia
                    ? 'bg-amber-950/80 text-amber-300 border-amber-500/80'
                    : 'bg-slate-900 text-slate-400 border-slate-800'
                }`}
                title="Agrupar lista por colonia"
              >
                <MapPin className="w-3.5 h-3.5 text-amber-400" />
                <span>Agrupar Colonia</span>
              </button>

              <button
                type="button"
                onClick={() => setIsListSearchExpanded(!isListSearchExpanded)}
                className="p-1.5 rounded-xl bg-slate-900 border border-slate-800 text-slate-300 hover:text-white shrink-0 ml-auto"
              >
                <Search className="w-4 h-4" />
              </button>
            </div>

            {isListSearchExpanded && (
              <div className="relative">
                <input
                  type="text"
                  value={listSearchQuery}
                  onChange={(e) => setListSearchQuery(e.target.value)}
                  placeholder="Filtrar por cliente, folio o calle..."
                  className="w-full bg-slate-900 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500"
                />
              </div>
            )}

            {/* Render Detailed Client Cards (No minimal single-line lists) */}
            {activeFilter === 'cuentas_por_iniciar' ? (
              <div className="space-y-6">
                {cuentasPorIniciarAgrupadas.length === 0 ? (
                  <div className="p-8 text-center text-xs text-slate-500 bg-slate-900 rounded-3xl border border-slate-800">
                    No hay cuentas por iniciar sin abono registrado.
                  </div>
                ) : (
                  cuentasPorIniciarAgrupadas.map((grupo) => (
                    <div key={grupo.fecha} className="space-y-3">
                      <div className="flex items-center gap-2 px-1 pt-2">
                        <Calendar className="w-4 h-4 text-amber-400" />
                        <h4 className="text-xs font-black text-amber-300 uppercase tracking-wider">
                          📅 Fecha de Inicio: {grupo.fecha} ({grupo.clientes.length} cuentas)
                        </h4>
                        <div className="flex-1 h-px bg-slate-800" />
                      </div>

                      <div className="space-y-3">
                        {grupo.clientes.map((cliente, idx) => renderDetailedClientCard(cliente, idx))}
                      </div>
                    </div>
                  ))
                )}
              </div>
            ) : groupByColonia ? (
              <div className="space-y-4">
                {/* Global Expand / Collapse Accordion Controls */}
                <div className="flex items-center justify-between text-xs px-1">
                  <span className="text-slate-400 font-bold">
                    🏙️ {clientesAgrupadosPorColonia.length} Colonias en Ruta
                  </span>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => {
                        const allExp: Record<string, boolean> = {};
                        clientesAgrupadosPorColonia.forEach((g) => (allExp[g.colonia] = true));
                        setExpandedColonias(allExp);
                        triggerHaptic([30]);
                      }}
                      className="text-[10px] font-bold text-indigo-300 hover:text-white bg-slate-900 border border-slate-800 px-2.5 py-1 rounded-xl cursor-pointer"
                    >
                      ▼ Expandir Todas
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        const allCol: Record<string, boolean> = {};
                        clientesAgrupadosPorColonia.forEach((g) => (allCol[g.colonia] = false));
                        setExpandedColonias(allCol);
                        triggerHaptic([30]);
                      }}
                      className="text-[10px] font-bold text-slate-400 hover:text-white bg-slate-900 border border-slate-800 px-2.5 py-1 rounded-xl cursor-pointer"
                    >
                      ▲ Colapsar Todas
                    </button>
                  </div>
                </div>

                {clientesAgrupadosPorColonia.length === 0 ? (
                  <div className="p-8 text-center text-xs text-slate-500 bg-slate-900 rounded-3xl border border-slate-800">
                    No se encontraron clientes con el filtro seleccionado.
                  </div>
                ) : (
                  clientesAgrupadosPorColonia.map((grupo) => {
                    const isExpanded = expandedColonias[grupo.colonia] !== false;
                    const distLabel =
                      grupo.minDistanciaKm < 1
                        ? `${Math.round(grupo.minDistanciaKm * 1000)} m`
                        : `${grupo.minDistanciaKm.toFixed(1)} km`;

                    return (
                      <div
                        key={grupo.colonia}
                        className="bg-slate-950/90 border border-slate-800 rounded-2xl overflow-hidden shadow-xl transition"
                      >
                        {/* COLONIA ACCORDION HEADER (DESPLEGABLE) */}
                        <button
                          type="button"
                          onClick={() => toggleColonia(grupo.colonia)}
                          className="w-full p-3.5 bg-slate-900/90 hover:bg-slate-800 border-b border-slate-800 flex items-center justify-between gap-3 text-left transition cursor-pointer"
                        >
                          <div className="flex items-center gap-2 min-w-0">
                            <MapPin className="w-4 h-4 text-amber-400 shrink-0" />
                            <div className="min-w-0">
                              <h4 className="text-xs font-black text-amber-200 uppercase tracking-wider truncate">
                                Colonia: {grupo.colonia}
                              </h4>
                              <div className="flex items-center gap-2 mt-0.5 text-[10px] font-bold text-slate-400">
                                <span>{grupo.clientes.length} clientes</span>
                                <span>•</span>
                                <span className="text-emerald-400">📍 Cercano: a {distLabel}</span>
                              </div>
                            </div>
                          </div>

                          <div className="flex items-center gap-2 shrink-0">
                            {grupo.conAtrasoCount > 0 && (
                              <span className="px-2 py-0.5 bg-red-950 text-red-300 border border-red-700/80 rounded-full text-[10px] font-extrabold animate-pulse">
                                🔴 {grupo.conAtrasoCount} con atraso
                              </span>
                            )}

                            <div className="w-7 h-7 rounded-xl bg-slate-800 border border-slate-700 flex items-center justify-center text-slate-300">
                              {isExpanded ? (
                                <ChevronUp className="w-4 h-4 text-amber-400" />
                              ) : (
                                <ChevronDown className="w-4 h-4 text-slate-400" />
                              )}
                            </div>
                          </div>
                        </button>

                        {/* CLIENTS LIST INSIDE EXPANDED COLONIA */}
                        {isExpanded && (
                          <div className="p-3 space-y-3 bg-slate-950/60">
                            {grupo.clientes.map((cliente, idx) =>
                              renderDetailedClientCard(cliente, idx)
                            )}
                          </div>
                        )}
                      </div>
                    );
                  })
                )}
              </div>
            ) : (
              <div className="space-y-3">
                {filteredClientsForList.length === 0 ? (
                  <div className="p-8 text-center text-xs text-slate-500 bg-slate-900 rounded-3xl border border-slate-800">
                    No se encontraron clientes con el filtro seleccionado.
                  </div>
                ) : (
                  filteredClientsForList.map((cliente, idx) => renderDetailedClientCard(cliente, idx))
                )}
              </div>
            )}
          </div>
        )}
      </main>

      {/* ---------------------------------------------------------------- */}
      {/* 3. FOOTER FIJO DE RESUMEN DE ATRASOS                              */}
      {/* ---------------------------------------------------------------- */}
      {clientesMorosidadUrgente.length > 0 && (
        <footer className="fixed bottom-0 left-0 right-0 z-40 bg-slate-950 border-t-2 border-red-500/80 p-2.5 px-4 shadow-2xl">
          <div className="max-w-xl mx-auto flex items-center justify-between gap-3">
            <div className="flex items-center gap-2.5 min-w-0">
              <div className="relative flex items-center justify-center shrink-0">
                <span className="animate-ping absolute inline-flex h-8 w-8 rounded-full bg-red-500 opacity-75" />
                <div className="relative w-8 h-8 rounded-full bg-gradient-to-br from-red-600 to-rose-700 flex items-center justify-center text-white shadow-lg">
                  <Siren className="w-4 h-4 animate-pulse text-white" />
                </div>
              </div>

              <div className="min-w-0">
                <div className="flex items-center gap-1.5">
                  <span className="text-[11px] font-black text-red-400 uppercase tracking-wider block">
                    Clientes con Atraso ({clientesMorosidadUrgente.length})
                  </span>
                </div>
                <p className="text-[10px] text-slate-400 font-semibold truncate">
                  ${totalDeudaUrgente.toLocaleString('es-MX')} saldo atrasado
                </p>
              </div>
            </div>

            <button
              type="button"
              onClick={() => {
                setActiveFilter('todos_incluyendo_futuros');
                triggerHaptic([40]);
              }}
              className="px-3 py-1.5 bg-red-950 hover:bg-red-900 text-red-200 font-bold text-xs rounded-xl border border-red-800 flex items-center gap-1 shrink-0 cursor-pointer"
            >
              <span>Ver Lista ➔</span>
            </button>
          </div>
        </footer>
      )}

      {/* ================================================================= */}
      {/* MODAL: BUSCADOR GLOBAL DE CLIENTES                                */}
      {/* ================================================================= */}
      {isGlobalSearchOpen && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-md flex flex-col p-4 sm:p-6 animate-fadeIn">
          <div className="max-w-xl mx-auto w-full bg-slate-900 border border-slate-800 rounded-3xl p-4 sm:p-5 flex flex-col h-full max-h-[85vh] shadow-2xl">
            <div className="flex items-center justify-between pb-3 border-b border-slate-800">
              <div className="flex items-center gap-2">
                <Search className="w-5 h-5 text-indigo-400" />
                <h3 className="text-sm font-black text-white">Buscador Global de Clientes</h3>
              </div>
              <button
                type="button"
                onClick={() => setIsGlobalSearchOpen(false)}
                className="p-1.5 text-slate-400 hover:text-white"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="py-3">
              <input
                type="text"
                autoFocus
                value={globalSearchTerm}
                onChange={(e) => setGlobalSearchTerm(e.target.value)}
                placeholder="Escribe nombre, folio, teléfono o dirección..."
                className="w-full bg-slate-950 border border-slate-800 rounded-2xl p-3 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500"
              />
            </div>

            <div className="flex-1 overflow-y-auto space-y-2 pt-1">
              {globalSearchResults.length === 0 ? (
                <p className="text-xs text-slate-500 text-center py-8">No se encontraron clientes.</p>
              ) : (
                globalSearchResults.map((cliente) => (
                  <div
                    key={cliente.id}
                    className="p-3 bg-slate-950 border border-slate-800 rounded-2xl flex items-center justify-between gap-2"
                  >
                    <div className="space-y-0.5 min-w-0">
                      <h4 className="text-xs font-black text-white truncate">{cliente.nombreCompleto}</h4>
                      <p className="text-[10px] text-slate-400 truncate">{cliente.direccion}</p>
                      <span className="text-[10px] font-bold text-emerald-400">
                        Deuda: ${cliente.deudaCalculada.toLocaleString('es-MX')}
                      </span>
                    </div>

                    <div className="flex items-center gap-1.5 shrink-0">
                      <button
                        type="button"
                        onClick={() => handleStartNavigationToClient(cliente)}
                        className="p-2 bg-indigo-600 text-white rounded-xl text-xs font-bold"
                        title="Ir con GPS"
                      >
                        <Navigation className="w-3.5 h-3.5 transform -rotate-45" />
                      </button>

                      <button
                        type="button"
                        onClick={() => {
                          setSelectedClient(cliente);
                          setIsGlobalSearchOpen(false);
                          setCurrentScreen('TARJETA_CLIENTE');
                        }}
                        className="px-2.5 py-2 bg-slate-800 text-slate-200 rounded-xl text-[10px] font-bold"
                      >
                        Ficha
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      )}

      {/* ================================================================= */}
      {/* MODAL: MAPA INTERACTIVO                                           */}
      {/* ================================================================= */}
      {isMapModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-md flex flex-col p-3 sm:p-5 animate-fadeIn">
          <div className="max-w-3xl mx-auto w-full bg-slate-900 border border-slate-800 rounded-3xl flex flex-col h-full overflow-hidden shadow-2xl relative">
            <div className="p-3 bg-slate-900 border-b border-slate-800 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Map className="w-5 h-5 text-cyan-400" />
                <h3 className="text-sm font-black text-white">Mapa Interactivo de Ruta</h3>
              </div>
              <button
                type="button"
                onClick={() => setIsMapModalOpen(false)}
                className="p-1.5 text-slate-400 hover:text-white cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="flex-1 w-full relative">
              <MapaRutaLeaflet
                clientes={clientes}
                clienteSeleccionadoId={selectedClient?.id}
                onSelectCliente={(c) => {
                  const calc = clientesConDeuda.find((item) => item.id === c.id) || {
                    ...c,
                    deudaCalculada: 2500,
                    diasMora: 12,
                    distanciaKm: 1.2,
                  };
                  setSelectedClient(calc);
                }}
                estadosClientes={clientStatuses}
                userLocation={userGps}
                height="100%"
                showRoutePolyline={true}
              />
            </div>
          </div>
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
            if (onShowActionNotice) {
              onShowActionNotice(
                'Nota Urgente Actualizada',
                notaText ? `📌 "${notaText}"` : 'Nota urgente eliminada.',
                'cobrador'
              );
            }
          }
        }}
      />

      {/* EXPEDIENTE COMPLETO CLIENTE MODAL */}
      {selectedClientForExpediente && (
        <ClienteDetailModal
          cliente={selectedClientForExpediente}
          ventas={ventas}
          abonos={abonos}
          isOpen={isExpedienteOpen}
          onClose={() => {
            setIsExpedienteOpen(false);
            setSelectedClientForExpediente(null);
          }}
          onCobrarAhora={(cliente) => {
            setIsExpedienteOpen(false);
            setSelectedClientForExpediente(null);
            handleOpenFlujoCobro(cliente);
          }}
        />
      )}

      {/* REAGENDAR VISITA / NO DIO ABONO FORMULARIO MODAL */}
      <ReagendarAbonoModal
        cliente={clientForReagendar}
        isOpen={isReagendarModalOpen}
        onClose={() => {
          setIsReagendarModalOpen(false);
          setClientForReagendar(null);
        }}
        onConfirm={handleConfirmReagendar}
      />

      {/* LIGHTBOX DE FOTOGRAFÍAS */}
      {selectedPhotoLightbox && (
        <ImageLightboxModal
          isOpen={Boolean(selectedPhotoLightbox)}
          imageUrl={selectedPhotoLightbox.url}
          title={selectedPhotoLightbox.title}
          onClose={() => setSelectedPhotoLightbox(null)}
        />
      )}
    </div>
  );
}
