'use client';

import { FormEvent, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Eye, EyeOff, Loader2, LockKeyhole, Mail, ShieldCheck } from 'lucide-react';
import BitalisLogo from '@/components/BitalisLogo';

export default function ProductionLoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    const removeLegacyPwa = async () => {
      try {
        if ('serviceWorker' in navigator) {
          const registrations = await navigator.serviceWorker.getRegistrations();
          await Promise.all(registrations.map((registration) => registration.unregister()));
        }
        if ('caches' in window) {
          const keys = await caches.keys();
          await Promise.all(keys.map((key) => caches.delete(key)));
        }

        const legacyKeys = [
          'pwa_session_user',
          'pwa_session_tab',
          'pwa_clientes',
          'pwa_ventas',
          'pwa_abonos',
          'pwa_cortes',
          'pwa_productos',
          'pwa_zonas',
          'pwa_usuarios',
          'pwa_audit_logs',
          'pwa_clean_db_v2',
          'bitalis_guide_disabled',
        ];
        legacyKeys.forEach((key) => localStorage.removeItem(key));
      } catch (cleanupError) {
        console.warn('No fue posible limpiar completamente el caché legacy:', cleanupError);
      }
    };

    removeLegacyPwa().finally(() => {
      const token = localStorage.getItem('bitalis_access_token');
      const user = localStorage.getItem('bitalis_auth_user');
      if (token && user) router.replace('/dashboard');
    });
  }, [router]);

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    if (!email.trim() || !password) {
      setError('Ingresa correo y contraseña.');
      return;
    }

    setLoading(true);
    setError('');
    try {
      const response = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' },
        cache: 'no-store',
        body: JSON.stringify({ email: email.trim(), password }),
      });
      const json = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(json?.error || json?.message || 'Credenciales inválidas.');

      const accessToken = json?.accessToken || json?.access_token || json?.tokens?.accessToken;
      const refreshToken = json?.refreshToken || json?.refresh_token || json?.tokens?.refreshToken;
      const user = json?.user;
      if (!accessToken || !user) throw new Error('La sesión no devolvió los datos esperados.');

      localStorage.setItem('bitalis_access_token', accessToken);
      if (refreshToken) localStorage.setItem('bitalis_refresh_token', refreshToken);
      localStorage.setItem('bitalis_auth_user', JSON.stringify(user));
      router.replace('/dashboard');
    } catch (err: any) {
      setError(err?.message || 'No fue posible iniciar sesión.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="relative flex min-h-screen items-center justify-center overflow-hidden bg-slate-950 px-4 py-10 text-slate-100">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(16,185,129,0.12),transparent_32%),radial-gradient(circle_at_bottom_left,rgba(14,165,233,0.08),transparent_30%)]" />
      <section className="relative w-full max-w-md overflow-hidden rounded-[30px] border border-white/10 bg-slate-900/90 p-6 shadow-2xl shadow-black/40 backdrop-blur-xl sm:p-8">
        <div className="mb-8 flex flex-col items-center text-center">
          <BitalisLogo size="lg" variant="dark" />
          <div className="mt-5 inline-flex items-center gap-2 rounded-full border border-emerald-400/15 bg-emerald-400/5 px-3 py-1.5 text-[10px] font-black uppercase tracking-[0.16em] text-emerald-300">
            <ShieldCheck className="h-3.5 w-3.5" /> Producción segura
          </div>
          <h1 className="mt-4 text-2xl font-black tracking-tight text-white">Acceso BITALIS</h1>
          <p className="mt-2 text-sm leading-6 text-slate-500">Sistema operativo conectado a MySQL mediante Prisma y autenticación JWT.</p>
        </div>

        {error && <div className="mb-4 rounded-2xl border border-red-400/20 bg-red-500/10 p-3 text-xs font-semibold text-red-200">{error}</div>}

        <form onSubmit={submit} className="space-y-4">
          <label className="block">
            <span className="mb-2 block text-xs font-bold text-slate-300">Correo electrónico</span>
            <div className="relative">
              <Mail className="absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-600" />
              <input type="email" autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} className="w-full rounded-2xl border border-slate-800 bg-slate-950 py-3.5 pl-10 pr-4 text-sm text-white outline-none transition focus:border-emerald-500/50" placeholder="usuario@bitalis.mx" />
            </div>
          </label>

          <label className="block">
            <span className="mb-2 block text-xs font-bold text-slate-300">Contraseña</span>
            <div className="relative">
              <LockKeyhole className="absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-600" />
              <input type={showPassword ? 'text' : 'password'} autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} className="w-full rounded-2xl border border-slate-800 bg-slate-950 py-3.5 pl-10 pr-11 text-sm text-white outline-none transition focus:border-emerald-500/50" placeholder="••••••••" />
              <button type="button" onClick={() => setShowPassword((value) => !value)} className="absolute right-3 top-1/2 -translate-y-1/2 p-1 text-slate-600 hover:text-slate-300" aria-label={showPassword ? 'Ocultar contraseña' : 'Mostrar contraseña'}>
                {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
          </label>

          <button type="submit" disabled={loading} className="mt-2 flex w-full items-center justify-center gap-2 rounded-2xl bg-emerald-500 px-4 py-3.5 text-sm font-black text-slate-950 shadow-lg shadow-emerald-500/10 transition hover:bg-emerald-400 disabled:cursor-not-allowed disabled:opacity-60">
            {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <ShieldCheck className="h-4 w-4" />}
            {loading ? 'Ingresando...' : 'Ingresar'}
          </button>
        </form>

        <div className="mt-6 border-t border-white/5 pt-5 text-center text-[10px] text-slate-600">BITALIS · MySQL · Prisma · JWT</div>
      </section>
    </main>
  );
}
