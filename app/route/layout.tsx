'use client';

import { ReactNode, useEffect, useState } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { ClipboardCheck, Flag, ShieldCheck } from 'lucide-react';

export default function RouteLayout({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const [routeFinished, setRouteFinished] = useState(false);

  useEffect(() => {
    if (pathname !== '/route') {
      setRouteFinished(false);
      return;
    }

    const detectFinished = () => {
      const text = document.body?.innerText || '';
      const finished = text.includes('Ruta completada') || text.includes('No quedan créditos con GPS');
      setRouteFinished(finished);
    };

    detectFinished();
    const observer = new MutationObserver(detectFinished);
    observer.observe(document.body, { subtree: true, childList: true, characterData: true });
    return () => observer.disconnect();
  }, [pathname]);

  return (
    <>
      {children}

      {pathname === '/route' && routeFinished && (
        <div className="fixed inset-x-0 bottom-0 z-[70] border-t border-emerald-400/20 bg-slate-950/95 p-3 shadow-2xl shadow-black/50 backdrop-blur-xl sm:p-4">
          <div className="mx-auto flex max-w-5xl flex-col gap-3 rounded-[22px] border border-emerald-400/15 bg-gradient-to-r from-slate-900 to-emerald-950/30 p-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-start gap-3">
              <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-emerald-500 text-slate-950">
                <Flag className="h-5 w-5" />
              </div>
              <div>
                <div className="flex items-center gap-2 text-[10px] font-black uppercase tracking-[.14em] text-emerald-300">
                  <ShieldCheck className="h-3.5 w-3.5" /> Ruta terminada
                </div>
                <p className="mt-1 text-sm font-black text-white">Finaliza la jornada y realiza el arqueo</p>
                <p className="mt-1 text-[11px] leading-5 text-slate-500">Cuenta el efectivo, compara contra la caja esperada y registra el cierre con GPS.</p>
              </div>
            </div>
            <button
              onClick={() => router.push('/route/close')}
              className="flex min-h-12 items-center justify-center gap-2 rounded-2xl bg-emerald-500 px-5 py-3 text-sm font-black text-slate-950 transition hover:bg-emerald-400"
            >
              <ClipboardCheck className="h-5 w-5" /> Finalizar ruta y hacer arqueo
            </button>
          </div>
        </div>
      )}

      {pathname === '/route' && !routeFinished && (
        <button
          onClick={() => router.push('/route/close')}
          className="fixed bottom-4 right-4 z-40 flex items-center gap-2 rounded-2xl border border-slate-700 bg-slate-900/95 px-4 py-3 text-[11px] font-black text-slate-300 shadow-xl backdrop-blur hover:border-emerald-400/30 hover:text-emerald-300"
        >
          <ClipboardCheck className="h-4 w-4" /> Cerrar jornada
        </button>
      )}
    </>
  );
}
