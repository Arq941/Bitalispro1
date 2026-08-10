'use client';

import { useState, useEffect } from 'react';
import { Cliente, Venta, Abono, Usuario, Zona, Producto, DiaSemana, CorteCaja, UserRole, LogAuditoria } from '@/types';
import CardPrintView from './CardPrintView';
import AuditLogView from './AuditLogView';
import BitalisAnalyticsDashboard from './BitalisAnalyticsDashboard';
import GestionRutasView from './GestionRutasView';
import ConfirmationModal from './ConfirmationModal';
import AdminAICopilotPanel from './AdminAICopilotPanel';
import CuentasNuevasProximaSemanaPanel from './CuentasNuevasProximaSemanaPanel';
import {
  Sparkles,
  Bot,
  Settings,
  Printer,
  DollarSign,
  Package,
  MapPin,
  Search,
  Plus,
  Edit2,
  Trash2,
  Check,
  X,
  AlertCircle,
  Building2,
  TrendingUp,
  Fuel,
  Users,
  CheckCircle2,
  AlertTriangle,
  Calendar,
  Layers,
  ArrowUpRight,
  ShieldAlert,
  ShieldCheck,
  BarChart3,
  Wallet,
  Route,
  Upload,
  Camera,
  Database,
  Bell,
  Smartphone,
  Volume2,
  Save
} from 'lucide-react';

interface AdminViewProps {
  clientes: Cliente[];
  ventas: Venta[];
  abonos: Abono[];
  usuarios: Usuario[];
  zonas: Zona[];
  productos: Producto[];
  cortes?: CorteCaja[];
  auditLogs?: LogAuditoria[];
  currentUser?: Usuario | null;
  onMarkCardsAsPrinted: (clienteIds: number[]) => void;
  onSaveProducto: (producto: Producto) => void;
  onSaveZona: (zona: Zona) => void;
  onSaveUsuario?: (usuario: Usuario) => void;
  onDeleteUsuario?: (usuarioId: number) => void;
  onUpdateCliente?: (cliente: Cliente) => void;
  onDeleteCliente?: (clienteId: number) => void;
  onUpdateVenta?: (venta: Venta) => void;
  onDeleteVenta?: (ventaId: number) => void;
  onUpdateAbono?: (abono: Abono) => void;
  onDeleteAbono?: (abonoId: number) => void;
  onAddAbono?: (nuevoAbono: Abono) => void;
  onWipeAllAbonos?: () => void;
  onWipeDatabaseKeepUsers?: () => void;
  onOpenSupabaseConfig?: () => void;
}

export default function AdminView({
  clientes,
  ventas,
  abonos,
  usuarios,
  zonas,
  productos,
  cortes = [],
  auditLogs = [],
  currentUser,
  onMarkCardsAsPrinted,
  onSaveProducto,
  onSaveZona,
  onSaveUsuario,
  onDeleteUsuario,
  onUpdateCliente,
  onDeleteCliente,
  onUpdateVenta,
  onDeleteVenta,
  onUpdateAbono,
  onDeleteAbono,
  onAddAbono,
  onWipeAllAbonos,
  onWipeDatabaseKeepUsers,
  onOpenSupabaseConfig,
}: AdminViewProps) {
  // Main view defaults to executive 'dashboard'. Secondary configuration views are accessed via the Engrane (Gear Icon)
  const [activeTab, setActiveTab] = useState<'dashboard' | 'tarjetas' | 'cuentas_nuevas' | 'productos' | 'zonas' | 'rutas' | 'nomina' | 'usuarios' | 'clientes' | 'auditoria' | 'alertas' | 'abonos' | 'mapa'>('dashboard');
  const [isGearMenuOpen, setIsGearMenuOpen] = useState(false);
  const [isWipeModalOpen, setIsWipeModalOpen] = useState(false);

  // State for Abono Editing Modal
  const [editingAbono, setEditingAbono] = useState<Partial<Abono> | null>(null);
  const [isAbonoModalOpen, setIsAbonoModalOpen] = useState(false);
  const [abonoSearchTerm, setAbonoSearchTerm] = useState('');
  const [abonoDateFilter, setAbonoDateFilter] = useState<
    'HOY' | 'AYER' | 'DIA_ESPECIFICO' | 'RANGO' | 'ESTA_SEMANA' | 'ESTE_MES' | 'TODOS'
  >('HOY');
  const [abonoSpecificDate, setAbonoSpecificDate] = useState<string>(
    () => new Date().toISOString().split('T')[0]
  );
  const [abonoStartDate, setAbonoStartDate] = useState<string>(
    () => new Date().toISOString().split('T')[0]
  );
  const [abonoEndDate, setAbonoEndDate] = useState<string>(
    () => new Date().toISOString().split('T')[0]
  );

  // State for Map Configuration Module
  const savedMapConfig = typeof window !== 'undefined' ? (() => {
    try {
      const saved = localStorage.getItem('bitalis_map_config');
      return saved ? JSON.parse(saved) : null;
    } catch {
      return null;
    }
  })() : null;

  const [mapStyle, setMapStyle] = useState<string>(savedMapConfig?.style || 'mapbox://styles/mapbox/dark-v11');
  const [mapTokenInput, setMapTokenInput] = useState<string>(
    savedMapConfig?.token || (typeof window !== 'undefined' ? localStorage.getItem('bitalis_mapbox_token') || '' : '')
  );
  const [defaultCenterLat, setDefaultCenterLat] = useState<number>(savedMapConfig?.centerLat ?? 20.6736);
  const [defaultCenterLng, setDefaultCenterLng] = useState<number>(savedMapConfig?.centerLng ?? -103.3440);
  const [defaultZoom, setDefaultZoom] = useState<number>(savedMapConfig?.zoom ?? 15);
  const [defaultPitch, setDefaultPitch] = useState<number>(savedMapConfig?.pitch ?? 50);
  const [defaultBearing, setDefaultBearing] = useState<number>(savedMapConfig?.bearing ?? 0);
  const [enable3dBuildings, setEnable3dBuildings] = useState<boolean>(savedMapConfig?.enable3dBuildings ?? true);
  const [proximityArrivalMeters, setProximityArrivalMeters] = useState<number>(savedMapConfig?.proximityArrivalMeters ?? 100);
  const [gpsUpdateIntervalSeconds, setGpsUpdateIntervalSeconds] = useState<number>(savedMapConfig?.gpsUpdateIntervalSeconds ?? 3);
  const [autoCenterOnRoute, setAutoCenterOnRoute] = useState<boolean>(savedMapConfig?.autoCenterOnRoute ?? true);
  const [isMapConfigSavedNotice, setIsMapConfigSavedNotice] = useState(false);

  const handleSaveMapConfig = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    const configToSave = {
      style: mapStyle,
      token: mapTokenInput.trim(),
      centerLat: defaultCenterLat,
      centerLng: defaultCenterLng,
      zoom: defaultZoom,
      pitch: defaultPitch,
      bearing: defaultBearing,
      enable3dBuildings,
      proximityArrivalMeters,
      gpsUpdateIntervalSeconds,
      autoCenterOnRoute,
      updatedAt: new Date().toISOString(),
    };

    if (typeof window !== 'undefined') {
      localStorage.setItem('bitalis_map_config', JSON.stringify(configToSave));
      if (mapTokenInput.trim()) {
        localStorage.setItem('bitalis_mapbox_token', mapTokenInput.trim());
      }
      window.dispatchEvent(new CustomEvent('bitalis-map-config-updated', { detail: configToSave }));
    }

    setIsMapConfigSavedNotice(true);
    setTimeout(() => setIsMapConfigSavedNotice(false), 4000);
    alert('✅ Configuración de Mapa, GPS y Visores 3D guardada y aplicada con éxito.');
  };

  const handleSaveAbonoSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingAbono?.id || !editingAbono?.fechaPago || !editingAbono?.monto) return;

    const updatedAbono: Abono = {
      ...(editingAbono as Abono),
      monto: Number(editingAbono.monto),
    };

    if (onUpdateAbono) {
      onUpdateAbono(updatedAbono);
    }
    setIsAbonoModalOpen(false);
    setEditingAbono(null);
    alert(`¡Abono #${updatedAbono.id} actualizado con éxito! Fecha de pago modificada a: ${updatedAbono.fechaPago}`);
  };

  // Helper to load initial saved push config
  const savedPushConfig = typeof window !== 'undefined' ? (() => {
    try {
      const saved = localStorage.getItem('bitalis_config_alertas_push');
      return saved ? JSON.parse(saved) : null;
    } catch {
      return null;
    }
  })() : null;

  // Configuración de Umbrales de Captación de Efectivo y Notificaciones Push
  const [umbralAdvertencia, setUmbralAdvertencia] = useState<number>(savedPushConfig?.umbralAdvertencia ?? 5000);
  const [umbralCritico, setUmbralCritico] = useState<number>(savedPushConfig?.umbralCritico ?? 10000);
  const [activarAlertasEfectivo, setActivarAlertasEfectivo] = useState<boolean>(savedPushConfig?.activarAlertasEfectivo ?? true);
  const [frecuenciaAlertas, setFrecuenciaAlertas] = useState<'inmediata' | 'acumulada_1000' | 'por_corte'>(savedPushConfig?.frecuenciaAlertas ?? 'inmediata');
  const [mensajeAlertaEfectivo, setMensajeAlertaEfectivo] = useState<string>(
    savedPushConfig?.mensajeAlertaEfectivo ??
    '⚠️ ATENCIÓN: El cobrador ha superado el umbral de efectivo acumulado en campo. Se recomienda solicitar corte o arqueo de caja.'
  );

  const [pushRolesConfig, setPushRolesConfig] = useState<{
    venta: { administrador: boolean; supervisora: boolean; vendedora: boolean; cobrador: boolean };
    cobro: { administrador: boolean; supervisora: boolean; vendedora: boolean; cobrador: boolean };
    corte: { administrador: boolean; supervisora: boolean; vendedora: boolean; cobrador: boolean };
    efectivo_exceso: { administrador: boolean; supervisora: boolean; vendedora: boolean; cobrador: boolean };
  }>(savedPushConfig?.pushRolesConfig ?? {
    venta: { administrador: true, supervisora: true, vendedora: true, cobrador: false },
    cobro: { administrador: true, supervisora: true, vendedora: false, cobrador: true },
    corte: { administrador: true, supervisora: true, vendedora: false, cobrador: false },
    efectivo_exceso: { administrador: true, supervisora: true, vendedora: false, cobrador: true },
  });

  const [canalPushApp, setCanalPushApp] = useState(savedPushConfig?.canalPushApp ?? true);
  const [canalSonido, setCanalSonido] = useState(savedPushConfig?.canalSonido ?? true);
  const [canalBannerDashboard, setCanalBannerDashboard] = useState(savedPushConfig?.canalBannerDashboard ?? true);
  const [isAlertsSavedNotice, setIsAlertsSavedNotice] = useState(false);

  const handleSaveAlertsConfig = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    const configToSave = {
      umbralAdvertencia,
      umbralCritico,
      activarAlertasEfectivo,
      frecuenciaAlertas,
      mensajeAlertaEfectivo,
      pushRolesConfig,
      canalPushApp,
      canalSonido,
      canalBannerDashboard,
      fechaActualizacion: new Date().toISOString(),
    };
    if (typeof window !== 'undefined') {
      localStorage.setItem('bitalis_config_alertas_push', JSON.stringify(configToSave));
    }
    setIsAlertsSavedNotice(true);
    setTimeout(() => setIsAlertsSavedNotice(false), 4000);
    alert('✅ Configuración de umbrales de captación de efectivo y notificaciones push guardada con éxito.');
  };

  const handleTogglePushRole = (
    eventType: 'venta' | 'cobro' | 'corte' | 'efectivo_exceso',
    role: 'administrador' | 'supervisora' | 'vendedora' | 'cobrador'
  ) => {
    setPushRolesConfig((prev) => ({
      ...prev,
      [eventType]: {
        ...prev[eventType],
        [role]: !prev[eventType][role],
      },
    }));
  };

  // Client Editing state
  const [editingCliente, setEditingCliente] = useState<Partial<Cliente> | null>(null);
  const [isClienteModalOpen, setIsClienteModalOpen] = useState(false);

  // Destructive Delete Confirmation Modal State
  const [deleteConfirmTarget, setDeleteConfirmTarget] = useState<{
    type: 'usuario' | 'cliente';
    id: number;
    name: string;
    detail?: string;
  } | null>(null);

  const handleSaveClienteSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingCliente?.id || !editingCliente?.nombreCompleto) return;

    const targetZona = zonas.find((z) => z.id === Number(editingCliente.zonaId));
    const updatedCliente: Cliente = {
      ...(editingCliente as Cliente),
      zonaNombre: targetZona ? targetZona.nombre : editingCliente.zonaNombre || 'Zona General',
    };

    if (onUpdateCliente) onUpdateCliente(updatedCliente);
    setIsClienteModalOpen(false);
    setEditingCliente(null);
    alert(`¡Cliente "${updatedCliente.nombreCompleto}" actualizado con éxito!`);
  };

  // Search for lost card reprint
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedForPrint, setSelectedForPrint] = useState<Cliente[] | null>(null);
  const [printTitleMode, setPrintTitleMode] = useState<string>('');

  // Product Form & Filtering State
  const [editingProducto, setEditingProducto] = useState<Partial<Producto> | null>(null);
  const [isProductModalOpen, setIsProductModalOpen] = useState(false);
  const [productSearchQuery, setProductSearchQuery] = useState('');
  const [productCategoryFilter, setProductCategoryFilter] = useState<string>('TODAS');
  const [productStockFilter, setProductStockFilter] = useState<'TODOS' | 'EN_STOCK' | 'STOCK_BAJO' | 'AGOTADO'>('TODOS');
  const [customRestockQtyMap, setCustomRestockQtyMap] = useState<Record<number, string>>({});

  // Zona Form State
  const [editingZona, setEditingZona] = useState<Partial<Zona> | null>(null);
  const [newColoniaInput, setNewColoniaInput] = useState('');
  const [isZonaModalOpen, setIsZonaModalOpen] = useState(false);

  // Usuario Form State
  const [editingUsuario, setEditingUsuario] = useState<Partial<Usuario> | null>(null);
  const [isUsuarioModalOpen, setIsUsuarioModalOpen] = useState(false);

  const handleSaveUsuarioSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingUsuario?.nombre || !editingUsuario?.usuario) return;

    const userPin = editingUsuario.pin || '1234';
    const newUsr: Usuario = {
      id: editingUsuario.id || Math.floor(Date.now() % 100000000) + Math.floor(Math.random() * 1000),
      nombre: editingUsuario.nombre,
      usuario: editingUsuario.usuario,
      email: editingUsuario.email || `${editingUsuario.usuario}@bitalis.com`,
      telefono: editingUsuario.telefono || '5551234567',
      password: editingUsuario.password || '1234',
      pin: userPin,
      rol: editingUsuario.rol || 'vendedora',
      activo: editingUsuario.activo !== undefined ? editingUsuario.activo : true,
      avatarUrl: editingUsuario.avatarUrl || 'https://picsum.photos/seed/user/200/200',
      sueldoBase: Number(editingUsuario.sueldoBase || 1500),
      porcentajeComision: Number(editingUsuario.porcentajeComision || 5),
      comisionPorVenta: Number(editingUsuario.comisionPorVenta || 100),
    };

    if (typeof window !== 'undefined') {
      localStorage.setItem(`bitalis_pin_${newUsr.id}`, userPin);
      import('localforage')
        .then((lf) => lf.default.setItem(`bitalis_pin_${newUsr.id}`, userPin))
        .catch(() => {});
    }

    if (onSaveUsuario) onSaveUsuario(newUsr);
    setIsUsuarioModalOpen(false);
    setEditingUsuario(null);
    alert(`¡Usuario "${newUsr.nombre}" guardado con éxito con PIN de seguridad ${userPin}!`);
  };

  // State for interactive KPI cards detail modal
  const [activeKpiModal, setActiveKpiModal] = useState<'recaudado' | 'ventas' | 'saldo' | 'viaticos' | null>(null);

  // Today & Yesterday Date Strings
  const hoyObj = new Date();
  const hoyStr = hoyObj.toISOString().split('T')[0];
  const ayerObj = new Date(hoyObj.getTime() - 86400000);
  const ayerStr = ayerObj.toISOString().split('T')[0];

  // 1. TOTAL RECAUDADO HOY vs AYER
  const abonosHoy = abonos.filter((a) => (a.fechaPago || '').startsWith(hoyStr));
  const cobradoHoy = abonosHoy.reduce((sum, a) => sum + a.monto, 0);

  const abonosAyer = abonos.filter((a) => (a.fechaPago || '').startsWith(ayerStr));
  const cobradoAyer = abonosAyer.reduce((sum, a) => sum + a.monto, 0);

  const cambioPctCobrado = cobradoAyer > 0
    ? Math.round(((cobradoHoy - cobradoAyer) / cobradoAyer) * 100)
    : (cobradoHoy > 0 ? 100 : 0);

  // 2. NUEVAS VENTAS DEL DÍA HOY vs AYER
  const ventasHoyList = ventas.filter((v) => (v.fechaVenta || '').startsWith(hoyStr) && v.estado !== 'RECHAZADA');
  const totalNuevasVentasHoyMonto = ventasHoyList.reduce((sum, v) => sum + (v.tipo === 'CONTADO' ? v.precioBase : v.saldoInicial), 0);
  const totalNuevasVentasHoyCount = ventasHoyList.length;

  const ventasAyerList = ventas.filter((v) => (v.fechaVenta || '').startsWith(ayerStr) && v.estado !== 'RECHAZADA');
  const totalNuevasVentasAyerMonto = ventasAyerList.reduce((sum, v) => sum + (v.tipo === 'CONTADO' ? v.precioBase : v.saldoInicial), 0);
  const totalNuevasVentasAyerCount = ventasAyerList.length;

  const cambioPctVentasMonto = totalNuevasVentasAyerMonto > 0
    ? Math.round(((totalNuevasVentasHoyMonto - totalNuevasVentasAyerMonto) / totalNuevasVentasAyerMonto) * 100)
    : (totalNuevasVentasHoyMonto > 0 ? 100 : 0);

  // 3. SALDO PENDIENTE TOTAL DE LA CARTERA
  const saldoPendienteTotal = ventas
    .filter((v) => v.estado !== 'RECHAZADA')
    .reduce((sum, v) => sum + v.saldoActual, 0);

  const saldoNuevasVentasCreditoHoy = ventasHoyList
    .filter((v) => v.tipo === 'CREDITO')
    .reduce((sum, v) => sum + v.saldoActual, 0);
  const saldoPendienteAyer = Math.max(0, saldoPendienteTotal + cobradoHoy - saldoNuevasVentasCreditoHoy);

  const cambioPctSaldoPendiente = saldoPendienteAyer > 0
    ? Math.round(((saldoPendienteTotal - saldoPendienteAyer) / saldoPendienteAyer) * 100)
    : 0;

  // 4. MONTO TOTAL EN VIÁTICOS/GASOLINA ENTREGADOS HOY vs AYER
  const cortesHoy = cortes.filter((c) => c.fecha === hoyStr);
  const gastosGasolinaHoy = cortesHoy.reduce((sum, c) => sum + (c.gastosGasolina || 0), 0);
  const viaticosHoy = cortesHoy.reduce((sum, c) => sum + (c.viaticos || 0), 0);
  const gastadoHoyTotal = gastosGasolinaHoy + viaticosHoy;

  const cortesAyer = cortes.filter((c) => c.fecha === ayerStr);
  const gastosGasolinaAyer = cortesAyer.reduce((sum, c) => sum + (c.gastosGasolina || 0), 0);
  const viaticosAyer = cortesAyer.reduce((sum, c) => sum + (c.viaticos || 0), 0);
  const gastadoAyerTotal = gastosGasolinaAyer + viaticosAyer;

  const cambioPctGastado = gastadoAyerTotal > 0
    ? Math.round(((gastadoHoyTotal - gastadoAyerTotal) / gastadoAyerTotal) * 100)
    : (gastadoHoyTotal > 0 ? 100 : 0);

  // NET OPERATING BALANCE TODAY
  const balanceNetoHoy = cobradoHoy - gastadoHoyTotal;

  // METRIC 3: VENTAS REALIZADAS POR DÍA
  const ventasPorDiaMap: Record<string, { creditoCount: number; contadoCount: number; totalMonto: number; enganches: number }> = {};
  
  ventas.forEach((v) => {
    const dia = v.fechaVenta || hoyStr;
    if (!ventasPorDiaMap[dia]) {
      ventasPorDiaMap[dia] = { creditoCount: 0, contadoCount: 0, totalMonto: 0, enganches: 0 };
    }
    if (v.tipo === 'CONTADO') {
      ventasPorDiaMap[dia].contadoCount += 1;
      ventasPorDiaMap[dia].totalMonto += v.precioBase;
      ventasPorDiaMap[dia].enganches += v.precioBase;
    } else {
      ventasPorDiaMap[dia].creditoCount += 1;
      ventasPorDiaMap[dia].totalMonto += v.precioBase;
      ventasPorDiaMap[dia].enganches += v.engancheMonto ?? 0;
    }
  });

  const diasOrdenados = Object.keys(ventasPorDiaMap).sort().reverse();
  const maxVentasDia = Math.max(...Object.values(ventasPorDiaMap).map((d) => d.creditoCount + d.contadoCount), 1);

  // METRIC 4: CÓMO VAN LOS CLIENTES POR MOROSIDAD
  const clientesVerde = clientes.filter((c) => c.estadoMorosidad === 'VERDE');
  const clientesAmarillo = clientes.filter((c) => c.estadoMorosidad === 'AMARILLO');
  const clientesRojo = clientes.filter((c) => c.estadoMorosidad === 'ROJO');

  const totalClientes = clientes.length || 1;
  const pctVerde = Math.round((clientesVerde.length / totalClientes) * 100);
  const pctAmarillo = Math.round((clientesAmarillo.length / totalClientes) * 100);
  const pctRojo = Math.round((clientesRojo.length / totalClientes) * 100);

  // Saldo total en riesgo
  const carteraRojoMonto = ventas
    .filter((v) => {
      const c = clientes.find((cli) => cli.id === v.clienteId);
      return c?.estadoMorosidad === 'ROJO';
    })
    .reduce((sum, v) => sum + v.saldoActual, 0);

  // Clients with unprinted cards
  const clientesPendientesImpresion = clientes.filter((c) => !c.tarjetaImpresa);

  // Filtered clients for individual search
  const clientesFiltrados = clientes.filter(
    (c) =>
      c.nombreCompleto.toLowerCase().includes(searchTerm.toLowerCase()) ||
      c.folio.toLowerCase().includes(searchTerm.toLowerCase()) ||
      c.direccion.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const handleStartMassivePrint = () => {
    setSelectedForPrint(clientesPendientesImpresion);
    setPrintTitleMode('Impresión Masiva BITALIS (Altas Recientes)');
  };

  const handleStartSinglePrint = (cliente: Cliente) => {
    setSelectedForPrint([cliente]);
    setPrintTitleMode(`Reposición de Tarjeta BITALIS (${cliente.nombreCompleto})`);
  };

  // Product Save Handler
  const handleProductImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 5 * 1024 * 1024) {
      alert('La imagen seleccionada supera los 5MB. Por favor elige una foto más liviana.');
      return;
    }

    const reader = new FileReader();
    reader.onload = (uploadEvent) => {
      const base64Url = uploadEvent.target?.result as string;
      if (base64Url && editingProducto) {
        setEditingProducto({
          ...editingProducto,
          fotoUrl: base64Url,
        });
      }
    };
    reader.readAsDataURL(file);
  };

  const handleSaveProductSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingProducto?.nombre || !editingProducto?.precioBase) return;

    const newProd: Producto = {
      id: editingProducto.id || Math.floor(Date.now() % 100000000) + Math.floor(Math.random() * 1000),
      nombre: editingProducto.nombre,
      precioBase: Number(editingProducto.precioBase),
      engancheMinimo: Number(editingProducto.engancheMinimo || 100),
      descuentoEmpresa: Number(editingProducto.descuentoEmpresa || 0),
      pagoSemanalSugerido: Number(editingProducto.pagoSemanalSugerido || 100),
      descripcion: editingProducto.descripcion || '',
      categoria: editingProducto.categoria || 'Hogar & Enseres',
      fotoUrl: editingProducto.fotoUrl || 'https://images.unsplash.com/photo-1584992236310-6edddc08acff?w=500',
      activo: true,
    };

    onSaveProducto(newProd);
    setIsProductModalOpen(false);
    setEditingProducto(null);
    alert(`¡Producto "${newProd.nombre}" guardado exitosamente!`);
  };

  // Zona Save Handler
  const handleSaveZonaSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingZona?.nombre || !editingZona?.diaCobro) return;

    const newZ: Zona = {
      id: editingZona.id || Math.floor(Date.now() % 100000000) + Math.floor(Math.random() * 1000),
      nombre: editingZona.nombre,
      diaCobro: (editingZona.diaCobro as DiaSemana) || 'Lunes',
      colonias: editingZona.colonias || ['Centro'],
      cuadrante: editingZona.cuadrante || 'Cuadrante Norte',
      descripcion: editingZona.descripcion || '',
    };

    onSaveZona(newZ);
    setIsZonaModalOpen(false);
    setEditingZona(null);
    alert(`¡Zona "${newZ.nombre}" guardada exitosamente!`);
  };

  const addColoniaToZona = () => {
    if (!newColoniaInput.trim()) return;
    const currentCols = editingZona?.colonias || [];
    setEditingZona({
      ...editingZona,
      colonias: [...currentCols, newColoniaInput.trim()],
    });
    setNewColoniaInput('');
  };

  const removeColoniaFromZona = (index: number) => {
    const currentCols = editingZona?.colonias || [];
    setEditingZona({
      ...editingZona,
      colonias: currentCols.filter((_, idx) => idx !== index),
    });
  };

  return (
    <div className="space-y-6">
      {/* Printable Modal View */}
      {selectedForPrint && (
        <CardPrintView
          clientes={selectedForPrint}
          ventas={ventas}
          abonos={abonos}
          titleMode={printTitleMode}
          onClose={() => setSelectedForPrint(null)}
          onMarkAsPrinted={(ids) => {
            onMarkCardsAsPrinted(ids);
          }}
        />
      )}

      {/* ADMIN CONTROL BAR WITH ENGRANE (GEAR) MENU BUTTON */}
      <div className="flex items-center justify-end gap-2.5 pb-1">
        {activeTab !== 'dashboard' && (
          <button
            onClick={() => setActiveTab('dashboard')}
            className="px-3.5 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-bold rounded-xl border border-slate-700 cursor-pointer transition shadow"
          >
            ← Volver al Dashboard Main
          </button>
        )}

        <button
          onClick={() => setIsGearMenuOpen(!isGearMenuOpen)}
          className="px-4 py-2 bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 text-white font-black text-xs sm:text-sm rounded-xl shadow-lg shadow-indigo-600/30 flex items-center gap-2 cursor-pointer transition transform active:scale-95"
        >
          <Settings className={`w-4 h-4 ${isGearMenuOpen ? 'animate-spin' : ''}`} />
          <span>Engrane de Ajustes</span>
        </button>
      </div>

      {/* GEAR SETTINGS DROPDOWN MODAL / PANEL */}
      {isGearMenuOpen && (
        <div className="bg-slate-950/90 border-2 border-indigo-500/80 p-5 rounded-2xl shadow-2xl space-y-4 animate-in fade-in zoom-in duration-150">
          <div className="flex items-center justify-between border-b border-slate-800 pb-3">
            <div className="flex items-center gap-2 text-indigo-300 font-extrabold text-sm">
              <Settings className="w-5 h-5 text-indigo-400 animate-spin-slow" />
              <span>Menús de Configuración & Administración BITALIS</span>
            </div>
            <button
              onClick={() => setIsGearMenuOpen(false)}
              className="p-1.5 bg-slate-800 hover:bg-slate-700 rounded-lg text-slate-300"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-2.5">
            {[
              { id: 'tarjetas', label: '1. Impresión Tarjetas', icon: Printer, desc: 'Generar PDFs masivos' },
              { id: 'cuentas_nuevas', label: '2. Cuentas Nuevas Prox. Sem.', icon: Calendar, desc: 'Nuevos contratos por cobrar' },
              { id: 'productos', label: '3. Catálogo Productos', icon: Package, desc: 'Precios y enganches' },
              { id: 'zonas', label: '4. Zonas & Colonias', icon: MapPin, desc: 'Rutas y asignaciones' },
              { id: 'rutas', label: '5. Gestión de Rutas', icon: Route, desc: 'Secuencia óptima' },
              { id: 'nomina', label: '6. Nómina & Comisiones', icon: DollarSign, desc: 'Sueldos e incentivos' },
              { id: 'usuarios', label: '7. Usuarios BITALIS', icon: Users, desc: 'Roles y contraseñas' },
              { id: 'clientes', label: '8. Gestión Clientes', icon: Building2, desc: 'Expedientes y ajustes' },
              { id: 'auditoria', label: '9. Log Auditoría', icon: ShieldCheck, desc: 'Seguridad y registros' },
              { id: 'alertas', label: '10. Alertas & Push', icon: Bell, desc: 'Efectivo y roles push' },
              { id: 'abonos', label: '11. Gestión Abonos', icon: DollarSign, desc: 'Editar fecha y montos' },
              { id: 'mapa', label: '12. Configuración Mapa', icon: MapPin, desc: 'GPS, zoom, vistas y 3D' },
            ].map((menu) => {
              const Icon = menu.icon;
              const isSelected = activeTab === menu.id;
              return (
                <button
                  key={menu.id}
                  onClick={() => {
                    setActiveTab(menu.id as any);
                    setIsGearMenuOpen(false);
                  }}
                  className={`p-3.5 rounded-xl text-left border transition cursor-pointer flex flex-col justify-between space-y-2 ${
                    isSelected
                      ? 'bg-indigo-600 text-white border-indigo-400 shadow-lg shadow-indigo-600/30'
                      : 'bg-slate-900 text-slate-200 border-slate-800 hover:border-indigo-500 hover:bg-slate-800'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <Icon className="w-5 h-5 text-indigo-300" />
                    {isSelected && <Check className="w-4 h-4 text-emerald-400" />}
                  </div>
                  <div>
                    <strong className="block text-xs font-bold">{menu.label}</strong>
                    <span className="text-[10px] text-slate-400 line-clamp-1">{menu.desc}</span>
                  </div>
                </button>
              );
            })}
          </div>

          {/* DATABASE & SYSTEM MAINTENANCE CONTROLS */}
          <div className="pt-3 border-t border-slate-800 flex flex-wrap items-center justify-between gap-3 bg-slate-900/60 p-3 rounded-xl border border-slate-800">
            <div className="flex items-center gap-2 text-xs text-slate-300 font-bold">
              <Database className="w-4 h-4 text-indigo-400" />
              <span>Acciones de Mantenimiento y Base de Datos</span>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              {onOpenSupabaseConfig && (
                <button
                  type="button"
                  onClick={() => {
                    setIsGearMenuOpen(false);
                    onOpenSupabaseConfig();
                  }}
                  className="px-3 py-1.5 bg-indigo-950 hover:bg-indigo-900 text-indigo-300 border border-indigo-800/80 rounded-xl text-xs font-bold flex items-center gap-1.5 cursor-pointer shadow transition"
                >
                  <Database className="w-3.5 h-3.5 text-indigo-400" />
                  <span>Configuración Supabase</span>
                </button>
              )}
              {onWipeDatabaseKeepUsers && (
                <button
                  type="button"
                  onClick={() => {
                    setIsGearMenuOpen(false);
                    setIsWipeModalOpen(true);
                  }}
                  className="px-3 py-1.5 bg-rose-950 hover:bg-rose-900 text-rose-200 border border-rose-800/80 rounded-xl text-xs font-bold flex items-center gap-1.5 cursor-pointer shadow transition"
                >
                  <Trash2 className="w-3.5 h-3.5 text-rose-400" />
                  <span>🧹 Limpiar BD (Solo Usuarios)</span>
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* CONFIRMATION MODAL FOR DATABASE WIPE */}
      {isWipeModalOpen && (
        <ConfirmationModal
          isOpen={isWipeModalOpen}
          title="🧹 ¿Limpiar Base de Datos (Mantener Usuarios)?"
          description="Esta acción eliminará de forma PERMANENTE todos los clientes registrados, contratos de ventas, abonos y cortes de caja tanto en este dispositivo como en Supabase Nube. Se conservarán ÚNICAMENTE las cuentas de usuarios registradas."
          confirmText="Sí, Limpiar Base de Datos"
          cancelText="Cancelar"
          variant="danger"
          onConfirm={() => {
            setIsWipeModalOpen(false);
            if (onWipeDatabaseKeepUsers) onWipeDatabaseKeepUsers();
          }}
          onClose={() => setIsWipeModalOpen(false)}
        />
      )}

      {/* TAB 1: EXECUTIVE DASHBOARD (MAIN VISUAL CONSOLE) */}
      {activeTab === 'dashboard' && (
        <div className="space-y-6">
          {/* AI COPILOT OPERATIONAL INTELLIGENCE PANEL */}
          <AdminAICopilotPanel
            clientes={clientes}
            ventas={ventas}
            abonos={abonos}
            zonas={zonas}
            productos={productos}
            usuarios={usuarios}
            cortes={cortes}
            onNavigateTab={(tab) => setActiveTab(tab)}
          />

          {/* TOP 4 INTERACTIVE EXECUTIVE KPI CARDS */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {/* KPI 1: TOTAL RECAUDADO HOY */}
            <div
              onClick={() => setActiveKpiModal('recaudado')}
              className="bg-gradient-to-br from-emerald-950/90 to-slate-900 border border-emerald-500/50 hover:border-emerald-400 p-5 rounded-2xl shadow-xl space-y-3 relative overflow-hidden cursor-pointer transition transform hover:-translate-y-1 hover:shadow-emerald-500/20 group"
            >
              <div className="flex items-center justify-between">
                <span className="text-xs font-black text-emerald-400 uppercase tracking-wider flex items-center gap-1.5">
                  <Wallet className="w-4 h-4" />
                  Total Recaudado Hoy
                </span>
                <span className={`text-xs font-extrabold px-2 py-0.5 rounded-full flex items-center gap-1 border ${
                  cambioPctCobrado >= 0
                    ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40'
                    : 'bg-red-500/20 text-red-300 border-red-500/40'
                }`}>
                  {cambioPctCobrado >= 0 ? `▲ +${cambioPctCobrado}%` : `▼ ${cambioPctCobrado}%`} vs ayer
                </span>
              </div>
              <div>
                <span className="text-2xl sm:text-3xl font-black text-emerald-400 block group-hover:scale-105 transition origin-left">
                  ${cobradoHoy.toLocaleString('en-US')} <span className="text-sm font-bold text-slate-300">MXN</span>
                </span>
                <div className="flex items-center justify-between text-xs text-slate-400 mt-1">
                  <span>{abonosHoy.length} cobros registrados</span>
                  <span className="text-emerald-300 underline font-semibold">Ver detalle →</span>
                </div>
              </div>
            </div>

            {/* KPI 2: NUEVAS VENTAS DEL DÍA */}
            <div
              onClick={() => setActiveKpiModal('ventas')}
              className="bg-gradient-to-br from-indigo-950/90 to-slate-900 border border-indigo-500/50 hover:border-indigo-400 p-5 rounded-2xl shadow-xl space-y-3 relative overflow-hidden cursor-pointer transition transform hover:-translate-y-1 hover:shadow-indigo-500/20 group"
            >
              <div className="flex items-center justify-between">
                <span className="text-xs font-black text-indigo-300 uppercase tracking-wider flex items-center gap-1.5">
                  <TrendingUp className="w-4 h-4" />
                  Nuevas Ventas del Día
                </span>
                <span className={`text-xs font-extrabold px-2 py-0.5 rounded-full flex items-center gap-1 border ${
                  cambioPctVentasMonto >= 0
                    ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40'
                    : 'bg-red-500/20 text-red-300 border-red-500/40'
                }`}>
                  {cambioPctVentasMonto >= 0 ? `▲ +${cambioPctVentasMonto}%` : `▼ ${cambioPctVentasMonto}%`} vs ayer
                </span>
              </div>
              <div>
                <span className="text-2xl sm:text-3xl font-black text-indigo-300 block group-hover:scale-105 transition origin-left">
                  ${totalNuevasVentasHoyMonto.toLocaleString('en-US')} <span className="text-sm font-bold text-slate-300">MXN</span>
                </span>
                <div className="flex items-center justify-between text-xs text-slate-400 mt-1">
                  <span>{totalNuevasVentasHoyCount} contratos hoy</span>
                  <span className="text-indigo-300 underline font-semibold">Ver ventas →</span>
                </div>
              </div>
            </div>

            {/* KPI 3: SALDO PENDIENTE TOTAL CARTERA */}
            <div
              onClick={() => setActiveKpiModal('saldo')}
              className="bg-gradient-to-br from-cyan-950/90 to-slate-900 border border-cyan-500/50 hover:border-cyan-400 p-5 rounded-2xl shadow-xl space-y-3 relative overflow-hidden cursor-pointer transition transform hover:-translate-y-1 hover:shadow-cyan-500/20 group"
            >
              <div className="flex items-center justify-between">
                <span className="text-xs font-black text-cyan-300 uppercase tracking-wider flex items-center gap-1.5">
                  <BarChart3 className="w-4 h-4" />
                  Saldo Pendiente Cartera
                </span>
                <span className={`text-xs font-extrabold px-2 py-0.5 rounded-full flex items-center gap-1 border ${
                  cambioPctSaldoPendiente <= 0
                    ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40'
                    : 'bg-amber-500/20 text-amber-300 border-amber-500/40'
                }`}>
                  {cambioPctSaldoPendiente >= 0 ? `▲ +${cambioPctSaldoPendiente}%` : `▼ ${cambioPctSaldoPendiente}%`} vs ayer
                </span>
              </div>
              <div>
                <span className="text-2xl sm:text-3xl font-black text-cyan-300 block group-hover:scale-105 transition origin-left">
                  ${saldoPendienteTotal.toLocaleString('en-US')} <span className="text-sm font-bold text-slate-300">MXN</span>
                </span>
                <div className="flex items-center justify-between text-xs text-slate-400 mt-1">
                  <span>En {clientes.length} expedientes</span>
                  <span className="text-cyan-300 underline font-semibold">Ver cartera →</span>
                </div>
              </div>
            </div>

            {/* KPI 4: VIÁTICOS Y GASOLINA ENTREGADOS */}
            <div
              onClick={() => setActiveKpiModal('viaticos')}
              className="bg-gradient-to-br from-amber-950/90 to-slate-900 border border-amber-500/50 hover:border-amber-400 p-5 rounded-2xl shadow-xl space-y-3 relative overflow-hidden cursor-pointer transition transform hover:-translate-y-1 hover:shadow-amber-500/20 group"
            >
              <div className="flex items-center justify-between">
                <span className="text-xs font-black text-amber-400 uppercase tracking-wider flex items-center gap-1.5">
                  <Fuel className="w-4 h-4" />
                  Viáticos & Gasolina
                </span>
                <span className={`text-xs font-extrabold px-2 py-0.5 rounded-full flex items-center gap-1 border ${
                  cambioPctGastado <= 0
                    ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40'
                    : 'bg-amber-500/20 text-amber-300 border-amber-500/40'
                }`}>
                  {cambioPctGastado >= 0 ? `▲ +${cambioPctGastado}%` : `▼ ${cambioPctGastado}%`} vs ayer
                </span>
              </div>
              <div>
                <span className="text-2xl sm:text-3xl font-black text-amber-400 block group-hover:scale-105 transition origin-left">
                  ${gastadoHoyTotal.toLocaleString('en-US')} <span className="text-sm font-bold text-slate-300">MXN</span>
                </span>
                <div className="flex items-center justify-between text-xs text-slate-400 mt-1">
                  <span>Gasolina: ${gastosGasolinaHoy} | Viáticos: ${viaticosHoy}</span>
                  <span className="text-amber-300 underline font-semibold">Ver cortes →</span>
                </div>
              </div>
            </div>
          </div>

          {/* BANNER EXECUTIVE: CUENTAS NUEVAS POR COBRAR LA SIGUIENTE SEMANA */}
          <div
            onClick={() => setActiveTab('cuentas_nuevas')}
            className="bg-gradient-to-r from-emerald-950/90 via-slate-900 to-indigo-950/90 border-2 border-emerald-500/60 hover:border-emerald-400 p-5 rounded-3xl shadow-2xl flex flex-col md:flex-row items-center justify-between gap-4 cursor-pointer transition transform hover:-translate-y-0.5 group relative overflow-hidden"
          >
            <div className="flex items-center gap-4">
              <div className="w-14 h-14 rounded-2xl bg-emerald-500/20 text-emerald-400 border border-emerald-500/40 flex items-center justify-center shrink-0 shadow-lg group-hover:scale-110 transition">
                <Calendar className="w-7 h-7" />
              </div>
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <span className="px-2.5 py-0.5 rounded-full text-[10px] font-mono font-black bg-emerald-900/80 text-emerald-300 border border-emerald-600/80 uppercase">
                    Cobros Próxima Semana
                  </span>
                  <span className="text-xs font-bold text-slate-400">• Novedad Operativa</span>
                </div>
                <h3 className="text-lg font-black text-white group-hover:text-emerald-300 transition flex items-center gap-2">
                  <span>Cuentas Nuevas por Cobrar la Siguiente Semana</span>
                  <ArrowUpRight className="w-4 h-4 text-emerald-400 opacity-0 group-hover:opacity-100 transition" />
                </h3>
                <p className="text-xs text-slate-300">
                  Panel especializado para supervisar y cobrar contratos nuevos con primera cuota a vencer la próxima semana.
                </p>
              </div>
            </div>

            <button
              onClick={(e) => {
                e.stopPropagation();
                setActiveTab('cuentas_nuevas');
              }}
              className="px-5 py-3 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white font-black text-xs rounded-2xl shadow-xl flex items-center gap-2 shrink-0 transition cursor-pointer active:scale-95"
            >
              <span>Abrir Panel Cuentas Nuevas →</span>
            </button>
          </div>

          {/* RECHARTS INTERACTIVE DASHBOARD COMPONENT */}
          <BitalisAnalyticsDashboard
            ventas={ventas}
            abonos={abonos}
            zonas={zonas}
            clientes={clientes}
          />
        </div>
      )}

      {/* TAB: PANEL DE CUENTAS NUEVAS POR COBRAR LA SIGUIENTE SEMANA */}
      {activeTab === 'cuentas_nuevas' && (
        <CuentasNuevasProximaSemanaPanel
          clientes={clientes}
          ventas={ventas}
          abonos={abonos}
          zonas={zonas}
          usuarios={usuarios}
          currentUser={currentUser}
          onAddAbono={onAddAbono}
          onMarkCardsAsPrinted={onMarkCardsAsPrinted}
          onOpenPrintCards={(pendientes) => {
            setSelectedForPrint(pendientes);
            setPrintTitleMode('Tarjetas Cuentas Nuevas Cobro Próxima Semana');
          }}
        />
      )}

      {/* TAB 2: IMPRESIÓN DE TARJETAS FISICAS */}
      {activeTab === 'tarjetas' && (
        <div className="bg-slate-800/90 border border-slate-700 rounded-2xl p-6 shadow-xl space-y-6">
          <div className="flex flex-wrap items-center justify-between gap-4 border-b border-slate-700/80 pb-4">
            <div>
              <h3 className="text-xl font-black text-white flex items-center gap-2">
                <Printer className="w-6 h-6 text-indigo-400" />
                Módulo de Impresión de Tarjetas Físicas (Formato 1/4 Carta)
              </h3>
              <p className="text-xs text-slate-400 mt-0.5">
                Imprime las tarjetas físicas de abonos para los clientes recién dados de alta por las vendedoras.
              </p>
            </div>

            {clientesPendientesImpresion.length > 0 && (
              <button
                onClick={handleStartMassivePrint}
                className="bg-gradient-to-r from-emerald-600 to-indigo-600 hover:from-emerald-500 hover:to-indigo-500 text-white font-black py-2.5 px-5 rounded-xl shadow-lg transition flex items-center gap-2 text-xs sm:text-sm cursor-pointer"
              >
                <Printer className="w-4 h-4 animate-bounce" />
                Imprimir {clientesPendientesImpresion.length} Tarjetas Pendientes
              </button>
            )}
          </div>

          {/* Search Box for Reprints */}
          <div className="bg-slate-900 p-4 rounded-xl border border-slate-700 space-y-3">
            <label className="block text-xs font-bold text-slate-300">
              Buscador para Reposición de Tarjeta Perdida o Maltratada:
            </label>
            <div className="relative">
              <Search className="w-4 h-4 absolute left-3.5 top-3 text-slate-500" />
              <input
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="Buscar por Nombre del Cliente, Folio CLI-2026-..., o Dirección..."
                className="w-full bg-slate-950 border border-slate-700 rounded-xl pl-10 pr-4 py-2 text-xs text-white focus:outline-none focus:border-indigo-500"
              />
            </div>
          </div>

          {/* List of Clients for Cards */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {clientesFiltrados.map((cliente) => (
              <div
                key={cliente.id}
                className="bg-slate-900 border border-slate-700/80 p-4 rounded-xl space-y-3 flex flex-col justify-between"
              >
                <div>
                  <div className="flex items-start justify-between gap-2">
                    <h4 className="font-bold text-white text-sm">{cliente.nombreCompleto}</h4>
                    <span
                      className={`px-2 py-0.5 rounded-full text-[10px] font-bold shrink-0 ${
                        cliente.tarjetaImpresa
                          ? 'bg-emerald-950 text-emerald-300 border border-emerald-800'
                          : 'bg-amber-950 text-amber-300 border border-amber-800'
                      }`}
                    >
                      {cliente.tarjetaImpresa ? 'Impresa' : 'Pendiente'}
                    </span>
                  </div>

                  <p className="text-xs text-slate-400 mt-1">Folio: {cliente.folio}</p>
                  <p className="text-xs text-slate-400">{cliente.direccion}</p>
                </div>

                <button
                  onClick={() => handleStartSinglePrint(cliente)}
                  className="w-full bg-indigo-600 hover:bg-indigo-500 text-white font-bold py-2 px-3 rounded-lg text-xs flex items-center justify-center gap-1.5 transition cursor-pointer"
                >
                  <Printer className="w-3.5 h-3.5" />
                  {cliente.tarjetaImpresa ? 'Reimprimir Tarjeta' : 'Imprimir Tarjeta'}
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* TAB 3: CATÁLOGO DE PRODUCTOS */}
      {activeTab === 'productos' && (() => {
        const availableCategories = Array.from(new Set(productos.map((p) => p.categoria).filter(Boolean)));
        const filteredProds = productos.filter((prod) => {
          const query = productSearchQuery.trim().toLowerCase();
          const matchesSearch =
            !query ||
            prod.nombre.toLowerCase().includes(query) ||
            (prod.descripcion && prod.descripcion.toLowerCase().includes(query)) ||
            (prod.proveedor && prod.proveedor.toLowerCase().includes(query));

          const matchesCategory =
            productCategoryFilter === 'TODAS' || prod.categoria === productCategoryFilter;

          const stockMin = prod.stockMinimo ?? 5;
          const currentStock = prod.stock ?? 0;
          let matchesStock = true;
          if (productStockFilter === 'EN_STOCK') matchesStock = currentStock > stockMin;
          if (productStockFilter === 'STOCK_BAJO') matchesStock = currentStock > 0 && currentStock <= stockMin;
          if (productStockFilter === 'AGOTADO') matchesStock = currentStock === 0;

          return matchesSearch && matchesCategory && matchesStock;
        });

        const handleQuickRestock = (prod: Producto, amountToAdd: number) => {
          const currentStock = prod.stock ?? 0;
          const updatedStock = currentStock + amountToAdd;
          const updatedProd = { ...prod, stock: updatedStock };
          onSaveProducto(updatedProd);
        };

        return (
          <div className="bg-slate-800/90 border border-slate-700 rounded-2xl p-4 sm:p-6 shadow-xl space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between border-b border-slate-700/80 pb-4 gap-4">
              <div>
                <h3 className="text-xl font-black text-white flex items-center gap-2">
                  <Package className="w-6 h-6 text-indigo-400" />
                  Catálogo Oficial de Productos BITALIS
                </h3>
                <p className="text-xs text-slate-400 mt-0.5">
                  Gestión de inventario extenso, búsqueda en tiempo real, filtros e ingresos de pedidos.
                </p>
              </div>

              <button
                onClick={() => {
                  setEditingProducto({});
                  setIsProductModalOpen(true);
                }}
                className="bg-emerald-600 hover:bg-emerald-500 text-white font-bold py-2.5 px-4 rounded-xl text-xs flex items-center justify-center gap-2 cursor-pointer shadow-lg shrink-0"
              >
                <Plus className="w-4 h-4" />
                Agregar Nuevo Producto
              </button>
            </div>

            {/* CONTROLES DE BÚSQUEDA Y FILTROS DE INVENTARIO */}
            <div className="bg-slate-900 border border-slate-700/80 rounded-xl p-3 sm:p-4 space-y-3">
              <div className="grid grid-cols-1 md:grid-cols-12 gap-3 items-center">
                {/* Search Bar */}
                <div className="md:col-span-5 relative">
                  <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    value={productSearchQuery}
                    onChange={(e) => setProductSearchQuery(e.target.value)}
                    placeholder="Buscar producto por nombre, descripción o proveedor..."
                    className="w-full bg-slate-950 border border-slate-700 rounded-xl pl-9 pr-8 py-2 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500"
                  />
                  {productSearchQuery && (
                    <button
                      onClick={() => setProductSearchQuery('')}
                      className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>

                {/* Stock Status Pills */}
                <div className="md:col-span-7 flex flex-wrap items-center gap-1.5 justify-start md:justify-end">
                  <span className="text-[11px] text-slate-400 font-bold mr-1">Estatus Stock:</span>
                  {[
                    { id: 'TODOS', label: 'Todos' },
                    { id: 'EN_STOCK', label: '✅ En Stock' },
                    { id: 'STOCK_BAJO', label: '⚠️ Stock Bajo' },
                    { id: 'AGOTADO', label: '❌ Agotado' },
                  ].map((filter) => (
                    <button
                      key={filter.id}
                      onClick={() => setProductStockFilter(filter.id as any)}
                      className={`px-2.5 py-1 rounded-lg text-xs font-bold transition ${
                        productStockFilter === filter.id
                          ? 'bg-indigo-600 text-white shadow-md'
                          : 'bg-slate-800 text-slate-400 hover:bg-slate-700 hover:text-white'
                      }`}
                    >
                      {filter.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Category Filter Pills (if categories exist) */}
              {availableCategories.length > 0 && (
                <div className="flex flex-wrap items-center gap-1.5 pt-1 border-t border-slate-800">
                  <span className="text-[11px] text-slate-400 font-bold mr-1">Categorías:</span>
                  <button
                    onClick={() => setProductCategoryFilter('TODAS')}
                    className={`px-2.5 py-0.5 rounded-md text-[11px] font-bold transition ${
                      productCategoryFilter === 'TODAS'
                        ? 'bg-emerald-600 text-white'
                        : 'bg-slate-950 text-slate-400 hover:text-white border border-slate-800'
                    }`}
                  >
                    Todas
                  </button>
                  {availableCategories.map((cat) => (
                    <button
                      key={cat}
                      onClick={() => setProductCategoryFilter(cat!)}
                      className={`px-2.5 py-0.5 rounded-md text-[11px] font-bold transition ${
                        productCategoryFilter === cat
                          ? 'bg-emerald-600 text-white'
                          : 'bg-slate-950 text-slate-400 hover:text-white border border-slate-800'
                      }`}
                    >
                      {cat}
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* PRODUCT GRID */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              {filteredProds.length === 0 ? (
                <div className="col-span-full py-12 text-center bg-slate-900 border border-slate-800 rounded-2xl space-y-2">
                  <Package className="w-10 h-10 text-slate-600 mx-auto" />
                  <p className="text-sm font-bold text-slate-300">No se encontraron productos coincidentes</p>
                  <p className="text-xs text-slate-500">Prueba cambiando los términos de búsqueda o los filtros de inventario.</p>
                </div>
              ) : (
                filteredProds.map((prod) => {
                  const stockMin = prod.stockMinimo ?? 5;
                  const currentStock = prod.stock ?? 0;
                  const requiresRestock = currentStock <= stockMin;
                  const customQty = customRestockQtyMap[prod.id] || '5';

                  return (
                    <div
                      key={prod.id}
                      className={`bg-slate-900 border rounded-xl p-4 space-y-3 flex flex-col justify-between shadow-lg relative ${
                        requiresRestock ? 'border-amber-500/80 shadow-amber-500/10' : 'border-slate-700'
                      }`}
                    >
                      <div>
                        {requiresRestock && (
                          <div className="mb-2 bg-amber-600 text-white font-black text-[10px] px-2.5 py-1 rounded-lg uppercase tracking-wider flex items-center justify-between shadow animate-pulse">
                            <span>⚠️ RESURTIDO URGENTE</span>
                            <span>Min: {stockMin}</span>
                          </div>
                        )}

                        <img
                          src={prod.fotoUrl || 'https://images.unsplash.com/photo-1584992236310-6edddc08acff?w=500'}
                          alt={prod.nombre}
                          className="w-full h-32 object-cover rounded-lg bg-slate-950 border border-slate-800 mb-3"
                        />
                        <h4 className="font-bold text-white text-sm">{prod.nombre}</h4>
                        <p className="text-xs text-slate-400 line-clamp-2 mt-1">{prod.descripcion}</p>

                        {prod.categoria && (
                          <span className="inline-block mt-2 bg-indigo-950/80 border border-indigo-700/50 text-indigo-300 text-[10px] font-bold px-2 py-0.5 rounded-md">
                            {prod.categoria}
                          </span>
                        )}

                        {prod.proveedor && (
                          <p className="text-[11px] text-slate-400 mt-1">
                            Proveedor: <strong className="text-slate-200">{prod.proveedor}</strong>
                          </p>
                        )}
                        {prod.fechaCompra && (
                          <p className="text-[11px] text-slate-400">
                            Comprado: <strong className="text-slate-200">{prod.fechaCompra}</strong>
                          </p>
                        )}
                      </div>

                      <div className="space-y-2 pt-2 border-t border-slate-800">
                        <div className="flex justify-between items-center text-xs">
                          <span className="text-slate-400">Precio Base Lista:</span>
                          <strong className="text-emerald-400 font-black text-sm">${prod.precioBase} MXN</strong>
                        </div>
                        <div className="flex justify-between items-center text-xs">
                          <span className="text-slate-400">Enganche Mínimo:</span>
                          <strong className="text-white">${prod.engancheMinimo} MXN</strong>
                        </div>
                        <div className="flex justify-between items-center text-xs bg-amber-950/40 p-1.5 rounded-lg border border-amber-800/40">
                          <span className="text-amber-300 font-medium">Descuento Empresa:</span>
                          <strong className="text-amber-400 font-bold">-${prod.descuentoEmpresa || 0} MXN</strong>
                        </div>
                        <div
                          className={`flex justify-between items-center text-xs p-1.5 rounded-lg border ${
                            requiresRestock
                              ? 'bg-amber-950/80 border-amber-500/80 text-amber-200'
                              : 'bg-indigo-950/50 border-indigo-800/40 text-indigo-200'
                          }`}
                        >
                          <span className="font-medium">Stock Disponible:</span>
                          <strong className={`font-black ${currentStock > 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                            {currentStock} / Mín. {stockMin}
                          </strong>
                        </div>

                        {/* BOTONES DE ACCESO RÁPIDO PARA AÑADIR PEDIDO DE PRODUCTOS */}
                        <div className="bg-slate-950 p-2 rounded-xl border border-slate-800 space-y-1.5">
                          <div className="flex items-center justify-between text-[11px]">
                            <span className="text-slate-400 font-bold flex items-center gap-1">
                              <Plus className="w-3 h-3 text-emerald-400" />
                              Pedido / Resurtido:
                            </span>
                          </div>
                          <div className="grid grid-cols-3 gap-1">
                            <button
                              onClick={() => handleQuickRestock(prod, 5)}
                              className="bg-emerald-950 hover:bg-emerald-900 border border-emerald-700/60 text-emerald-300 font-black text-[11px] py-1 rounded-lg transition active:scale-95"
                              title="Añadir +5 unidades al stock"
                            >
                              +5 Stock
                            </button>
                            <button
                              onClick={() => handleQuickRestock(prod, 10)}
                              className="bg-emerald-950 hover:bg-emerald-900 border border-emerald-700/60 text-emerald-300 font-black text-[11px] py-1 rounded-lg transition active:scale-95"
                              title="Añadir +10 unidades al stock"
                            >
                              +10 Stock
                            </button>
                            <button
                              onClick={() => handleQuickRestock(prod, 20)}
                              className="bg-emerald-950 hover:bg-emerald-900 border border-emerald-700/60 text-emerald-300 font-black text-[11px] py-1 rounded-lg transition active:scale-95"
                              title="Añadir +20 unidades al stock"
                            >
                              +20 Stock
                            </button>
                          </div>
                          <div className="flex items-center gap-1 pt-0.5">
                            <input
                              type="number"
                              min="1"
                              value={customQty}
                              onChange={(e) =>
                                setCustomRestockQtyMap({ ...customRestockQtyMap, [prod.id]: e.target.value })
                              }
                              placeholder="Cant."
                              className="w-16 bg-slate-900 border border-slate-700 rounded-lg py-1 px-2 text-xs text-white text-center font-bold"
                            />
                            <button
                              onClick={() => {
                                const qty = parseInt(customQty) || 1;
                                handleQuickRestock(prod, qty);
                              }}
                              className="flex-1 bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs py-1 rounded-lg transition"
                            >
                              + Pedido Personalizado
                            </button>
                          </div>
                        </div>

                        <button
                          onClick={() => {
                            setEditingProducto(prod);
                            setIsProductModalOpen(true);
                          }}
                          className="w-full bg-slate-800 hover:bg-slate-700 text-indigo-300 font-bold py-1.5 px-3 rounded-lg text-xs flex items-center justify-center gap-1.5 cursor-pointer border border-slate-700"
                        >
                          <Edit2 className="w-3.5 h-3.5" />
                          Editar Producto & Config
                        </button>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        );
      })()}

      {/* TAB 4: ZONAS Y COLONIAS (LUNES - VIERNES) */}
      {activeTab === 'zonas' && (
        <div className="bg-slate-800/90 border border-slate-700 rounded-2xl p-6 shadow-xl space-y-6">
          <div className="flex items-center justify-between border-b border-slate-700/80 pb-4">
            <div>
              <h3 className="text-xl font-black text-white flex items-center gap-2">
                <MapPin className="w-6 h-6 text-indigo-400" />
                Configuración de Zonas & Colonias (Días de Cobro Lunes-Viernes)
              </h3>
              <p className="text-xs text-slate-400 mt-0.5">
                Asigna varias colonias a cada día de la semana para optimizar las rutas de cobranza.
              </p>
            </div>

            <button
              onClick={() => {
                setEditingZona({ diaCobro: 'Lunes', colonias: [] });
                setIsZonaModalOpen(true);
              }}
              className="bg-emerald-600 hover:bg-emerald-500 text-white font-bold py-2.5 px-4 rounded-xl text-xs flex items-center gap-2 cursor-pointer shadow-lg"
            >
              <Plus className="w-4 h-4" />
              Agregar Nueva Zona
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {zonas.map((zona) => (
              <div key={zona.id} className="bg-slate-900 border border-slate-700 rounded-xl p-4 space-y-3">
                <div className="flex items-center justify-between border-b border-slate-800 pb-2">
                  <h4 className="font-bold text-white text-base">{zona.nombre}</h4>
                  <span className="bg-indigo-950 text-indigo-300 border border-indigo-800 font-extrabold text-xs px-3 py-1 rounded-full">
                    Día: {zona.diaCobro}
                  </span>
                </div>

                <p className="text-xs text-slate-400">{zona.descripcion}</p>

                <div className="space-y-1.5">
                  <span className="text-xs font-bold text-slate-300 block">Colonias Asignadas:</span>
                  <div className="flex flex-wrap gap-1.5">
                    {zona.colonias.map((col, idx) => (
                      <span
                        key={idx}
                        className="bg-slate-800 text-slate-200 text-xs px-2.5 py-1 rounded-lg border border-slate-700"
                      >
                        {col}
                      </span>
                    ))}
                  </div>
                </div>

                <div className="pt-2 border-t border-slate-800 flex justify-end">
                  <button
                    onClick={() => {
                      setEditingZona(zona);
                      setIsZonaModalOpen(true);
                    }}
                    className="bg-slate-800 hover:bg-slate-700 text-indigo-300 text-xs font-bold py-1.5 px-3 rounded-lg flex items-center gap-1.5 cursor-pointer border border-slate-700"
                  >
                    <Edit2 className="w-3.5 h-3.5" />
                    Editar Zona & Colonias
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* TAB 5: NÓMINA Y COMISIONES */}
      {activeTab === 'nomina' && (
        <div className="bg-slate-800/90 border border-slate-700 rounded-2xl p-6 shadow-xl space-y-6">
          <div>
            <h3 className="text-xl font-black text-white flex items-center gap-2">
              <DollarSign className="w-6 h-6 text-emerald-400" />
              Nómina & Comisiones de Personal Campo
            </h3>
            <p className="text-xs text-slate-400 mt-0.5">
              Cálculo automático de sueldos base y comisiones acumuladas esta semana.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {usuarios.map((usr) => (
              <div key={usr.id} className="bg-slate-900 border border-slate-700 p-4 rounded-xl space-y-3">
                <div className="flex items-center justify-between border-b border-slate-800 pb-2">
                  <div>
                    <h4 className="font-bold text-white text-sm">{usr.nombre}</h4>
                    <span className="text-xs text-slate-400 uppercase font-semibold">{usr.rol}</span>
                  </div>
                  <span className="text-xs bg-emerald-950 text-emerald-300 border border-emerald-800 px-2.5 py-1 rounded-full font-bold">
                    Activo
                  </span>
                </div>

                <div className="space-y-1.5 text-xs text-slate-300">
                  <div className="flex justify-between">
                    <span>Sueldo Base Semanal:</span>
                    <strong className="text-white">$1,500 MXN</strong>
                  </div>
                  <div className="flex justify-between">
                    <span>Comisiones Estimadas:</span>
                    <strong className="text-emerald-400">$850 MXN</strong>
                  </div>
                  <div className="pt-2 border-t border-slate-800 flex justify-between font-bold text-sm text-white">
                    <span>Total a Pagar:</span>
                    <span className="text-emerald-400">$2,350 MXN</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* TAB 6: GESTIÓN DE USUARIOS, ROLES, CONTRASEÑAS Y COMISIONES */}
      {activeTab === 'usuarios' && (
        <div className="bg-slate-800/90 border border-slate-700 rounded-2xl p-6 shadow-xl space-y-6">
          <div className="flex items-center justify-between border-b border-slate-700/80 pb-4">
            <div>
              <h3 className="text-xl font-black text-white flex items-center gap-2">
                <Users className="w-6 h-6 text-indigo-400" />
                Panel de Usuarios, Roles, Contraseñas y Comisiones
              </h3>
              <p className="text-xs text-slate-400 mt-0.5">
                Administra las credenciales de acceso, rol de trabajo, sueldos base y esquema de comisiones por usuario.
              </p>
            </div>

            <button
              onClick={() => {
                setEditingUsuario({ rol: 'vendedora', sueldoBase: 1500, porcentajeComision: 5, comisionPorVenta: 100 });
                setIsUsuarioModalOpen(true);
              }}
              className="bg-emerald-600 hover:bg-emerald-500 text-white font-bold py-2.5 px-4 rounded-xl text-xs flex items-center gap-2 cursor-pointer shadow-lg"
            >
              <Plus className="w-4 h-4" />
              Nuevo Usuario
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {usuarios.map((usr) => (
              <div key={usr.id} className="bg-slate-900 border border-slate-700 p-5 rounded-2xl space-y-4 shadow-lg flex flex-col justify-between">
                <div className="space-y-3">
                  <div className="flex items-start gap-3 border-b border-slate-800 pb-3">
                    <img
                      src={usr.avatarUrl || 'https://picsum.photos/seed/user/200/200'}
                      alt={usr.nombre}
                      className="w-12 h-12 rounded-xl object-cover border border-slate-700 shrink-0"
                    />
                    <div className="min-w-0 flex-1">
                      <h4 className="font-bold text-white text-base truncate">{usr.nombre}</h4>
                      <span className="text-xs text-indigo-400 font-semibold block uppercase">Rol: {usr.rol}</span>
                      <span className="text-xs text-slate-400">Usuario: <strong className="text-slate-200">{usr.usuario}</strong></span>
                    </div>
                  </div>

                  <div className="space-y-1.5 text-xs text-slate-300 bg-slate-950 p-3 rounded-xl border border-slate-850">
                    <div className="flex justify-between items-center">
                      <span className="text-slate-400">Contraseña:</span>
                      <span className="font-mono bg-slate-900 px-2 py-0.5 rounded text-amber-300 font-bold">
                        {usr.password}
                      </span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-slate-400">PIN de Seguridad:</span>
                      <span className="font-mono bg-indigo-950/80 border border-indigo-800/80 px-2 py-0.5 rounded text-indigo-300 font-bold">
                        {usr.pin || '1234'}
                      </span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-slate-400">Sueldo Base Semanal:</span>
                      <strong className="text-white">${usr.sueldoBase || 1500} MXN</strong>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-slate-400">% Comisión Venta:</span>
                      <strong className="text-emerald-400">{usr.porcentajeComision || 5}%</strong>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-slate-400">Comisión Fija Venta:</span>
                      <strong className="text-emerald-400">${usr.comisionPorVenta || 100} MXN</strong>
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-2 mt-3">
                  <button
                    type="button"
                    onClick={() => {
                      setEditingUsuario(usr);
                      setIsUsuarioModalOpen(true);
                    }}
                    className="flex-1 bg-slate-800 hover:bg-slate-700 text-indigo-300 font-bold py-2.5 px-3 rounded-xl text-xs flex items-center justify-center gap-1.5 cursor-pointer border border-slate-700 transition"
                  >
                    <Edit2 className="w-3.5 h-3.5" /> Editar Rol, Clave & Comisiones
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setDeleteConfirmTarget({
                        type: 'usuario',
                        id: usr.id,
                        name: usr.nombre,
                        detail: usr.usuario,
                      });
                    }}
                    className="px-3.5 py-2.5 bg-red-950/80 hover:bg-red-900 text-red-300 font-bold rounded-xl text-xs flex items-center justify-center gap-1 cursor-pointer border border-red-800/60 transition"
                    title="Eliminar usuario"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* TAB 7: GESTIÓN DE CLIENTES (EDITAR EXPEDIENTES, ZONAS Y ELIMINAR CLIENTES) */}
      {activeTab === 'clientes' && (
        <div className="bg-slate-800/90 border border-slate-700 rounded-2xl p-6 shadow-xl space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-700/80 pb-4">
            <div>
              <h3 className="text-xl font-black text-white flex items-center gap-2">
                <Building2 className="w-6 h-6 text-indigo-400" />
                Gestión Integral de Expedientes de Clientes
              </h3>
              <p className="text-xs text-slate-400 mt-0.5">
                Edita información de clientes, asignación de zonas, vendedoras o elimina expedientes duplicados o erróneos.
              </p>
            </div>

            <div className="relative w-full sm:w-72">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
              <input
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="Buscar cliente, folio o calle..."
                className="w-full bg-slate-900 border border-slate-700 rounded-xl pl-9 pr-3 py-2 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {clientesFiltrados.map((cli) => {
              const ventaCli = ventas.find((v) => v.clienteId === cli.id);
              return (
                <div key={cli.id} className="bg-slate-900 border border-slate-700 p-5 rounded-2xl space-y-4 shadow-lg flex flex-col justify-between">
                  <div className="space-y-3">
                    <div className="flex items-start justify-between border-b border-slate-800 pb-3">
                      <div>
                        <span className="text-[10px] font-bold uppercase bg-indigo-950 text-indigo-300 border border-indigo-800/60 px-2 py-0.5 rounded-full">
                          Folio: {cli.folio}
                        </span>
                        <h4 className="font-bold text-white text-base mt-1.5">{cli.nombreCompleto}</h4>
                        <p className="text-xs text-slate-400 flex items-center gap-1 mt-0.5">
                          <MapPin className="w-3.5 h-3.5 text-indigo-400 shrink-0" />
                          <span>{cli.direccion}</span>
                        </p>
                      </div>

                      <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${
                        cli.estadoMorosidad === 'VERDE'
                          ? 'bg-emerald-950 text-emerald-300 border-emerald-800'
                          : cli.estadoMorosidad === 'AMARILLO'
                          ? 'bg-amber-950 text-amber-300 border-amber-800'
                          : 'bg-red-950 text-red-300 border-red-800'
                      }`}>
                        {cli.estadoMorosidad}
                      </span>
                    </div>

                    <div className="space-y-1 text-xs text-slate-300 bg-slate-950 p-3 rounded-xl border border-slate-850">
                      <div className="flex justify-between">
                        <span className="text-slate-400">Teléfono:</span>
                        <strong className="text-white">{cli.telefono}</strong>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-slate-400">Zona / Día:</span>
                        <strong className="text-indigo-300">{cli.zonaNombre}</strong>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-slate-400">Vendedora:</span>
                        <strong className="text-slate-200">{cli.vendedoraNombre || 'N/A'}</strong>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-slate-400">Saldo Actual:</span>
                        <strong className="text-emerald-400">${ventaCli?.saldoActual || 0} MXN</strong>
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 mt-3 pt-2 border-t border-slate-800">
                    <button
                      type="button"
                      onClick={() => {
                        setEditingCliente(cli);
                        setIsClienteModalOpen(true);
                      }}
                      className="flex-1 bg-slate-800 hover:bg-slate-700 text-indigo-300 font-bold py-2.5 px-3 rounded-xl text-xs flex items-center justify-center gap-1.5 cursor-pointer border border-slate-700 transition"
                    >
                      <Edit2 className="w-3.5 h-3.5" /> Editar Datos
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setDeleteConfirmTarget({
                          type: 'cliente',
                          id: cli.id,
                          name: cli.nombreCompleto,
                          detail: cli.folio,
                        });
                      }}
                      className="px-3.5 py-2.5 bg-red-950/80 hover:bg-red-900 text-red-300 font-bold rounded-xl text-xs flex items-center justify-center gap-1 cursor-pointer border border-red-800/60 transition"
                      title="Eliminar cliente"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* USUARIO EDIT/CREATE MODAL */}
      {isUsuarioModalOpen && editingUsuario && (
        <div className="fixed inset-0 bg-slate-950/80 z-50 flex items-center justify-center p-4 backdrop-blur-sm">
          <form
            onSubmit={handleSaveUsuarioSubmit}
            className="bg-slate-900 border border-slate-700 w-full max-w-lg rounded-2xl p-6 shadow-2xl space-y-4"
          >
            <div className="flex justify-between items-center border-b border-slate-800 pb-3">
              <h3 className="font-bold text-white text-base flex items-center gap-2">
                <Users className="w-5 h-5 text-indigo-400" />
                {editingUsuario.id ? 'Editar Usuario & Configuración' : 'Registrar Nuevo Usuario'}
              </h3>
              <button
                type="button"
                onClick={() => setIsUsuarioModalOpen(false)}
                className="p-1 bg-slate-800 text-slate-300 rounded-lg cursor-pointer"
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
                  value={editingUsuario.nombre || ''}
                  onChange={(e) => setEditingUsuario({ ...editingUsuario, nombre: e.target.value })}
                  className="w-full bg-slate-950 border border-slate-700 rounded-xl p-2.5 text-white"
                />
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="block text-slate-300 font-semibold mb-1">Usuario (Login) *</label>
                  <input
                    type="text"
                    required
                    value={editingUsuario.usuario || ''}
                    onChange={(e) => setEditingUsuario({ ...editingUsuario, usuario: e.target.value })}
                    className="w-full bg-slate-950 border border-slate-700 rounded-xl p-2.5 text-white"
                  />
                </div>

                <div>
                  <label className="block text-slate-300 font-semibold mb-1">Contraseña *</label>
                  <input
                    type="text"
                    required
                    value={editingUsuario.password || ''}
                    onChange={(e) => setEditingUsuario({ ...editingUsuario, password: e.target.value })}
                    className="w-full bg-slate-950 border border-slate-700 rounded-xl p-2.5 text-white font-mono"
                  />
                </div>

                <div>
                  <label className="block text-slate-300 font-semibold mb-1">PIN Seguridad (4 dígitos) *</label>
                  <input
                    type="password"
                    maxLength={4}
                    required
                    value={editingUsuario.pin || '1234'}
                    onChange={(e) => setEditingUsuario({ ...editingUsuario, pin: e.target.value.replace(/\D/g, '') })}
                    className="w-full bg-slate-950 border border-slate-700 rounded-xl p-2.5 text-white font-mono text-center tracking-widest"
                  />
                </div>
              </div>

              <div>
                <label className="block text-slate-300 font-semibold mb-1">Rol Asignado *</label>
                <select
                  value={editingUsuario.rol || 'vendedora'}
                  onChange={(e) => setEditingUsuario({ ...editingUsuario, rol: e.target.value as UserRole })}
                  className="w-full bg-slate-950 border border-slate-700 rounded-xl p-2.5 text-white font-bold"
                >
                  <option value="vendedora">Vendedora (Alta & Campo)</option>
                  <option value="sup_vendedores">Supervisora de Vendedoras</option>
                  <option value="cobrador">Cobrador (Ruta & Recibos WA)</option>
                  <option value="sup_cobradores">Supervisor de Cobradores</option>
                  <option value="admin">Administrador General</option>
                </select>
              </div>

              <div className="grid grid-cols-3 gap-2 pt-2 border-t border-slate-800">
                <div>
                  <label className="block text-slate-300 font-semibold mb-1">Sueldo Base ($)</label>
                  <input
                    type="number"
                    value={editingUsuario.sueldoBase || 1500}
                    onChange={(e) => setEditingUsuario({ ...editingUsuario, sueldoBase: Number(e.target.value) })}
                    className="w-full bg-slate-950 border border-slate-700 rounded-xl p-2.5 text-white"
                  />
                </div>

                <div>
                  <label className="block text-slate-300 font-semibold mb-1">% Comisión</label>
                  <input
                    type="number"
                    value={editingUsuario.porcentajeComision || 5}
                    onChange={(e) => setEditingUsuario({ ...editingUsuario, porcentajeComision: Number(e.target.value) })}
                    className="w-full bg-slate-950 border border-slate-700 rounded-xl p-2.5 text-white"
                  />
                </div>

                <div>
                  <label className="block text-slate-300 font-semibold mb-1">Comisión Venta ($)</label>
                  <input
                    type="number"
                    value={editingUsuario.comisionPorVenta || 100}
                    onChange={(e) => setEditingUsuario({ ...editingUsuario, comisionPorVenta: Number(e.target.value) })}
                    className="w-full bg-slate-950 border border-slate-700 rounded-xl p-2.5 text-white"
                  />
                </div>
              </div>
            </div>

            <button
              type="submit"
              className="w-full bg-indigo-600 hover:bg-indigo-500 text-white font-bold py-3 rounded-xl text-xs cursor-pointer shadow-lg"
            >
              Guardar Configuración de Usuario
            </button>
          </form>
        </div>
      )}
      {isProductModalOpen && editingProducto && (
        <div className="fixed inset-0 bg-slate-950/80 z-50 flex items-center justify-center p-3 sm:p-4 backdrop-blur-sm overflow-y-auto">
          <form
            onSubmit={handleSaveProductSubmit}
            className="bg-slate-900 border border-slate-700 w-full max-w-lg rounded-2xl p-4 sm:p-6 shadow-2xl space-y-4 max-h-[85vh] overflow-y-auto my-auto"
          >
            <div className="flex justify-between items-center border-b border-slate-800 pb-3">
              <h3 className="font-bold text-white text-base">
                {editingProducto.id ? 'Editar Producto' : 'Agregar Nuevo Producto'}
              </h3>
              <button
                type="button"
                onClick={() => setIsProductModalOpen(false)}
                className="p-1 bg-slate-800 text-slate-300 rounded-lg"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-3 text-xs">
              <div>
                <label className="block text-slate-300 font-semibold mb-1">Nombre del Producto *</label>
                <input
                  type="text"
                  required
                  value={editingProducto.nombre || ''}
                  onChange={(e) => setEditingProducto({ ...editingProducto, nombre: e.target.value })}
                  className="w-full bg-slate-950 border border-slate-700 rounded-xl p-2.5 text-white"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-300 font-semibold mb-1">Precio Base ($) *</label>
                  <input
                    type="number"
                    required
                    value={editingProducto.precioBase || ''}
                    onChange={(e) => setEditingProducto({ ...editingProducto, precioBase: Number(e.target.value) })}
                    className="w-full bg-slate-950 border border-slate-700 rounded-xl p-2.5 text-white"
                  />
                </div>

                <div>
                  <label className="block text-slate-300 font-semibold mb-1">Enganche Mínimo ($)</label>
                  <input
                    type="number"
                    value={editingProducto.engancheMinimo || 100}
                    onChange={(e) => setEditingProducto({ ...editingProducto, engancheMinimo: Number(e.target.value) })}
                    className="w-full bg-slate-950 border border-slate-700 rounded-xl p-2.5 text-white"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-amber-300 font-semibold mb-1">Descuento Empresa (Enganche) ($)</label>
                  <input
                    type="number"
                    value={editingProducto.descuentoEmpresa || 0}
                    onChange={(e) => setEditingProducto({ ...editingProducto, descuentoEmpresa: Number(e.target.value) })}
                    className="w-full bg-slate-950 border border-amber-800/80 rounded-xl p-2.5 text-amber-200"
                    placeholder="Ej. 100"
                  />
                  <p className="text-[10px] text-slate-400 mt-1">Apoyo que otorga la empresa directo al enganche.</p>
                </div>

                <div>
                  <label className="block text-slate-300 font-semibold mb-1">Pago Semanal Sugerido ($)</label>
                  <input
                    type="number"
                    value={editingProducto.pagoSemanalSugerido || 100}
                    onChange={(e) => setEditingProducto({ ...editingProducto, pagoSemanalSugerido: Number(e.target.value) })}
                    className="w-full bg-slate-950 border border-slate-700 rounded-xl p-2.5 text-white"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-emerald-300 font-extrabold mb-1">Stock Disponible (Unidades) *</label>
                  <input
                    type="number"
                    min="0"
                    required
                    value={editingProducto.stock ?? 10}
                    onChange={(e) => setEditingProducto({ ...editingProducto, stock: Math.max(0, parseInt(e.target.value) || 0) })}
                    className="w-full bg-slate-950 border border-emerald-500/80 rounded-xl p-2.5 text-emerald-200 font-black text-sm"
                    placeholder="Ej. 30"
                  />
                </div>

                <div>
                  <label className="block text-amber-300 font-extrabold mb-1">Stock Mínimo (Alerta Resurtido) *</label>
                  <input
                    type="number"
                    min="1"
                    required
                    value={editingProducto.stockMinimo ?? 5}
                    onChange={(e) => setEditingProducto({ ...editingProducto, stockMinimo: Math.max(1, parseInt(e.target.value) || 1) })}
                    className="w-full bg-slate-950 border border-amber-500/80 rounded-xl p-2.5 text-amber-200 font-black text-sm"
                    placeholder="Ej. 5"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-300 font-semibold mb-1">Fecha de Compra / Lote</label>
                  <input
                    type="date"
                    value={editingProducto.fechaCompra || ''}
                    onChange={(e) => setEditingProducto({ ...editingProducto, fechaCompra: e.target.value })}
                    className="w-full bg-slate-950 border border-slate-700 rounded-xl p-2.5 text-white font-mono text-xs"
                  />
                </div>

                <div>
                  <label className="block text-slate-300 font-semibold mb-1">Proveedor / Distribuidor</label>
                  <input
                    type="text"
                    value={editingProducto.proveedor || ''}
                    onChange={(e) => setEditingProducto({ ...editingProducto, proveedor: e.target.value })}
                    placeholder="ej. Distribuidora Mueblera S.A."
                    className="w-full bg-slate-950 border border-slate-700 rounded-xl p-2.5 text-white text-xs"
                  />
                </div>
              </div>
              <p className="text-[10px] text-slate-400">Si el stock disponible llega a ser menor o igual al stock mínimo, el sistema generará una alerta automática de resurtido.</p>

              <div>
                <label className="block text-slate-300 font-semibold mb-1">Fotografía del Producto (Galería / Archivo)</label>
                <div className="flex items-center gap-3 bg-slate-950 p-3 rounded-xl border border-slate-700">
                  {editingProducto.fotoUrl ? (
                    <img
                      src={editingProducto.fotoUrl}
                      alt="Vista previa"
                      className="w-16 h-16 object-cover rounded-lg border border-slate-700 shrink-0 bg-slate-900"
                    />
                  ) : (
                    <div className="w-16 h-16 rounded-lg bg-slate-900 border border-slate-800 flex items-center justify-center text-slate-500 shrink-0">
                      <Camera className="w-6 h-6" />
                    </div>
                  )}

                  <div className="flex-1 space-y-2">
                    <div className="flex items-center gap-2 flex-wrap">
                      <label className="inline-flex items-center gap-2 px-3 py-2 bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs rounded-xl cursor-pointer transition shadow border border-indigo-400/30">
                        <Upload className="w-4 h-4" />
                        <span>Subir Foto de Galería</span>
                        <input
                          type="file"
                          accept="image/*"
                          className="hidden"
                          onChange={handleProductImageUpload}
                        />
                      </label>

                      {editingProducto.fotoUrl && (
                        <button
                          type="button"
                          onClick={() => setEditingProducto({ ...editingProducto, fotoUrl: '' })}
                          className="px-2.5 py-2 bg-red-950/80 hover:bg-red-900 text-red-300 text-xs font-bold rounded-xl border border-red-800/60 cursor-pointer transition"
                        >
                          Quitar Foto
                        </button>
                      )}
                    </div>

                    <p className="text-[10px] text-slate-400">
                      Selecciona una imagen JPG, PNG o toma una foto directamente desde tu teléfono o PC.
                    </p>
                  </div>
                </div>
              </div>

              <div>
                <label className="block text-slate-300 font-semibold mb-1">Descripción</label>
                <textarea
                  value={editingProducto.descripcion || ''}
                  onChange={(e) => setEditingProducto({ ...editingProducto, descripcion: e.target.value })}
                  className="w-full bg-slate-950 border border-slate-700 rounded-xl p-2.5 text-white h-20"
                />
              </div>
            </div>

            <button
              type="submit"
              className="w-full bg-emerald-600 hover:bg-emerald-500 text-white font-bold py-3 rounded-xl text-xs cursor-pointer shadow-lg"
            >
              Guardar Producto
            </button>
          </form>
        </div>
      )}

      {/* ZONA EDIT/CREATE MODAL */}
      {isZonaModalOpen && editingZona && (
        <div className="fixed inset-0 bg-slate-950/80 z-50 flex items-center justify-center p-4 backdrop-blur-sm">
          <form
            onSubmit={handleSaveZonaSubmit}
            className="bg-slate-900 border border-slate-700 w-full max-w-lg rounded-2xl p-6 shadow-2xl space-y-4"
          >
            <div className="flex justify-between items-center border-b border-slate-800 pb-3">
              <h3 className="font-bold text-white text-base">
                {editingZona.id ? 'Editar Zona & Colonias' : 'Agregar Nueva Zona'}
              </h3>
              <button
                type="button"
                onClick={() => setIsZonaModalOpen(false)}
                className="p-1 bg-slate-800 text-slate-300 rounded-lg"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-3 text-xs">
              <div>
                <label className="block text-slate-300 font-semibold mb-1">Nombre de la Zona *</label>
                <input
                  type="text"
                  required
                  value={editingZona.nombre || ''}
                  onChange={(e) => setEditingZona({ ...editingZona, nombre: e.target.value })}
                  className="w-full bg-slate-950 border border-slate-700 rounded-xl p-2.5 text-white"
                />
              </div>

              <div>
                <label className="block text-slate-300 font-semibold mb-1">Día de Cobro Asignado *</label>
                <select
                  value={editingZona.diaCobro || 'Lunes'}
                  onChange={(e) => setEditingZona({ ...editingZona, diaCobro: e.target.value as DiaSemana })}
                  className="w-full bg-slate-950 border border-slate-700 rounded-xl p-2.5 text-white"
                >
                  {['Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes'].map((dia) => (
                    <option key={dia} value={dia}>
                      {dia}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-slate-300 font-semibold mb-1">Agregar Colonias a la Zona:</label>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={newColoniaInput}
                    onChange={(e) => setNewColoniaInput(e.target.value)}
                    placeholder="ej. Col. San Miguel"
                    className="flex-1 bg-slate-950 border border-slate-700 rounded-xl p-2 text-white"
                  />
                  <button
                    type="button"
                    onClick={addColoniaToZona}
                    className="bg-indigo-600 hover:bg-indigo-500 text-white font-bold px-3 py-2 rounded-xl"
                  >
                    Agregar
                  </button>
                </div>

                <div className="flex flex-wrap gap-1.5 mt-2">
                  {(editingZona.colonias || []).map((col, idx) => (
                    <span
                      key={idx}
                      className="bg-slate-800 text-slate-200 text-xs px-2.5 py-1 rounded-lg border border-slate-700 flex items-center gap-1.5"
                    >
                      {col}
                      <button
                        type="button"
                        onClick={() => removeColoniaFromZona(idx)}
                        className="text-red-400 hover:text-red-300"
                      >
                        ×
                      </button>
                    </span>
                  ))}
                </div>
              </div>
            </div>

            <button
              type="submit"
              className="w-full bg-emerald-600 hover:bg-emerald-500 text-white font-bold py-3 rounded-xl text-xs cursor-pointer shadow-lg"
            >
              Guardar Configuración de Zona
            </button>
          </form>
        </div>
      )}

      {/* CLIENT EDIT MODAL IN ADMIN VIEW */}
      {isClienteModalOpen && editingCliente && (
        <div className="fixed inset-0 bg-slate-950/80 z-50 flex items-center justify-center p-4 backdrop-blur-sm">
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
                  setIsClienteModalOpen(false);
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

              <div>
                <label className="block text-slate-300 font-semibold mb-1">Entre Calles (Ubicación para Cobrador)</label>
                <input
                  type="text"
                  value={editingCliente.entreCalles || ''}
                  onChange={(e) => setEditingCliente({ ...editingCliente, entreCalles: e.target.value })}
                  placeholder="ej. Entre Calle Allende y Calle Morelos"
                  className="w-full bg-slate-950 border border-slate-700 rounded-xl p-2.5 text-white"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-300 font-semibold mb-1">Colonia * (Auto-detecta Zona)</label>
                  <select
                    value={editingCliente.colonia || ''}
                    onChange={(e) => {
                      const colName = e.target.value;
                      const matchedZ = zonas.find((z) =>
                        z.colonias.some((c) => c.toLowerCase() === colName.toLowerCase())
                      );
                      setEditingCliente({
                        ...editingCliente,
                        colonia: colName,
                        zonaId: matchedZ ? matchedZ.id : editingCliente.zonaId,
                        zonaNombre: matchedZ ? matchedZ.nombre : editingCliente.zonaNombre,
                      });
                    }}
                    className="w-full bg-slate-950 border border-slate-700 rounded-xl p-2.5 text-white font-bold"
                  >
                    <option value="">-- Selecciona Colonia --</option>
                    {zonas.flatMap((z) => z.colonias).map((col, idx) => (
                      <option key={`${col}-${idx}`} value={col}>
                        Col. {col}
                      </option>
                    ))}
                  </select>
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

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-300 font-semibold mb-1">Vendedora Asignada</label>
                  <input
                    type="text"
                    value={editingCliente.vendedoraNombre || ''}
                    onChange={(e) => setEditingCliente({ ...editingCliente, vendedoraNombre: e.target.value })}
                    className="w-full bg-slate-950 border border-slate-700 rounded-xl p-2.5 text-white"
                  />
                </div>

                <div>
                  <label className="block text-slate-300 font-semibold mb-1">Tarjeta Física Impresa</label>
                  <select
                    value={editingCliente.tarjetaImpresa ? 'SI' : 'NO'}
                    onChange={(e) => setEditingCliente({ ...editingCliente, tarjetaImpresa: e.target.value === 'SI' })}
                    className="w-full bg-slate-950 border border-slate-700 rounded-xl p-2.5 text-white font-bold"
                  >
                    <option value="SI">Sí (Impresa)</option>
                    <option value="NO">No (Pendiente)</option>
                  </select>
                </div>
              </div>

              {/* GESTIÓN DE FOTOGRAFÍAS (CLIENTE, FACHADA, CONTRATO) */}
              <div className="bg-slate-950 p-3 rounded-xl border border-slate-800 space-y-2.5">
                <span className="block font-bold text-indigo-300 text-xs flex items-center gap-1.5">
                  <Camera className="w-4 h-4 text-indigo-400" />
                  Fotografías del Expediente (Edición / Eliminación Directa)
                </span>

                <div className="grid grid-cols-3 gap-2">
                  {[
                    { key: 'fotoCliente', label: 'Rostro Cliente' },
                    { key: 'fotoFachada', label: 'Fachada' },
                    { key: 'fotoContrato', label: 'Pagaré / Contrato' },
                  ].map(({ key, label }) => {
                    const photoUrl = (editingCliente as any)[key];
                    return (
                      <div key={key} className="bg-slate-900 p-2 rounded-lg border border-slate-800 text-center space-y-1.5">
                        <span className="block text-[10px] text-slate-400 font-bold truncate">{label}</span>
                        {photoUrl ? (
                          <div className="relative group rounded-lg overflow-hidden border border-slate-700 h-20 bg-slate-950">
                            {/* eslint-disable-next-line @next/next/no-img-element */}
                            <img src={photoUrl} alt={label} className="w-full h-full object-cover" />
                            <button
                              type="button"
                              onClick={() => {
                                setEditingCliente({ ...editingCliente, [key]: '' });
                              }}
                              className="absolute inset-0 bg-red-950/80 text-red-200 font-bold text-[10px] flex items-center justify-center opacity-0 group-hover:opacity-100 transition cursor-pointer"
                            >
                              🗑️ Eliminar
                            </button>
                          </div>
                        ) : (
                          <div className="h-20 bg-slate-950 border border-dashed border-slate-700 rounded-lg flex flex-col items-center justify-center p-1 text-[9px] text-slate-500">
                            <span>Sin foto</span>
                          </div>
                        )}
                        <label className="block text-[10px] bg-indigo-950 hover:bg-indigo-900 text-indigo-300 border border-indigo-800 rounded py-1 px-1.5 cursor-pointer font-bold">
                          Subir / Cambiar
                          <input
                            type="file"
                            accept="image/*"
                            className="hidden"
                            onChange={(e) => {
                              const file = e.target.files?.[0];
                              if (file) {
                                const reader = new FileReader();
                                reader.onload = (evt) => {
                                  if (evt.target?.result) {
                                    setEditingCliente({
                                      ...editingCliente,
                                      [key]: evt.target.result as string,
                                    });
                                  }
                                };
                                reader.readAsDataURL(file);
                              }
                            }}
                          />
                        </label>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* GESTIÓN DE CONTRATO Y VALORES FINANCIEROS */}
              {(() => {
                const activeVenta = ventas.find((v) => v.clienteId === editingCliente.id);
                if (!activeVenta) return null;
                return (
                  <div className="bg-slate-950 p-3 rounded-xl border border-slate-800 space-y-2">
                    <div className="flex items-center justify-between border-b border-slate-800 pb-1.5">
                      <span className="font-bold text-emerald-400 text-xs flex items-center gap-1.5">
                        <DollarSign className="w-4 h-4 text-emerald-400" />
                        Contrato Activo #{activeVenta.id} - Saldo & Cuotas
                      </span>
                      {onDeleteVenta && (
                        <button
                          type="button"
                          onClick={() => {
                            if (window.confirm(`¿Eliminar contrato #${activeVenta.id}?`)) {
                              onDeleteVenta(activeVenta.id);
                            }
                          }}
                          className="text-[10px] bg-red-950 text-red-300 border border-red-800 px-2 py-0.5 rounded font-bold hover:bg-red-900 cursor-pointer"
                        >
                          🗑️ Eliminar Venta
                        </button>
                      )}
                    </div>

                    <div className="grid grid-cols-3 gap-2 text-xs">
                      <div>
                        <label className="block text-slate-400 text-[10px]">Precio Base ($)</label>
                        <input
                          type="number"
                          value={activeVenta.precioBase || 0}
                          onChange={(e) => {
                            const val = Number(e.target.value);
                            if (onUpdateVenta) onUpdateVenta({ ...activeVenta, precioBase: val });
                          }}
                          className="w-full bg-slate-900 border border-slate-700 rounded-lg p-1.5 text-white font-mono text-xs"
                        />
                      </div>
                      <div>
                        <label className="block text-slate-400 text-[10px]">Saldo Actual ($)</label>
                        <input
                          type="number"
                          value={activeVenta.saldoActual || 0}
                          onChange={(e) => {
                            const val = Number(e.target.value);
                            if (onUpdateVenta) onUpdateVenta({ ...activeVenta, saldoActual: val });
                          }}
                          className="w-full bg-slate-900 border border-emerald-700/80 rounded-lg p-1.5 text-emerald-300 font-mono text-xs font-bold"
                        />
                      </div>
                      <div>
                        <label className="block text-slate-400 text-[10px]">Pago Semanal ($)</label>
                        <input
                          type="number"
                          value={activeVenta.pagoSemanal || 0}
                          onChange={(e) => {
                            const val = Number(e.target.value);
                            if (onUpdateVenta) onUpdateVenta({ ...activeVenta, pagoSemanal: val });
                          }}
                          className="w-full bg-slate-900 border border-slate-700 rounded-lg p-1.5 text-white font-mono text-xs"
                        />
                      </div>
                    </div>
                  </div>
                );
              })()}
            </div>

            <button
              type="submit"
              className="w-full bg-indigo-600 hover:bg-indigo-500 text-white font-bold py-3 rounded-xl text-xs cursor-pointer shadow-lg transition mt-3"
            >
              Guardar Cambios de Cliente & Sincronizar
            </button>
          </form>
        </div>
      )}

      {/* TAB: GESTIÓN DE RUTAS Y SECUENCIA ÓPTIMA DE CALLES */}
      {activeTab === 'rutas' && (
        <GestionRutasView
          clientes={clientes}
          zonas={zonas}
          ventas={ventas}
          abonos={abonos}
          onUpdateCliente={onUpdateCliente}
          onSaveZona={onSaveZona}
        />
      )}

      {/* TAB 7: LOG DE AUDITORÍA Y SEGURIDAD */}
      {activeTab === 'auditoria' && (
        <AuditLogView logs={auditLogs} />
      )}

      {/* TAB 9: CONFIGURACIÓN DE UMBRALES DE CAPTACIÓN DE EFECTIVO Y ROLES DE NOTIFICACIONES PUSH */}
      {activeTab === 'alertas' && (
        <div className="bg-slate-900/90 border border-indigo-500/40 rounded-3xl p-6 shadow-2xl space-y-6">
          {/* Header Banner */}
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-800 pb-5">
            <div>
              <div className="flex items-center gap-2 text-indigo-400 font-mono text-xs font-bold uppercase tracking-wider mb-1">
                <Bell className="w-4 h-4 text-indigo-400 animate-bounce" />
                <span>Módulo de Control de Riesgo & Comunicaciones Push</span>
              </div>
              <h3 className="text-xl sm:text-2xl font-black text-white flex items-center gap-2">
                <span>Alertas de Captación de Efectivo & Permisos Push por Rol</span>
              </h3>
              <p className="text-xs text-slate-300 mt-1 max-w-2xl">
                Configura los montos límite de efectivo acumulado en campo antes de emitir alertas preventivas a la Supervisora y Administrador, y define qué roles del equipo reciben notificaciones Push en tiempo real para Ventas, Cobros y Cortes.
              </p>
            </div>

            <div className="flex items-center gap-2.5 shrink-0">
              {isAlertsSavedNotice && (
                <span className="text-xs bg-emerald-500/20 text-emerald-300 border border-emerald-500/50 px-3 py-1.5 rounded-xl font-bold animate-pulse flex items-center gap-1">
                  <CheckCircle2 className="w-4 h-4 text-emerald-400" /> ¡Guardado!
                </span>
              )}
              <button
                type="button"
                onClick={() => handleSaveAlertsConfig()}
                className="px-5 py-2.5 bg-gradient-to-r from-emerald-600 to-indigo-600 hover:from-emerald-500 hover:to-indigo-500 text-white rounded-xl font-black text-xs flex items-center gap-2 cursor-pointer shadow-lg shadow-emerald-600/20 active:scale-95 transition"
              >
                <Save className="w-4 h-4" />
                <span>Guardar Configuración</span>
              </button>
            </div>
          </div>

          {/* SECCIÓN 1: UMBRALES DE CAPTACIÓN DE EFECTIVO */}
          <div className="bg-slate-950 p-5 rounded-2xl border border-slate-800 space-y-5">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-850 pb-3">
              <div className="flex items-center gap-2.5">
                <div className="p-2.5 bg-emerald-950 border border-emerald-800 rounded-xl">
                  <DollarSign className="w-5 h-5 text-emerald-400" />
                </div>
                <div>
                  <h4 className="font-extrabold text-white text-base">
                    1. Umbrales de Alerta para Captación de Efectivo en Ruta
                  </h4>
                  <p className="text-xs text-slate-400">
                    Controla el volumen de dinero en efectivo en manos de los cobradores antes de solicitar un arqueo o depósito.
                  </p>
                </div>
              </div>

              {/* Master Toggle */}
              <button
                type="button"
                onClick={() => setActivarAlertasEfectivo(!activarAlertasEfectivo)}
                className={`px-4 py-2 rounded-xl border text-xs font-bold flex items-center gap-2 cursor-pointer transition ${
                  activarAlertasEfectivo
                    ? 'bg-emerald-950 text-emerald-300 border-emerald-700 hover:bg-emerald-900'
                    : 'bg-slate-900 text-slate-400 border-slate-700 hover:bg-slate-800'
                }`}
              >
                <span className={`w-3 h-3 rounded-full ${activarAlertasEfectivo ? 'bg-emerald-400 animate-ping' : 'bg-slate-500'}`} />
                <span>{activarAlertasEfectivo ? 'Alertas Activas en Campo' : 'Alertas Desactivadas'}</span>
              </button>
            </div>

            {/* Threshold Cards */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Card 1: Umbral de Advertencia Preventiva */}
              <div className="bg-slate-900 p-4 rounded-xl border border-amber-500/40 space-y-3 relative overflow-hidden">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-black text-amber-300 uppercase tracking-wider flex items-center gap-1.5">
                    <AlertTriangle className="w-4 h-4 text-amber-400" />
                    Umbral Preventivo (Amarillo)
                  </span>
                  <span className="text-[10px] bg-amber-950 text-amber-300 border border-amber-800 px-2 py-0.5 rounded-full font-bold">
                    Alerta Inicial
                  </span>
                </div>

                <div>
                  <label className="block text-xs text-slate-300 mb-1">Monto Límite en Efectivo ($ MXN):</label>
                  <div className="flex items-center gap-2">
                    <span className="text-lg font-black text-amber-400">$</span>
                    <input
                      type="number"
                      step="500"
                      min="1000"
                      max="50000"
                      value={umbralAdvertencia}
                      onChange={(e) => setUmbralAdvertencia(Number(e.target.value))}
                      className="w-full bg-slate-950 border border-amber-500/60 rounded-xl p-2 text-amber-300 font-extrabold text-lg focus:outline-none focus:border-amber-400"
                    />
                  </div>
                </div>

                {/* Preset Buttons */}
                <div className="flex flex-wrap gap-1.5 pt-1">
                  {[3000, 5000, 7500, 10000].map((val) => (
                    <button
                      key={val}
                      type="button"
                      onClick={() => setUmbralAdvertencia(val)}
                      className={`text-[10px] px-2.5 py-1 rounded-lg border font-bold cursor-pointer transition ${
                        umbralAdvertencia === val
                          ? 'bg-amber-500 text-slate-950 border-amber-400 font-black'
                          : 'bg-slate-950 text-slate-300 border-slate-800 hover:border-amber-500'
                      }`}
                    >
                      ${val.toLocaleString()} MXN
                    </button>
                  ))}
                </div>

                <p className="text-[11px] text-slate-400 leading-relaxed pt-1">
                  Emitirá una notificación preventiva a la Supervisora e indicará al cobrador que se aproxima al límite de seguridad diario.
                </p>
              </div>

              {/* Card 2: Umbral Crítico / Arqueo Obligatorio */}
              <div className="bg-slate-900 p-4 rounded-xl border border-rose-500/40 space-y-3 relative overflow-hidden">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-black text-rose-300 uppercase tracking-wider flex items-center gap-1.5">
                    <ShieldAlert className="w-4 h-4 text-rose-400" />
                    Umbral Crítico de Arqueo (Rojo)
                  </span>
                  <span className="text-[10px] bg-rose-950 text-rose-300 border border-rose-800 px-2 py-0.5 rounded-full font-bold">
                    Alerta Máxima
                  </span>
                </div>

                <div>
                  <label className="block text-xs text-slate-300 mb-1">Monto Máximo de Riesgo ($ MXN):</label>
                  <div className="flex items-center gap-2">
                    <span className="text-lg font-black text-rose-400">$</span>
                    <input
                      type="number"
                      step="1000"
                      min="2000"
                      max="100000"
                      value={umbralCritico}
                      onChange={(e) => setUmbralCritico(Number(e.target.value))}
                      className="w-full bg-slate-950 border border-rose-500/60 rounded-xl p-2 text-rose-300 font-extrabold text-lg focus:outline-none focus:border-rose-400"
                    />
                  </div>
                </div>

                {/* Preset Buttons */}
                <div className="flex flex-wrap gap-1.5 pt-1">
                  {[8000, 10000, 15000, 20000].map((val) => (
                    <button
                      key={val}
                      type="button"
                      onClick={() => setUmbralCritico(val)}
                      className={`text-[10px] px-2.5 py-1 rounded-lg border font-bold cursor-pointer transition ${
                        umbralCritico === val
                          ? 'bg-rose-500 text-white border-rose-400 font-black'
                          : 'bg-slate-950 text-slate-300 border-slate-800 hover:border-rose-500'
                      }`}
                    >
                      ${val.toLocaleString()} MXN
                    </button>
                  ))}
                </div>

                <p className="text-[11px] text-slate-400 leading-relaxed pt-1">
                  Alcanzado este monto, se notifica urgentemente al Administrador General y Supervisora para coordinar la entrega o depósito del efectivo.
                </p>
              </div>
            </div>

            {/* Additional Threshold Settings: Frecuencia & Mensaje */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2">
              <div>
                <label className="block text-xs text-slate-300 font-bold mb-1.5">
                  ⚡ Frecuencia de Notificaciones de Alerta:
                </label>
                <div className="space-y-2">
                  {[
                    { id: 'inmediata', label: 'Inmediata al superar el umbral en vivo', desc: 'Sincronización al segundo de registrar el cobro.' },
                    { id: 'acumulada_1000', label: 'Acumulada por cada $1,000 excedentes', desc: 'Recordatorios continuos mientras no entregue el dinero.' },
                    { id: 'por_corte', label: 'Resumen consolidado en Corte de Caja', desc: 'Al enviar el arqueo final de la jornada.' },
                  ].map((frec) => (
                    <label
                      key={frec.id}
                      className={`flex items-start gap-2.5 p-2.5 rounded-xl border cursor-pointer transition text-xs ${
                        frecuenciaAlertas === frec.id
                          ? 'bg-indigo-950/80 border-indigo-500 text-white'
                          : 'bg-slate-900 border-slate-800 text-slate-400 hover:bg-slate-850'
                      }`}
                    >
                      <input
                        type="radio"
                        name="frecuenciaAlertas"
                        checked={frecuenciaAlertas === frec.id}
                        onChange={() => setFrecuenciaAlertas(frec.id as any)}
                        className="mt-0.5 text-indigo-500"
                      />
                      <div>
                        <strong className="block text-slate-200">{frec.label}</strong>
                        <span className="text-[10px] text-slate-400">{frec.desc}</span>
                      </div>
                    </label>
                  ))}
                </div>
              </div>

              <div>
                <label className="block text-xs text-slate-300 font-bold mb-1.5">
                  💬 Mensaje Personalizado de Advertencia al Dispositivo:
                </label>
                <textarea
                  rows={4}
                  value={mensajeAlertaEfectivo}
                  onChange={(e) => setMensajeAlertaEfectivo(e.target.value)}
                  className="w-full bg-slate-900 border border-slate-700 rounded-xl p-3 text-white text-xs leading-relaxed focus:outline-none focus:border-indigo-500"
                  placeholder="Escribe el texto de aviso que aparecerá en el celular del cobrador..."
                />

                {/* Simulated Push Preview */}
                <div className="mt-3 bg-gradient-to-r from-amber-950/90 via-slate-900 to-slate-950 p-3 rounded-xl border border-amber-500/50 flex items-start gap-3">
                  <Smartphone className="w-5 h-5 text-amber-400 shrink-0 mt-0.5 animate-pulse" />
                  <div className="min-w-0 text-xs">
                    <span className="text-[10px] font-mono text-amber-400 uppercase font-extrabold block">
                      VISTA PREVIA PUSH (MÓVIL) • BITALIS ALERTS
                    </span>
                    <strong className="text-white block mt-0.5">🚨 Captación Excesiva: ${umbralAdvertencia.toLocaleString()} MXN Almacenados</strong>
                    <p className="text-[11px] text-slate-300 line-clamp-2 mt-0.5">{mensajeAlertaEfectivo}</p>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* SECCIÓN 2: MATRIZ DE ASIGNACIÓN DE NOTIFICACIONES PUSH POR ROL */}
          <div className="bg-slate-950 p-5 rounded-2xl border border-slate-800 space-y-4">
            <div className="flex items-center gap-2.5 border-b border-slate-850 pb-3">
              <div className="p-2.5 bg-indigo-950 border border-indigo-800 rounded-xl">
                <Smartphone className="w-5 h-5 text-indigo-400" />
              </div>
              <div>
                <h4 className="font-extrabold text-white text-base">
                  2. Asignación de Notificaciones Push por Rol
                </h4>
                <p className="text-xs text-slate-400">
                  Define qué usuarios de la estructura organizativa de BITALIS reciben alertas Push instantáneas en su app móvil para cada tipo de evento.
                </p>
              </div>
            </div>

            {/* Matrix Table */}
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="bg-slate-900 border-b border-slate-800 text-slate-300 font-extrabold uppercase text-[11px]">
                    <th className="p-3.5 rounded-tl-xl">Tipo de Evento Notificado</th>
                    <th className="p-3.5 text-center">👑 Admin General</th>
                    <th className="p-3.5 text-center">🛡️ Supervisora</th>
                    <th className="p-3.5 text-center">🛍️ Vendedora</th>
                    <th className="p-3.5 text-center rounded-tr-xl">🛵 Cobrador</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-850">
                  {[
                    {
                      id: 'venta',
                      title: '🛒 Nuevas Ventas / Contratos Emitidos',
                      desc: 'Notifica el alta de un contrato a crédito o contado en el sistema.',
                    },
                    {
                      id: 'cobro',
                      title: '💵 Cobro / Abono Recibido en Campo',
                      desc: 'Notifica cuando se registra un pago en tarjeta o efectivo.',
                    },
                    {
                      id: 'corte',
                      title: '📋 Cortes de Caja & Arqueos Semanales',
                      desc: 'Notifica la liquidación diaria o solicitud de viáticos.',
                    },
                    {
                      id: 'efectivo_exceso',
                      title: '🚨 Exceso de Captación de Efectivo',
                      desc: 'Notifica al sobrepasar el umbral de efectivo establecido.',
                    },
                  ].map((evt) => {
                    const eventKey = evt.id as 'venta' | 'cobro' | 'corte' | 'efectivo_exceso';
                    return (
                      <tr key={evt.id} className="hover:bg-slate-900/50 transition">
                        <td className="p-3.5">
                          <strong className="text-white font-extrabold block text-sm">{evt.title}</strong>
                          <span className="text-[11px] text-slate-400">{evt.desc}</span>
                        </td>

                        {(['administrador', 'supervisora', 'vendedora', 'cobrador'] as const).map((roleKey) => {
                          const isActive = pushRolesConfig[eventKey][roleKey];
                          return (
                            <td key={roleKey} className="p-3.5 text-center">
                              <button
                                type="button"
                                onClick={() => handleTogglePushRole(eventKey, roleKey)}
                                className={`px-3 py-2 rounded-xl border text-xs font-bold inline-flex items-center gap-1.5 cursor-pointer transition transform active:scale-95 ${
                                  isActive
                                    ? 'bg-emerald-950 text-emerald-300 border-emerald-700 hover:bg-emerald-900 shadow'
                                    : 'bg-slate-900 text-slate-500 border-slate-800 hover:border-slate-700 hover:text-slate-300'
                                }`}
                              >
                                {isActive ? (
                                  <>
                                    <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                                    <span>Recibe</span>
                                  </>
                                ) : (
                                  <>
                                    <X className="w-4 h-4 text-slate-500 shrink-0" />
                                    <span>Inactivo</span>
                                  </>
                                )}
                              </button>
                            </td>
                          );
                        })}
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>

          {/* SECCIÓN 3: CANALES Y PREFERENCIAS ADICIONALES */}
          <div className="bg-slate-950 p-5 rounded-2xl border border-slate-800 space-y-4">
            <h4 className="font-extrabold text-white text-sm flex items-center gap-2">
              <Volume2 className="w-4 h-4 text-indigo-400" />
              <span>Canales de Salida & Preferencias del Sistema</span>
            </h4>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
              <label className={`p-3.5 rounded-xl border cursor-pointer transition flex items-center gap-3 ${
                canalPushApp ? 'bg-indigo-950/80 border-indigo-600 text-white' : 'bg-slate-900 border-slate-800 text-slate-400'
              }`}>
                <input
                  type="checkbox"
                  checked={canalPushApp}
                  onChange={(e) => setCanalPushApp(e.target.checked)}
                  className="rounded text-indigo-500"
                />
                <div>
                  <strong className="block text-slate-200">Push App Móvil / PWA</strong>
                  <span className="text-[10px] text-slate-400">Notificaciones flotantes nativas</span>
                </div>
              </label>

              <label className={`p-3.5 rounded-xl border cursor-pointer transition flex items-center gap-3 ${
                canalSonido ? 'bg-indigo-950/80 border-indigo-600 text-white' : 'bg-slate-900 border-slate-800 text-slate-400'
              }`}>
                <input
                  type="checkbox"
                  checked={canalSonido}
                  onChange={(e) => setCanalSonido(e.target.checked)}
                  className="rounded text-indigo-500"
                />
                <div>
                  <strong className="block text-slate-200">Sonido & Vibración</strong>
                  <span className="text-[10px] text-slate-400">Tono de alerta para sobreprecios y efectivo</span>
                </div>
              </label>

              <label className={`p-3.5 rounded-xl border cursor-pointer transition flex items-center gap-3 ${
                canalBannerDashboard ? 'bg-indigo-950/80 border-indigo-600 text-white' : 'bg-slate-900 border-slate-800 text-slate-400'
              }`}>
                <input
                  type="checkbox"
                  checked={canalBannerDashboard}
                  onChange={(e) => setCanalBannerDashboard(e.target.checked)}
                  className="rounded text-indigo-500"
                />
                <div>
                  <strong className="block text-slate-200">Banner en Dashboard</strong>
                  <span className="text-[10px] text-slate-400">Aviso destacado en vista Supervisora</span>
                </div>
              </label>
            </div>
          </div>

          {/* Action Footer */}
          <div className="flex flex-col sm:flex-row items-center justify-between gap-3 pt-3 border-t border-slate-800">
            <button
              type="button"
              onClick={() => {
                setUmbralAdvertencia(5000);
                setUmbralCritico(10000);
                setActivarAlertasEfectivo(true);
                setFrecuenciaAlertas('inmediata');
                setMensajeAlertaEfectivo(
                  '⚠️ ATENCIÓN: El cobrador ha superado el umbral de efectivo acumulado en campo. Se recomienda solicitar corte o arqueo de caja.'
                );
                setPushRolesConfig({
                  venta: { administrador: true, supervisora: true, vendedora: true, cobrador: false },
                  cobro: { administrador: true, supervisora: true, vendedora: false, cobrador: true },
                  corte: { administrador: true, supervisora: true, vendedora: false, cobrador: false },
                  efectivo_exceso: { administrador: true, supervisora: true, vendedora: false, cobrador: true },
                });
                alert('Valores predeterminados de BITALIS restablecidos.');
              }}
              className="text-xs text-slate-400 hover:text-slate-200 underline cursor-pointer"
            >
              Restablecer Valores Predeterminados BITALIS
            </button>

            <button
              type="button"
              onClick={() => handleSaveAlertsConfig()}
              className="px-6 py-3 bg-gradient-to-r from-emerald-600 to-indigo-600 hover:from-emerald-500 hover:to-indigo-500 text-white rounded-xl font-black text-xs flex items-center gap-2 cursor-pointer shadow-xl shadow-emerald-600/30 transition transform active:scale-95"
            >
              <Save className="w-4 h-4" />
              <span>Guardar Configuración de Umbrales & Push</span>
            </button>
          </div>
        </div>
      )}

      {/* TAB 10/11: GESTIÓN & EDICIÓN DE ABONOS Y FECHAS DE PAGO */}
      {activeTab === 'abonos' && (() => {
        const todayStr = new Date().toISOString().split('T')[0];
        const yesterday = new Date();
        yesterday.setDate(yesterday.getDate() - 1);
        const yesterdayStr = yesterday.toISOString().split('T')[0];

        const abonosFiltrados = abonos.filter((ab) => {
          const query = abonoSearchTerm.trim().toLowerCase();
          const cli = clientes.find((c) => c.id === ab.clienteId);
          const matchSearch =
            !query ||
            (ab.clienteNombre && ab.clienteNombre.toLowerCase().includes(query)) ||
            (ab.clienteFolio && ab.clienteFolio.toLowerCase().includes(query)) ||
            (ab.cobradorNombre && ab.cobradorNombre.toLowerCase().includes(query)) ||
            (cli && cli.nombreCompleto.toLowerCase().includes(query)) ||
            ab.monto.toString().includes(query) ||
            ab.fechaPago.toLowerCase().includes(query);

          if (!matchSearch) return false;

          const aDate = (ab.fechaPago || '').split('T')[0];

          if (abonoDateFilter === 'HOY') return aDate === todayStr;
          if (abonoDateFilter === 'AYER') return aDate === yesterdayStr;
          if (abonoDateFilter === 'DIA_ESPECIFICO') return aDate === abonoSpecificDate;
          if (abonoDateFilter === 'RANGO') {
            if (!abonoStartDate && !abonoEndDate) return true;
            if (abonoStartDate && !abonoEndDate) return aDate >= abonoStartDate;
            if (!abonoStartDate && abonoEndDate) return aDate <= abonoEndDate;
            return aDate >= abonoStartDate && aDate <= abonoEndDate;
          }
          if (abonoDateFilter === 'ESTA_SEMANA') {
            const now = new Date();
            const abDate = new Date(ab.fechaPago);
            const diffDays = (now.getTime() - abDate.getTime()) / (1000 * 3600 * 24);
            return diffDays >= 0 && diffDays <= 7;
          }
          if (abonoDateFilter === 'ESTE_MES') {
            const now = new Date();
            const abDate = new Date(ab.fechaPago);
            return abDate.getMonth() === now.getMonth() && abDate.getFullYear() === now.getFullYear();
          }

          return true;
        });

        const totalRecaudadoFiltrado = abonosFiltrados.reduce((sum, a) => sum + a.monto, 0);

        // Desglose por Método de Pago
        const abonosEfectivo = abonosFiltrados.filter((a) => a.tipoPago === 'EFECTIVO' || !a.tipoPago);
        const abonosTransferencia = abonosFiltrados.filter((a) => a.tipoPago === 'TRANSFERENCIA');
        const abonosOtros = abonosFiltrados.filter((a) => a.tipoPago === 'MIXTO');

        const montoEfectivo = abonosEfectivo.reduce((s, a) => s + a.monto, 0);
        const montoTransferencia = abonosTransferencia.reduce((s, a) => s + a.monto, 0);
        const montoOtros = abonosOtros.reduce((s, a) => s + a.monto, 0);

        // Desglose por Tipo de Pago (Regular vs Enganche)
        const abonosEnganche = abonosFiltrados.filter((a) => a.esEnganche);
        const abonosRegulares = abonosFiltrados.filter((a) => !a.esEnganche);

        const montoEnganches = abonosEnganche.reduce((s, a) => s + a.monto, 0);
        const montoRegulares = abonosRegulares.reduce((s, a) => s + a.monto, 0);

        // Desglose por Cobrador
        const cobradorBreakdownMap = new Map<string, { nombre: string; monto: number; count: number }>();
        abonosFiltrados.forEach((a) => {
          const cName = a.cobradorNombre || 'Cobrador Sin Nombre';
          if (!cobradorBreakdownMap.has(cName)) {
            cobradorBreakdownMap.set(cName, { nombre: cName, monto: 0, count: 0 });
          }
          const item = cobradorBreakdownMap.get(cName)!;
          item.monto += a.monto;
          item.count += 1;
        });
        const listCobradorBreakdown = Array.from(cobradorBreakdownMap.values()).sort((a, b) => b.monto - a.monto);

        return (
          <div className="bg-slate-800/90 border border-slate-700 rounded-2xl p-6 shadow-xl space-y-6">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-700/80 pb-4">
              <div>
                <div className="flex items-center gap-2 text-emerald-400 font-mono text-xs font-bold uppercase tracking-wider mb-1">
                  <DollarSign className="w-4 h-4 text-emerald-400" />
                  <span>Administración de Cobros & Historial Financiero</span>
                </div>
                <h3 className="text-xl font-black text-white flex items-center gap-2">
                  <span>Gestión & Edición de Fechas de Abonos/Pagos</span>
                </h3>
                <p className="text-xs text-slate-400 mt-0.5">
                  Modifica la fecha de pago, monto, cobrador asignado o método de pago de abonos registrados en campo. Al guardar, el saldo pendiente del cliente se reajusta automáticamente.
                </p>
              </div>

              {/* Summary Pill & Global Wipe Action */}
              <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 shrink-0">
                {onWipeAllAbonos && (
                  <button
                    type="button"
                    onClick={() => {
                      if (window.confirm('⚠️ ¿ESTÁS ABSOLUTAMENTE SEGURO DE ELIMINAR TODOS LOS ABONOS?\n\nEsta acción eliminará PERMANENTEMENTE todos los abonos del sistema, reajustará los saldos de todos los clientes a su monto de venta original y sincronizará con la nube.')) {
                        onWipeAllAbonos();
                      }
                    }}
                    className="bg-red-950 hover:bg-red-900 border-2 border-red-600 text-red-200 font-black text-xs px-4 py-2.5 rounded-2xl flex items-center justify-center gap-2 transition cursor-pointer shadow-lg shadow-red-950/60"
                  >
                    <Trash2 className="w-4 h-4 text-red-400" />
                    <span>Eliminar Todos los Abonos & Sincronizar</span>
                  </button>
                )}
                <div className="bg-slate-900 border border-emerald-500/40 p-3 rounded-2xl text-right">
                  <span className="text-[11px] text-slate-400 font-bold block">Total Recaudado (Selección):</span>
                  <span className="text-xl font-black text-emerald-400">
                    ${totalRecaudadoFiltrado.toLocaleString('en-US')} MXN
                  </span>
                  <span className="text-[10px] text-slate-400 block mt-0.5">{abonosFiltrados.length} abonos mostrados</span>
                </div>
              </div>
            </div>

            {/* CONTROLES DE BÚSQUEDA Y FILTRADO POR FECHA */}
            <div className="bg-slate-900 border border-slate-700 rounded-2xl p-4 space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-12 gap-3 items-center">
                <div className="md:col-span-5 relative">
                  <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    value={abonoSearchTerm}
                    onChange={(e) => setAbonoSearchTerm(e.target.value)}
                    placeholder="Buscar abono por cliente, folio CLI-..., cobrador o monto..."
                    className="w-full bg-slate-950 border border-slate-700 rounded-xl pl-9 pr-8 py-2 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500"
                  />
                  {abonoSearchTerm && (
                    <button
                      type="button"
                      onClick={() => setAbonoSearchTerm('')}
                      className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>

                <div className="md:col-span-7 flex flex-wrap items-center gap-1.5 justify-start md:justify-end">
                  <span className="text-[11px] text-slate-400 font-bold mr-1">Filtro Fecha Día:</span>
                  {[
                    { id: 'HOY', label: '📅 Hoy' },
                    { id: 'AYER', label: '🗓️ Ayer' },
                    { id: 'DIA_ESPECIFICO', label: '📌 Día Específico' },
                    { id: 'RANGO', label: '📐 Rango' },
                    { id: 'ESTA_SEMANA', label: '📊 Esta Semana' },
                    { id: 'ESTE_MES', label: '📆 Este Mes' },
                    { id: 'TODOS', label: '🌐 Todos' },
                  ].map((f) => (
                    <button
                      type="button"
                      key={f.id}
                      onClick={() => setAbonoDateFilter(f.id as any)}
                      className={`px-3 py-1.5 rounded-lg text-xs font-bold transition cursor-pointer ${
                        abonoDateFilter === f.id
                          ? 'bg-emerald-600 text-white shadow-md'
                          : 'bg-slate-800 text-slate-400 hover:bg-slate-700 hover:text-white'
                      }`}
                    >
                      {f.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* INPUTS CUANDO SE SELECCIONA DÍA ESPECÍFICO O RANGO */}
              {abonoDateFilter === 'DIA_ESPECIFICO' && (
                <div className="flex flex-wrap items-center gap-3 bg-slate-950 border border-emerald-500/40 p-3 rounded-xl text-xs">
                  <span className="text-slate-300 font-bold">Seleccionar Día Específico:</span>
                  <input
                    type="date"
                    value={abonoSpecificDate}
                    onChange={(e) => setAbonoSpecificDate(e.target.value)}
                    className="bg-slate-900 border border-slate-700 text-white font-mono px-3 py-1.5 rounded-lg focus:outline-none focus:border-emerald-500"
                  />
                  <span className="text-emerald-300 text-[11px]">
                    Mostrando abonos del día {abonoSpecificDate}
                  </span>
                </div>
              )}

              {abonoDateFilter === 'RANGO' && (
                <div className="flex flex-wrap items-center gap-3 bg-slate-950 border border-emerald-500/40 p-3 rounded-xl text-xs">
                  <div className="flex items-center gap-2">
                    <span className="text-slate-300 font-bold">Desde:</span>
                    <input
                      type="date"
                      value={abonoStartDate}
                      onChange={(e) => setAbonoStartDate(e.target.value)}
                      className="bg-slate-900 border border-slate-700 text-white font-mono px-3 py-1.5 rounded-lg focus:outline-none focus:border-emerald-500"
                    />
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-slate-300 font-bold">Hasta:</span>
                    <input
                      type="date"
                      value={abonoEndDate}
                      onChange={(e) => setAbonoEndDate(e.target.value)}
                      className="bg-slate-900 border border-slate-700 text-white font-mono px-3 py-1.5 rounded-lg focus:outline-none focus:border-emerald-500"
                    />
                  </div>
                </div>
              )}
            </div>

            {/* PANEL DE DESGLOSE COMPLETO DE ABONOS DEL DÍA / PERIODO */}
            <div className="bg-slate-950/80 border border-slate-700/80 rounded-2xl p-4 space-y-4 shadow-xl">
              <h4 className="text-xs font-black text-slate-300 uppercase tracking-wider flex items-center gap-2 border-b border-slate-800 pb-2">
                <BarChart3 className="w-4 h-4 text-emerald-400" />
                <span>Desglose Operativo del Periodo Seleccionado</span>
              </h4>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-xs">
                {/* 1. MÉTODOS DE PAGO */}
                <div className="bg-slate-900 border border-slate-800 p-3.5 rounded-xl space-y-2">
                  <span className="font-bold text-slate-300 block text-[11px] uppercase tracking-wider">
                    💳 Métodos de Pago
                  </span>
                  <div className="space-y-1.5 text-[11px]">
                    <div className="flex justify-between items-center bg-slate-950 p-2 rounded-lg border border-emerald-500/20">
                      <span className="text-emerald-400 font-bold">💵 Efectivo:</span>
                      <span className="font-mono font-bold text-white">${montoEfectivo.toLocaleString('en-US')} MXN ({abonosEfectivo.length})</span>
                    </div>
                    <div className="flex justify-between items-center bg-slate-950 p-2 rounded-lg border border-indigo-500/20">
                      <span className="text-indigo-400 font-bold">🏦 Transferencia:</span>
                      <span className="font-mono font-bold text-white">${montoTransferencia.toLocaleString('en-US')} MXN ({abonosTransferencia.length})</span>
                    </div>
                    {montoOtros > 0 && (
                      <div className="flex justify-between items-center bg-slate-950 p-2 rounded-lg border border-slate-700">
                        <span className="text-slate-400 font-bold">🔀 Mixto / Otro:</span>
                        <span className="font-mono font-bold text-white">${montoOtros.toLocaleString('en-US')} MXN ({abonosOtros.length})</span>
                      </div>
                    )}
                  </div>
                </div>

                {/* 2. TIPO DE COBRO (ABONO REGULAR VS ENGANCHE) */}
                <div className="bg-slate-900 border border-slate-800 p-3.5 rounded-xl space-y-2">
                  <span className="font-bold text-slate-300 block text-[11px] uppercase tracking-wider">
                    🏷️ Tipo de Ingreso
                  </span>
                  <div className="space-y-1.5 text-[11px]">
                    <div className="flex justify-between items-center bg-slate-950 p-2 rounded-lg border border-emerald-500/20">
                      <span className="text-emerald-300 font-bold">Abonos Regulares:</span>
                      <span className="font-mono font-bold text-white">${montoRegulares.toLocaleString('en-US')} MXN ({abonosRegulares.length})</span>
                    </div>
                    <div className="flex justify-between items-center bg-slate-950 p-2 rounded-lg border border-indigo-500/20">
                      <span className="text-indigo-300 font-bold">Enganches Registrados:</span>
                      <span className="font-mono font-bold text-white">${montoEnganches.toLocaleString('en-US')} MXN ({abonosEnganche.length})</span>
                    </div>
                  </div>
                </div>

                {/* 3. RESUMEN DE COBRADORES EN EL DÍA */}
                <div className="bg-slate-900 border border-slate-800 p-3.5 rounded-xl space-y-2">
                  <span className="font-bold text-slate-300 block text-[11px] uppercase tracking-wider">
                    👮 Cobranza por Cobrador
                  </span>
                  <div className="space-y-1.5 max-h-32 overflow-y-auto pr-1">
                    {listCobradorBreakdown.map((cob) => {
                      const pct = totalRecaudadoFiltrado > 0 ? Math.round((cob.monto / totalRecaudadoFiltrado) * 100) : 0;
                      return (
                        <div key={cob.nombre} className="flex justify-between items-center bg-slate-950 p-1.5 rounded-lg text-[11px] border border-slate-800">
                          <span className="text-slate-300 font-medium truncate max-w-[120px]">{cob.nombre}</span>
                          <span className="font-mono font-bold text-emerald-400">
                            ${cob.monto.toLocaleString('en-US')} <span className="text-[10px] text-slate-500">({cob.count} | {pct}%)</span>
                          </span>
                        </div>
                      );
                    })}
                    {listCobradorBreakdown.length === 0 && (
                      <p className="text-[11px] text-slate-500 py-2 text-center">Sin cobros en este periodo.</p>
                    )}
                  </div>
                </div>
              </div>
            </div>

            {/* LISTA DE ABONOS CON EDICIÓN DE FECHA */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {abonosFiltrados.length === 0 ? (
                <div className="col-span-full py-12 text-center bg-slate-900 border border-slate-800 rounded-2xl space-y-2">
                  <DollarSign className="w-10 h-10 text-slate-600 mx-auto" />
                  <p className="text-sm font-bold text-slate-300">No se encontraron abonos registrados</p>
                  <p className="text-xs text-slate-500">Prueba cambiando los términos de búsqueda o el rango de fecha.</p>
                </div>
              ) : (
                abonosFiltrados.map((ab) => {
                  const cli = clientes.find((c) => c.id === ab.clienteId);
                  const fechaFormateada = new Date(ab.fechaPago).toLocaleString('es-MX', {
                    dateStyle: 'medium',
                    timeStyle: 'short',
                  });

                  return (
                    <div
                      key={ab.id}
                      className="bg-slate-900 border border-slate-700 rounded-2xl p-4 space-y-3 shadow-lg flex flex-col justify-between hover:border-emerald-500/60 transition"
                    >
                      <div>
                        <div className="flex items-start justify-between border-b border-slate-800 pb-2.5 gap-2">
                          <div>
                            <span className="text-[10px] font-mono bg-emerald-950 text-emerald-300 border border-emerald-800 px-2 py-0.5 rounded-md font-bold">
                              ABONO #{ab.id}
                            </span>
                            <h4 className="font-extrabold text-white text-sm mt-1">
                              {ab.clienteNombre || cli?.nombreCompleto || 'Cliente Registrado'}
                            </h4>
                            <p className="text-xs text-slate-400 font-mono">
                              Folio: {ab.clienteFolio || cli?.folio || 'N/A'}
                            </p>
                          </div>

                          <div className="text-right shrink-0">
                            <span className="text-lg font-black text-emerald-400 block">
                              ${ab.monto.toLocaleString('en-US')} <span className="text-[10px] text-slate-300 font-semibold">MXN</span>
                            </span>
                            <span className="text-[10px] font-bold bg-slate-800 text-slate-300 px-2 py-0.5 rounded border border-slate-700">
                              {ab.tipoPago}
                            </span>
                          </div>
                        </div>

                        <div className="space-y-1.5 text-xs text-slate-300 pt-2 font-mono">
                          <div className="flex items-center justify-between bg-slate-950 p-2 rounded-xl border border-slate-800">
                            <span className="text-slate-400 font-sans flex items-center gap-1">
                              <Calendar className="w-3.5 h-3.5 text-indigo-400" /> Fecha Pago:
                            </span>
                            <strong className="text-amber-300 font-bold">{fechaFormateada}</strong>
                          </div>

                          <div className="flex justify-between px-1">
                            <span className="text-slate-400 font-sans">Cobrador / Registró:</span>
                            <strong className="text-slate-200">{ab.cobradorNombre || 'Cobrador Campo'}</strong>
                          </div>

                          {ab.observaciones && (
                            <div className="px-1 pt-1 text-[11px] text-slate-400 italic">
                              "{ab.observaciones}"
                            </div>
                          )}
                        </div>
                      </div>

                      <div className="flex items-center gap-2 pt-2 border-t border-slate-800">
                        <button
                          type="button"
                          onClick={() => {
                            setEditingAbono(ab);
                            setIsAbonoModalOpen(true);
                          }}
                          className="flex-1 bg-indigo-600 hover:bg-indigo-500 text-white font-bold py-2 px-3 rounded-xl text-xs flex items-center justify-center gap-1.5 transition cursor-pointer shadow"
                        >
                          <Edit2 className="w-3.5 h-3.5" /> Editar Fecha / Datos
                        </button>

                        {onDeleteAbono && (
                          <button
                            type="button"
                            onClick={() => {
                              if (window.confirm(`¿Estás seguro de eliminar el abono #${ab.id} de $${ab.monto}? Esta acción recalculará el saldo del cliente.`)) {
                                onDeleteAbono(ab.id);
                              }
                            }}
                            className="p-2 bg-rose-950/80 hover:bg-rose-900 text-rose-300 rounded-xl border border-rose-800/60 cursor-pointer transition"
                            title="Eliminar Abono"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        );
      })()}

      {/* TAB 11: CONFIGURACIÓN AVANZADA DE MAPA, GPS & NAVEGACIÓN 3D */}
      {activeTab === 'mapa' && (
        <div className="bg-slate-800/90 border border-slate-700 rounded-2xl p-6 shadow-xl space-y-6">
          {/* Header Banner */}
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-700/80 pb-5">
            <div>
              <div className="flex items-center gap-2 text-indigo-400 font-mono text-xs font-bold uppercase tracking-wider mb-1">
                <MapPin className="w-4 h-4 text-indigo-400 animate-bounce" />
                <span>Módulo de Configuración Geográfica & Motor GPS</span>
              </div>
              <h3 className="text-xl sm:text-2xl font-black text-white flex items-center gap-2">
                <span>Configuración Global del Mapa de Navegación 3D</span>
              </h3>
              <p className="text-xs text-slate-300 mt-1 max-w-2xl">
                Personaliza la apariencia del mapa, credenciales de Mapbox, nivel de zoom predeterminado, inclinación 3D, geocerca de llegada a domicilios y frecuencia de rastreo GPS en campo.
              </p>
            </div>

            <div className="flex items-center gap-2.5 shrink-0">
              {isMapConfigSavedNotice && (
                <span className="text-xs bg-emerald-500/20 text-emerald-300 border border-emerald-500/50 px-3 py-1.5 rounded-xl font-bold animate-pulse flex items-center gap-1">
                  <CheckCircle2 className="w-4 h-4 text-emerald-400" /> ¡Configuración Aplicada!
                </span>
              )}
              <button
                type="button"
                onClick={() => handleSaveMapConfig()}
                className="px-5 py-2.5 bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 text-white rounded-xl font-black text-xs flex items-center gap-2 cursor-pointer shadow-lg shadow-indigo-600/30 active:scale-95 transition"
              >
                <Save className="w-4 h-4" />
                <span>Guardar Configuración de Mapa</span>
              </button>
            </div>
          </div>

          <form onSubmit={handleSaveMapConfig} className="space-y-6">
            {/* SECCIÓN 1: CREDENCIALES & MAPBOX TOKEN */}
            <div className="bg-slate-950 p-5 rounded-2xl border border-slate-800 space-y-4">
              <div className="flex items-center gap-2 border-b border-slate-850 pb-3">
                <Settings className="w-5 h-5 text-indigo-400" />
                <div>
                  <h4 className="font-extrabold text-white text-base">1. Credenciales de Mapbox Access Token</h4>
                  <p className="text-xs text-slate-400">Token de acceso para renderizado de mapas vectoriales en alta definición.</p>
                </div>
              </div>

              <div className="space-y-2">
                <label className="block text-xs font-bold text-slate-300">Mapbox Public Access Token:</label>
                <input
                  type="text"
                  value={mapTokenInput}
                  onChange={(e) => setMapTokenInput(e.target.value)}
                  placeholder="pk.eyJ1IjoicGxvcGV4..."
                  className="w-full bg-slate-900 border border-slate-700 rounded-xl p-3 text-xs font-mono text-amber-300 focus:outline-none focus:border-indigo-500"
                />
                <p className="text-[11px] text-slate-400">
                  Si se deja vacío o el token falla, BITALIS utilizará automáticamente los mosaicos oscuros de raster de alta disponibilidad sin requerir clave de pago.
                </p>
              </div>
            </div>

            {/* SECCIÓN 2: ESTILO DE MAPA VISUAL */}
            <div className="bg-slate-950 p-5 rounded-2xl border border-slate-800 space-y-4">
              <div className="flex items-center gap-2 border-b border-slate-850 pb-3">
                <Layers className="w-5 h-5 text-indigo-400" />
                <div>
                  <h4 className="font-extrabold text-white text-base">2. Estilo Visual del Mapa en Modo Conducción y Rastreo</h4>
                  <p className="text-xs text-slate-400">Selecciona el tema que se aplicará a todos los navegadores y mapas del sistema.</p>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                {[
                  {
                    id: 'mapbox://styles/mapbox/dark-v11',
                    label: '🌙 Modo Oscuro Vectorial 3D (Default BITALIS)',
                    desc: 'Optimizado para ahorro de batería OLED y máxima legibilidad nocturna en campo.',
                  },
                  {
                    id: 'mapbox://styles/mapbox/navigation-night-v1',
                    label: '🚘 Navegación GPS Noche',
                    desc: 'Aumenta el contraste de calles secundarias y flechas de giro.',
                  },
                  {
                    id: 'mapbox://styles/mapbox/navigation-day-v1',
                    label: '☀️ Navegación GPS Día',
                    desc: 'Mapas de alto brillo diseñados para pleno sol directo.',
                  },
                  {
                    id: 'mapbox://styles/mapbox/streets-v12',
                    label: '🗺️ Calles Claros (Street Map)',
                    desc: 'Fácil identificación de nombres de calles y colonias.',
                  },
                  {
                    id: 'mapbox://styles/mapbox/satellite-streets-v12',
                    label: '🛰️ Satélite Híbrido HD',
                    desc: 'Fotografía aérea con superposición de nombres de calles.',
                  },
                  {
                    id: 'mapbox://styles/mapbox/outdoors-v12',
                    label: '🏔️ Topográfico Outdoors',
                    desc: 'Muestra relieve de terreno y curvas de nivel en zonas rurales.',
                  },
                ].map((st) => (
                  <button
                    type="button"
                    key={st.id}
                    onClick={() => setMapStyle(st.id)}
                    className={`p-4 rounded-xl border text-left transition cursor-pointer flex flex-col justify-between space-y-2 ${
                      mapStyle === st.id
                        ? 'bg-indigo-950 border-indigo-500 text-white shadow-lg shadow-indigo-600/20 ring-2 ring-indigo-500'
                        : 'bg-slate-900 border-slate-800 text-slate-300 hover:border-slate-700'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <strong className="text-xs font-bold block">{st.label}</strong>
                      {mapStyle === st.id && <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />}
                    </div>
                    <p className="text-[11px] text-slate-400">{st.desc}</p>
                  </button>
                ))}
              </div>
            </div>

            {/* SECCIÓN 3: CENTRO DE OPERACIONES Y ZOOM PREDETERMINADO */}
            <div className="bg-slate-950 p-5 rounded-2xl border border-slate-800 space-y-4">
              <div className="flex items-center gap-2 border-b border-slate-850 pb-3">
                <Route className="w-5 h-5 text-indigo-400" />
                <div>
                  <h4 className="font-extrabold text-white text-base">3. Centro Geográfico Inicial & Zoom Predeterminado</h4>
                  <p className="text-xs text-slate-400">Coordenadas de la ciudad base donde opera la flotilla BITALIS.</p>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-300 mb-1">Latitud Base:</label>
                  <input
                    type="number"
                    step="0.000001"
                    value={defaultCenterLat}
                    onChange={(e) => setDefaultCenterLat(Number(e.target.value))}
                    className="w-full bg-slate-900 border border-slate-700 rounded-xl p-2.5 text-xs text-white font-mono"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-300 mb-1">Longitud Base:</label>
                  <input
                    type="number"
                    step="0.000001"
                    value={defaultCenterLng}
                    onChange={(e) => setDefaultCenterLng(Number(e.target.value))}
                    className="w-full bg-slate-900 border border-slate-700 rounded-xl p-2.5 text-xs text-white font-mono"
                  />
                </div>

                <div className="flex items-end">
                  <button
                    type="button"
                    onClick={() => {
                      if (navigator.geolocation) {
                        navigator.geolocation.getCurrentPosition(
                          (pos) => {
                            setDefaultCenterLat(pos.coords.latitude);
                            setDefaultCenterLng(pos.coords.longitude);
                            alert(`📍 Centro actualizado a tu ubicación GPS actual: ${pos.coords.latitude.toFixed(4)}, ${pos.coords.longitude.toFixed(4)}`);
                          },
                          (err) => alert(`Error de GPS: ${err.message}`)
                        );
                      }
                    }}
                    className="w-full bg-slate-800 hover:bg-slate-700 text-indigo-300 border border-slate-700 font-bold py-2.5 px-3 rounded-xl text-xs flex items-center justify-center gap-1.5 cursor-pointer transition"
                  >
                    <MapPin className="w-4 h-4 text-indigo-400" />
                    <span>Usar Mi GPS Actual</span>
                  </button>
                </div>
              </div>

              {/* Sliders for Zoom, Pitch, Bearing */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 pt-3 border-t border-slate-850 text-xs">
                <div>
                  <div className="flex justify-between font-bold mb-1">
                    <span className="text-slate-300">Zoom Inicial:</span>
                    <span className="text-indigo-400 font-mono">{defaultZoom}</span>
                  </div>
                  <input
                    type="range"
                    min={10}
                    max={20}
                    step={0.5}
                    value={defaultZoom}
                    onChange={(e) => setDefaultZoom(Number(e.target.value))}
                    className="w-full accent-indigo-500 cursor-pointer"
                  />
                </div>

                <div>
                  <div className="flex justify-between font-bold mb-1">
                    <span className="text-slate-300">Inclinación 3D (Pitch):</span>
                    <span className="text-indigo-400 font-mono">{defaultPitch}°</span>
                  </div>
                  <input
                    type="range"
                    min={0}
                    max={60}
                    step={5}
                    value={defaultPitch}
                    onChange={(e) => setDefaultPitch(Number(e.target.value))}
                    className="w-full accent-indigo-500 cursor-pointer"
                  />
                </div>

                <div>
                  <div className="flex justify-between font-bold mb-1">
                    <span className="text-slate-300">Orientación (Bearing):</span>
                    <span className="text-indigo-400 font-mono">{defaultBearing}°</span>
                  </div>
                  <input
                    type="range"
                    min={0}
                    max={360}
                    step={15}
                    value={defaultBearing}
                    onChange={(e) => setDefaultBearing(Number(e.target.value))}
                    className="w-full accent-indigo-500 cursor-pointer"
                  />
                </div>
              </div>
            </div>

            {/* SECCIÓN 4: GEOCERCA DE LLEGADA & CONFIGURACIÓN GPS */}
            <div className="bg-slate-950 p-5 rounded-2xl border border-slate-800 space-y-4">
              <div className="flex items-center gap-2 border-b border-slate-850 pb-3">
                <Smartphone className="w-5 h-5 text-indigo-400" />
                <div>
                  <h4 className="font-extrabold text-white text-base">4. Geocerca de Aproximación & Tasa de Actualización GPS</h4>
                  <p className="text-xs text-slate-400">Define los metros de tolerancia para activar el zoom de llegada y foto de fachada en la pantalla del cobrador.</p>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-xs">
                <div>
                  <label className="block font-bold text-slate-300 mb-1">Radio Geocerca de Llegada (Metros):</label>
                  <select
                    value={proximityArrivalMeters}
                    onChange={(e) => setProximityArrivalMeters(Number(e.target.value))}
                    className="w-full bg-slate-900 border border-slate-700 rounded-xl p-2.5 text-white font-bold"
                  >
                    <option value={50}>50 metros (Alta precisión urbana)</option>
                    <option value={100}>100 metros (Estándar BITALIS)</option>
                    <option value={200}>200 metros (Zonas abiertas / suburbanas)</option>
                    <option value={500}>500 metros (Anticipación máxima)</option>
                  </select>
                </div>

                <div>
                  <label className="block font-bold text-slate-300 mb-1">Frecuencia Rastreo GPS en Campo:</label>
                  <select
                    value={gpsUpdateIntervalSeconds}
                    onChange={(e) => setGpsUpdateIntervalSeconds(Number(e.target.value))}
                    className="w-full bg-slate-900 border border-slate-700 rounded-xl p-2.5 text-white font-bold"
                  >
                    <option value={1}>Cada 1 segundo (Tiempo Real Total)</option>
                    <option value={3}>Cada 3 segundos (Balance Batería / Precisión)</option>
                    <option value={5}>Cada 5 segundos (Ahorro de Datos)</option>
                    <option value={10}>Cada 10 segundos (Modo Reposo)</option>
                  </select>
                </div>

                <div className="flex flex-col justify-end">
                  <label className={`p-2.5 rounded-xl border cursor-pointer transition flex items-center gap-2 ${
                    autoCenterOnRoute ? 'bg-indigo-950 border-indigo-600 text-white' : 'bg-slate-900 border-slate-800 text-slate-400'
                  }`}>
                    <input
                      type="checkbox"
                      checked={autoCenterOnRoute}
                      onChange={(e) => setAutoCenterOnRoute(e.target.checked)}
                      className="rounded text-indigo-500"
                    />
                    <div>
                      <strong className="block text-xs text-slate-200">Auto-centrar Vehículo</strong>
                      <span className="text-[10px] text-slate-400">Mantiene el mapa centrado en el cobrador</span>
                    </div>
                  </label>
                </div>
              </div>
            </div>

            <button
              type="submit"
              className="w-full bg-gradient-to-r from-indigo-600 via-purple-600 to-pink-600 hover:from-indigo-500 hover:to-pink-500 text-white font-black py-3.5 rounded-2xl text-xs cursor-pointer shadow-xl shadow-indigo-600/30 transition transform active:scale-98"
            >
              Guardar Configuración Geográfica & Aplicar a Todos los Navegadores
            </button>
          </form>
        </div>
      )}

      {/* ABONO EDIT MODAL */}
      {isAbonoModalOpen && editingAbono && (
        <div className="fixed inset-0 bg-slate-950/80 z-50 flex items-center justify-center p-4 backdrop-blur-sm animate-in fade-in">
          <form
            onSubmit={handleSaveAbonoSubmit}
            className="bg-slate-900 border border-slate-700 w-full max-w-lg rounded-2xl p-6 shadow-2xl space-y-4 max-h-[90vh] overflow-y-auto"
          >
            <div className="flex justify-between items-center border-b border-slate-800 pb-3">
              <h3 className="font-bold text-white text-base flex items-center gap-2">
                <Edit2 className="w-5 h-5 text-emerald-400" />
                Editar Registro de Abono / Pago (#{editingAbono.id})
              </h3>
              <button
                type="button"
                onClick={() => {
                  setIsAbonoModalOpen(false);
                  setEditingAbono(null);
                }}
                className="p-1 bg-slate-800 text-slate-300 rounded-lg hover:bg-slate-700 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-3 text-xs">
              <div>
                <label className="block text-slate-300 font-semibold mb-1">Cliente / Expediente</label>
                <input
                  type="text"
                  disabled
                  value={`${editingAbono.clienteNombre || 'Cliente'} (${editingAbono.clienteFolio || 'Folio'})`}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl p-2.5 text-slate-400 font-bold"
                />
              </div>

              <div>
                <label className="block text-amber-300 font-bold mb-1">Fecha y Hora de Pago (ISO / Local) *</label>
                <input
                  type="datetime-local"
                  required
                  value={
                    editingAbono.fechaPago
                      ? (editingAbono.fechaPago.includes('T')
                          ? editingAbono.fechaPago.slice(0, 16)
                          : `${editingAbono.fechaPago}T12:00`)
                      : new Date().toISOString().slice(0, 16)
                  }
                  onChange={(e) => setEditingAbono({ ...editingAbono, fechaPago: e.target.value })}
                  className="w-full bg-slate-950 border border-amber-500/80 rounded-xl p-2.5 text-amber-300 font-mono font-bold"
                />
                <p className="text-[10px] text-slate-400 mt-1">
                  Puedes retrodatar la fecha de cobro si el recibo se capturó posteriormente.
                </p>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-emerald-400 font-bold mb-1">Monto del Abono ($ MXN) *</label>
                  <input
                    type="number"
                    required
                    min={1}
                    value={editingAbono.monto || ''}
                    onChange={(e) => setEditingAbono({ ...editingAbono, monto: Number(e.target.value) })}
                    className="w-full bg-slate-950 border border-emerald-500/80 rounded-xl p-2.5 text-emerald-300 font-black text-sm"
                  />
                </div>

                <div>
                  <label className="block text-slate-300 font-semibold mb-1">Método de Pago</label>
                  <select
                    value={editingAbono.tipoPago || 'EFECTIVO'}
                    onChange={(e) => setEditingAbono({ ...editingAbono, tipoPago: e.target.value as any })}
                    className="w-full bg-slate-950 border border-slate-700 rounded-xl p-2.5 text-white font-bold"
                  >
                    <option value="EFECTIVO">EFECTIVO</option>
                    <option value="TRANSFERENCIA">TRANSFERENCIA</option>
                    <option value="MIXTO">MIXTO</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-slate-300 font-semibold mb-1">Nombre del Cobrador / Registró</label>
                <input
                  type="text"
                  value={editingAbono.cobradorNombre || ''}
                  onChange={(e) => setEditingAbono({ ...editingAbono, cobradorNombre: e.target.value })}
                  className="w-full bg-slate-950 border border-slate-700 rounded-xl p-2.5 text-white"
                />
              </div>

              <div>
                <label className="block text-slate-300 font-semibold mb-1">Observaciones / Concepto</label>
                <textarea
                  rows={2}
                  value={editingAbono.observaciones || ''}
                  onChange={(e) => setEditingAbono({ ...editingAbono, observaciones: e.target.value })}
                  placeholder="Ej. Pago reprogramado por la supervisora..."
                  className="w-full bg-slate-950 border border-slate-700 rounded-xl p-2.5 text-white"
                />
              </div>

              <div className="bg-amber-950/40 border border-amber-800/60 p-3 rounded-xl text-[11px] text-amber-300">
                ⚠️ Al guardar cambios, el saldo del cliente en su expediente se recalculará automáticamente.
              </div>
            </div>

            <button
              type="submit"
              className="w-full bg-emerald-600 hover:bg-emerald-500 text-white font-bold py-3 rounded-xl text-xs cursor-pointer shadow-lg transition mt-2"
            >
              Guardar Cambios de Abono y Recalcular Saldo
            </button>
          </form>
        </div>
      )}

      {/* INTERACTIVE KPI DETAIL MODAL */}
      {activeKpiModal && (
        <div className="fixed inset-0 bg-slate-950/80 z-50 flex items-center justify-center p-4 backdrop-blur-sm animate-in fade-in">
          <div className="bg-slate-900 border border-slate-700 w-full max-w-2xl rounded-2xl p-6 shadow-2xl space-y-4 max-h-[85vh] overflow-y-auto">
            <div className="flex justify-between items-center border-b border-slate-800 pb-3">
              <div className="flex items-center gap-2">
                {activeKpiModal === 'recaudado' && <Wallet className="w-6 h-6 text-emerald-400" />}
                {activeKpiModal === 'ventas' && <TrendingUp className="w-6 h-6 text-indigo-400" />}
                {activeKpiModal === 'saldo' && <BarChart3 className="w-6 h-6 text-cyan-400" />}
                {activeKpiModal === 'viaticos' && <Fuel className="w-6 h-6 text-amber-400" />}
                <h3 className="font-extrabold text-white text-base">
                  {activeKpiModal === 'recaudado' && 'Detalle KPI: Total Recaudado Hoy'}
                  {activeKpiModal === 'ventas' && 'Detalle KPI: Nuevas Ventas del Día'}
                  {activeKpiModal === 'saldo' && 'Detalle KPI: Saldo Pendiente Cartera'}
                  {activeKpiModal === 'viaticos' && 'Detalle KPI: Viáticos & Gasolina Entregados'}
                </h3>
              </div>
              <button
                onClick={() => setActiveKpiModal(null)}
                className="p-1.5 bg-slate-800 hover:bg-slate-700 rounded-xl text-slate-300"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* RECAUDADO HOY BREAKDOWN */}
            {activeKpiModal === 'recaudado' && (
              <div className="space-y-4">
                <div className="bg-slate-950 p-4 rounded-xl border border-emerald-500/30 flex justify-between items-center">
                  <div>
                    <span className="text-xs text-slate-400">Recaudado Hoy:</span>
                    <h4 className="text-2xl font-black text-emerald-400">${cobradoHoy.toLocaleString()} MXN</h4>
                  </div>
                  <div className="text-right text-xs">
                    <span className="text-slate-400 block">Cobrado Ayer: ${cobradoAyer.toLocaleString()} MXN</span>
                    <span className={`font-bold ${cambioPctCobrado >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                      Variación: {cambioPctCobrado >= 0 ? `+${cambioPctCobrado}%` : `${cambioPctCobrado}%`} vs ayer
                    </span>
                  </div>
                </div>

                <div className="space-y-2">
                  <h5 className="text-xs font-bold text-slate-300 uppercase">Cobros Registrados Hoy ({abonosHoy.length}):</h5>
                  {abonosHoy.length === 0 ? (
                    <p className="text-xs text-slate-500 py-4 text-center">Aún no se registran cobros en la fecha de hoy.</p>
                  ) : (
                    <div className="space-y-2 max-h-60 overflow-y-auto">
                      {abonosHoy.map((a) => (
                        <div key={a.id} className="bg-slate-950 p-3 rounded-xl border border-slate-800 flex justify-between items-center text-xs">
                          <div>
                            <strong className="text-white block">{a.clienteNombre || `Cliente #${a.clienteId}`}</strong>
                            <span className="text-[11px] text-slate-400">Cobrador: {a.cobradorNombre || 'Cobrador'} | Pago: {a.tipoPago}</span>
                          </div>
                          <span className="text-sm font-black text-emerald-400">${a.monto.toLocaleString()} MXN</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* NUEVAS VENTAS DEL DÍA BREAKDOWN */}
            {activeKpiModal === 'ventas' && (
              <div className="space-y-4">
                <div className="bg-slate-950 p-4 rounded-xl border border-indigo-500/30 flex justify-between items-center">
                  <div>
                    <span className="text-xs text-slate-400">Monto Colocado Hoy:</span>
                    <h4 className="text-2xl font-black text-indigo-300">${totalNuevasVentasHoyMonto.toLocaleString()} MXN</h4>
                  </div>
                  <div className="text-right text-xs">
                    <span className="text-slate-400 block">Colocado Ayer: ${totalNuevasVentasAyerMonto.toLocaleString()} MXN</span>
                    <span className={`font-bold ${cambioPctVentasMonto >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                      Variación: {cambioPctVentasMonto >= 0 ? `+${cambioPctVentasMonto}%` : `${cambioPctVentasMonto}%`} vs ayer
                    </span>
                  </div>
                </div>

                <div className="space-y-2">
                  <h5 className="text-xs font-bold text-slate-300 uppercase">Contratos Emitidos Hoy ({ventasHoyList.length}):</h5>
                  {ventasHoyList.length === 0 ? (
                    <p className="text-xs text-slate-500 py-4 text-center">No hay contratos emitidos en el día de hoy.</p>
                  ) : (
                    <div className="space-y-2 max-h-60 overflow-y-auto">
                      {ventasHoyList.map((v) => (
                        <div key={v.id} className="bg-slate-950 p-3 rounded-xl border border-slate-800 flex justify-between items-center text-xs">
                          <div>
                            <strong className="text-white block">{v.clienteNombre || `Cliente #${v.clienteId}`}</strong>
                            <span className="text-[11px] text-slate-400">Producto: {v.productoNombre} ({v.tipo})</span>
                          </div>
                          <div className="text-right">
                            <span className="text-sm font-black text-indigo-300 block">${(v.tipo === 'CONTADO' ? v.precioBase : v.saldoInicial).toLocaleString()} MXN</span>
                            <span className="text-[10px] text-emerald-400">Enganche: ${v.engancheMonto}</span>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* SALDO PENDIENTE CARTERA BREAKDOWN */}
            {activeKpiModal === 'saldo' && (
              <div className="space-y-4">
                <div className="bg-slate-950 p-4 rounded-xl border border-cyan-500/30 flex justify-between items-center">
                  <div>
                    <span className="text-xs text-slate-400">Saldo Pendiente Cartera Actual:</span>
                    <h4 className="text-2xl font-black text-cyan-300">${saldoPendienteTotal.toLocaleString()} MXN</h4>
                  </div>
                  <div className="text-right text-xs">
                    <span className="text-slate-400 block">Estimado Ayer: ${saldoPendienteAyer.toLocaleString()} MXN</span>
                    <span className="text-cyan-300 font-bold">Variación: {cambioPctSaldoPendiente}% vs ayer</span>
                  </div>
                </div>

                <div className="grid grid-cols-3 gap-3 text-center text-xs">
                  <div className="bg-emerald-950/60 p-3 rounded-xl border border-emerald-500/30">
                    <span className="text-emerald-400 font-bold block">Al Día (Verde)</span>
                    <span className="text-lg font-black text-white">{clientesVerde.length} clientes</span>
                  </div>
                  <div className="bg-amber-950/60 p-3 rounded-xl border border-amber-500/30">
                    <span className="text-amber-400 font-bold block">Abono Pend. (Amarillo)</span>
                    <span className="text-lg font-black text-white">{clientesAmarillo.length} clientes</span>
                  </div>
                  <div className="bg-red-950/60 p-3 rounded-xl border border-red-500/30">
                    <span className="text-red-400 font-bold block">Morosos (Rojo)</span>
                    <span className="text-lg font-black text-white">{clientesRojo.length} clientes</span>
                  </div>
                </div>
              </div>
            )}

            {/* VIÁTICOS Y GASOLINA BREAKDOWN */}
            {activeKpiModal === 'viaticos' && (
              <div className="space-y-4">
                <div className="bg-slate-950 p-4 rounded-xl border border-amber-500/30 flex justify-between items-center">
                  <div>
                    <span className="text-xs text-slate-400">Gastos Entregados Hoy:</span>
                    <h4 className="text-2xl font-black text-amber-400">${gastadoHoyTotal.toLocaleString()} MXN</h4>
                  </div>
                  <div className="text-right text-xs">
                    <span className="text-slate-400 block">Entregado Ayer: ${gastadoAyerTotal.toLocaleString()} MXN</span>
                    <span className={`font-bold ${cambioPctGastado <= 0 ? 'text-emerald-400' : 'text-amber-400'}`}>
                      Variación: {cambioPctGastado >= 0 ? `+${cambioPctGastado}%` : `${cambioPctGastado}%`} vs ayer
                    </span>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3 text-xs">
                  <div className="bg-slate-950 p-3.5 rounded-xl border border-slate-800">
                    <span className="text-slate-400 block mb-1">Monto Gasolina Hoy:</span>
                    <span className="text-xl font-black text-amber-400">${gastosGasolinaHoy.toLocaleString()} MXN</span>
                  </div>
                  <div className="bg-slate-950 p-3.5 rounded-xl border border-slate-800">
                    <span className="text-slate-400 block mb-1">Monto Viáticos Hoy:</span>
                    <span className="text-xl font-black text-amber-400">${viaticosHoy.toLocaleString()} MXN</span>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* GENERIC CONFIRMATION MODAL FOR DESTRUCTIVE ACTIONS */}
      <ConfirmationModal
        isOpen={deleteConfirmTarget !== null}
        title={deleteConfirmTarget?.type === 'usuario' ? 'Eliminar Usuario' : 'Eliminar Cliente'}
        description={
          deleteConfirmTarget?.type === 'usuario' ? (
            <>
              ¿Estás seguro de eliminar permanentemente al usuario{' '}
              <strong className="text-white font-bold">{deleteConfirmTarget?.name}</strong> ({deleteConfirmTarget?.detail})? Esta acción revocaría sus accesos al sistema.
            </>
          ) : (
            <>
              ¿Estás seguro de eliminar al cliente{' '}
              <strong className="text-white font-bold">{deleteConfirmTarget?.name}</strong> (Folio: {deleteConfirmTarget?.detail}) de la cartera activa?
            </>
          )
        }
        confirmText="Eliminar Permanentemente"
        cancelText="Cancelar"
        variant="danger"
        onConfirm={() => {
          if (deleteConfirmTarget) {
            if (deleteConfirmTarget.type === 'usuario' && onDeleteUsuario) {
              onDeleteUsuario(deleteConfirmTarget.id);
            } else if (deleteConfirmTarget.type === 'cliente' && onDeleteCliente) {
              onDeleteCliente(deleteConfirmTarget.id);
            }
          }
          setDeleteConfirmTarget(null);
        }}
        onClose={() => setDeleteConfirmTarget(null)}
      />
    </div>
  );
}
