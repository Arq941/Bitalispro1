'use client';

import { Eye, EyeOff, Smartphone, SunMedium } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { usePathname } from 'next/navigation';

type WakeLockSentinelLike = {
  released?: boolean;
  release: () => Promise<void>;
  addEventListener?: (type: string, listener: () => void) => void;
};

export default function RouteFieldMode() {
  const pathname = usePathname();
  const [enabled, setEnabled] = useState(true);
  const [wakeActive, setWakeActive] = useState(false);
  const wakeRef = useRef<WakeLockSentinelLike | null>(null);
  const isFieldScreen = pathname === '/route' || pathname === '/route/navigate' || pathname === '/route/map';

  const releaseWakeLock = async () => {
    const current = wakeRef.current;
    wakeRef.current = null;
    if (current) {
      try { await current.release(); } catch {}
    }
    setWakeActive(false);
  };

  const requestWakeLock = async () => {
    if (!enabled || !isFieldScreen || document.visibilityState !== 'visible') return;
    const nav = navigator as Navigator & { wakeLock?: { request: (type: 'screen') => Promise<WakeLockSentinelLike> } };
    if (!nav.wakeLock?.request) return;
    try {
      const sentinel = await nav.wakeLock.request('screen');
      wakeRef.current = sentinel;
      setWakeActive(true);
      sentinel.addEventListener?.('release', () => setWakeActive(false));
    } catch {
      setWakeActive(false);
    }
  };

  useEffect(() => {
    if (!isFieldScreen || !enabled) {
      void releaseWakeLock();
      return;
    }
    void requestWakeLock();
    const onVisibility = () => {
      if (document.visibilityState === 'visible') void requestWakeLock();
      else void releaseWakeLock();
    };
    document.addEventListener('visibilitychange', onVisibility);
    return () => {
      document.removeEventListener('visibilitychange', onVisibility);
      void releaseWakeLock();
    };
  }, [enabled, isFieldScreen, pathname]);

  if (!isFieldScreen) return null;

  return (
    <button
      type="button"
      onClick={() => setEnabled((value) => !value)}
      className="fixed left-3 top-[72px] z-[72] flex min-h-10 items-center gap-2 rounded-2xl border border-white/10 bg-slate-950/90 px-3 py-2 text-[10px] font-black text-slate-200 shadow-xl backdrop-blur-xl print:hidden"
      aria-pressed={enabled}
      aria-label={enabled ? 'Desactivar modo calle' : 'Activar modo calle'}
      title="Modo calle mantiene la pantalla activa cuando el navegador lo permite"
    >
      {enabled ? <Eye className="h-4 w-4 text-emerald-300" /> : <EyeOff className="h-4 w-4 text-slate-500" />}
      <span>MODO CALLE</span>
      {enabled && (
        <span className={`flex items-center gap-1 rounded-full px-2 py-1 ${wakeActive ? 'bg-emerald-500/10 text-emerald-300' : 'bg-slate-800 text-slate-400'}`}>
          {wakeActive ? <SunMedium className="h-3 w-3" /> : <Smartphone className="h-3 w-3" />}
          {wakeActive ? 'ACTIVO' : 'LISTO'}
        </span>
      )}
    </button>
  );
}
