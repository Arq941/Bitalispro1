'use client';

import React, { useState, useEffect } from 'react';
import {
  Database,
  CheckCircle2,
  AlertCircle,
  RefreshCw,
  X,
  Key,
  Globe,
  Save,
  RotateCcw,
  Zap,
  ShieldCheck,
  Info,
  Copy,
  Code2,
  ChevronDown,
  ChevronUp,
  Github,
  Lock,
  Settings
} from 'lucide-react';
import {
  getSupabaseCredentials,
  saveSupabaseCredentials,
  checkSupabaseConnection,
  syncLocalDataWithSupabase
} from '../db.js';
import { triggerHaptic } from '@/lib/utils';

const BITALIS_SQL_SCRIPT = `-- SCRIPT DE INICIALIZACIÓN DE TABLAS BITALIS PARA SUPABASE (PostgreSQL)
-- Copia este código y pégalo en Supabase -> SQL Editor -> New Query -> RUN

-- 1. TABLA USUARIOS
CREATE TABLE IF NOT EXISTS public.usuarios (
  id BIGINT PRIMARY KEY,
  nombre TEXT NOT NULL,
  usuario TEXT NOT NULL UNIQUE,
  email TEXT,
  password TEXT,
  pin TEXT DEFAULT '1234',
  rol TEXT DEFAULT 'admin',
  telefono TEXT,
  activo BOOLEAN DEFAULT TRUE,
  avatar_url TEXT,
  sueldo_base NUMERIC DEFAULT 1500,
  porcentaje_comision NUMERIC DEFAULT 5,
  comision_por_venta NUMERIC DEFAULT 100,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. TABLA ZONAS
CREATE TABLE IF NOT EXISTS public.zonas (
  id BIGINT PRIMARY KEY,
  nombre TEXT NOT NULL,
  dia_cobro TEXT DEFAULT 'Lunes',
  colonias TEXT DEFAULT '[]',
  cuadrante TEXT,
  descripcion TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 3. TABLA PRODUCTOS
CREATE TABLE IF NOT EXISTS public.productos (
  id BIGINT PRIMARY KEY,
  nombre TEXT NOT NULL,
  precio_base NUMERIC DEFAULT 0,
  enganche_minimo NUMERIC DEFAULT 0,
  descuento_empresa NUMERIC DEFAULT 0,
  pago_semanal_sugerido NUMERIC DEFAULT 0,
  descripcion TEXT,
  categoria TEXT,
  foto_url TEXT,
  activo INT DEFAULT 1,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 4. TABLA CLIENTES
CREATE TABLE IF NOT EXISTS public.clientes (
  id BIGINT PRIMARY KEY,
  folio TEXT,
  nombre_completo TEXT NOT NULL,
  direccion TEXT,
  colonia TEXT,
  referencias TEXT,
  telefono TEXT,
  latitud NUMERIC DEFAULT 0,
  longitud NUMERIC DEFAULT 0,
  latitud_secundaria NUMERIC,
  longitud_secundaria NUMERIC,
  zona_id BIGINT DEFAULT 1,
  zona_nombre TEXT,
  foto_fachada TEXT,
  foto_cliente TEXT,
  foto_contrato TEXT,
  tarjeta_impresa INT DEFAULT 0,
  estado_morosidad TEXT DEFAULT 'VERDE',
  creado_por_vendedora_id BIGINT DEFAULT 1,
  vendedora_nombre TEXT,
  fecha_registro TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 5. TABLA VENTAS
CREATE TABLE IF NOT EXISTS public.ventas (
  id BIGINT PRIMARY KEY,
  cliente_id BIGINT,
  cliente_nombre TEXT,
  cliente_folio TEXT,
  vendedora_id BIGINT DEFAULT 1,
  vendedora_nombre TEXT,
  producto_id BIGINT DEFAULT 1,
  producto_nombre TEXT,
  tipo TEXT DEFAULT 'CREDITO',
  precio_base NUMERIC DEFAULT 1490,
  enganche_monto NUMERIC DEFAULT 0,
  aporte_empresa NUMERIC DEFAULT 0,
  descuento_otorgado NUMERIC DEFAULT 0,
  saldo_inicial NUMERIC DEFAULT 0,
  saldo_actual NUMERIC DEFAULT 0,
  pago_semanal NUMERIC DEFAULT 100,
  comision_vendedora NUMERIC DEFAULT 0,
  estado TEXT DEFAULT 'PENDIENTE_VALIDACION',
  fecha_venta TEXT,
  fecha_primer_pago TEXT,
  dia_cobro_zona TEXT DEFAULT 'Lunes',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 6. TABLA ABONOS
CREATE TABLE IF NOT EXISTS public.abonos (
  id BIGINT PRIMARY KEY,
  venta_id BIGINT,
  cliente_id BIGINT,
  cliente_nombre TEXT,
  cliente_folio TEXT,
  cobrador_id BIGINT DEFAULT 1,
  cobrador_nombre TEXT,
  monto NUMERIC DEFAULT 0,
  tipo_pago TEXT DEFAULT 'EFECTIVO',
  semana_numero INT DEFAULT 1,
  observaciones TEXT,
  fecha_pago TEXT,
  wa_enviado INT DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 7. TABLA CORTES
CREATE TABLE IF NOT EXISTS public.cortes (
  id BIGINT PRIMARY KEY,
  usuario_id BIGINT DEFAULT 1,
  usuario_nombre TEXT,
  rol_tipo TEXT DEFAULT 'VENDEDORA',
  fecha TEXT,
  fondo_inicial NUMERIC DEFAULT 0,
  gastos_gasolina NUMERIC DEFAULT 0,
  viaticos NUMERIC DEFAULT 0,
  efectivo_recolectado NUMERIC DEFAULT 0,
  efectivo_entregado NUMERIC DEFAULT 0,
  diferencia NUMERIC DEFAULT 0,
  estado TEXT DEFAULT 'ABIERTO',
  observaciones TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- DESACTIVAR RLS PARA PERMITIR LECTURA/ESCRITURA CON LA ANON KEY
ALTER TABLE public.usuarios DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.zonas DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.productos DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.clientes DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.ventas DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.abonos DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.cortes DISABLE ROW LEVEL SECURITY;
`;

interface SupabaseConfigModalProps {
  isOpen: boolean;
  onClose: () => void;
  onDataSynced?: (data: any) => void;
  currentUser?: { id: number; nombre: string; rol: string } | null;
  onOpenRls?: () => void;
  onOpenGitHub?: () => void;
}

export default function SupabaseConfigModal({
  isOpen,
  onClose,
  onDataSynced,
  currentUser,
  onOpenRls,
  onOpenGitHub
}: SupabaseConfigModalProps) {
  const isAdmin = currentUser?.rol === 'admin';
  const [urlInput, setUrlInput] = useState<string>(() => getSupabaseCredentials().url);
  const [keyInput, setKeyInput] = useState<string>(() => getSupabaseCredentials().key);
  const [status, setStatus] = useState<{
    connected: boolean;
    latency: number;
    error?: string | null;
    tablesMissing?: boolean;
  } | null>(null);
  const [isTesting, setIsTesting] = useState<boolean>(false);
  const [isSyncing, setIsSyncing] = useState<boolean>(false);
  const [saveSuccessMsg, setSaveSuccessMsg] = useState<string>('');
  const [showSqlScript, setShowSqlScript] = useState<boolean>(false);
  const [copiedSql, setCopiedSql] = useState<boolean>(false);

  const testConnection = async () => {
    setIsTesting(true);
    setSaveSuccessMsg('');
    const res = await checkSupabaseConnection();
    setStatus(res);
    setIsTesting(false);
  };

  useEffect(() => {
    if (isOpen) {
      const creds = getSupabaseCredentials();
      Promise.resolve().then(() => {
        setUrlInput(creds.url);
        setKeyInput(creds.key);
      });
      checkSupabaseConnection().then((res) => setStatus(res));
    }
  }, [isOpen]);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    triggerHaptic(10);
    setIsTesting(true);
    setSaveSuccessMsg('');

    // Guardar credenciales en localStorage y re-inicializar cliente Supabase
    saveSupabaseCredentials(urlInput, keyInput);

    // Comprobar nueva conexión
    const res = await checkSupabaseConnection();
    setStatus(res);
    setIsTesting(false);

    if (res.connected) {
      setSaveSuccessMsg('¡Conexión establecida exitosamente con Supabase Nube!');
    } else {
      setSaveSuccessMsg('Credenciales guardadas en local. Revisa el estado de la conexión.');
    }
  };

  const handleCopySql = () => {
    triggerHaptic(10);
    navigator.clipboard.writeText(BITALIS_SQL_SCRIPT);
    setCopiedSql(true);
    setTimeout(() => setCopiedSql(false), 3000);
  };

  const handleReset = async () => {
    triggerHaptic(10);
    saveSupabaseCredentials('', '');
    const creds = getSupabaseCredentials();
    setUrlInput(creds.url);
    setKeyInput(creds.key);
    testConnection();
  };

  const handleSyncNow = async () => {
    triggerHaptic(15);
    setIsSyncing(true);
    try {
      const syncRes = await syncLocalDataWithSupabase();
      if (syncRes.mergedData && onDataSynced) {
        onDataSynced(syncRes.mergedData);
      }
      await testConnection();
      alert('⚡ Sincronización bidireccional completada con Supabase.');
    } catch (err) {
      alert('⚠️ Ocurrió un inconveniente durante la sincronización.');
    } finally {
      setIsSyncing(false);
    }
  };

  if (!isOpen) return null;

  // Non-Admin Restricted Screen
  if (!isAdmin) {
    return (
      <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4 animate-fadeIn">
        <div className="bg-slate-900 border border-slate-700/80 rounded-3xl max-w-md w-full p-6 shadow-2xl space-y-5 text-center relative">
          <button
            type="button"
            onClick={onClose}
            className="absolute top-4 right-4 p-2 hover:bg-slate-800 rounded-xl text-slate-400 hover:text-white transition cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>

          <div className="w-16 h-16 bg-amber-950/80 border border-amber-600/50 rounded-2xl flex items-center justify-center mx-auto text-amber-400">
            <Lock className="w-8 h-8" />
          </div>

          <div>
            <h3 className="text-lg font-black text-white">Acceso Reservado a Administración</h3>
            <p className="text-xs text-slate-400 mt-1">
              La edición de la base de datos Supabase, sincronización manual, arquitectura RLS y la integración con GitHub están restringidas exclusivamente al perfil de <strong>Administrador</strong>.
            </p>
          </div>

          <div className="p-3 bg-slate-950 rounded-xl border border-slate-800 text-xs text-slate-300 font-mono">
            Usuario actual: <span className="font-bold text-indigo-400">{currentUser?.nombre || 'Usuario'}</span>
            <br />
            Rol: <span className="font-bold uppercase text-amber-400">{currentUser?.rol || 'Operador'}</span>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="w-full py-2.5 bg-slate-800 hover:bg-slate-700 text-white font-bold rounded-xl text-xs cursor-pointer transition"
          >
            Entendido
          </button>
        </div>
      </div>
    );
  }

  // Admin Master Settings Engrane Modal
  return (
    <div className="fixed inset-0 z-50 bg-slate-950/85 backdrop-blur-md flex items-center justify-center p-4 animate-fadeIn">
      <div className="bg-slate-900 border border-slate-700/80 rounded-3xl max-w-xl w-full p-6 shadow-2xl space-y-6 text-left relative max-h-[90vh] overflow-y-auto">
        {/* Modal Header */}
        <div className="flex items-center justify-between border-b border-slate-800 pb-4">
          <div className="flex items-center gap-3">
            <div className="p-3 bg-indigo-600/20 text-indigo-400 rounded-2xl border border-indigo-500/30">
              <Settings className="w-6 h-6 text-indigo-400" />
            </div>
            <div>
              <h3 className="text-lg font-black text-white flex items-center gap-2">
                <span>Engrane de Configuración BITALIS</span>
                <span className="text-[10px] bg-indigo-950 text-indigo-300 px-2 py-0.5 rounded-full border border-indigo-800">
                  ADMIN
                </span>
              </h3>
              <p className="text-xs text-slate-400">Configuración Supabase, Sincronización, RLS & GitHub</p>
            </div>
          </div>

          <button
            type="button"
            onClick={() => {
              triggerHaptic(10);
              onClose();
            }}
            className="p-2 hover:bg-slate-800 rounded-xl text-slate-400 hover:text-white transition cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Quick Admin Modules Shortcuts (RLS & GitHub) */}
        <div className="grid grid-cols-2 gap-3">
          <button
            type="button"
            onClick={() => {
              onClose();
              if (onOpenRls) onOpenRls();
            }}
            className="p-3 bg-indigo-950/60 hover:bg-indigo-900/80 border border-indigo-700/60 rounded-2xl flex items-center gap-2 text-indigo-200 text-xs font-bold transition cursor-pointer shadow"
          >
            <ShieldCheck className="w-4 h-4 text-indigo-400" />
            <span>Arquitectura RLS Supabase ↗</span>
          </button>

          <button
            type="button"
            onClick={() => {
              onClose();
              if (onOpenGitHub) onOpenGitHub();
            }}
            className="p-3 bg-slate-950/80 hover:bg-slate-800 border border-slate-700 rounded-2xl flex items-center gap-2 text-slate-200 text-xs font-bold transition cursor-pointer shadow"
          >
            <Github className="w-4 h-4 text-white" />
            <span>Repositorio GitHub ↗</span>
          </button>
        </div>

        {/* Current Connection Status Badge */}
        <div className={`p-4 rounded-2xl border ${
          status?.connected
            ? 'bg-emerald-950/40 border-emerald-800/80 text-emerald-200'
            : 'bg-amber-950/40 border-amber-800/80 text-amber-200'
        } space-y-2`}>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 font-bold text-sm">
              {status?.connected ? (
                <>
                  <CheckCircle2 className="w-5 h-5 text-emerald-400" />
                  <span>Conectado a Supabase Nube ({status.latency} ms)</span>
                </>
              ) : (
                <>
                  <AlertCircle className="w-5 h-5 text-amber-400" />
                  <span>Sin conexión directa con la nube</span>
                </>
              )}
            </div>

            <button
              type="button"
              onClick={testConnection}
              disabled={isTesting}
              className="p-1.5 bg-slate-900 hover:bg-slate-800 rounded-lg border border-slate-700 text-xs text-slate-300 flex items-center gap-1 cursor-pointer disabled:opacity-50"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isTesting ? 'animate-spin' : ''}`} />
              <span>{isTesting ? 'Probando...' : 'Recomprobar'}</span>
            </button>
          </div>

          {status && !status.connected && status.error && (
            <p className="text-xs text-amber-300/90 bg-slate-950/60 p-2.5 rounded-xl border border-amber-900/50 leading-relaxed">
              <strong>Detalle del Estado:</strong> {status.error}
            </p>
          )}

          {status?.connected && (
            <p className="text-xs text-emerald-300/90 leading-relaxed">
              ✓ Todos los registros de vendedoras, clientes, cobros y abonos se sincronizan directamente con la base de datos PostgreSQL.
            </p>
          )}
        </div>

        {/* SQL Script Assistant Block (If tables are missing or on request) */}
        <div className="p-4 bg-slate-950 border border-indigo-900/60 rounded-2xl space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 text-indigo-400 font-bold text-xs uppercase tracking-wider">
              <Code2 className="w-4 h-4 text-indigo-400" />
              <span>Crear Tablas en Supabase (Script SQL)</span>
            </div>

            <button
              type="button"
              onClick={handleCopySql}
              className="px-3 py-1 bg-indigo-600 hover:bg-indigo-500 text-white font-bold rounded-lg text-xs flex items-center gap-1.5 cursor-pointer transition shadow"
            >
              <Copy className="w-3.5 h-3.5" />
              <span>{copiedSql ? '¡Copiado!' : 'Copiar SQL'}</span>
            </button>
          </div>

          <p className="text-xs text-slate-300 leading-relaxed">
            Si recibes el aviso <code className="text-indigo-300 bg-slate-900 px-1 py-0.5 rounded">public.usuarios not found</code>, tu proyecto de Supabase no tiene creadas las tablas. Sigue estos 3 pasos sencillos:
          </p>

          <ol className="text-xs text-slate-300 space-y-1 list-decimal list-inside pl-1 bg-slate-900/80 p-2.5 rounded-xl border border-slate-800">
            <li>Haz clic arriba en <strong>Copiar SQL</strong>.</li>
            <li>Abre tu panel de Supabase → Menú lateral izquierdo → <strong>SQL Editor</strong> → Haz clic en <strong>New query</strong>.</li>
            <li>Pega el código SQL, haz clic en <strong>RUN</strong> y luego pulsa <strong>Recomprobar</strong> arriba.</li>
          </ol>

          <button
            type="button"
            onClick={() => setShowSqlScript(!showSqlScript)}
            className="text-xs text-indigo-400 hover:text-indigo-300 font-medium flex items-center gap-1 cursor-pointer pt-1"
          >
            {showSqlScript ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
            <span>{showSqlScript ? 'Ocultar código SQL' : 'Ver código SQL completo'}</span>
          </button>

          {showSqlScript && (
            <pre className="bg-slate-900 p-3 rounded-xl border border-slate-800 text-[10px] font-mono text-indigo-200/90 overflow-x-auto max-h-48 leading-relaxed">
              {BITALIS_SQL_SCRIPT}
            </pre>
          )}
        </div>

        {/* Credentials Form */}
        <form onSubmit={handleSave} className="space-y-4">
          {!isAdmin && (
            <div className="p-3 bg-indigo-950/90 border border-indigo-700/80 rounded-xl text-xs text-indigo-200 flex items-center gap-2">
              <ShieldCheck className="w-4 h-4 text-indigo-400 shrink-0" />
              <span>
                <strong>Edición protegida:</strong> Solo el Administrador puede modificar la URL y Anon Key de Supabase. (Conectado como {currentUser?.nombre})
              </span>
            </div>
          )}

          <div className="space-y-1">
            <label className="block text-xs font-semibold text-slate-300 flex items-center gap-1.5">
              <Globe className="w-3.5 h-3.5 text-indigo-400" />
              URL de Proyecto Supabase (REST Endpoint):
            </label>
            <input
              type="url"
              required
              disabled={!isAdmin}
              value={urlInput}
              onChange={(e) => setUrlInput(e.target.value)}
              placeholder="Ej: https://xyzcompany.supabase.co"
              className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2 text-xs text-white placeholder-slate-600 focus:outline-none focus:border-indigo-500 font-mono transition disabled:opacity-60 disabled:cursor-not-allowed"
            />
          </div>

          <div className="space-y-1">
            <label className="block text-xs font-semibold text-slate-300 flex items-center gap-1.5">
              <Key className="w-3.5 h-3.5 text-indigo-400" />
              Llave Anon Key de Supabase (anon / public):
            </label>
            <textarea
              required
              rows={2}
              disabled={!isAdmin}
              value={keyInput}
              onChange={(e) => setKeyInput(e.target.value)}
              placeholder="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
              className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2 text-xs text-white placeholder-slate-600 focus:outline-none focus:border-indigo-500 font-mono transition disabled:opacity-60 disabled:cursor-not-allowed"
            />
          </div>

          {saveSuccessMsg && (
            <div className="p-3 bg-emerald-950/80 border border-emerald-800 text-emerald-200 text-xs rounded-xl font-medium text-center">
              {saveSuccessMsg}
            </div>
          )}

          {/* Action Buttons */}
          <div className="flex flex-wrap items-center gap-2 pt-2">
            <button
              type="submit"
              disabled={isTesting || !isAdmin}
              className="flex-1 bg-indigo-600 hover:bg-indigo-500 text-white font-bold py-2.5 px-4 rounded-xl text-xs shadow-lg transition flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <Save className="w-4 h-4" />
              {isTesting ? 'Verificando...' : 'Guardar y Conectar'}
            </button>

            <button
              type="button"
              onClick={handleSyncNow}
              disabled={isSyncing || !status?.connected}
              className="bg-emerald-600 hover:bg-emerald-500 text-white font-bold py-2.5 px-4 rounded-xl text-xs shadow-lg transition flex items-center justify-center gap-2 cursor-pointer disabled:opacity-40"
            >
              <Zap className={`w-4 h-4 ${isSyncing ? 'animate-bounce' : ''}`} />
              {isSyncing ? 'Sincronizando...' : 'Sincronizar Todo'}
            </button>

            <button
              type="button"
              onClick={handleReset}
              className="bg-slate-800 hover:bg-slate-700 text-slate-300 font-medium py-2.5 px-3 rounded-xl text-xs transition flex items-center justify-center gap-1.5 cursor-pointer"
              title="Restablecer valores"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Restablecer</span>
            </button>
          </div>
        </form>

        {/* Info Banner */}
        <div className="p-3 bg-slate-950/80 rounded-2xl border border-slate-800/80 text-[11px] text-slate-400 space-y-1">
          <div className="flex items-center gap-1.5 font-bold text-slate-300">
            <Info className="w-3.5 h-3.5 text-indigo-400" />
            <span>¿Dónde encontrar estas credenciales en Supabase?</span>
          </div>
          <p className="leading-relaxed">
            Ve a tu panel de Supabase → <strong>Project Settings</strong> → <strong>API</strong>. Copia el <strong>Project URL</strong> y la clave <strong>anon public key</strong>.
          </p>
        </div>
      </div>
    </div>
  );
}

