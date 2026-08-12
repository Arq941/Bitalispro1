'use client';

import { ReactNode, useEffect, useState } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { ClipboardCheck, Flag, MapPinned, Navigation, Route, ShieldCheck } from 'lucide-react';
import RouteEvidenceDrawer from '@/components/route/RouteEvidenceDrawer';
import RouteQuickActions from '@/components/route/RouteQuickActions';

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

  const nav = [
    { href: '/route', label: 'Cobranza', icon: Route },
    { href: '/route/navigate', label: 'Navegar', icon: Navigation },
    { href: '/route/map', label: 'Mapa', icon: MapPinned },
    { href: '/route/close', label: 'Cierre', icon: ClipboardCheck },
  ];

  const showEvidence = pathname === '/route' || pathname === '/route/navigate' || pathname === '/route/map';
  const showQuickActions = pathname === '/route' && !routeFinished;

  return (
    <>
      {children}
      {showEvidence && !routeFinished && <RouteEvidenceDrawer />}
      {showQuickActions && <RouteQuickActions />}

      {pathname === '/route' && routeFinished ? (
        <div className="fixed inset-x-0 bottom-0 z-[90] border-t border-emerald-400/20 bg-slate-950/95 p-3 shadow-2xl shadow-black/50 backdrop-blur-xl sm:p-4">
          <div className="mx-auto flex max-w-5xl flex-col gap-3 rounded-[22px] border border-emerald-400/15 bg-gradient-to-r from-slate-900 to-emerald-950/30 p-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-start gap-3">
              <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-emerald-500 text-slate-950"><Flag className="h-5 w-5" /></div>
              <div><div className="flex items-center gap-2 text-[10px] font-black uppercase tracking-[.14em] text-emerald-300"><ShieldCheck className="h-3.5 w-3.5" /> Ruta terminada</div><p className="mt-1 text-sm font-black text-white">Finaliza la jornada y realiza el arqueo</p><p className="mt-1 text-[11px] leading-5 text-slate-500">Cuenta el efectivo, compara contra la caja esperada y registra el cierre con GPS.</p></div>
            </div>
            <button onClick={() => router.push('/route/close')} className="flex min-h-12 items-center justify-center gap-2 rounded-2xl bg-emerald-500 px-5 py-3 text-sm font-black text-slate-950 transition hover:bg-emerald-400"><ClipboardCheck className="h-5 w-5" /> Finalizar ruta y hacer arqueo</button>
          </div>
        </div>
      ) : (
        <nav className="fixed bottom-3 left-1/2 z-[80] w-[calc(100%-24px)] max-w-lg -translate-x-1/2 rounded-2xl border border-white/10 bg-slate-950/95 p-1.5 shadow-2xl shadow-black/40 backdrop-blur-xl print:hidden">
          <div className="grid grid-cols-4 gap-1">
            {nav.map(({ href, label, icon: Icon }) => {
              const active = href === '/route' ? pathname === '/route' : pathname.startsWith(href);
              return <button key={href} type="button" onClick={() => router.push(href)} className={`flex min-h-12 flex-col items-center justify-center gap-1 rounded-xl px-2 text-[10px] font-black transition sm:flex-row sm:gap-2 sm:text-xs ${active ? 'bg-emerald-500 text-slate-950' : 'text-slate-400 hover:bg-slate-900 hover:text-white'}`}><Icon className="h-4 w-4" />{label}</button>;
            })}
          </div>
        </nav>
      )}
      <div className={pathname === '/route' && !routeFinished ? 'h-40 print:hidden sm:h-20' : 'h-20 print:hidden'} />
    </>
  );
}
