'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  AlertTriangle, Banknote, CheckCircle2, CircleDollarSign,
  ClipboardCheck, Loader2, MapPin, ReceiptText, ShieldAlert,
  ShieldCheck, WalletCards
} from 'lucide-react';
import { apiClient } from '@/lib/phase15/apiClient';

type AuthUser = { id: string; email: string; firstName?: string; lastName?: string; role: string };
type Movement = { id: string; type: string; amount: number | string; description?: string | null; createdAt?: string };
type CashSession = {
  id: string; status: string; openingFund: number | string; expectedCash: number | string;
  currentCash: number | string; countedCash?: number | string | null; varianceAmount?: number | string | null;
  openedAt?: string; movements?: Movement[];
};
type Denominations = Record<string, number>;

const money = new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN', minimumFractionDigits: 2 });
const DENOMS = [
  ['bills1000', 1000, '$1,000'], ['bills500', 500, '$500'], ['bills200', 200, '$200'],
  ['bills100', 100, '$100'], ['bills50', 50, '$50'], ['bills20', 20, '$20'],
  ['coins20', 20, '$20 moneda'], ['coins10', 10, '$10'], ['coins5', 5, '$5'],
  ['coins2', 2, '$2'], ['coins1', 1, '$1'],
] as const;

export default function CloseRoutePage() {
  const router = useRouter();
  const [user, setUser] = useState<AuthUser | null>(null);
  const [session, setSession] = useState<CashSession | null>(null);
  const [position, setPosition] = useState<{lat:number;lng:number} | null>(null);
  const [denominations, setDenominations] = useState<Denominations>({});
  const [countResult, setCountResult] = useState<any>(null);
  const [closingNotes, setClosingNotes] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [closed, setClosed] = useState(false);

  const getGps = () => {
    if (!navigator.geolocation) return;
    navigator.geolocation.getCurrentPosition(
      p => setPosition({ lat: p.coords.latitude, lng: p.coords.longitude }),
      () => setError('Activa la ubicación para cerrar la jornada con evidencia GPS.'),
      { enableHighAccuracy: true, timeout: 15000 }
    );
  };

  const load = async () => {
    const raw = localStorage.getItem('bitalis_auth_user');
    if (!raw) { router.replace('/'); return; }
    let parsed: AuthUser;
    try { parsed = JSON.parse(raw); } catch { router.replace('/'); return; }
    setUser(parsed); setLoading(true); setError('');
    try {
      const json = await apiClient<any>(`/api/cash-sessions/current?userId=${encodeURIComponent(parsed.id)}`);
      setSession(json?.data || null);
    } catch (e:any) {
      if (e?.status === 401) { router.replace('/'); return; }
      setError(e?.message || 'No fue posible cargar la caja actual.');
    } finally { setLoading(false); }
  };

  useEffect(() => { load(); getGps(); }, []);

  const totalCounted = useMemo(() => DENOMS.reduce((sum,[key,value]) => sum + Number(denominations[key] || 0) * value, 0), [denominations]);
  const expected = Number(session?.expectedCash || 0);
  const variance = totalCounted - expected;
  const movements = Array.isArray(session?.movements) ? session!.movements! : [];
  const cashPayments = movements.filter(m => m.type === 'PAYMENT').reduce((s,m) => s + Number(m.amount || 0), 0);
  const expenses = movements.filter(m => ['EXPENSE','WITHDRAWAL','REFUND'].includes(m.type)).reduce((s,m) => s + Number(m.amount || 0), 0);

  const saveCount = async () => {
    if (!session) { setError('No hay una caja abierta para arquear.'); return; }
    setSaving(true); setError(''); setNotice('');
    try {
      const json = await apiClient<any>('/api/cash-sessions/count', {
        method: 'POST',
        body: JSON.stringify({ cashSessionId: session.id, denominations }),
      });
      setCountResult(json?.data || json);
      setNotice('Arqueo guardado. Revisa la diferencia antes de cerrar la jornada.');
      await load();
    } catch (e:any) {
      if (e?.status === 401) { router.replace('/'); return; }
      setError(e?.message || 'No fue posible guardar el arqueo.');
    } finally { setSaving(false); }
  };

  const closeSession = async () => {
    if (!session) { setError('No hay una caja abierta.'); return; }
    if (!countResult && session.status !== 'COUNTING') { setError('Primero realiza y guarda el arqueo de efectivo.'); return; }
    if (!position) { setError('Activa GPS para cerrar la jornada.'); return; }
    setSaving(true); setError(''); setNotice('');
    try {
      const json = await apiClient<any>('/api/cash-sessions/close', {
        method: 'POST',
        body: JSON.stringify({
          cashSessionId: session.id,
          closingNotes: closingNotes || undefined,
          latitude: position.lat,
          longitude: position.lng,
          closedClientAt: new Date().toISOString(),
        }),
      });
      const status = json?.data?.status || json?.data?.session?.status || 'CLOSED';
      setClosed(true);
      setSession(json?.data?.session || session);
      if (status === 'PENDING_REVIEW') setNotice('Jornada enviada a revisión por diferencia de caja. La supervisión deberá autorizarla.');
      else setNotice('Jornada cerrada correctamente. Caja conciliada.');
    } catch (e:any) {
      if (e?.status === 401) { router.replace('/'); return; }
      setError(e?.message || 'No fue posible cerrar la jornada.');
    } finally { setSaving(false); }
  };

  return <div className="min-h-screen bg-[#062B24] text-white">
    <main className="mx-auto max-w-5xl px-3 pb-28 pt-3 sm:px-4 sm:pt-5">
      <section className="rounded-[28px] border border-[#70E5A6]/10 bg-gradient-to-br from-[#0B3D33] to-[#062B24] p-5 sm:p-7">
        <div className="inline-flex items-center gap-2 rounded-full border border-[#70E5A6]/15 bg-[#70E5A6]/5 px-3 py-1.5 text-[10px] font-black uppercase tracking-[.16em] text-[#70E5A6]"><ClipboardCheck className="h-3.5 w-3.5"/> Cierre de jornada</div>
        <h1 className="mt-4 text-2xl font-black text-white">Arqueo y cierre del cobrador</h1>
        <p className="mt-2 text-sm leading-6 text-emerald-100/75">Cuenta el efectivo físico, compara contra el esperado y deja evidencia GPS del cierre.</p>
      </section>

      {error && <div className="mt-4 flex gap-2 rounded-2xl border border-red-400/20 bg-red-500/10 p-4 text-sm text-red-200"><AlertTriangle className="h-5 w-5 shrink-0"/>{error}</div>}
      {notice && <div className="mt-4 flex gap-2 rounded-2xl border border-[#70E5A6]/20 bg-[#11A65A]/10 p-4 text-sm font-bold text-emerald-200"><CheckCircle2 className="h-5 w-5 shrink-0"/>{notice}</div>}

      {!session && !loading ? <section className="mt-5 rounded-[26px] border border-white/5 bg-[#0B3D33]/70 p-8 text-center"><WalletCards className="mx-auto h-9 w-9 text-emerald-100/40"/><h2 className="mt-3 text-lg font-black">No hay caja abierta</h2><p className="mt-2 text-sm text-emerald-100/55">Inicia una caja desde el modo cobrador antes de cerrar jornada.</p><button onClick={() => router.push('/route')} className="mt-5 min-h-12 rounded-xl bg-[#11A65A] px-5 py-3 text-xs font-black text-[#062B24] active:scale-95">Volver a ruta</button></section> : session && <>
        <section className="mt-5 grid grid-cols-2 gap-3 lg:grid-cols-4">
          <article className="rounded-2xl border border-white/5 bg-[#0B3D33]/70 p-4"><Banknote className="h-5 w-5 text-[#70E5A6]"/><p className="mt-3 text-[10px] font-bold uppercase text-emerald-100/55">Fondo inicial</p><p className="mt-1 text-xl font-black">{money.format(Number(session.openingFund||0))}</p></article>
          <article className="rounded-2xl border border-white/5 bg-[#0B3D33]/70 p-4"><CircleDollarSign className="h-5 w-5 text-[#70E5A6]"/><p className="mt-3 text-[10px] font-bold uppercase text-emerald-100/55">Cobros efectivo</p><p className="mt-1 text-xl font-black">{money.format(cashPayments)}</p></article>
          <article className="rounded-2xl border border-white/5 bg-[#0B3D33]/70 p-4"><ReceiptText className="h-5 w-5 text-orange-300"/><p className="mt-3 text-[10px] font-bold uppercase text-emerald-100/55">Salidas</p><p className="mt-1 text-xl font-black">{money.format(expenses)}</p></article>
          <article className="rounded-2xl border border-[#70E5A6]/10 bg-[#11A65A]/5 p-4"><ShieldCheck className="h-5 w-5 text-[#70E5A6]"/><p className="mt-3 text-[10px] font-bold uppercase text-emerald-100/55">Efectivo esperado</p><p className="mt-1 text-xl font-black text-[#70E5A6]">{money.format(expected)}</p></article>
        </section>

        <section className="mt-5 grid gap-5 lg:grid-cols-[1.1fr_.9fr]">
          <article className="rounded-[26px] border border-white/5 bg-[#0B3D33]/70 p-5">
            <h2 className="text-sm font-black text-white">Conteo por denominación</h2><p className="mt-1 text-xs text-emerald-100/55">Captura cuántas piezas tienes de cada denominación.</p>
            <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-3">
              {DENOMS.map(([key,value,label]) => <label key={key} className="rounded-xl border border-emerald-800 bg-[#062B24] p-3"><span className="text-[10px] font-black text-emerald-100/55">{label}</span><input type="number" min="0" inputMode="numeric" value={denominations[key] || ''} onChange={e => setDenominations(d => ({...d,[key]:Math.max(0,Number(e.target.value||0))}))} className="mt-2 min-h-12 w-full bg-transparent text-lg font-black text-white outline-none" placeholder="0"/><span className="text-[9px] text-emerald-100/40">{money.format((denominations[key]||0)*value)}</span></label>)}
            </div>
            <button disabled={saving || closed} onClick={saveCount} className="mt-4 flex min-h-12 w-full items-center justify-center gap-2 rounded-xl bg-[#11A65A] px-4 py-3.5 text-sm font-black text-[#062B24] active:scale-[.99] disabled:opacity-40">{saving?<Loader2 className="h-4 w-4 animate-spin"/>:<Banknote className="h-4 w-4"/>}Guardar arqueo</button>
          </article>

          <article className="rounded-[26px] border border-white/5 bg-[#0B3D33]/70 p-5">
            <h2 className="text-sm font-black text-white">Resultado del arqueo</h2>
            <div className="mt-4 rounded-2xl bg-[#062B24] p-4"><p className="text-xs text-emerald-100/55">Efectivo contado</p><p className="mt-1 text-3xl font-black text-white">{money.format(totalCounted)}</p></div>
            <div className={`mt-3 rounded-2xl border p-4 ${variance===0?'border-[#70E5A6]/20 bg-[#11A65A]/10':'border-amber-400/20 bg-amber-500/10'}`}><p className="text-xs text-emerald-100/75">Diferencia</p><p className={`mt-1 text-2xl font-black ${variance===0?'text-[#70E5A6]':'text-amber-200'}`}>{variance>0?'+':''}{money.format(variance)}</p><p className="mt-1 text-[10px] text-emerald-100/55">{variance===0?'Caja exacta':variance<0?'Faltante de efectivo':'Sobrante de efectivo'}</p></div>
            <div className="mt-3 flex min-h-12 items-center gap-2 rounded-xl border border-emerald-800 bg-[#062B24] p-3 text-xs text-emerald-100/75"><MapPin className="h-4 w-4 text-[#70E5A6]"/>{position?'GPS listo para cierre':'Esperando ubicación GPS'}</div>
            <textarea value={closingNotes} onChange={e=>setClosingNotes(e.target.value)} placeholder="Notas de cierre / explicación de diferencia" className="mt-3 min-h-24 w-full rounded-xl border border-emerald-800 bg-[#062B24] p-3 text-sm text-white outline-none"/>
            {variance!==0 && <div className="mt-3 flex gap-2 rounded-xl border border-amber-400/20 bg-amber-500/10 p-3 text-xs text-amber-200"><ShieldAlert className="h-4 w-4 shrink-0"/><span>Si cierras con diferencia, la caja pasará a revisión de supervisión.</span></div>}
            <button disabled={saving || closed || !position || (!countResult && session.status!=='COUNTING')} onClick={closeSession} className="mt-4 flex min-h-12 w-full items-center justify-center gap-2 rounded-xl bg-white px-4 py-3.5 text-sm font-black text-[#062B24] active:scale-[.99] disabled:opacity-40">{saving?<Loader2 className="h-4 w-4 animate-spin"/>:<ClipboardCheck className="h-4 w-4"/>}{closed?'Jornada procesada':'Cerrar jornada'}</button>
            {closed && <button onClick={() => router.push('/dashboard')} className="mt-2 min-h-12 w-full rounded-xl border border-emerald-700 px-4 py-3 text-xs font-black text-white active:scale-[.99]">Volver al dashboard</button>}
          </article>
        </section>
      </>}
    </main>
  </div>;
}
