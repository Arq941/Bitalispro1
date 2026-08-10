'use client';

import { useState, useEffect } from 'react';
import { Usuario } from '@/types';
import { LogIn, Lock, User, LogOut, RefreshCw, Database, CheckCircle2, AlertCircle } from 'lucide-react';
import { supabase, checkSupabaseConnection } from '../db.js';
import BitalisLogo from './BitalisLogo';

interface LoginModalProps {
  usuarios: Usuario[];
  currentUser: Usuario | null;
  onLogin: (user: Usuario) => void;
  onLogout: () => void;
  onRefreshUsers?: () => void;
}

export default function LoginModal({ usuarios, currentUser, onLogin, onLogout, onRefreshUsers }: LoginModalProps) {
  const [userInput, setUserInput] = useState<string>('');
  const [passwordInput, setPasswordInput] = useState<string>('');
  const [errorMsg, setErrorMsg] = useState<string>('');
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [dbStatus, setDbStatus] = useState<{ connected: boolean; latency: number } | null>(null);

  useEffect(() => {
    checkSupabaseConnection().then((res) => setDbStatus(res));
  }, []);

  const handleFormSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const term = userInput.trim().toLowerCase();

    if (!term) {
      setErrorMsg('Por favor ingresa tu usuario o correo electrónico.');
      return;
    }

    setIsLoading(true);
    setErrorMsg('');

    // 1. Buscar primero en la lista local de usuarios
    let userToLogin = usuarios.find(
      (u) =>
        (u.usuario && u.usuario.toLowerCase() === term) ||
        (u.email && u.email.toLowerCase() === term) ||
        (u.nombre && u.nombre.toLowerCase() === term)
    );

    // 2. Si no se encuentra en local, consultar directamente en Supabase (Nube)
    if (!userToLogin) {
      try {
        const { data, error } = await supabase.from('usuarios').select('*');
        if (data && data.length > 0) {
          const remoteMapped: Usuario[] = data.map((db: any) => ({
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

          userToLogin = remoteMapped.find(
            (u) =>
              (u.usuario && u.usuario.toLowerCase() === term) ||
              (u.email && u.email.toLowerCase() === term) ||
              (u.nombre && u.nombre.toLowerCase() === term)
          );

          if (userToLogin && onRefreshUsers) {
            onRefreshUsers();
          }
        }
      } catch (err) {
        console.warn('Error al verificar usuario directo en Supabase:', err);
      }
    }

    setIsLoading(false);

    if (!userToLogin) {
      setErrorMsg('Usuario o correo no registrado en el sistema ni en la nube.');
      return;
    }

    if (userToLogin.password && passwordInput !== userToLogin.password) {
      setErrorMsg('Contraseña incorrecta.');
      return;
    }

    setErrorMsg('');
    setUserInput('');
    setPasswordInput('');
    onLogin(userToLogin);
  };

  const getRoleLabel = (rol: string) => {
    switch (rol) {
      case 'vendedora':
        return 'Vendedora de Campo';
      case 'sup_vendedores':
        return 'Supervisora de Ventas';
      case 'cobrador':
        return 'Cobrador de Ruta';
      case 'sup_cobradores':
        return 'Supervisor de Cobranza';
      case 'admin':
        return 'Administrador BITALIS';
      default:
        return rol;
    }
  };

  return (
    <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 sm:p-8 shadow-2xl max-w-md mx-auto space-y-6">
      <div className="text-center space-y-2 flex flex-col items-center">
        <BitalisLogo size="lg" variant="dark" className="mb-2" />
        <h2 className="text-xl font-bold text-white tracking-tight">Acceso al Sistema</h2>
        <p className="text-xs text-slate-400">Ingresa tus credenciales autorizadas</p>

        {/* Status Conexión Supabase Nube */}
        <div className="inline-flex items-center gap-2 px-3 py-1 bg-slate-950 border border-slate-800 rounded-full text-[11px]">
          <Database className={`w-3.5 h-3.5 ${dbStatus?.connected ? 'text-emerald-400' : 'text-amber-400'}`} />
          <span className="text-slate-300">
            {dbStatus === null
              ? 'Verificando nube...'
              : dbStatus.connected
              ? `Base de Datos Supabase Conectada (${dbStatus.latency}ms)`
              : 'Modo Local Offline (Sin Supabase)'}
          </span>
          <span className={`w-2 h-2 rounded-full ${dbStatus?.connected ? 'bg-emerald-400 animate-pulse' : 'bg-amber-400'}`} />
        </div>
      </div>

      {currentUser ? (
        <div className="space-y-4 pt-2">
          <div className="p-4 bg-slate-950 border border-slate-800 rounded-xl space-y-3">
            <div className="flex items-center justify-between text-xs text-slate-400">
              <span>Sesión Activa</span>
              <span className="text-indigo-400 font-bold">{getRoleLabel(currentUser.rol)}</span>
            </div>
            <div className="flex items-center gap-3">
              <div className="p-2.5 bg-indigo-600/20 text-indigo-400 rounded-xl border border-indigo-500/30">
                <User className="w-5 h-5" />
              </div>
              <div className="min-w-0 flex-1">
                <h3 className="text-sm font-bold text-white truncate">{currentUser.nombre}</h3>
                <p className="text-xs text-slate-400 truncate">{currentUser.email}</p>
              </div>
            </div>
          </div>

          <button
            type="button"
            onClick={onLogout}
            className="w-full bg-red-950/60 hover:bg-red-900 text-red-300 font-bold py-2.5 px-4 rounded-xl border border-red-800/60 transition text-xs flex items-center justify-center gap-2 cursor-pointer"
          >
            <LogOut className="w-4 h-4" />
            Cerrar Sesión
          </button>
        </div>
      ) : (
        <form onSubmit={handleFormSubmit} className="space-y-4">
          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1.5 flex items-center gap-1.5">
              <User className="w-3.5 h-3.5 text-indigo-400" />
              Usuario o Correo:
            </label>
            <input
              type="text"
              required
              value={userInput}
              onChange={(e) => setUserInput(e.target.value)}
              placeholder="Ej: admin, vendedora1, maria@empresa.com"
              className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2.5 text-sm text-white placeholder-slate-600 focus:outline-none focus:border-indigo-500 transition"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1.5 flex items-center gap-1.5">
              <Lock className="w-3.5 h-3.5 text-indigo-400" />
              Contraseña:
            </label>
            <input
              type="password"
              required
              value={passwordInput}
              onChange={(e) => setPasswordInput(e.target.value)}
              placeholder="Escribe tu contraseña"
              className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2.5 text-sm text-white placeholder-slate-600 focus:outline-none focus:border-indigo-500 transition"
            />
          </div>

          {errorMsg && (
            <div className="p-3 bg-red-950/80 border border-red-800/80 text-red-300 rounded-xl text-xs text-center font-medium">
              {errorMsg}
            </div>
          )}

          {/* Submit Button */}
          <button
            type="submit"
            disabled={isLoading}
            className="w-full bg-indigo-600 hover:bg-indigo-500 text-white font-bold py-3 px-4 rounded-xl shadow-lg transition flex items-center justify-center gap-2 text-sm cursor-pointer disabled:opacity-50 mt-2"
          >
            {isLoading ? (
              <>
                <RefreshCw className="w-4 h-4 animate-spin" />
                Verificando en Supabase Nube...
              </>
            ) : (
              <>
                <LogIn className="w-4 h-4" />
                Iniciar Sesión
              </>
            )}
          </button>
        </form>
      )}
    </div>
  );
}
