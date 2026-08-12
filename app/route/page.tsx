'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  ArrowLeft, Banknote, CalendarClock, CheckCircle2, Compass, Crosshair,
  Loader2, MapPin, Navigation, Phone, Printer, RefreshCw, Route, ShieldCheck,
  SkipForward, WalletCards, X, XCircle
} from 'lucide-react';
import BitalisLogo from '@/components/BitalisLogo';

type Client = {
  id: string; clientNumber: string; firstName: string; lastName: string;
  secondLastName?: string | null; phone: string; latitude?: number | null;
  longitude?: number | null; riskLevel?: string;
};
type Credit = {
  id: string; saleId: string; saleNumber?: string | null; clientId: string;
  principalAmount: number; saldoActual: number; suggestedInstallment: number;
  paymentFrequency: string; proximaVisita?: string | null; status: string;
  client: Client;
};
type Position = { lat: number; lng: number; accuracy?: number };
type AuthUser = { id: string; email: string; firstName?: string; lastName?: string; role: string };
type CashSession = { id: string; openingFund: number | string; currentCash: number | string; expectedCash: number | string; status: string; openedAt?: string };
type Receipt = { paymentId: string; clientName: string; clientNumber: string; creditId: string; amount: number; method: string; previousBalance: number; newBalance: number; createdAt: string };
type RouteStats = { visited: number; paid: number; noPay: number; rescheduled: number; skipped: number; totalCollected: number };

const money = new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN', minimumFractionDigits: 2 });
const toRad = (v: number) => (v * Math.PI) / 180;
function distanceMeters(a: Position, b: { lat: number; lng: number }) {
  const R = 6371000, dLat = toRad(b.lat - a.lat), dLng = toRad(b.lng - a.lng);
  const x = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.atan2(Math.sqrt(x), Math.sqrt(1 - x));
}
function bearingDegrees(a: Position, b: { lat: number; lng: number }) {
  const lat1 = toRad(a.lat), lat2 = toRad(b.lat), dLng = toRad(b.lng - a.lng);
  const y = Math.sin(dLng) * Math.cos(lat2);
  const x = Math.cos(lat1) * Math.sin(lat2) - Math.sin(lat1) * Math.cos(lat2) * Math.cos(dLng);
  return (Math.atan2(y, x) * 180 / Math.PI + 360) % 360;
}
function directionLabel(b: number) {
  const dirs = ['N','NE','E','SE','S','SO','O','NO'];
  return dirs[Math.round(b / 45) % 8];
}

export default function CollectorRoutePage() {
  const router = useRouter();
  const [user, setUser] = useState<AuthUser | null>(null);
  const [credits, setCredits] = useState<Credit[]>([]);
  const [position, setPosition] = useState<Position | null>(null);
  const [selectedId, setSelectedId] = useState('');
  const [tracking, setTracking] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [completed, setCompleted] = useState<string[]>([]);
  const [notes, setNotes] = useState('');
  const [noPayReason, setNoPayReason] = useState('NO_TENIA_DINERO');
  const [rescheduleDate, setRescheduleDate] = useState('');
  const [payOpen, setPayOpen] = useState(false);
  const [paymentAmount, setPaymentAmount] = useState('');
  const [paymentMethod, setPaymentMethod] = useState<'CASH'|'BANK_TRANSFER'>('CASH');
  const [cashSession, setCashSession] = useState<CashSession | null>(null);
  const [openingFund, setOpeningFund] = useState('0');
  const [openingCash, setOpeningCash] = useState(false);
  const [receipt, setReceipt] = useState<Receipt | null>(null);
  const [stats, setStats] = useState<RouteStats>({ visited: 0, paid: 0, noPay: 0, rescheduled: 0, skipped: 0, totalCollected: 0 });

  const authToken = () => localStorage.getItem('bitalis_access_token');

  const deviceId = () => {
    let id = localStorage.getItem('bitalis_device_id');
    if (!id) { id = `DEV-${crypto.randomUUID()}`; localStorage.setItem('bitalis_device_id', id); }
    return id;
  };

  const loadCash = async (currentUser?: AuthUser | null) => {
    const u = currentUser || user;
    if (!u?.id) return;
    try {
      const res = await fetch(`/api/cash-sessions/current?userId=${encodeURIComponent(u.id)}`, { cache: 'no-store' });
      const json = await res.json().catch(() => ({}));
      if (res.ok) setCashSession(json?.data || null);
    } catch { /* La ruta puede operar con transferencia aunque no haya caja. */ }
  };

  const load = async () => {
    const token = authToken();
    const rawUser = localStorage.getItem('bitalis_auth_user');
    if (!token || !rawUser) { router.replace('/'); return; }
    let parsed: AuthUser;
    try { parsed = JSON.parse(rawUser); setUser(parsed); } catch { router.replace('/'); return; }
    setLoading(true); setError('');
    try {
      const res = await fetch('/api/collections/portfolio', { headers: { Authorization: `Bearer ${token}` }, cache: 'no-store' });
      const json = await res.json().catch(() => ({}));
      if (res.status === 401) { router.replace('/'); return; }
      if (!res.ok) throw new Error(json?.error || 'No fue posible cargar la cartera.');
      const list = (Array.isArray(json?.data) ? json.data : []).filter((c: Credit) => c.client?.latitude != null && c.client?.longitude != null);
      setCredits(list);
      await loadCash(parsed);
    } catch (e: any) { setError(e?.message || 'No fue posible cargar la cartera con GPS.'); }
    finally { setLoading(false); }
  };

  useEffect(() => { load(); }, []);
  useEffect(() => {
    if (!tracking || !navigator.geolocation) return;
    const id = navigator.geolocation.watchPosition(
      p => setPosition({ lat: p.coords.latitude, lng: p.coords.longitude, accuracy: p.coords.accuracy }),
      e => setError(e.message || 'No fue posible obtener tu ubicación.'),
      { enableHighAccuracy: true, maximumAge: 5000, timeout: 15000 }
    );
    return () => navigator.geolocation.clearWatch(id);
  }, [tracking]);

  const pending = useMemo(() => credits.filter(c => !completed.includes(c.id)), [credits, completed]);
  const sorted = useMemo(() => {
    if (!position) return pending;
    return [...pending].sort((a,b) => distanceMeters(position, { lat: Number(a.client.latitude), lng: Number(a.client.longitude) }) - distanceMeters(position, { lat: Number(b.client.latitude), lng: Number(b.client.longitude) }));
  }, [pending, position]);
  const selected = sorted.find(c => c.id === selectedId) || sorted[0] || null;
  const client = selected?.client || null;
  const distance = selected && position ? distanceMeters(position, { lat: Number(client?.latitude), lng: Number(client?.longitude) }) : null;
  const bearing = selected && position ? bearingDegrees(position, { lat: Number(client?.latitude), lng: Number(client?.longitude) }) : null;
  const arrived = distance != null && distance <= 80;

  useEffect(() => {
    if (selected) setPaymentAmount(String(Math.min(selected.suggestedInstallment || selected.saldoActual, selected.saldoActual)));
  }, [selected?.id]);

  const start = () => {
    if (!navigator.geolocation) { setError('Este dispositivo no permite geolocalización.'); return; }
    setTracking(true);
    navigator.geolocation.getCurrentPosition(
      p => setPosition({ lat: p.coords.latitude, lng: p.coords.longitude, accuracy: p.coords.accuracy }),
      e => setError(e.message || 'Activa el permiso de ubicación para navegar.'),
      { enableHighAccuracy: true, timeout: 15000 }
    );
  };

  const openCashSession = async () => {
    if (!position) { setError('Activa el GPS antes de abrir caja.'); return; }
    const token = authToken();
    if (!token) return router.replace('/');
    const fund = Number(openingFund);
    if (!Number.isFinite(fund) || fund < 0) { setError('El fondo inicial no es válido.'); return; }
    setOpeningCash(true); setError('');
    try {
      const res = await fetch('/api/cash-sessions/open', {
        method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ openingFund: fund, latitude: position.lat, longitude: position.lng, deviceId: deviceId(), openedClientAt: new Date().toISOString(), idempotencyKey: `cash-open-${user?.id}-${new Date().toISOString().slice(0,10)}` })
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json?.error || 'No fue posible abrir caja.');
      const session = json?.data?.session || json?.data;
      setCashSession(session || null);
      setNotice('Caja abierta correctamente. Ya puedes registrar cobros en efectivo.');
    } catch (e: any) { setError(e?.message || 'No fue posible abrir caja.'); }
    finally { setOpeningCash(false); }
  };

  const next = (message: string) => {
    if (!selected) return;
    setCompleted(prev => [...prev, selected.id]); setSelectedId(''); setNotice(message);
    setNotes(''); setRescheduleDate(''); setPayOpen(false); setPaymentAmount('');
    window.setTimeout(() => setNotice(''), 3500);
  };

  const registerVisit = async (result: 'SUCCESS'|'NOT_HOME'|'REFUSED'|'RESCHEDULED', reason?: string, doNext = true) => {
    if (!selected || !client || !position) throw new Error('Activa el GPS antes de registrar la visita.');
    const token = authToken(); if (!token) throw new Error('Sesión no disponible.');
    const extra = result === 'RESCHEDULED' && rescheduleDate ? `Reagendado para ${rescheduleDate}. ${notes}`.trim() : notes;
    const res = await fetch('/api/collections/visits', {
      method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({ clientId: client.id, creditId: selected.id, visitType: 'COLLECTION_VISIT', result, noPaymentReason: reason, gpsLatitude: position.lat, gpsLongitude: position.lng, accuracy: position.accuracy, notes: extra || undefined, clientCapturedAt: new Date().toISOString(), idempotencyKey: `route-visit-${selected.id}-${Date.now()}` })
    });
    const json = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(json?.error || 'No fue posible registrar la visita.');
    if (doNext) {
      setStats(s => ({ ...s, visited: s.visited + 1, noPay: result === 'RESCHEDULED' ? s.noPay : s.noPay + 1, rescheduled: result === 'RESCHEDULED' ? s.rescheduled + 1 : s.rescheduled }));
      next(result === 'RESCHEDULED' ? 'Cliente reagendado. Siguiente destino…' : 'Visita registrada. Siguiente destino…');
    }
  };

  const saveVisit = async (result: 'NOT_HOME'|'REFUSED'|'RESCHEDULED', reason?: string) => {
    setSaving(true); setError('');
    try { await registerVisit(result, reason, true); }
    catch (e: any) { setError(e?.message || 'No fue posible registrar la visita.'); }
    finally { setSaving(false); }
  };

  const registerPayment = async () => {
    if (!selected || !client || !position) { setError('Activa el GPS antes de cobrar.'); return; }
    const amount = Number(paymentAmount);
    if (!Number.isFinite(amount) || amount <= 0) { setError('Captura un importe válido.'); return; }
    if (amount > selected.saldoActual) { setError('El abono no puede ser mayor al saldo actual.'); return; }
    if (paymentMethod === 'CASH' && !cashSession) { setError('Abre la caja del cobrador antes de recibir efectivo.'); return; }
    const token = authToken(); if (!token) return router.replace('/');
    setSaving(true); setError('');
    try {
      const capturedAt = new Date().toISOString();
      const res = await fetch('/api/payments', {
        method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ creditId: selected.id, amount, paymentMethod, cashSessionId: paymentMethod === 'CASH' ? cashSession?.id : undefined, clientCapturedAt: capturedAt, gpsLatitude: position.lat, gpsLongitude: position.lng, notes: notes || undefined, idempotencyKey: `route-payment-${selected.id}-${Date.now()}` })
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json?.error || 'No fue posible registrar el abono.');
      const payment = json?.payment || json?.data || json;
      await registerVisit('SUCCESS', undefined, false);
      const newBalance = Math.max(0, selected.saldoActual - amount);
      setReceipt({ paymentId: payment?.id || 'PAGO-REGISTRADO', clientName: `${client.firstName} ${client.lastName} ${client.secondLastName || ''}`.trim(), clientNumber: client.clientNumber, creditId: selected.id, amount, method: paymentMethod, previousBalance: selected.saldoActual, newBalance, createdAt: capturedAt });
      setStats(s => ({ ...s, visited: s.visited + 1, paid: s.paid + 1, totalCollected: s.totalCollected + amount }));
      if (paymentMethod === 'CASH') await loadCash();
      next(`Abono ${money.format(amount)} registrado. Siguiente destino…`);
      await load();
    } catch (e: any) { setError(e?.message || 'No fue posible registrar el abono.'); }
    finally { setSaving(false); }
  };

  const skip = () => {
    if (!selected) return;
    setStats(s => ({ ...s, skipped: s.skipped + 1 }));
    next('Cliente omitido temporalmente. Siguiente destino…');
  };

  const printReceipt = () => window.print();

  return <div className="min-h-screen bg-slate-950 text-slate-100 print:bg-white print:text-black">
    <header className="sticky top-0 z-30 border-b border-white/5 bg-slate-950/90 backdrop-blur-xl print:hidden">
      <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-3">
        <div className="flex items-center gap-3"><button onClick={() => router.push('/dashboard')} className="flex h-10 w-10 items-center justify-center rounded-xl border border-slate-800 bg-slate-900"><ArrowLeft className="h-4 w-4"/></button><BitalisLogo size="md" variant="dark" /></div>
        <button onClick={load} className="flex h-10 w-10 items-center justify-center rounded-xl border border-slate-800 bg-slate-900"><RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`}/></button>
      </div>
    </header>

    <main className="mx-auto max-w-6xl px-4 py-5 print:hidden">
      <section className="rounded-[28px] border border-emerald-400/10 bg-gradient-to-br from-slate-900 to-emerald-950/20 p-5">
        <div className="inline-flex items-center gap-2 rounded-full border border-emerald-400/15 bg-emerald-400/5 px-3 py-1.5 text-[10px] font-black uppercase tracking-[.16em] text-emerald-300"><Route className="h-3.5 w-3.5"/> Ruta de cobranza</div>
        <h1 className="mt-4 text-2xl font-black text-white">Modo cobrador</h1>
        <p className="mt-2 text-sm leading-6 text-slate-400">Ruta, GPS, visita, abono y caja en un solo flujo operativo.</p>
        <div className="mt-4 grid grid-cols-3 gap-2 text-[11px] sm:grid-cols-6">
          <span className="rounded-lg bg-slate-950 px-3 py-2 text-slate-400">Pendientes <b className="block text-white">{sorted.length}</b></span>
          <span className="rounded-lg bg-emerald-500/10 px-3 py-2 text-emerald-300">Visitados <b className="block">{stats.visited}</b></span>
          <span className="rounded-lg bg-emerald-500/10 px-3 py-2 text-emerald-300">Pagaron <b className="block">{stats.paid}</b></span>
          <span className="rounded-lg bg-orange-500/10 px-3 py-2 text-orange-200">No pagaron <b className="block">{stats.noPay}</b></span>
          <span className="rounded-lg bg-slate-950 px-3 py-2 text-slate-400">Reagendados <b className="block text-white">{stats.rescheduled}</b></span>
          <span className="rounded-lg bg-slate-950 px-3 py-2 text-slate-400">Cobrado <b className="block text-emerald-300">{money.format(stats.totalCollected)}</b></span>
        </div>
      </section>

      {error && <div className="mt-4 rounded-2xl border border-red-400/20 bg-red-500/10 p-4 text-sm text-red-200">{error}</div>}
      {notice && <div className="mt-4 rounded-2xl border border-emerald-400/20 bg-emerald-500/10 p-4 text-sm font-bold text-emerald-200">{notice}</div>}

      <section className="mt-4 rounded-[24px] border border-white/5 bg-slate-900/70 p-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div><p className="text-xs font-black uppercase tracking-[.14em] text-slate-500">Caja del cobrador</p><p className="mt-1 text-sm font-black text-white">{cashSession ? `Caja ${cashSession.status}` : 'Sin caja abierta'}</p></div>
          {cashSession ? <div className="flex gap-2"><div className="rounded-xl bg-slate-950 px-3 py-2 text-xs text-slate-400">Fondo <b className="ml-1 text-white">{money.format(Number(cashSession.openingFund || 0))}</b></div><div className="rounded-xl bg-emerald-500/10 px-3 py-2 text-xs text-emerald-300">Esperado <b className="ml-1">{money.format(Number(cashSession.expectedCash || 0))}</b></div></div> : <div className="flex gap-2"><input inputMode="decimal" value={openingFund} onChange={e => setOpeningFund(e.target.value)} className="w-28 rounded-xl border border-slate-800 bg-slate-950 px-3 py-2 text-sm text-white" placeholder="Fondo"/><button onClick={openCashSession} disabled={openingCash || !position} className="flex items-center gap-2 rounded-xl bg-emerald-500 px-4 py-2 text-xs font-black text-slate-950 disabled:opacity-50">{openingCash ? <Loader2 className="h-4 w-4 animate-spin"/> : <Banknote className="h-4 w-4"/>}Abrir caja</button></div>}
        </div>
      </section>

      <section className="mt-4 grid gap-4 lg:grid-cols-[1fr_.72fr]">
        <article className="rounded-[26px] border border-white/5 bg-slate-900/70 p-5">
          {!tracking ? <button onClick={start} className="flex w-full items-center justify-center gap-2 rounded-2xl bg-emerald-500 px-4 py-4 text-sm font-black text-slate-950"><Navigation className="h-5 w-5"/> Iniciar ruta con GPS</button> : <div className="flex items-center gap-2 rounded-2xl border border-emerald-400/15 bg-emerald-400/5 p-3 text-xs font-bold text-emerald-300"><ShieldCheck className="h-4 w-4"/> Seguimiento GPS activo {position?.accuracy ? `· precisión ${Math.round(position.accuracy)} m` : ''}</div>}

          <div className="mt-5 rounded-[24px] border border-slate-800 bg-slate-950 p-5 text-center">
            <div className="mx-auto flex h-24 w-24 items-center justify-center rounded-full border border-emerald-400/20 bg-emerald-400/5"><Compass className="h-12 w-12 text-emerald-400" style={{ transform: `rotate(${bearing || 0}deg)` }}/></div>
            <p className="mt-4 text-[10px] font-black uppercase tracking-[.16em] text-slate-500">Siguiente destino</p>
            <h2 className="mt-1 text-xl font-black text-white">{client ? `${client.firstName} ${client.lastName}` : 'Ruta completada'}</h2>
            <p className="mt-1 text-xs text-slate-500">{client?.clientNumber || 'No quedan créditos con GPS'}</p>
            {selected && <div className="mt-4 grid grid-cols-2 gap-2"><div className="rounded-xl bg-slate-900 p-3"><p className="text-[9px] uppercase text-slate-600">Saldo</p><p className="mt-1 text-lg font-black text-white">{money.format(selected.saldoActual)}</p></div><div className="rounded-xl bg-slate-900 p-3"><p className="text-[9px] uppercase text-slate-600">Abono sugerido</p><p className="mt-1 text-lg font-black text-emerald-300">{money.format(selected.suggestedInstallment)}</p></div></div>}
            {distance != null && <p className="mt-4 text-3xl font-black text-emerald-300">{distance < 1000 ? `${Math.round(distance)} m` : `${(distance/1000).toFixed(1)} km`}</p>}
            {bearing != null && <p className="mt-1 text-xs text-slate-500">Dirección aproximada: {directionLabel(bearing)}</p>}
            {arrived && <div className="mt-4 flex items-center justify-center gap-2 rounded-2xl border border-emerald-400/20 bg-emerald-500/10 p-3 text-sm font-black text-emerald-200"><CheckCircle2 className="h-5 w-5"/> Llegaste al domicilio</div>}
          </div>

          {selected && client && <>
            <div className="mt-4 grid grid-cols-2 gap-2">
              <a href={`tel:${client.phone}`} className="flex items-center justify-center gap-2 rounded-2xl border border-slate-800 bg-slate-950 px-3 py-3 text-xs font-black text-slate-200"><Phone className="h-4 w-4"/> Llamar</a>
              <button onClick={() => setPayOpen(true)} className="flex items-center justify-center gap-2 rounded-2xl bg-emerald-500 px-3 py-3 text-xs font-black text-slate-950"><WalletCards className="h-4 w-4"/> Registrar abono</button>
              <a href={`https://www.google.com/maps/dir/?api=1&destination=${client.latitude},${client.longitude}&travelmode=driving`} target="_blank" rel="noreferrer" className="col-span-2 flex items-center justify-center gap-2 rounded-2xl border border-slate-800 bg-slate-900 px-3 py-3 text-xs font-black text-slate-300"><MapPin className="h-4 w-4"/> Respaldo: Google Maps</a>
            </div>

            <div className="mt-4 rounded-[22px] border border-white/5 bg-slate-950 p-4">
              <p className="text-xs font-black uppercase tracking-[.14em] text-slate-500">Resultado sin pago</p>
              <textarea value={notes} onChange={e => setNotes(e.target.value)} placeholder="Nota opcional" className="mt-3 min-h-20 w-full rounded-xl border border-slate-800 bg-slate-900 p-3 text-sm text-white outline-none"/>
              <div className="mt-3 grid grid-cols-2 gap-2">
                <button disabled={saving} onClick={() => saveVisit('NOT_HOME','NO_ESTABA')} className="rounded-xl border border-slate-700 bg-slate-900 px-3 py-3 text-xs font-black text-slate-200"><XCircle className="mr-1 inline h-4 w-4"/>No estaba</button>
                <button disabled={saving} onClick={() => saveVisit('REFUSED', noPayReason)} className="rounded-xl border border-orange-400/20 bg-orange-500/10 px-3 py-3 text-xs font-black text-orange-200">No pagó</button>
              </div>
              <select value={noPayReason} onChange={e => setNoPayReason(e.target.value)} className="mt-2 w-full rounded-xl border border-slate-800 bg-slate-900 px-3 py-3 text-xs text-white"><option value="NO_TENIA_DINERO">No tenía dinero</option><option value="PROMESA_PAGO">Promesa de pago</option><option value="ESTA_DE_VIAJE">Está de viaje</option><option value="PROBLEMA_FAMILIAR">Problema familiar</option><option value="RECHAZO_PAGAR">Rechazó pagar</option><option value="OTRO">Otro</option></select>
              <div className="mt-3 grid gap-2 sm:grid-cols-[1fr_auto]"><input type="date" value={rescheduleDate} onChange={e => setRescheduleDate(e.target.value)} className="rounded-xl border border-slate-800 bg-slate-900 px-3 py-3 text-xs text-white"/><button disabled={saving || !rescheduleDate} onClick={() => saveVisit('RESCHEDULED','PROMESA_PAGO')} className="flex items-center justify-center gap-2 rounded-xl border border-blue-400/20 bg-blue-500/10 px-4 py-3 text-xs font-black text-blue-200 disabled:opacity-40"><CalendarClock className="h-4 w-4"/>Reagendar</button></div>
              <button onClick={skip} className="mt-3 flex w-full items-center justify-center gap-2 rounded-xl border border-slate-800 px-3 py-3 text-xs font-black text-slate-400"><SkipForward className="h-4 w-4"/>Omitir y seguir</button>
            </div>
          </>}
        </article>

        <article className="rounded-[26px] border border-white/5 bg-slate-900/70 p-4">
          <div className="flex items-center justify-between"><div><p className="text-sm font-black text-white">Ruta sugerida</p><p className="mt-1 text-[11px] text-slate-500">Créditos pendientes ordenados por cercanía</p></div><Crosshair className="h-5 w-5 text-emerald-400"/></div>
          <div className="mt-4 space-y-2">{sorted.length === 0 ? <div className="rounded-2xl border border-slate-800 bg-slate-950 p-5 text-center text-sm text-slate-500">Ruta completada o sin clientes con GPS.</div> : sorted.map((c,index) => { const d = position ? distanceMeters(position,{lat:Number(c.client.latitude),lng:Number(c.client.longitude)}) : null; const active = selected?.id === c.id; return <button key={c.id} onClick={() => setSelectedId(c.id)} className={`w-full rounded-2xl border p-3 text-left ${active ? 'border-emerald-400/30 bg-emerald-400/5' : 'border-slate-800 bg-slate-950'}`}><div className="flex items-center gap-3"><div className="flex h-9 w-9 items-center justify-center rounded-xl bg-slate-800 text-xs font-black">{index+1}</div><div className="min-w-0 flex-1"><p className="truncate text-sm font-black text-white">{c.client.firstName} {c.client.lastName}</p><p className="mt-1 text-[10px] text-slate-500">Saldo {money.format(c.saldoActual)}{d != null ? ` · ${d<1000?`${Math.round(d)} m`:`${(d/1000).toFixed(1)} km`}`:''}</p></div><MapPin className="h-4 w-4 text-slate-600"/></div></button> })}</div>
        </article>
      </section>
    </main>

    {payOpen && selected && client && <div className="fixed inset-0 z-50 flex items-end justify-center bg-slate-950/90 p-0 backdrop-blur sm:items-center sm:p-4 print:hidden"><div className="w-full max-w-md rounded-t-[28px] border border-white/10 bg-slate-900 p-5 sm:rounded-[28px]"><div className="flex items-center justify-between"><div><p className="text-lg font-black text-white">Registrar abono</p><p className="mt-1 text-xs text-slate-500">{client.firstName} {client.lastName}</p></div><button onClick={() => setPayOpen(false)} className="h-9 w-9 rounded-xl bg-slate-800"><X className="mx-auto h-4 w-4"/></button></div><div className="mt-4 rounded-2xl bg-slate-950 p-4"><p className="text-xs text-slate-500">Saldo actual</p><p className="mt-1 text-2xl font-black text-white">{money.format(selected.saldoActual)}</p></div><label className="mt-4 block"><span className="text-xs font-bold text-slate-400">Importe</span><input inputMode="decimal" value={paymentAmount} onChange={e => setPaymentAmount(e.target.value)} className="mt-2 w-full rounded-xl border border-slate-800 bg-slate-950 px-3 py-3 text-lg font-black text-white"/></label><button onClick={() => setPaymentAmount(String(selected.saldoActual))} className="mt-2 text-xs font-black text-emerald-300">Liquidar saldo completo</button><div className="mt-4 grid grid-cols-2 gap-2"><button onClick={() => setPaymentMethod('CASH')} className={`rounded-xl border px-3 py-3 text-xs font-black ${paymentMethod==='CASH'?'border-emerald-400/30 bg-emerald-500/10 text-emerald-200':'border-slate-800 text-slate-400'}`}>Efectivo</button><button onClick={() => setPaymentMethod('BANK_TRANSFER')} className={`rounded-xl border px-3 py-3 text-xs font-black ${paymentMethod==='BANK_TRANSFER'?'border-blue-400/30 bg-blue-500/10 text-blue-200':'border-slate-800 text-slate-400'}`}>Transferencia</button></div>{paymentMethod==='CASH' && !cashSession && <div className="mt-3 rounded-xl border border-amber-400/20 bg-amber-500/10 p-3 text-xs text-amber-200">Debes abrir caja antes de registrar efectivo.</div>}<button disabled={saving || (paymentMethod==='CASH' && !cashSession)} onClick={registerPayment} className="mt-5 flex w-full items-center justify-center gap-2 rounded-xl bg-emerald-500 px-4 py-3.5 text-sm font-black text-slate-950 disabled:opacity-40">{saving&&<Loader2 className="h-4 w-4 animate-spin"/>}Confirmar abono</button></div></div>}

    {receipt && <div className="fixed inset-0 z-[60] flex items-center justify-center bg-slate-950/90 p-4 backdrop-blur print:static print:block print:bg-white print:p-0"><div className="w-full max-w-sm rounded-[24px] border border-white/10 bg-white p-6 text-slate-900 shadow-2xl print:max-w-none print:rounded-none print:border-0 print:shadow-none"><div className="text-center"><p className="text-xl font-black">BITALIS</p><p className="text-xs text-slate-500">Comprobante de pago</p></div><div className="my-5 border-y border-dashed border-slate-300 py-4 text-sm"><p><b>Cliente:</b> {receipt.clientName}</p><p><b>Folio:</b> {receipt.clientNumber}</p><p><b>Crédito:</b> {receipt.creditId}</p><p><b>Fecha:</b> {new Date(receipt.createdAt).toLocaleString('es-MX')}</p><p><b>Método:</b> {receipt.method==='CASH'?'Efectivo':'Transferencia'}</p></div><div className="text-center"><p className="text-xs text-slate-500">Importe recibido</p><p className="text-3xl font-black">{money.format(receipt.amount)}</p><p className="mt-3 text-xs text-slate-500">Saldo anterior {money.format(receipt.previousBalance)}</p><p className="text-sm font-black">Nuevo saldo {money.format(receipt.newBalance)}</p></div><p className="mt-5 text-center text-[10px] text-slate-400">Pago #{receipt.paymentId}</p><div className="mt-5 grid grid-cols-2 gap-2 print:hidden"><button onClick={printReceipt} className="flex items-center justify-center gap-2 rounded-xl border border-slate-300 px-3 py-3 text-xs font-black"><Printer className="h-4 w-4"/>Imprimir</button><button onClick={() => setReceipt(null)} className="rounded-xl bg-slate-900 px-3 py-3 text-xs font-black text-white">Continuar</button></div></div></div>}
  </div>;
}
