'use client';

import { Camera, CalendarClock, Navigation, WalletCards, XCircle, Clock3, X, CheckCircle2 } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useState } from 'react';

function buttons() {
  return Array.from(document.querySelectorAll('button')) as HTMLButtonElement[];
}

function clickButton(label: string) {
  const target = buttons().find((b) =>
    (b.innerText || '').trim().toLowerCase().includes(label.toLowerCase())
  );
  if (!target) return false;
  target.click();
  target.scrollIntoView({ behavior: 'smooth', block: 'center' });
  return true;
}

function setNativeValue(el: HTMLInputElement | HTMLSelectElement, value: string) {
  const proto = el instanceof HTMLSelectElement ? HTMLSelectElement.prototype : HTMLInputElement.prototype;
  const setter = Object.getOwnPropertyDescriptor(proto, 'value')?.set;
  setter?.call(el, value);
  el.dispatchEvent(new Event('input', { bubbles: true }));
  el.dispatchEvent(new Event('change', { bubbles: true }));
}

const reasons = [
  ['NO_TENIA_DINERO', 'No tenía dinero'],
  ['NO_ESTABA', 'No estaba'],
  ['ESTA_DE_VIAJE', 'Está de viaje'],
  ['PROBLEMA_FAMILIAR', 'Problema familiar'],
  ['RECHAZO_PAGAR', 'Rechazó pagar'],
  ['OTRO', 'Otro'],
] as const;

function parseSaldoActual(text: string) {
  const match = text.match(/Saldo actual\s*\$([\d,.]+)/i);
  if (!match?.[1]) return null;
  const value = Number(match[1].replace(/,/g, ''));
  return Number.isFinite(value) ? value : null;
}

export default function RouteQuickActions() {
  const router = useRouter();
  const [panel, setPanel] = useState<'none' | 'noPay' | 'reschedule'>('none');
  const [reason, setReason] = useState('NO_TENIA_DINERO');
  const [date, setDate] = useState('');

  const openPhotos = () => window.dispatchEvent(new Event('bitalis:open-evidence'));

  const enhancePayment = () => {
    if (!clickButton('Registrar abono')) return;
    window.setTimeout(() => {
      const confirmButton = buttons().find((b) =>
        (b.innerText || '').toLowerCase().includes('confirmar abono')
      );
      const dialog = confirmButton?.closest('div.fixed');
      if (!dialog || dialog.querySelector('[data-bitalis-quick-pay]')) return;
      const input = dialog.querySelector('input[inputmode="decimal"]') as HTMLInputElement | null;
      if (!input) return;
      const saldoActual = parseSaldoActual(dialog.textContent || '');
      const wrap = document.createElement('div');
      wrap.setAttribute('data-bitalis-quick-pay', 'true');
      wrap.className = 'mt-3 grid grid-cols-4 gap-2';
      [100, 150, 200, 300].forEach((amount) => {
        const quickButton = document.createElement('button');
        quickButton.type = 'button';
        quickButton.textContent = `$${amount}`;
        quickButton.className = 'min-h-11 rounded-xl border border-emerald-400/20 bg-emerald-500/10 text-xs font-black text-emerald-200';
        quickButton.onclick = () => {
          const safeAmount = saldoActual == null ? amount : Math.min(amount, saldoActual);
          setNativeValue(input, String(safeAmount));
        };
        wrap.appendChild(quickButton);
      });
      input.insertAdjacentElement('afterend', wrap);
    }, 80);
  };

  const submitNoPay = () => {
    const select = document.querySelector('select') as HTMLSelectElement | null;
    if (select) setNativeValue(select, reason);
    window.setTimeout(() => {
      clickButton('No pagó');
      setPanel('none');
    }, 50);
  };

  const submitReschedule = () => {
    if (!date) return;
    const input = document.querySelector('input[type="date"]') as HTMLInputElement | null;
    const selects = Array.from(document.querySelectorAll('select')) as HTMLSelectElement[];
    const reasonSelect = selects.find((s) =>
      Array.from(s.options).some((o) => o.value === 'PROMESA_PAGO')
    );
    if (input) setNativeValue(input, date);
    if (reasonSelect) setNativeValue(reasonSelect, 'PROMESA_PAGO');
    window.setTimeout(() => {
      clickButton('Reagendar');
      setPanel('none');
    }, 80);
  };

  return (
    <>
      <div className="fixed inset-x-0 bottom-[76px] z-[78] px-2 print:hidden sm:hidden">
        <div className="mx-auto grid max-w-md grid-cols-5 gap-1 rounded-[20px] border border-white/10 bg-slate-950/96 p-1.5 shadow-2xl shadow-black/35 backdrop-blur-xl">
          <DockButton label="COBRAR" onClick={enhancePayment} primary><WalletCards className="h-4 w-4" /></DockButton>
          <DockButton label="NO PAGÓ" onClick={() => setPanel('noPay')} tone="orange"><XCircle className="h-4 w-4" /></DockButton>
          <DockButton label="PROMESA" onClick={() => setPanel('reschedule')} tone="blue"><CalendarClock className="h-4 w-4" /></DockButton>
          <DockButton label="FOTOS" onClick={openPhotos} tone="orange"><Camera className="h-4 w-4" /></DockButton>
          <DockButton label="NAVEGAR" onClick={() => router.push('/route/navigate')} light><Navigation className="h-4 w-4" /></DockButton>
        </div>
      </div>

      {panel !== 'none' && (
        <div className="fixed inset-0 z-[115] flex items-end bg-slate-950/80 backdrop-blur-sm sm:hidden" onClick={() => setPanel('none')}>
          <section onClick={(e) => e.stopPropagation()} className="w-full rounded-t-[30px] border border-white/10 bg-slate-950 p-4 pb-7 text-white shadow-2xl">
            <div className="mx-auto mb-4 h-1 w-10 rounded-full bg-slate-700" />
            <div className="flex items-center justify-between">
              <div><p className="text-[10px] font-black uppercase tracking-[.14em] text-[#C79A3B]">Visita rápida</p><h2 className="mt-1 text-xl font-black">{panel === 'noPay' ? '¿Qué ocurrió?' : 'Promesa / reagendar'}</h2></div>
              <button type="button" onClick={() => setPanel('none')} className="flex h-11 w-11 items-center justify-center rounded-2xl bg-slate-900" aria-label="Cerrar"><X className="h-5 w-5" /></button>
            </div>
            {panel === 'noPay' ? (
              <>
                <div className="mt-4 grid grid-cols-2 gap-2">
                  {reasons.map(([value, label]) => (
                    <button key={value} type="button" onClick={() => setReason(value)} className={`min-h-14 rounded-2xl border px-3 text-left text-xs font-black ${reason === value ? 'border-orange-400 bg-orange-500/15 text-orange-200' : 'border-slate-800 bg-slate-900 text-slate-300'}`}>{label}</button>
                  ))}
                </div>
                <button type="button" onClick={submitNoPay} className="mt-4 flex min-h-14 w-full items-center justify-center gap-2 rounded-2xl bg-[#FF6A00] text-sm font-black text-white"><CheckCircle2 className="h-5 w-5" />GUARDAR Y SIGUIENTE</button>
              </>
            ) : (
              <>
                <div className="mt-4 rounded-2xl border border-blue-400/15 bg-blue-500/5 p-4">
                  <div className="flex items-center gap-2 text-xs font-black text-blue-200"><Clock3 className="h-4 w-4" />Fecha prometida / nueva visita</div>
                  <input type="date" value={date} onChange={(e) => setDate(e.target.value)} className="mt-3 min-h-14 w-full rounded-2xl border border-slate-700 bg-slate-900 px-4 text-base font-black text-white" />
                </div>
                <button type="button" disabled={!date} onClick={submitReschedule} className="mt-4 flex min-h-14 w-full items-center justify-center gap-2 rounded-2xl bg-blue-500 text-sm font-black text-white disabled:opacity-40"><CalendarClock className="h-5 w-5" />GUARDAR PROMESA Y SIGUIENTE</button>
              </>
            )}
          </section>
        </div>
      )}
    </>
  );
}

function DockButton({label,onClick,children,primary=false,light=false,tone}:{label:string;onClick:()=>void;children:React.ReactNode;primary?:boolean;light?:boolean;tone?:'orange'|'blue'}){
  const style=primary?'bg-emerald-500 text-slate-950':light?'bg-white text-slate-950':tone==='blue'?'border border-blue-400/20 bg-blue-500/10 text-blue-200':'border border-orange-400/20 bg-orange-500/10 text-orange-200';
  return <button type="button" onClick={onClick} className={`min-w-0 rounded-2xl ${style} flex min-h-13 flex-col items-center justify-center gap-1 px-1 py-2`}><span className="shrink-0">{children}</span><span className="w-full truncate text-center text-[8px] font-black leading-none tracking-tight">{label}</span></button>;
}
