'use client';

import { FormEvent, useEffect, useState } from 'react';
import { flushSync } from 'react-dom';
import { useRouter } from 'next/navigation';
import { Eye, EyeOff, Loader2, LockKeyhole, Mail, ShieldCheck, Wifi, WifiOff } from 'lucide-react';
import BitalisLogo from '@/components/BitalisLogo';
import {usePrimeAuthenticatedShellSession} from '@/components/phase15/AppShell';
import {getAuthenticatedLandingRoute} from '@/lib/auth/landingRoute';
import {traceAuthTransition} from '@/lib/ux/authTransitionTrace';

const permissionCacheKey='bitalis_effective_permissions';
type SessionUser={id:string;role:string;firstName?:string;lastName?:string;email?:string};
type EntrySource='login'|'restore';

function dismissAndroidKeyboard(){
  try{
    const active=document.activeElement;
    if(active instanceof HTMLElement)active.blur();
    const virtualKeyboard=(navigator as Navigator&{virtualKeyboard?:{hide?:()=>void}}).virtualKeyboard;
    virtualKeyboard?.hide?.();
  }catch{}
}

const nextPaint=()=>new Promise<void>(resolve=>requestAnimationFrame(()=>resolve()));
async function waitForColdRouter(){
  if(document.readyState!=='complete'){
    await new Promise<void>(resolve=>window.addEventListener('load',()=>resolve(),{once:true}));
  }
  await nextPaint();
  await nextPaint();
}

export default function ProductionLoginPage() {
  const router = useRouter();
  const primeAuthenticatedSession = usePrimeAuthenticatedShellSession();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [online, setOnline] = useState(true);

  const primeAuthenticatedApp=async(accessToken:string):Promise<string[]|null>=>{
    try{
      const response=await fetch('/api/auth/permissions',{
        headers:{Authorization:`Bearer ${accessToken}`,'Cache-Control':'no-store'},
        cache:'no-store',
      });
      if(!response.ok)return null;
      const json=await response.json().catch(()=>({}));
      const codes=Array.isArray(json?.permissionCodes)?json.permissionCodes.map(String):[];
      sessionStorage.setItem(permissionCacheKey,JSON.stringify(codes));
      return codes;
    }catch{return null;}
  };

  const enterAuthenticatedApp=async(user:SessionUser,permissionCodes:string[],source:EntrySource)=>{
    const destination=getAuthenticatedLandingRoute(permissionCodes);
    router.prefetch(destination);
    dismissAndroidKeyboard();
    flushSync(()=>{
      primeAuthenticatedSession?.(user,permissionCodes);
    });
    if(source==='restore')await waitForColdRouter();
    else await nextPaint();
    traceAuthTransition('auth-enter-router-replace',{source,destination});
    router.replace(destination);
  };

  useEffect(() => {
    setOnline(navigator.onLine);
    const onOnline = () => setOnline(true);
    const onOffline = () => setOnline(false);
    window.addEventListener('online', onOnline);
    window.addEventListener('offline', onOffline);

    const token = localStorage.getItem('bitalis_access_token');
    const rawUser = localStorage.getItem('bitalis_auth_user');
    if (token && rawUser) {
      try {
        const storedUser=JSON.parse(rawUser) as SessionUser;
        void primeAuthenticatedApp(token).then((permissionCodes)=>{
          if(permissionCodes===null){
            setError('No pudimos validar los permisos de esta sesión. Revisa tu conexión e intenta nuevamente.');
            return;
          }
          void enterAuthenticatedApp(storedUser,permissionCodes,'restore');
        });
      } catch {}
    }

    return () => {
      window.removeEventListener('online', onOnline);
      window.removeEventListener('offline', onOffline);
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [router, primeAuthenticatedSession]);

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    if (!online) { setError('Sin conexión. Conéctate a internet para iniciar sesión.'); return; }
    if (!email.trim() || !password) { setError('Ingresa correo y contraseña.'); return; }

    dismissAndroidKeyboard();
    setLoading(true);
    setError('');
    try {
      navigator.vibrate?.(18);
      const response = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Cache-Control':'no-store' },
        cache: 'no-store',
        body: JSON.stringify({ email: email.trim(), password }),
      });
      const json = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(json?.error || json?.message || 'Credenciales inválidas o cuenta inaccesible.');

      const accessToken = json?.accessToken || json?.access_token || json?.tokens?.accessToken;
      const refreshToken = json?.refreshToken || json?.refresh_token || json?.tokens?.refreshToken;
      const user = json?.user as SessionUser|undefined;
      if (!accessToken || !user) throw new Error('No pudimos iniciar la sesión. Intenta nuevamente.');

      localStorage.setItem('bitalis_access_token', accessToken);
      if (refreshToken) localStorage.setItem('bitalis_refresh_token', refreshToken);
      localStorage.setItem('bitalis_auth_user', JSON.stringify(user));

      const permissionCodes=await primeAuthenticatedApp(accessToken);
      if(permissionCodes===null)throw new Error('La sesión inició, pero no pudimos validar sus permisos. Revisa tu conexión e intenta nuevamente.');
      navigator.vibrate?.([24, 30, 24]);
      await enterAuthenticatedApp(user,permissionCodes,'login');
    } catch (err: any) {
      navigator.vibrate?.(55);
      setError(err?.message || 'No fue posible iniciar sesión.');
      setLoading(false);
    }
  };

  return (
    <main className="relative flex min-h-[100svh] items-center justify-center overflow-hidden bg-[var(--bitalis-bg)] px-4 py-6 text-[var(--bitalis-text)] sm:py-10">
      <section className="relative w-full max-w-[430px] overflow-hidden rounded-[30px] border border-[var(--bitalis-border)] bg-white p-5 shadow-[0_18px_48px_rgba(6,43,36,.10)] sm:p-8">
        <div className="mb-7 flex flex-col items-center text-center">
          <BitalisLogo size="lg" />
          <div className={`mt-5 inline-flex min-h-8 items-center gap-2 rounded-full px-3 text-[10px] font-black uppercase tracking-[.14em] ${online?'bg-emerald-50 text-emerald-700':'bg-red-50 text-red-700'}`}>
            {online ? <Wifi className="h-3.5 w-3.5"/> : <WifiOff className="h-3.5 w-3.5"/>}
            {online ? 'Conectado' : 'Sin conexión'}
          </div>
          <h1 className="mt-4 text-2xl font-black tracking-tight text-[var(--bitalis-primary)]">Bienvenido a BITALIS</h1>
          <p className="mt-2 max-w-xs text-sm leading-6 text-slate-500">Ventas, cobranza en ruta y operación de campo en una sola aplicación.</p>
        </div>

        {error && <div role="alert" className="mb-4 rounded-2xl border border-red-100 bg-red-50 p-3 text-xs font-bold leading-5 text-red-700">{error}</div>}

        <form onSubmit={submit} className="space-y-4">
          <label className="block">
            <span className="mb-2 block text-xs font-black text-[var(--bitalis-primary)]">Correo o usuario</span>
            <div className="relative">
              <Mail className="absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <input type="email" inputMode="email" autoCapitalize="none" autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} className="min-h-14 w-full rounded-2xl border border-[var(--bitalis-border)] bg-[var(--bitalis-bg)] pl-11 pr-4 text-base outline-none focus:border-[var(--bitalis-action)] focus:bg-white focus:ring-4 focus:ring-emerald-500/10" placeholder="usuario@bitalis.mx" />
            </div>
          </label>

          <label className="block">
            <span className="mb-2 block text-xs font-black text-[var(--bitalis-primary)]">Contraseña</span>
            <div className="relative">
              <LockKeyhole className="absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <input type={showPassword ? 'text' : 'password'} autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} className="min-h-14 w-full rounded-2xl border border-[var(--bitalis-border)] bg-[var(--bitalis-bg)] pl-11 pr-14 text-base outline-none focus:border-[var(--bitalis-action)] focus:bg-white focus:ring-4 focus:ring-emerald-500/10" placeholder="••••••••" />
              <button type="button" onClick={() => { navigator.vibrate?.(10); setShowPassword((value) => !value); }} className="absolute right-2 top-1/2 flex h-10 w-10 -translate-y-1/2 items-center justify-center rounded-xl text-slate-500 active:scale-90" aria-label={showPassword ? 'Ocultar contraseña' : 'Mostrar contraseña'}>
                {showPassword ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
              </button>
            </div>
          </label>

          <button type="submit" disabled={loading || !online} className="mt-2 flex min-h-14 w-full touch-manipulation items-center justify-center gap-2 rounded-2xl bg-[var(--bitalis-action)] px-4 text-sm font-black text-white shadow-[0_10px_24px_rgba(17,166,90,.18)] active:scale-[.98] disabled:cursor-not-allowed disabled:opacity-50">
            {loading ? <Loader2 className="h-5 w-5 animate-spin" /> : <ShieldCheck className="h-5 w-5" />}
            {loading ? 'PREPARANDO BITALIS…' : 'INICIAR SESIÓN'}
          </button>
        </form>

        <div className="mt-6 border-t border-slate-100 pt-5 text-center text-[10px] font-bold uppercase tracking-[.12em] text-slate-400">BITALIS · Operación segura</div>
      </section>
    </main>
  );
}
