'use client';

import { useState, useEffect, useMemo, Suspense, Component, ReactNode } from 'react';
import dynamic from 'next/dynamic';
import localforage from 'localforage';
import {
  Usuario,
  Zona,
  Cliente,
  Venta,
  Abono,
  CorteCaja,
  Producto,
  UserRole,
  LogAuditoria,
  diffCliente,
  diffVenta,
  calcularReglasFinancieras
} from '@/types';
import { triggerHaptic } from '@/lib/utils';
import BitalisLogo from '@/components/BitalisLogo';

import {
  INITIAL_USUARIOS,
  INITIAL_ZONAS,
  INITIAL_CLIENTES,
  INITIAL_VENTAS,
  INITIAL_ABONOS,
  INITIAL_CORTES,
  INITIAL_PRODUCTOS,
  INITIAL_AUDIT_LOGS
} from '@/lib/store';
import {
  syncLocalDataWithSupabase,
  checkSupabaseConnection,
  quickPushCliente,
  quickPushVenta,
  quickPushAbono,
  quickPushUsuario,
  quickPushProducto,
  quickPushZona,
  quickPushCorte,
  quickDeleteCliente,
  quickDeleteAbono,
  quickDeleteVenta,
  quickDeleteUsuario,
  markAsDeletedLocally,
  getPendingSyncCount,
  incrementPendingSyncCount,
  getSyncQueue,
  enqueueSyncTask,
  processSyncQueue,
  clearSyncQueue,
  setupSyncListeners,
  wipeDatabaseKeepUsers,
  supabase
} from '../db.js';

import LoginModal from '@/components/LoginModal';
import PinLockModal from '@/components/PinLockModal';
import SupabaseSecurityModal from '@/components/SupabaseSecurityModal';
import SupabaseConfigModal from '@/components/SupabaseConfigModal';
import GitHubModal from '@/components/GitHubModal';
import MobileBottomNavBar from '@/components/MobileBottomNavBar';
import InstaladorApkModal from '@/components/InstaladorApkModal';
import ToastNotification from '@/components/ToastNotification';
import PushNotificationManagerModal from '@/components/PushNotificationManagerModal';

import {
  Wifi,
  WifiOff,
  RefreshCw,
  User,
  ShieldCheck,
  Building2,
  MapPin,
  TrendingUp,
  Sparkles,
  Users,
  LogIn,
  Layers,
  Menu,
  X,
  Search,
  Zap,
  Command,
  Plus,
  DollarSign,
  CheckCircle2,
  Phone,
  Bell,
  BellRing,
  Smartphone,
  Lock,
  Database,
  Github,
  Settings,
  Hand,
  Award
} from 'lucide-react';
import {
  registerServiceWorker,
  requestNotificationPermission,
  ensureDefaultPushEnabled,
  sendAdvancedPushNotification,
  checkCaptacionEfectivoAndNotify
} from '@/lib/serviceWorkerManager';

function ViewLoadingFallback() {
  return (
    <div className="flex flex-col items-center justify-center min-h-[60vh] py-12 px-4 space-y-4">
      <div className="relative w-16 h-16 flex items-center justify-center">
        <div className="absolute inset-0 rounded-2xl bg-indigo-500/20 animate-ping" />
        <div className="w-14 h-14 rounded-2xl bg-slate-900 border border-indigo-500/40 flex items-center justify-center shadow-xl shadow-indigo-500/10">
          <RefreshCw className="w-7 h-7 text-indigo-400 animate-spin" />
        </div>
      </div>
      <div className="text-center space-y-1">
        <h3 className="text-base font-black text-white tracking-wide">Cargando Módulo BITALIS...</h3>
        <p className="text-xs text-slate-400 font-medium">Cargando interfaz perezosa optimizada para móvil</p>
      </div>
    </div>
  );
}

class ViewErrorBoundary extends Component<{ children: ReactNode }, { hasError: boolean; error?: Error }> {
  constructor(props: { children: ReactNode }) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(error: Error) {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error('ViewErrorBoundary caught error:', error, errorInfo);
  }

  handleReload = () => {
    if (typeof window !== 'undefined') {
      window.location.reload();
    }
  };

  render() {
    if (this.state.hasError) {
      const isChunkError =
        this.state.error?.name === 'ChunkLoadError' ||
        this.state.error?.message?.includes('Loading chunk');
      return (
        <div className="flex flex-col items-center justify-center min-h-[50vh] p-6 text-center space-y-4 bg-slate-900/80 rounded-3xl border border-indigo-500/30 m-4 shadow-2xl">
          <div className="w-14 h-14 rounded-2xl bg-indigo-500/20 text-indigo-400 flex items-center justify-center font-bold text-2xl">
            ⚡
          </div>
          <div className="space-y-1 max-w-md">
            <h3 className="text-lg font-black text-white">
              {isChunkError ? 'Módulo cargado con nueva versión' : 'Inconveniente de carga en la vista'}
            </h3>
            <p className="text-xs text-slate-400">
              {isChunkError
                ? 'Se ha actualizado el código de la aplicación. Haz clic abajo para refrescar la interfaz.'
                : 'Ocurrió un error al renderizar esta sección.'}
            </p>
          </div>
          <button
            onClick={this.handleReload}
            className="px-5 py-2.5 bg-gradient-to-r from-indigo-600 to-teal-600 hover:from-indigo-500 hover:to-teal-500 text-white font-bold rounded-xl text-xs transition cursor-pointer shadow-lg active:scale-95 flex items-center gap-2"
          >
            <RefreshCw className="w-4 h-4" />
            <span>Recargar Aplicación BITALIS</span>
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}

const lazyWithRetry = <P = {},>(importFn: () => Promise<{ default: React.ComponentType<P> }>) =>
  dynamic(
    () =>
      new Promise<{ default: React.ComponentType<P> }>((resolve, reject) => {
        importFn()
          .then(resolve)
          .catch((error) => {
            console.warn('ChunkLoadError detected, retrying chunk load...', error);
            setTimeout(() => {
              importFn()
                .then(resolve)
                .catch((err2) => {
                  console.warn('Second chunk retry failed, retrying after 1s...', err2);
                  setTimeout(() => {
                    importFn().then(resolve).catch(reject);
                  }, 1000);
                });
            }, 300);
          });
      }),
    { ssr: false, loading: () => <ViewLoadingFallback /> }
  );

// Dynamically import main views for optimized initial bundle and smooth performance
const VendedoraView = lazyWithRetry(() => import('@/components/VendedoraView'));
const SupVendedorasView = lazyWithRetry(() => import('@/components/SupVendedorasView'));
const CobradorView = lazyWithRetry(() => import('@/components/CobradorView'));
const SupCobradoresView = lazyWithRetry(() => import('@/components/SupCobradoresView'));
const AdminView = lazyWithRetry(() => import('@/components/AdminView'));
const CarteraClientesView = lazyWithRetry(() => import('@/components/CarteraClientesView'));
const CajaControlView = lazyWithRetry(() => import('@/components/CajaControlView'));
const CommissionsModule = lazyWithRetry(() => import('@/components/CommissionsModule'));

export default function Home() {
  // Action Notice Toast & Push Notification State
  const [actionNotice, setActionNotice] = useState<{ title: string; message: string; role?: string } | null>(null);
  const [showPushManagerModal, setShowPushManagerModal] = useState<boolean>(false);
  const [showRoleTourModal, setShowRoleTourModal] = useState<boolean>(false);

  const handleShowActionNotice = (title: string, message: string, role?: string) => {
    triggerHaptic([30, 50, 30]);
    setActionNotice({ title, message, role });
    sendAdvancedPushNotification({
      title,
      body: message,
      role: role || currentUser?.rol || 'all',
      soundType: role === 'admin' || role === 'sup_cobradores' ? 'alert' : 'success'
    });
  };
  // App Data State
  const [usuarios, setUsuarios] = useState<Usuario[]>(INITIAL_USUARIOS);
  const [zonas, setZonas] = useState<Zona[]>(INITIAL_ZONAS);
  const [productos, setProductos] = useState<Producto[]>(INITIAL_PRODUCTOS);
  const [clientes, setClientes] = useState<Cliente[]>(INITIAL_CLIENTES);
  const [ventas, setVentas] = useState<Venta[]>(INITIAL_VENTAS);
  const [abonos, setAbonos] = useState<Abono[]>(INITIAL_ABONOS);
  const [cortes, setCortes] = useState<CorteCaja[]>(INITIAL_CORTES);
  const [auditLogs, setAuditLogs] = useState<LogAuditoria[]>(INITIAL_AUDIT_LOGS);

  // Authentication & Active Tab State
  const [currentUser, setCurrentUser] = useState<Usuario | null>(null);
  const [activeTab, setActiveTab] = useState<
    'vendedora' | 'sup_vendedores' | 'cobrador' | 'sup_cobradores' | 'caja' | 'cartera' | 'comisiones' | 'admin' | 'login'
  >('login');

  // Offline-First PWA State
  const [isOnline, setIsOnline] = useState<boolean>(() =>
    typeof window !== 'undefined' ? navigator.onLine : true
  );
  const [pendingSyncCount, setPendingSyncCount] = useState<number>(0);
  const [isSyncing, setIsSyncing] = useState<boolean>(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState<boolean>(false);
  const [deferredPrompt, setDeferredPrompt] = useState<any>(null);
  const [showApkModal, setShowApkModal] = useState<boolean>(false);

  // Real Supabase Connection Status State
  const [dbStatus, setDbStatus] = useState<{ connected: boolean; latency: number; error?: string | null } | null>(null);

  const runDbCheck = async () => {
    const res = await checkSupabaseConnection();
    setDbStatus(res);
    return res;
  };

  useEffect(() => {
    checkSupabaseConnection().then((res) => setDbStatus(res));
    const timer = setInterval(() => {
      checkSupabaseConnection().then((res) => setDbStatus(res));
    }, 20000);
    return () => clearInterval(timer);
  }, []);

  const refreshUsuariosFromCloud = async () => {
    try {
      const { data } = await supabase.from('usuarios').select('*');
      if (data && data.length > 0) {
        const remoteUsers: Usuario[] = data.map((db: any) => ({
          id: db.id,
          nombre: db.nombre || '',
          usuario: db.usuario || '',
          email: db.email || '',
          password: db.password || '',
          pin: db.pin || '1234',
          rol: db.rol || 'admin',
          telefono: db.telefono || '',
          activo: Boolean(db.activo),
          avatarUrl: db.avatar_url || db.avatarUrl || '',
          sueldoBase: Number(db.sueldo_base || db.sueldoBase || 1500),
          porcentajeComision: Number(db.porcentaje_comision || db.porcentajeComision || 5),
          comisionPorVenta: Number(db.comision_por_venta || db.comisionPorVenta || 100)
        }));
        setUsuarios(remoteUsers);
        await localforage.setItem('pwa_usuarios', remoteUsers);
      }
    } catch (err) {
      console.warn('Error al actualizar usuarios desde Supabase:', err);
    }
  };

  // Security & PIN Lock State
  const [isPinLocked, setIsPinLocked] = useState<boolean>(false);
  const [isSecurityModalOpen, setIsSecurityModalOpen] = useState<boolean>(false);
  const [isDbConfigModalOpen, setIsDbConfigModalOpen] = useState<boolean>(false);
  const [isGitHubModalOpen, setIsGitHubModalOpen] = useState<boolean>(false);

  // Command Center AI Palette
  const [commandPaletteOpen, setCommandPaletteOpen] = useState<boolean>(false);
  const [commandSearchTerm, setCommandSearchTerm] = useState<string>('');

  // Auto inactivity session lock (5 minutes)
  useEffect(() => {
    let timer: NodeJS.Timeout;
    const resetTimer = () => {
      clearTimeout(timer);
      timer = setTimeout(() => {
        if (currentUser && !isPinLocked) {
          setIsPinLocked(true);
        }
      }, 5 * 60 * 1000); // 5 min
    };

    const events = ['mousemove', 'touchstart', 'keydown', 'scroll'];
    events.forEach((evt) => window.addEventListener(evt, resetTimer));
    resetTimer();

    return () => {
      clearTimeout(timer);
      events.forEach((evt) => window.removeEventListener(evt, resetTimer));
    };
  }, [currentUser, isPinLocked]);

  // Filter available navigation tabs strictly based on current user role
  const availableTabs = useMemo(() => {
    const allTabs = [
      { id: 'vendedora', label: 'Vendedora Campo', icon: User, roles: ['vendedora', 'sup_vendedores', 'admin'] },
      { id: 'sup_vendedores', label: 'Sup. Ventas', icon: ShieldCheck, roles: ['sup_vendedores', 'admin'] },
      { id: 'cobrador', label: 'Cobrador Ruta', icon: MapPin, roles: ['cobrador', 'sup_cobradores', 'admin'] },
      { id: 'caja', label: 'Caja & Control (Fase 7)', icon: DollarSign, roles: ['cobrador', 'sup_cobradores', 'admin'] },
      { id: 'comisiones', label: 'Comisiones (Fase 8)', icon: Award, roles: ['vendedora', 'sup_vendedores', 'cobrador', 'sup_cobradores', 'admin'] },
      { id: 'admin', label: 'Panel BITALIS', icon: Building2, roles: ['admin'] },
    ];

    if (!currentUser) return allTabs;
    return allTabs.filter((t) => t.roles.includes(currentUser.rol));
  }, [currentUser]);

  // Keyboard shortcut Cmd/Ctrl + K
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        setCommandPaletteOpen((prev) => !prev);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  // Helper to record an audit log entry
  const recordAuditLog = (entry: Omit<LogAuditoria, 'id' | 'fechaHora' | 'usuarioId' | 'usuarioNombre' | 'usuarioRol'> & {
    usuarioId?: number;
    usuarioNombre?: string;
    usuarioRol?: string;
  }) => {
    const now = new Date();
    const fechaHora = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')} ${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}:${String(now.getSeconds()).padStart(2, '0')}`;

    const newLog: LogAuditoria = {
      id: Date.now() + Math.floor(Math.random() * 1000),
      fechaHora,
      usuarioId: entry.usuarioId || currentUser?.id || 1,
      usuarioNombre: entry.usuarioNombre || currentUser?.nombre || 'Usuario Sistema',
      usuarioRol: entry.usuarioRol || currentUser?.rol || 'admin',
      tipoEntidad: entry.tipoEntidad,
      entidadId: entry.entidadId,
      entidadFolio: entry.entidadFolio,
      clienteNombre: entry.clienteNombre,
      accion: entry.accion,
      resumenCambio: entry.resumenCambio,
      cambios: entry.cambios
    };

    setAuditLogs((prev) => {
      const updated = [newLog, ...prev];
      localforage.setItem('pwa_audit_logs', updated).catch((err) => console.error('Error saving audit log:', err));
      return updated;
    });
  };

  // Load from localforage on mount (Clears legacy sample mock data on first run)
  useEffect(() => {
    async function loadStoredData() {
      try {
        const isCleaned = await localforage.getItem<boolean>('pwa_clean_db_v2');
        if (!isCleaned) {
          await localforage.removeItem('pwa_clientes');
          await localforage.removeItem('pwa_ventas');
          await localforage.removeItem('pwa_abonos');
          await localforage.removeItem('pwa_cortes');
          await localforage.removeItem('pwa_productos');
          await localforage.removeItem('pwa_zonas');
          await localforage.removeItem('pwa_usuarios');
          await localforage.removeItem('pwa_audit_logs');
          await clearSyncQueue();
          await localforage.setItem('pwa_clean_db_v2', true);
          setClientes([]);
          setVentas([]);
          setAbonos([]);
          setCortes([]);
          setProductos([]);
          setZonas([]);
          setUsuarios(INITIAL_USUARIOS);
          setAuditLogs([]);
        } else {
          const storedClientes = await localforage.getItem<Cliente[]>('pwa_clientes');
          if (storedClientes) setClientes(storedClientes);

          const storedVentas = await localforage.getItem<Venta[]>('pwa_ventas');
          if (storedVentas) setVentas(storedVentas);

          const storedAbonos = await localforage.getItem<Abono[]>('pwa_abonos');
          if (storedAbonos) setAbonos(storedAbonos);

          const storedCortes = await localforage.getItem<CorteCaja[]>('pwa_cortes');
          if (storedCortes) setCortes(storedCortes);

          const storedProductos = await localforage.getItem<Producto[]>('pwa_productos');
          if (storedProductos && storedProductos.length > 0) {
            setProductos(storedProductos);
          } else {
            setProductos(INITIAL_PRODUCTOS);
            await localforage.setItem('pwa_productos', INITIAL_PRODUCTOS);
          }

          const storedZonas = await localforage.getItem<Zona[]>('pwa_zonas');
          if (storedZonas) setZonas(storedZonas);

          const storedUsuarios = await localforage.getItem<Usuario[]>('pwa_usuarios');
          if (storedUsuarios && storedUsuarios.length > 0) setUsuarios(storedUsuarios);

          const storedAuditLogs = await localforage.getItem<LogAuditoria[]>('pwa_audit_logs');
          if (storedAuditLogs) setAuditLogs(storedAuditLogs);
        }

        // Restore active user session from localforage so page reload syncs without forcing logout
        const storedSessionUser = await localforage.getItem<Usuario>('pwa_session_user');
        const storedSessionTab = await localforage.getItem<string>('pwa_session_tab');
        if (storedSessionUser) {
          setCurrentUser(storedSessionUser);
          if (storedSessionTab && storedSessionTab !== 'login') {
            setActiveTab(storedSessionTab as any);
          } else {
            switch (storedSessionUser.rol) {
              case 'vendedora': setActiveTab('vendedora'); break;
              case 'sup_vendedores': setActiveTab('sup_vendedores'); break;
              case 'cobrador':
              case 'sup_cobradores': setActiveTab('cobrador'); break;
              case 'admin': setActiveTab('admin'); break;
              default: setActiveTab('vendedora');
            }
          }
        }

        const pending = await getPendingSyncCount();
        setPendingSyncCount(pending);

        // Immediate sync pull from Supabase on mount
        syncLocalDataWithSupabase().then((res: any) => {
          if (res?.success && res?.mergedData) {
            if (res.mergedData.clientes) setClientes(res.mergedData.clientes);
            if (res.mergedData.ventas) setVentas(res.mergedData.ventas);
            if (res.mergedData.abonos) setAbonos(res.mergedData.abonos);
            if (res.mergedData.productos) setProductos(res.mergedData.productos);
            if (res.mergedData.zonas) setZonas(res.mergedData.zonas);
            if (res.mergedData.usuarios && res.mergedData.usuarios.length > 0) setUsuarios(res.mergedData.usuarios);
            if (res.mergedData.cortes) setCortes(res.mergedData.cortes);
          }
        });

        // Registrar Service Worker y Habilitar Notificaciones Push por Defecto
        await registerServiceWorker();
        await ensureDefaultPushEnabled();

        // Verificar si la Guía de Rol está desactivada por el usuario
        if (typeof window !== 'undefined') {
          const guideDisabled = localStorage.getItem('bitalis_guide_disabled') === 'true';
          if (!guideDisabled) {
            setShowRoleTourModal(true);
          }
        }
      } catch (err) {
        console.error('Error loading stored PWA state:', err);
      }
    }

    loadStoredData();

    // Listeners for sync and browser connectivity
    const cleanupSync = setupSyncListeners(
      (res: any) => {
        if (res?.mergedData) {
          if (res.mergedData.clientes) setClientes(res.mergedData.clientes);
          if (res.mergedData.ventas) setVentas(res.mergedData.ventas);
          if (res.mergedData.abonos) setAbonos(res.mergedData.abonos);
          if (res.mergedData.productos) setProductos(res.mergedData.productos);
          if (res.mergedData.zonas) setZonas(res.mergedData.zonas);
          if (res.mergedData.usuarios && res.mergedData.usuarios.length > 0) setUsuarios(res.mergedData.usuarios);
          if (res.mergedData.cortes) setCortes(res.mergedData.cortes);
        }
        if (typeof res?.pendingSyncCount === 'number') {
          setPendingSyncCount(res.pendingSyncCount);
        }
      },
      (err: any) => {
        console.warn('Error en listener de sincronización:', err);
      }
    );

    // Queue update event listener
    const handleQueueUpdated = (e: any) => {
      if (typeof e.detail?.count === 'number') {
        setPendingSyncCount(e.detail.count);
      }
    };
    window.addEventListener('pwa-queue-updated', handleQueueUpdated);

    // Listen to browser online/offline events
    const handleOnline = () => {
      setIsOnline(true);
      processSyncQueue();
    };
    const handleOffline = () => setIsOnline(false);

    // Capture PWA / WebAPK install prompt
    const handleBeforeInstallPrompt = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e);
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      cleanupSync();
      window.removeEventListener('pwa-queue-updated', handleQueueUpdated);
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  // Monitoreo automático de captación de efectivo respecto al promedio semanal vía Service Worker
  useEffect(() => {
    if (abonos.length > 0) {
      checkCaptacionEfectivoAndNotify(abonos, ventas);
    }
  }, [abonos, ventas]);

  // Sync state to localforage & queue for Supabase
  const persistState = async (
    newClientes?: Cliente[],
    newVentas?: Venta[],
    newAbonos?: Abono[],
    newCortes?: CorteCaja[],
    newProductos?: Producto[],
    newZonas?: Zona[],
    newUsuarios?: Usuario[]
  ) => {
    try {
      if (newClientes) {
        await localforage.setItem('pwa_clientes', newClientes);
        await enqueueSyncTask('UPSERT', 'clientes', newClientes);
      }
      if (newVentas) {
        await localforage.setItem('pwa_ventas', newVentas);
        await enqueueSyncTask('UPSERT', 'ventas', newVentas);
      }
      if (newAbonos) {
        await localforage.setItem('pwa_abonos', newAbonos);
        await enqueueSyncTask('UPSERT', 'abonos', newAbonos);
      }
      if (newCortes) {
        await localforage.setItem('pwa_cortes', newCortes);
        await enqueueSyncTask('UPSERT', 'cortes', newCortes);
      }
      if (newProductos) {
        await localforage.setItem('pwa_productos', newProductos);
        await enqueueSyncTask('UPSERT', 'productos', newProductos);
      }
      if (newZonas) {
        await localforage.setItem('pwa_zonas', newZonas);
        await enqueueSyncTask('UPSERT', 'zonas', newZonas);
      }
      if (newUsuarios) {
        await localforage.setItem('pwa_usuarios', newUsuarios);
        await enqueueSyncTask('UPSERT', 'usuarios', newUsuarios);
      }

      const count = await getPendingSyncCount();
      setPendingSyncCount(count);

      if (typeof navigator !== 'undefined' && navigator.onLine) {
        processSyncQueue();
      }
    } catch (err) {
      console.error('Error persisting state:', err);
    }
  };

  // Persist active tab changes for session reload
  useEffect(() => {
    if (currentUser && activeTab && activeTab !== 'login') {
      localforage.setItem('pwa_session_tab', activeTab);
    }
  }, [currentUser, activeTab]);

  // Login handler with persistent session
  const handleLoginUser = (user: Usuario) => {
    setCurrentUser(user);
    ensureDefaultPushEnabled();
    localforage.setItem('pwa_session_user', user);
    let targetTab: any = 'vendedora';
    switch (user.rol) {
      case 'vendedora':
        targetTab = 'vendedora';
        break;
      case 'sup_vendedores':
        targetTab = 'sup_vendedores';
        break;
      case 'cobrador':
      case 'sup_cobradores':
        targetTab = 'cobrador';
        break;
      case 'admin':
        targetTab = 'admin';
        break;
      default:
        targetTab = 'vendedora';
    }
    setActiveTab(targetTab);
    localforage.setItem('pwa_session_tab', targetTab);
  };

  const handleLogout = () => {
    setCurrentUser(null);
    setActiveTab('login');
    setIsPinLocked(false);
    setCommandPaletteOpen(false);
    setIsSecurityModalOpen(false);
    localforage.removeItem('pwa_session_user');
    localforage.removeItem('pwa_session_tab');
  };

  const handleWipeDatabaseKeepUsers = async () => {
    setIsSyncing(true);
    try {
      const res = await wipeDatabaseKeepUsers();
      if (res.success) {
        setClientes([]);
        setVentas([]);
        setAbonos([]);
        setCortes([]);
        setAuditLogs([]);
        setPendingSyncCount(0);
        alert('🧹 ¡Base de datos limpiada con éxito! Se eliminaron todos los clientes, ventas, abonos y cortes de caja. Los usuarios registrados se mantuvieron intactos.');
      } else {
        alert(`❌ Error al limpiar la base de datos: ${res.error}`);
      }
    } catch (err) {
      console.error('Error al limpiar base de datos:', err);
      alert('❌ Ocurrió un error inesperado al intentar limpiar la base de datos.');
    } finally {
      setIsSyncing(false);
    }
  };

  // Handlers
  const handleAddClienteVenta = (nuevoCliente: Cliente, nuevaVenta: Venta) => {
    setClientes((prevClientes) => {
      const filteredC = prevClientes.filter((c) => c.id !== nuevoCliente.id);
      const updatedClientes = [nuevoCliente, ...filteredC];

      setVentas((prevVentas) => {
        const filteredV = prevVentas.filter((v) => v.id !== nuevaVenta.id);
        const updatedVentas = [nuevaVenta, ...filteredV];

        setProductos((prevProds) => {
          let updatedProductos = prevProds;
          if (nuevaVenta.productoId) {
            updatedProductos = prevProds.map((prod) =>
              prod.id === nuevaVenta.productoId
                ? { ...prod, stock: Math.max(0, (prod.stock ?? 10) - 1) }
                : prod
            );
          }
          persistState(updatedClientes, updatedVentas, undefined, undefined, updatedProductos);
          return updatedProductos;
        });

        return updatedVentas;
      });

      return updatedClientes;
    });

    incrementPendingSyncCount(1).then((c) => setPendingSyncCount(c));

    // Fast asynchronous push over mobile data
    quickPushCliente(nuevoCliente);
    quickPushVenta(nuevaVenta);

    sendAdvancedPushNotification({
      title: '📈 NUEVA VENTA CAMPO REGISTRADA',
      body: `Cliente: ${nuevoCliente.nombreCompleto} (${nuevoCliente.folio}). Folio Venta #${nuevaVenta.id}. Colonia: ${nuevoCliente.colonia || 'Centro'}.`,
      role: 'vendedora',
      soundType: 'success'
    });

    recordAuditLog({
      tipoEntidad: 'CLIENTE',
      entidadId: nuevoCliente.id,
      entidadFolio: nuevoCliente.folio,
      clienteNombre: nuevoCliente.nombreCompleto,
      accion: 'CREACION',
      resumenCambio: `Alta de Cliente ${nuevoCliente.nombreCompleto} y Registro de Venta #${nuevaVenta.id}`,
      cambios: [
        { campo: 'Cliente Registrado', valorAnterior: 'Inexistente', valorNuevo: `${nuevoCliente.nombreCompleto} (${nuevoCliente.folio})` },
        { campo: 'Contrato de Venta', valorAnterior: 'Inexistente', valorNuevo: `Producto ID #${nuevaVenta.productoId || 1} ($${nuevaVenta.saldoInicial})` }
      ]
    });
  };

  const handleApproveVenta = (ventaId: number) => {
    const targetVenta = ventas.find((v) => v.id === ventaId);
    if (!targetVenta) return;

    const updatedVenta = { ...targetVenta, estado: 'APROBADA' as const };
    const updatedVentas = ventas.map((v) =>
      v.id === ventaId ? updatedVenta : v
    );
    setVentas(updatedVentas);
    incrementPendingSyncCount(1).then((c) => setPendingSyncCount(c));
    persistState(undefined, updatedVentas);

    // Fast push over mobile data
    quickPushVenta(updatedVenta);

    sendAdvancedPushNotification({
      title: '✅ EXPEDIENTE DE CRÉDITO APROBADO',
      body: `La solicitud de venta #${targetVenta.id} (${targetVenta.clienteNombre || 'Cliente'}) fue APROBADA por la supervisora.`,
      role: 'sup_vendedores',
      soundType: 'success'
    });

    recordAuditLog({
      tipoEntidad: 'VENTA',
      entidadId: targetVenta.id,
      entidadFolio: targetVenta.clienteFolio || `VENTA-${targetVenta.id}`,
      clienteNombre: targetVenta.clienteNombre || 'Cliente',
      accion: 'APROBACION',
      resumenCambio: `Aprobación y Validación de Contrato #${targetVenta.id} por la Supervisora`,
      cambios: [{ campo: 'Estado de Validación Contrato', valorAnterior: targetVenta.estado, valorNuevo: 'APROBADA' }]
    });
  };

  const handleRejectVenta = (ventaId: number) => {
    const targetVenta = ventas.find((v) => v.id === ventaId);
    if (!targetVenta) return;

    const updatedVenta = { ...targetVenta, estado: 'RECHAZADA' as const };
    const updatedVentas = ventas.map((v) =>
      v.id === ventaId ? updatedVenta : v
    );
    setVentas(updatedVentas);
    incrementPendingSyncCount(1).then((c) => setPendingSyncCount(c));
    persistState(undefined, updatedVentas);

    // Fast push over mobile data
    quickPushVenta(updatedVenta);

    sendAdvancedPushNotification({
      title: '⚠️ EXPEDIENTE DE CRÉDITO RECHAZADO',
      body: `La solicitud de venta #${targetVenta.id} (${targetVenta.clienteNombre || 'Cliente'}) fue RECHAZADA por la supervisora.`,
      role: 'sup_vendedores',
      soundType: 'warning'
    });

    recordAuditLog({
      tipoEntidad: 'VENTA',
      entidadId: targetVenta.id,
      entidadFolio: targetVenta.clienteFolio || `VENTA-${targetVenta.id}`,
      clienteNombre: targetVenta.clienteNombre || 'Cliente',
      accion: 'RECHAZO',
      resumenCambio: `Rechazo de Contrato #${targetVenta.id} por la Supervisora`,
      cambios: [{ campo: 'Estado de Validación Contrato', valorAnterior: targetVenta.estado, valorNuevo: 'RECHAZADA' }]
    });
  };

  const handleAddAbono = (nuevoAbono: Abono) => {
    const updatedAbonos = [nuevoAbono, ...abonos];

    const isEnganchePayment = Boolean(
      (nuevoAbono as any).esEnganche ||
      nuevoAbono.observaciones?.toUpperCase().includes('ENGANCHE')
    );

    let targetVentaToPush: Venta | undefined;
    let targetClienteToPush: Cliente | undefined;

    // Update client balance & sale state
    const updatedVentas = ventas.map((v) => {
      if (v.clienteId === nuevoAbono.clienteId) {
        let descuentoTotalAbono = nuevoAbono.monto;
        let aporteBonusEmpresa = v.aporteEmpresa || 0;

        // If collecting deferred enganche, apply Matriz de Bonificación de Enganche
        if (isEnganchePayment && !v.engancheCobrado) {
          const calcBonus = calcularReglasFinancieras(nuevoAbono.monto, v.pagoSemanal, v.precioBase);
          aporteBonusEmpresa = calcBonus.aporteEmpresa;
          descuentoTotalAbono = nuevoAbono.monto + aporteBonusEmpresa;
        }

        const nuevoSaldo = Math.max(0, v.saldoActual - descuentoTotalAbono);
        
        let nuevaFechaPrimerPago = v.fechaPrimerPago;
        if (isEnganchePayment || !v.engancheCobrado) {
          const fechaBase = v.fechaPrimerPago || v.fechaVenta || new Date().toISOString().split('T')[0];
          const dt = new Date(fechaBase + 'T00:00:00');
          dt.setDate(dt.getDate() + 7);
          nuevaFechaPrimerPago = dt.toISOString().split('T')[0];
        }

        const updated: Venta = {
          ...v,
          saldoActual: nuevoSaldo,
          engancheMonto: isEnganchePayment ? nuevoAbono.monto : v.engancheMonto,
          aporteEmpresa: aporteBonusEmpresa,
          descuentoOtorgado: aporteBonusEmpresa,
          engancheCobrado: isEnganchePayment ? true : v.engancheCobrado,
          enganchePagado: isEnganchePayment ? true : v.enganchePagado,
          enganchePendiente: isEnganchePayment ? false : v.enganchePendiente,
          lugarCobroEnganche: isEnganchePayment ? (nuevoAbono.lugarCobroEnganche || 'RUTA_COBRADOR') : v.lugarCobroEnganche,
          fechaPrimerPago: nuevaFechaPrimerPago,
        };
        targetVentaToPush = updated;
        return updated;
      }
      return v;
    });

    // Update client status & reset delinquency upon payment
    const updatedClientes = clientes.map((c) => {
      if (c.id === nuevoAbono.clienteId) {
        const ventaRel = updatedVentas.find((v) => v.clienteId === c.id);
        const nuevoSaldo = ventaRel ? ventaRel.saldoActual : 0;
        
        let proximoPago = nuevoAbono.fechaProximoPago || c.proximoPagoFecha;
        if (isEnganchePayment && ventaRel && !nuevoAbono.fechaProximoPago) {
          proximoPago = ventaRel.fechaPrimerPago;
        }

        const updated: Cliente = {
          ...c,
          deudaCalculada: nuevoSaldo,
          enganchePendiente: isEnganchePayment ? false : c.enganchePendiente,
          proximoPagoFecha: proximoPago,
          estadoMorosidad: 'VERDE',
          diasMora: 0,
        };
        targetClienteToPush = updated;
        return updated;
      }
      return c;
    });

    setAbonos(updatedAbonos);
    setVentas(updatedVentas);
    setClientes(updatedClientes);
    incrementPendingSyncCount(1).then((co) => setPendingSyncCount(co));

    persistState(updatedClientes, updatedVentas, updatedAbonos);

    // Fast push over mobile data
    quickPushAbono(nuevoAbono);
    if (targetVentaToPush) quickPushVenta(targetVentaToPush);
    if (targetClienteToPush) quickPushCliente(targetClienteToPush);

    const clienteRel = updatedClientes.find((c) => c.id === nuevoAbono.clienteId);
    sendAdvancedPushNotification({
      title: isEnganchePayment ? '💵 ENGANCHE COBRADO EN RUTA' : '💰 COBRO Y ABONO REGISTRADO EN RUTA',
      body: `Abono de $${nuevoAbono.monto.toLocaleString()} MXN registrado a ${clienteRel?.nombreCompleto || 'Cliente'}. Saldo actualizado.`,
      role: 'cobrador',
      soundType: 'success'
    });
  };

  const handleUpdateAbono = (abonoActualizado: Abono) => {
    setAbonos((prevAbonos) => {
      const updatedAbonos = prevAbonos.map((a) => (a.id === abonoActualizado.id ? abonoActualizado : a));

      let targetVentaToPush: Venta | undefined;
      const updatedVentas = ventas.map((v) => {
        if (v.clienteId === abonoActualizado.clienteId) {
          const totalAbonado = updatedAbonos
            .filter((a) => a.clienteId === abonoActualizado.clienteId)
            .reduce((sum, a) => sum + a.monto, 0);
          const nuevoSaldo = Math.max(0, v.saldoInicial - totalAbonado);
          const updated = { ...v, saldoActual: nuevoSaldo };
          targetVentaToPush = updated;
          return updated;
        }
        return v;
      });

      setVentas(updatedVentas);
      persistState(undefined, updatedVentas, updatedAbonos);

      quickPushAbono(abonoActualizado);
      if (targetVentaToPush) quickPushVenta(targetVentaToPush);

      recordAuditLog({
        tipoEntidad: 'ABONO',
        entidadId: abonoActualizado.id,
        entidadFolio: `ABONO-${abonoActualizado.id}`,
        clienteNombre: abonoActualizado.clienteNombre || 'Cliente',
        accion: 'EDICION',
        resumenCambio: `Edición de Abono #${abonoActualizado.id} (Nueva fecha: ${abonoActualizado.fechaPago}, Monto: $${abonoActualizado.monto})`,
        cambios: [
          { campo: 'Fecha de Pago', valorAnterior: 'Modificado', valorNuevo: abonoActualizado.fechaPago },
          { campo: 'Monto Abono', valorAnterior: 'Modificado', valorNuevo: `$${abonoActualizado.monto}` },
        ]
      });

      return updatedAbonos;
    });
    incrementPendingSyncCount(1).then((c) => setPendingSyncCount(c));
  };

  const handleDeleteAbono = (abonoId: number) => {
    const targetAbono = abonos.find((a) => a.id === abonoId);
    if (!targetAbono) return;

    const updatedAbonos = abonos.filter((a) => a.id !== abonoId);

    let targetVentaToPush: Venta | undefined;
    let targetClienteToPush: Cliente | undefined;

    const updatedVentas = ventas.map((v) => {
      if (v.clienteId === targetAbono.clienteId) {
        const totalAbonado = updatedAbonos
          .filter((a) => a.clienteId === targetAbono.clienteId)
          .reduce((sum, a) => sum + a.monto, 0);
        const nuevoSaldo = Math.max(0, v.saldoInicial - totalAbonado);
        const updated = { ...v, saldoActual: nuevoSaldo };
        targetVentaToPush = updated;
        return updated;
      }
      return v;
    });

    const updatedClientes = clientes.map((c) => {
      if (c.id === targetAbono.clienteId) {
        const ventaRel = updatedVentas.find((v) => v.clienteId === c.id);
        const nuevoSaldo = ventaRel ? ventaRel.saldoActual : c.deudaCalculada;
        const updated = { ...c, deudaCalculada: nuevoSaldo };
        targetClienteToPush = updated;
        return updated;
      }
      return c;
    });

    setAbonos(updatedAbonos);
    setVentas(updatedVentas);
    setClientes(updatedClientes);

    persistState(updatedClientes, updatedVentas, updatedAbonos);

    markAsDeletedLocally('abonos', targetAbono.id);
    quickDeleteAbono(targetAbono.id);
    if (targetVentaToPush) quickPushVenta(targetVentaToPush);
    if (targetClienteToPush) quickPushCliente(targetClienteToPush);
    incrementPendingSyncCount(1).then((co) => setPendingSyncCount(co));

    recordAuditLog({
      tipoEntidad: 'ABONO',
      entidadId: targetAbono.id,
      entidadFolio: `ABONO-${targetAbono.id}`,
      clienteNombre: targetAbono.clienteNombre || 'Cliente',
      accion: 'ELIMINACION',
      resumenCambio: `Eliminación de Abono #${targetAbono.id} ($${targetAbono.monto})`,
      cambios: [{ campo: 'Estatus Abono', valorAnterior: 'Registrado', valorNuevo: 'ELIMINADO' }]
    });

    alert('¡Abono eliminado con éxito y saldo del cliente actualizado!');
  };

  const handleSaveCorte = (corteUpdated: CorteCaja) => {
    const existingIdx = cortes.findIndex((c) => c.id === corteUpdated.id);
    let updatedCortes: CorteCaja[];

    if (existingIdx >= 0) {
      updatedCortes = cortes.map((c) => (c.id === corteUpdated.id ? corteUpdated : c));
    } else {
      updatedCortes = [corteUpdated, ...cortes];
    }

    setCortes(updatedCortes);
    persistState(undefined, undefined, undefined, updatedCortes);

    sendAdvancedPushNotification({
      title: '📊 CORTE DE CAJA GUARDADO',
      body: `Corte de caja de $${(corteUpdated.efectivoRecolectado || corteUpdated.efectivoEntregado || 0).toLocaleString()} MXN registrado en estado ${corteUpdated.estado}.`,
      role: 'sup_cobradores',
      soundType: 'alert'
    });
  };

  const handleMarkCardsAsPrinted = (clienteIds: number[]) => {
    const updatedClientes = clientes.map((c) =>
      clienteIds.includes(c.id) ? { ...c, tarjetaImpresa: true } : c
    );
    setClientes(updatedClientes);
    incrementPendingSyncCount(1).then((c) => setPendingSyncCount(c));
    persistState(updatedClientes);
  };

  const handleSaveProducto = (producto: Producto) => {
    setProductos((prev) => {
      const idx = prev.findIndex((p) => p.id === producto.id);
      let updated: Producto[];
      if (idx >= 0) {
        updated = prev.map((p) => (p.id === producto.id ? producto : p));
      } else {
        updated = [producto, ...prev];
      }
      persistState(undefined, undefined, undefined, undefined, updated);
      return updated;
    });
    incrementPendingSyncCount(1).then((c) => setPendingSyncCount(c));
    quickPushProducto(producto);
  };

  const handleSaveZona = (zona: Zona) => {
    setZonas((prev) => {
      const idx = prev.findIndex((z) => z.id === zona.id);
      let updated: Zona[];
      if (idx >= 0) {
        updated = prev.map((z) => (z.id === zona.id ? zona : z));
      } else {
        updated = [zona, ...prev];
      }
      persistState(undefined, undefined, undefined, undefined, undefined, updated);
      return updated;
    });
    incrementPendingSyncCount(1).then((c) => setPendingSyncCount(c));
    quickPushZona(zona);
  };

  const handleUpdateCliente = (clienteActualizado: Cliente) => {
    setClientes((prev) => {
      const oldCliente = prev.find((c) => c.id === clienteActualizado.id);
      const diffs = oldCliente ? diffCliente(oldCliente, clienteActualizado) : [];
      const updated = prev.map((c) => (c.id === clienteActualizado.id ? clienteActualizado : c));
      persistState(updated);

      recordAuditLog({
        tipoEntidad: 'CLIENTE',
        entidadId: clienteActualizado.id,
        entidadFolio: clienteActualizado.folio,
        clienteNombre: clienteActualizado.nombreCompleto,
        accion: 'EDICION',
        resumenCambio: diffs.length > 0 
          ? `Modificación de ${diffs.length} dato(s): ${diffs.map((d) => d.campo).join(', ')}`
          : 'Actualización de datos de cliente',
        cambios: diffs.length > 0 ? diffs : [{ campo: 'Datos Cliente', valorAnterior: 'Modificado', valorNuevo: 'Actualizado' }]
      });

      return updated;
    });
    incrementPendingSyncCount(1).then((c) => setPendingSyncCount(c));

    // Fast asynchronous push over mobile data
    quickPushCliente(clienteActualizado);
  };

  const handleUpdateVenta = (ventaActualizada: Venta) => {
    setVentas((prev) => {
      const oldVenta = prev.find((v) => v.id === ventaActualizada.id);
      const diffs = oldVenta ? diffVenta(oldVenta, ventaActualizada) : [];
      const updated = prev.map((v) => (v.id === ventaActualizada.id ? ventaActualizada : v));
      persistState(undefined, updated);

      recordAuditLog({
        tipoEntidad: 'VENTA',
        entidadId: ventaActualizada.id,
        entidadFolio: ventaActualizada.clienteFolio || `VENTA-${ventaActualizada.id}`,
        clienteNombre: ventaActualizada.clienteNombre || 'Cliente',
        accion: 'EDICION',
        resumenCambio: diffs.length > 0 
          ? `Modificación de ${diffs.length} dato(s): ${diffs.map((d) => d.campo).join(', ')}`
          : 'Actualización de datos de venta',
        cambios: diffs.length > 0 ? diffs : [{ campo: 'Datos Venta', valorAnterior: 'Modificado', valorNuevo: 'Actualizado' }]
      });

      return updated;
    });
    incrementPendingSyncCount(1).then((c) => setPendingSyncCount(c));
    quickPushVenta(ventaActualizada);
  };

  const handleSaveUsuario = (usuarioActualizado: Usuario) => {
    const idx = usuarios.findIndex((u) => u.id === usuarioActualizado.id);
    let updated: Usuario[];
    if (idx >= 0) {
      updated = usuarios.map((u) => (u.id === usuarioActualizado.id ? usuarioActualizado : u));
    } else {
      updated = [usuarioActualizado, ...usuarios];
    }
    setUsuarios(updated);
    incrementPendingSyncCount(1).then((c) => setPendingSyncCount(c));
    persistState(undefined, undefined, undefined, undefined, undefined, undefined, updated);
    quickPushUsuario(usuarioActualizado);
  };

  const handleDeleteUsuario = (usuarioId: number) => {
    const updated = usuarios.filter((u) => u.id !== usuarioId);
    setUsuarios(updated);
    markAsDeletedLocally('usuarios', usuarioId);
    localforage.setItem('pwa_usuarios', updated);
    quickDeleteUsuario(usuarioId);
    enqueueSyncTask('DELETE', 'usuarios', [{ id: usuarioId }]);
    alert('¡Usuario eliminado con éxito!');
  };

  const handleDeleteVenta = (ventaId: number) => {
    const targetVenta = ventas.find((v) => v.id === ventaId);
    if (!targetVenta) return;

    const updatedVentas = ventas.filter((v) => v.id !== ventaId);
    setVentas(updatedVentas);

    markAsDeletedLocally('ventas', ventaId);
    quickDeleteVenta(ventaId);
    enqueueSyncTask('DELETE', 'ventas', [{ id: ventaId }]);

    persistState(undefined, updatedVentas);

    if (targetVenta) {
      recordAuditLog({
        tipoEntidad: 'VENTA',
        entidadId: targetVenta.id,
        entidadFolio: targetVenta.clienteFolio || `VENTA-${targetVenta.id}`,
        clienteNombre: targetVenta.clienteNombre || 'Cliente',
        accion: 'ELIMINACION',
        resumenCambio: `Eliminación de Contrato de Venta #${targetVenta.id}`,
        cambios: [{ campo: 'Estatus Venta', valorAnterior: 'Activa', valorNuevo: 'ELIMINADA' }]
      });
    }

    alert('¡Contrato de venta eliminado con éxito!');
  };

  const handleWipeAllAbonos = async () => {
    setAbonos([]);
    const updatedVentas = ventas.map((v) => ({
      ...v,
      saldoActual: v.saldoInicial,
      engancheCobrado: false,
      enganchePagado: false,
      enganchePendiente: true,
    }));
    const updatedClientes = clientes.map((c) => {
      const v = updatedVentas.find((venta) => venta.clienteId === c.id);
      return {
        ...c,
        deudaCalculada: v ? v.saldoInicial : c.deudaCalculada,
        ultimoAbonoMonto: undefined,
        ultimoAbonoFecha: undefined,
        proximoPagoFecha: v?.fechaPrimerPago || c.proximoPagoFecha,
        enganchePendiente: true,
        estadoMorosidad: 'VERDE' as const,
        diasMora: 0,
      };
    });
    setVentas(updatedVentas);
    setClientes(updatedClientes);

    await persistState(updatedClientes, updatedVentas, []);
    enqueueSyncTask('DELETE', 'abonos_all', []);
    alert('🧹 ¡Todos los abonos han sido eliminados del sistema y el saldo de todos los clientes ha sido restablecido y sincronizado!');
  };

  const handleDeleteCliente = (clienteId: number) => {
    const targetCliente = clientes.find((c) => c.id === clienteId);
    const updatedClientes = clientes.filter((c) => c.id !== clienteId);
    const associatedVentas = ventas.filter((v) => v.clienteId === clienteId);
    const updatedVentas = ventas.filter((v) => v.clienteId !== clienteId);

    setClientes(updatedClientes);
    setVentas(updatedVentas);

    // Guardado directo sin re-encolar UPSERT de restantes
    localforage.setItem('pwa_clientes', updatedClientes);
    localforage.setItem('pwa_ventas', updatedVentas);

    markAsDeletedLocally('clientes', clienteId);
    quickDeleteCliente(clienteId);
    enqueueSyncTask('DELETE', 'clientes', [{ id: clienteId }]);

    for (const v of associatedVentas) {
      markAsDeletedLocally('ventas', v.id);
      quickDeleteVenta(v.id);
      enqueueSyncTask('DELETE', 'ventas', [{ id: v.id }]);
    }

    if (targetCliente) {
      recordAuditLog({
        tipoEntidad: 'CLIENTE',
        entidadId: targetCliente.id,
        entidadFolio: targetCliente.folio,
        clienteNombre: targetCliente.nombreCompleto,
        accion: 'ELIMINACION',
        resumenCambio: `Eliminación de Cliente ${targetCliente.nombreCompleto} de la cartera`,
        cambios: [{ campo: 'Estatus en Cartera', valorAnterior: 'Activo', valorNuevo: 'ELIMINADO' }]
      });
    }

    alert('¡Cliente y sus registros de ventas eliminados con éxito!');
  };

  const handleForceSync = async () => {
    setIsSyncing(true);
    try {
      const pendingBefore = await getPendingSyncCount();
      const queueBefore = await getSyncQueue();
      const totalPending = Math.max(pendingBefore, queueBefore?.length || 0);

      if (totalPending > 0) {
        alert(`📤 Tienes ${totalPending} registro(s) local(es) pendiente(s) por subir a la base de datos de Supabase.\nIniciando subida y sincronización...`);
      } else {
        alert(`✨ Todo está al día: No hay datos pendientes por subir a la base de datos.\nSe descargarán las últimas actualizaciones de Supabase.`);
      }

      await processSyncQueue();
      const res = await syncLocalDataWithSupabase();

      if (res.success && res.mergedData) {
        if (res.mergedData.clientes) setClientes(res.mergedData.clientes);
        if (res.mergedData.ventas) setVentas(res.mergedData.ventas);
        if (res.mergedData.abonos) setAbonos(res.mergedData.abonos);
        if (res.mergedData.productos) setProductos(res.mergedData.productos);
        if (res.mergedData.zonas) setZonas(res.mergedData.zonas);
        if (res.mergedData.usuarios && res.mergedData.usuarios.length > 0) setUsuarios(res.mergedData.usuarios);
        if (res.mergedData.cortes) setCortes(res.mergedData.cortes);

        const remaining = res.pendingSyncCount ?? (await getPendingSyncCount());
        setPendingSyncCount(remaining);

        if (totalPending > 0) {
          if (remaining === 0) {
            alert('✅ ¡Sincronización completada exitosamente!\nTodos tus datos pendientes han sido subidos a la base de datos de Supabase.');
          } else {
            alert(`ℹ️ Proceso completado. Quedan ${remaining} registros pendientes en cola local para subir cuando haya mejor conexión.`);
          }
        } else {
          alert('✅ ¡Sincronización al día con la base de datos!');
        }
      } else {
        const remaining = await getPendingSyncCount();
        setPendingSyncCount(remaining);
        alert(`Respaldo local guardado. Registros pendientes en cola por subir: ${remaining}`);
      }
    } catch (err) {
      console.error('Error durante la sincronización:', err);
      const remaining = await getPendingSyncCount();
      alert(`⚠️ Respaldo local guardado en el dispositivo. Pendientes por subir: ${remaining}`);
    } finally {
      setIsSyncing(false);
    }
  };

  if (!currentUser || activeTab === 'login') {
    return (
      <div className="min-h-screen bg-slate-950 flex flex-col justify-center items-center p-4">
        <LoginModal
          usuarios={usuarios}
          currentUser={currentUser}
          onLogin={handleLoginUser}
          onLogout={handleLogout}
          onRefreshUsers={refreshUsuariosFromCloud}
        />
      </div>
    );
  }

  const isAdmin = currentUser?.rol === 'admin';

  return (
    <div className="min-h-screen bg-slate-900 text-slate-100 flex flex-col font-sans pb-6">
      {/* Top Application Header */}
      <header className="no-print bg-slate-950/95 border-b border-slate-800 sticky top-0 z-40 backdrop-blur-md">
        <div className="max-w-7xl mx-auto px-3 sm:px-6 py-2.5 flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-2.5">
          {/* App Branding & Fast Command */}
          <div className="flex items-center justify-between sm:justify-start gap-3 shrink-0">
            <BitalisLogo size="md" variant="dark" />
            <span className="hidden lg:inline-block text-[10px] font-black uppercase tracking-widest bg-emerald-950 text-emerald-300 border border-emerald-800 px-2.5 py-1 rounded-full shadow-inner">
              SISTEMA INTEGRAL EN RUTA
            </span>

            {/* Fast Command Trigger (Solo Administración) */}
            {isAdmin && (
              <button
                onClick={() => setCommandPaletteOpen(true)}
                className="flex items-center gap-1.5 bg-slate-900 hover:bg-slate-850 border border-indigo-500/40 hover:border-indigo-400 px-2.5 py-1 rounded-xl text-xs font-bold text-slate-200 transition cursor-pointer shadow-sm group"
              >
                <Zap className="w-3.5 h-3.5 text-amber-400 group-hover:scale-110 transition" />
                <span className="text-[11px] sm:text-xs">Buscar</span>
                <kbd className="hidden md:inline-block px-1.5 py-0.5 text-[10px] bg-slate-800 text-slate-400 rounded border border-slate-700 font-mono">
                  ⌘K
                </kbd>
              </button>
            )}
          </div>

          {/* Clean Top Action Bar with Active User Badge, Push Button & Visual Gesture Hint */}
          <div className="flex items-center gap-2 shrink-0">
            {/* Push Notifications Button */}
            <button
              onClick={() => setShowPushManagerModal(true)}
              className="relative flex items-center gap-1.5 bg-indigo-950/80 border border-indigo-700/80 hover:border-indigo-500 px-3 py-1.5 rounded-xl text-xs font-bold text-indigo-200 shadow-sm transition cursor-pointer group"
              title="Gestionar Notificaciones Push Jerárquicas"
            >
              <Bell className="w-3.5 h-3.5 text-amber-400 animate-bounce" />
              <span className="hidden sm:inline">Push Activas</span>
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping absolute -top-1 -right-1" />
            </button>

            {/* User Session Chip */}
            <button
              onClick={() => setActiveTab('login')}
              className="flex items-center gap-1.5 bg-slate-900 border border-slate-800 hover:border-slate-700 px-3 py-1.5 rounded-xl text-xs font-bold text-slate-200 shadow-sm transition cursor-pointer"
            >
              <User className="w-3.5 h-3.5 text-indigo-400" />
              <span>{currentUser ? currentUser.nombre.split(' ')[0] : 'Ingresar'}</span>
              <span className="text-[10px] uppercase font-mono px-1.5 py-0.5 rounded bg-indigo-950 text-indigo-300 border border-indigo-900">
                {currentUser?.rol || 'Sesión'}
              </span>
            </button>

            {/* Visual Swipe Gestures Pill */}
            <div className="hidden sm:flex items-center gap-1.5 bg-indigo-950/90 border border-indigo-800/80 text-indigo-300 px-3 py-1.5 rounded-xl text-xs font-extrabold shadow-sm">
              <Hand className="w-3.5 h-3.5 text-indigo-400 animate-pulse" />
              <span className="text-[11px]">Gestos Activos 👈 Desliza 👉</span>
            </div>
          </div>
        </div>

        {/* Responsive Role Navigation Bar (Visisible & Scrollable on Mobile and Desktop) */}
        <div className="max-w-7xl mx-auto px-3 sm:px-6 py-2 border-t border-slate-800/60 overflow-x-auto flex gap-1.5 scrollbar-none">
          {availableTabs.map((r) => {
            const Icon = r.icon;
            return (
              <button
                key={r.id}
                onClick={() => setActiveTab(r.id as any)}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold transition flex items-center gap-1.5 cursor-pointer shrink-0 border ${
                  activeTab === r.id
                    ? 'bg-indigo-600 text-white border-indigo-400 shadow-md'
                    : 'bg-slate-900/80 text-slate-400 hover:text-slate-200 hover:bg-slate-850 border-slate-800'
                }`}
              >
                <Icon className="w-3.5 h-3.5" />
                <span>{r.label}</span>
              </button>
            );
          })}
        </div>
      </header>

      {/* Main Content Workspace */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-3 sm:px-6 py-4 sm:py-6">
        <ViewErrorBoundary>
          <Suspense fallback={<ViewLoadingFallback />}>
          {activeTab === 'vendedora' && (
            <VendedoraView
              zonas={zonas}
              clientes={clientes}
              ventas={ventas}
              productos={productos}
              currentUser={currentUser}
              onAddClienteVenta={handleAddClienteVenta}
              onShowActionNotice={handleShowActionNotice}
            />
          )}

          {activeTab === 'sup_vendedores' && (
            <SupVendedorasView
              ventas={ventas}
              clientes={clientes}
              cortes={cortes}
              productos={productos}
              usuarios={usuarios}
              currentUser={currentUser}
              onApproveVenta={handleApproveVenta}
              onRejectVenta={handleRejectVenta}
              onSaveCorte={handleSaveCorte}
              onUpdateCliente={handleUpdateCliente}
              onUpdateVenta={handleUpdateVenta}
              onAddClienteVenta={handleAddClienteVenta}
              onSaveProducto={handleSaveProducto}
              onShowActionNotice={handleShowActionNotice}
            />
          )}

          {activeTab === 'cobrador' && (
            <CobradorView
              clientes={clientes}
              ventas={ventas}
              abonos={abonos}
              zonas={zonas}
              cortes={cortes}
              onAddAbono={handleAddAbono}
              onUpdateCorteCobrador={handleSaveCorte}
              onUpdateCliente={handleUpdateCliente}
              onShowActionNotice={handleShowActionNotice}
            />
          )}

          {activeTab === 'caja' && (
            <CajaControlView
              currentUser={currentUser}
              onShowNotice={handleShowActionNotice}
            />
          )}

          {activeTab === 'comisiones' && (
            <CommissionsModule />
          )}

          {activeTab === 'admin' && (
            <AdminView
              clientes={clientes}
              ventas={ventas}
              abonos={abonos}
              usuarios={usuarios}
              zonas={zonas}
              productos={productos}
              cortes={cortes}
              auditLogs={auditLogs}
              currentUser={currentUser}
              onMarkCardsAsPrinted={handleMarkCardsAsPrinted}
              onSaveProducto={handleSaveProducto}
              onSaveZona={handleSaveZona}
              onSaveUsuario={handleSaveUsuario}
              onDeleteUsuario={handleDeleteUsuario}
              onUpdateCliente={handleUpdateCliente}
              onDeleteCliente={handleDeleteCliente}
              onUpdateVenta={handleUpdateVenta}
              onDeleteVenta={handleDeleteVenta}
              onUpdateAbono={handleUpdateAbono}
              onDeleteAbono={handleDeleteAbono}
              onAddAbono={handleAddAbono}
              onWipeAllAbonos={handleWipeAllAbonos}
              onWipeDatabaseKeepUsers={handleWipeDatabaseKeepUsers}
              onOpenSupabaseConfig={() => setIsDbConfigModalOpen(true)}
            />
          )}
        </Suspense>
        </ViewErrorBoundary>
      </main>

      {/* Command Palette Modal */}
      {commandPaletteOpen && (
        <div
          className="fixed inset-0 bg-slate-950/80 backdrop-blur-md z-50 flex items-start justify-center p-4 pt-16 sm:pt-24 animate-fadeIn"
          onClick={() => setCommandPaletteOpen(false)}
        >
          <div
            className="bg-slate-900 border-2 border-indigo-500/80 rounded-2xl w-full max-w-2xl overflow-hidden shadow-2xl space-y-0"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Search Input Bar */}
            <div className="p-4 border-b border-slate-800 flex items-center gap-3 bg-slate-950">
              <Search className="w-5 h-5 text-indigo-400 shrink-0" />
              <input
                type="text"
                autoFocus
                placeholder="Buscar cliente, folio, colonia, o ejecutar acción rápida..."
                value={commandSearchTerm}
                onChange={(e) => setCommandSearchTerm(e.target.value)}
                className="w-full bg-transparent text-white placeholder-slate-500 font-medium text-sm sm:text-base focus:outline-none"
              />
              <button
                type="button"
                onClick={() => setCommandPaletteOpen(false)}
                className="p-1 rounded-lg bg-slate-800 text-slate-400 hover:text-white cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Quick Actions Bar */}
            <div className="p-3 bg-slate-950/50 border-b border-slate-800/80 flex flex-wrap gap-2 text-xs">
              <span className="text-slate-400 font-bold self-center text-[11px] mr-1">⚡ Acceso Rápido:</span>
              <button
                type="button"
                onClick={() => {
                  setActiveTab('vendedora');
                  setCommandPaletteOpen(false);
                }}
                className="px-2.5 py-1 bg-indigo-950 hover:bg-indigo-900 text-indigo-300 border border-indigo-800/60 rounded-lg font-bold flex items-center gap-1 cursor-pointer"
              >
                <Plus className="w-3.5 h-3.5 text-indigo-400" />
                <span>+ Nueva Venta Campo</span>
              </button>

              <button
                type="button"
                onClick={() => {
                  setActiveTab('cobrador');
                  setCommandPaletteOpen(false);
                }}
                className="px-2.5 py-1 bg-emerald-950 hover:bg-emerald-900 text-emerald-300 border border-emerald-800/60 rounded-lg font-bold flex items-center gap-1 cursor-pointer"
              >
                <DollarSign className="w-3.5 h-3.5 text-emerald-400" />
                <span>Registrar Abono Ruta</span>
              </button>

              <button
                type="button"
                onClick={() => {
                  setActiveTab('cartera');
                  setCommandPaletteOpen(false);
                }}
                className="px-2.5 py-1 bg-purple-950 hover:bg-purple-900 text-purple-300 border border-purple-800/60 rounded-lg font-bold flex items-center gap-1 cursor-pointer"
              >
                <MapPin className="w-3.5 h-3.5 text-purple-400" />
                <span>Mapa Cartera</span>
              </button>

              <button
                type="button"
                onClick={() => {
                  handleForceSync();
                  setCommandPaletteOpen(false);
                }}
                className="px-2.5 py-1 bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 rounded-lg font-bold flex items-center gap-1 cursor-pointer"
              >
                <RefreshCw className="w-3.5 h-3.5 text-indigo-400" />
                <span>Sync Supabase</span>
              </button>
            </div>

            {/* Live Search Results List */}
            <div className="p-3 max-h-80 overflow-y-auto space-y-2">
              <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-2 block">
                Resultados Coincidentes ({
                  clientes.filter((c) =>
                    !commandSearchTerm ||
                    c.nombreCompleto.toLowerCase().includes(commandSearchTerm.toLowerCase()) ||
                    c.folio.toLowerCase().includes(commandSearchTerm.toLowerCase()) ||
                    (c.colonia || '').toLowerCase().includes(commandSearchTerm.toLowerCase()) ||
                    c.telefono.includes(commandSearchTerm)
                  ).length
                }):
              </span>

              {clientes
                .filter((c) =>
                  !commandSearchTerm ||
                  c.nombreCompleto.toLowerCase().includes(commandSearchTerm.toLowerCase()) ||
                  c.folio.toLowerCase().includes(commandSearchTerm.toLowerCase()) ||
                  (c.colonia || '').toLowerCase().includes(commandSearchTerm.toLowerCase()) ||
                  c.telefono.includes(commandSearchTerm)
                )
                .slice(0, 8)
                .map((cliente) => {
                  const venta = ventas.find((v) => v.clienteId === cliente.id);
                  return (
                    <div
                      key={cliente.id}
                      className="p-3 bg-slate-950 hover:bg-slate-850 rounded-xl border border-slate-800 flex items-center justify-between gap-3 transition cursor-pointer group"
                      onClick={() => {
                        setActiveTab('cartera');
                        setCommandPaletteOpen(false);
                      }}
                    >
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                          <span className="font-bold text-white text-xs group-hover:text-indigo-400 transition">
                            {cliente.nombreCompleto}
                          </span>
                          <span className="text-[10px] font-mono text-indigo-300 bg-indigo-950 px-1.5 py-0.5 rounded border border-indigo-900">
                            {cliente.folio}
                          </span>
                        </div>
                        <p className="text-[11px] text-slate-400 truncate mt-0.5">
                          {cliente.direccion} • Colonia: {cliente.colonia || 'Centro'} • Saldo: ${venta?.saldoActual || 0} MXN
                        </p>
                      </div>

                      <div className="flex items-center gap-1 shrink-0">
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            setActiveTab('cobrador');
                            setCommandPaletteOpen(false);
                          }}
                          className="px-2.5 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg font-bold text-[11px] cursor-pointer shadow"
                        >
                          Cobrar
                        </button>
                        <a
                          href={`tel:${cliente.telefono}`}
                          onClick={(e) => e.stopPropagation()}
                          className="p-1.5 bg-slate-800 text-slate-300 rounded-lg hover:text-white"
                          title="Llamar"
                        >
                          <Phone className="w-3.5 h-3.5" />
                        </a>
                      </div>
                    </div>
                  );
                })}
            </div>
          </div>
        </div>
      )}

      {/* Modal Instalador APK / PWA */}
      {showApkModal && (
        <InstaladorApkModal
          deferredPrompt={deferredPrompt}
          onClose={() => setShowApkModal(false)}
          onInstallSuccess={() => setShowApkModal(false)}
        />
      )}

      {/* Supabase Security Architecture Info Modal */}
      {isSecurityModalOpen && (
        <SupabaseSecurityModal onClose={() => setIsSecurityModalOpen(false)} />
      )}

      {/* Supabase Database Connection & Cloud Config Modal */}
      <SupabaseConfigModal
        isOpen={isDbConfigModalOpen}
        currentUser={currentUser}
        onClose={() => setIsDbConfigModalOpen(false)}
        onDataSynced={(mergedData) => {
          if (mergedData.clientes) setClientes(mergedData.clientes);
          if (mergedData.ventas) setVentas(mergedData.ventas);
          if (mergedData.abonos) setAbonos(mergedData.abonos);
          if (mergedData.productos) setProductos(mergedData.productos);
          if (mergedData.zonas) setZonas(mergedData.zonas);
          if (mergedData.usuarios && mergedData.usuarios.length > 0) setUsuarios(mergedData.usuarios);
          if (mergedData.cortes) setCortes(mergedData.cortes);
          getPendingSyncCount().then((c) => setPendingSyncCount(c));
          checkSupabaseConnection().then((r) => setDbStatus(r));
        }}
      />

      {/* GitHub Repository Connection Modal */}
      <GitHubModal
        isOpen={isGitHubModalOpen}
        onClose={() => setIsGitHubModalOpen(false)}
        onShowNotice={handleShowActionNotice}
      />

      {/* Push Notification Manager Modal */}
      <PushNotificationManagerModal
        isOpen={showPushManagerModal}
        onClose={() => setShowPushManagerModal(false)}
      />

      {/* PIN Security Lock Modal */}
      {isPinLocked && (
        <PinLockModal
          userId={currentUser?.id}
          userNombre={currentUser?.nombre || 'Operador BITALIS'}
          userRol={currentUser?.rol || 'vendedora'}
          onUnlock={() => setIsPinLocked(false)}
        />
      )}

      {/* Footer */}
      <footer className="no-print bg-slate-950 border-t border-slate-800 py-4 text-center text-xs text-slate-500">
        <div className="max-w-7xl mx-auto px-4 flex flex-wrap items-center justify-between gap-2">
          <span>Plataforma BITALIS de Campo & Cobranza Semanal © 2026</span>
          <span className="flex items-center gap-1.5 text-indigo-400">
            <Sparkles className="w-3.5 h-3.5" /> Powered by Google Gen AI (@google/genai gemini-2.5-flash) & Supabase
          </span>
        </div>
      </footer>
    </div>
  );
}

