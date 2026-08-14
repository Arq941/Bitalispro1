'use client';

import { useEffect, useRef } from 'react';
import { usePathname } from 'next/navigation';

type WakeLockSentinelLike = {
  released?: boolean;
  release: () => Promise<void>;
  addEventListener?: (type: string, listener: () => void) => void;
};

export default function RouteFieldMode() {
  const pathname = usePathname();
  const wakeRef = useRef<WakeLockSentinelLike | null>(null);
  const isFieldScreen = pathname === '/route' || pathname === '/route/navigate' || pathname === '/route/map';

  const releaseWakeLock = async () => {
    const current = wakeRef.current;
    wakeRef.current = null;
    if (current) {
      try { await current.release(); } catch {}
    }
  };

  const requestWakeLock = async () => {
    if (!isFieldScreen || document.visibilityState !== 'visible' || wakeRef.current) return;
    const nav = navigator as Navigator & { wakeLock?: { request: (type: 'screen') => Promise<WakeLockSentinelLike> } };
    if (!nav.wakeLock?.request) return;
    try {
      const sentinel = await nav.wakeLock.request('screen');
      wakeRef.current = sentinel;
      sentinel.addEventListener?.('release', () => { wakeRef.current = null; });
    } catch {}
  };

  useEffect(() => {
    if (!isFieldScreen) {
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
  }, [isFieldScreen, pathname]);

  return null;
}
