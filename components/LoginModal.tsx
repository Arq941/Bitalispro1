'use client';

import { useState } from 'react';
import { Usuario, UserRole } from '@/types';
import {
  LogIn,
  Lock,
  Mail,
  LogOut,
  RefreshCw,
  ShieldCheck,
  AlertCircle,
  Eye,
  EyeOff,
  CheckCircle2,
} from 'lucide-react';
import BitalisLogo from './BitalisLogo';

interface LoginModalProps {
  usuarios: Usuario[];
  currentUser: Usuario | null;
  onLogin: (user: Usuario) => void;
  onLogout: () => void;
  onRefreshUsers?: () => void;
}

function roleToLegacyRole(role: string): UserRole {
  switch (role) {
    case 'ADMIN':
      return 'admin';
    case 'VENDEDORA':
      return 'vendedora';
    case 'COBRADOR':
      return 'cobrador';
    case 'SUPERVISORA':
      return 'sup_vendedores';
    default:
      return 'admin';
  }
}

function stableNumericId(value: string): number {
  let hash = 0;
  for (let i = 0; i < value.length; i += 1) {
    hash = (hash * 31 + value.charCodeAt(i)) | 0;
  }
  return Math.abs(hash) || 1;
}

export default function LoginModal({ currentUser, onLogin, onLogout }: LoginModalProps) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [errorMsg, setErrorMsg] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  const handleFormSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const normalizedEmail = email.trim().toLowerCase();

    if (!normalizedEmail || !password) {
      setErrorMsg('Ingresa tu correo y contraseña.');
      return;
    }

    if (!normalizedEmail.includes('@')) {
      setErrorMsg('Para la versión de producción inicia sesión con tu correo electrónico.');
      return;
    }

    setIsLoading(true);
    setErrorMsg('');

    try {
      const response = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: normalizedEmail, password }),
      });

      const result = await response.json().catch(() => null);

      if (!response.ok || !result?.success || !result?.accessToken || !result?.user) {
        setErrorMsg(result?.message || 'No fue posible iniciar sesión. Verifica tus credenciales.');
        return;
      }

      localStorage.setItem('bitalis_access_token', result.accessToken);
      if (result.refreshToken) localStorage.setItem('bitalis_refresh_token', result.refreshToken);
      localStorage.setItem('bitalis_auth_user', JSON.stringify(result.user));

      const apiUser = result.user;
      const mappedUser: Usuario = {
        id: stableNumericId(String(apiUser.id)),
        nombre: `${apiUser.firstName || ''} ${apiUser.lastName || ''}`.trim() || apiUser.email,
        email: apiUser.email,
        usuario: apiUser.email,
        rol: roleToLegacyRole(apiUser.role),
        telefono: '',
        activo: true,
      };

      setEmail('');
      setPassword('');
      onLogin(mappedUser);
    } catch (error) {
      console.error('Production login error:', error);
      setErrorMsg('No se pudo conectar con el servidor de BITALIS. Intenta nuevamente.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleLogout = () => {
    localStorage.removeItem('bitalis_access_token');
    localStorage.removeItem('bitalis_refresh_token');
    localStorage.removeItem('bitalis_auth_user');
    onLogout();
  };

  const getRoleLabel = (rol: string) => {
    switch (rol) {
      case 'vendedora': return 'Vendedora de Campo';
      case 'sup_vendedores': return 'Supervisión de Ventas';
      case 'cobrador': return 'Cobranza de Ruta';
      case 'sup_cobradores': return 'Supervisión de Cobranza';
      case 'admin': return 'Administrador BITALIS';
      default: return rol;
    }
  };

  return (
    <div className="w-full max-w-md mx-auto overflow-hidden rounded-[28px] border border-emerald-400/15 bg-slate-950/90 shadow-2xl shadow-black/40 backdrop-blur-xl">
      <div className="relative px-6 pt-8 pb-6 sm:px-8">
        <div className="absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-emerald-400 via-teal-400 to-cyan-400" />
        <div className="flex flex-col items-center text-center">
          <div className="mb-4 rounded-3xl border border-white/5 bg-slate-900/70 px-5 py-4 shadow-inner">
            <BitalisLogo size="lg" variant="dark" />
          </div>
          <h1 className="text-2xl font-black tracking-tight text-white">Bienvenido a BITALIS</h1>
          <p className="mt-2 max-w-xs text-sm leading-5 text-slate-400">
            Ventas, cobranza, clientes e inventario en una sola operación.
          </p>

          <div className="mt-4 inline-flex items-center gap-2 rounded-full border border-emerald-400/15 bg-emerald-400/5 px-3 py-1.5 text-[11px] font-semibold text-emerald-300">
            <ShieldCheck className="h-3.5 w-3.5" />
            <span>Acceso seguro · MySQL + JWT</span>
            <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />
          </div>
        </div>
      </div>

      <div className="border-t border-white/5 bg-slate-900/55 px-6 py-6 sm:px-8">
        {currentUser ? (
          <div className="space-y-4">
            <div className="rounded-2xl border border-emerald-400/15 bg-emerald-400/5 p-4">
              <div className="mb-3 flex items-center gap-2 text-xs font-bold text-emerald-300">
                <CheckCircle2 className="h-4 w-4" /> Sesión activa
              </div>
              <p className="truncate text-base font-black text-white">{currentUser.nombre}</p>
              <p className="mt-1 truncate text-xs text-slate-400">{currentUser.email}</p>
              <span className="mt-3 inline-block rounded-lg bg-slate-950/70 px-2.5 py-1 text-[10px] font-bold uppercase tracking-wide text-slate-300">
                {getRoleLabel(currentUser.rol)}
              </span>
            </div>

            <button
              type="button"
              onClick={handleLogout}
              className="flex w-full items-center justify-center gap-2 rounded-2xl border border-red-400/20 bg-red-500/10 px-4 py-3 text-sm font-bold text-red-300 transition active:scale-[0.98]"
            >
              <LogOut className="h-4 w-4" /> Cerrar sesión
            </button>
          </div>
        ) : (
          <form onSubmit={handleFormSubmit} className="space-y-4">
            <div>
              <label className="mb-2 flex items-center gap-2 text-xs font-bold text-slate-300">
                <Mail className="h-4 w-4 text-emerald-400" /> Correo electrónico
              </label>
              <input
                type="email"
                autoComplete="email"
                inputMode="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="nombre@empresa.com"
                className="w-full rounded-2xl border border-slate-700/70 bg-slate-950 px-4 py-3.5 text-sm text-white outline-none transition placeholder:text-slate-600 focus:border-emerald-400/70 focus:ring-4 focus:ring-emerald-400/10"
              />
            </div>

            <div>
              <label className="mb-2 flex items-center gap-2 text-xs font-bold text-slate-300">
                <Lock className="h-4 w-4 text-emerald-400" /> Contraseña
              </label>
              <div className="relative">
                <input
                  type={showPassword ? 'text' : 'password'}
                  autoComplete="current-password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Escribe tu contraseña"
                  className="w-full rounded-2xl border border-slate-700/70 bg-slate-950 px-4 py-3.5 pr-12 text-sm text-white outline-none transition placeholder:text-slate-600 focus:border-emerald-400/70 focus:ring-4 focus:ring-emerald-400/10"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((value) => !value)}
                  aria-label={showPassword ? 'Ocultar contraseña' : 'Mostrar contraseña'}
                  className="absolute inset-y-0 right-0 flex w-12 items-center justify-center text-slate-500 transition hover:text-slate-300"
                >
                  {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>

            {errorMsg && (
              <div className="flex items-start gap-2 rounded-2xl border border-red-400/20 bg-red-500/10 p-3 text-xs leading-5 text-red-200">
                <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
                <span>{errorMsg}</span>
              </div>
            )}

            <button
              type="submit"
              disabled={isLoading}
              className="mt-2 flex w-full items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-emerald-500 to-teal-500 px-4 py-3.5 text-sm font-black text-slate-950 shadow-lg shadow-emerald-500/15 transition active:scale-[0.98] disabled:cursor-wait disabled:opacity-60"
            >
              {isLoading ? (
                <><RefreshCw className="h-4 w-4 animate-spin" /> Validando acceso...</>
              ) : (
                <><LogIn className="h-4 w-4" /> Entrar a BITALIS</>
              )}
            </button>

            <p className="pt-1 text-center text-[10px] leading-4 text-slate-500">
              Credenciales protegidas por autenticación de servidor. La contraseña no se guarda en el dispositivo.
            </p>
          </form>
        )}
      </div>
    </div>
  );
}
