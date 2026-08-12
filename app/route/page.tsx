'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { ArrowLeft, CalendarClock, CheckCircle2, Compass, Crosshair, MapPin, Navigation, Phone, RefreshCw, Route, ShieldCheck, SkipForward, WalletCards, XCircle } from 'lucide-react';
import BitalisLogo from '@/components/BitalisLogo';

type Client = {
  id: string;
  clientNumber: string;
  firstName: string;
  lastName: string;
  phone: string;
  latitude?: number | null;
  longitude?: number | null;
  riskLevel?: string;
};

type Position = { lat: number; lng: number; accuracy?: number };

const toRad = (v: number) => (v * Math.PI) / 180;
function distanceMeters(a: Position, b: { lat: number; lng: number }) {
  const R = 6371000;
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const x = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.atan2(Math.sqrt(x), Math.sqrt(1 - x));
}
function bearingDegrees(a: Position, b: { lat: number; lng: number }) {
  const lat1 = toRad(a.lat); const lat2 = toRad(b.lat); const dLng = toRad(b.lng - a.lng);
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
  const [clients, setClients] = useState<Client[]>([]);
  const [position, setPosition] = useState<Position | null>(null);
  const [selectedId, setSelectedId] = useState('');
  const [tracking, setTracking] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [loading, setLoading] = useState(true);
  const [savingVisit, setSavingVisit] = useState(false);
  const [completed, setCompleted] = useState<string[]>([]);
  const [noPayReason, setNoPayReason] = useState('NO_TENIA_DINERO');
  const [rescheduleDate, setRescheduleDate] = useState('');
  const [notes, setNotes] = useState('');

  const load = async () => {
    const token = localStorage.getItem('bitalis_access_token');
    if (!token) { router.replace('/'); return; }
    setLoading(true); setError('');
    try {
      const res = await fetch('/api/clients?page=1&limit=100', { headers: { Authorization: `Bearer ${token}` }, cache: 'no-store' });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json?.error || 'No fue posible cargar la ruta.');
      const list = (Array.isArray(json?.data) ? json.data : []).filter((c: Client) => c.latitude != null && c.longitude != null);
      setClients(list);
    } catch (e: any) { setError(e?.message || 'No fue posible cargar clientes con GPS.'); }
    finally { setLoading(false); }
  };

  useEffect(() => { load(); }, []);

  useEffect(() => {
    if (!tracking || !navigator.geolocation) return;
    const id = navigator.geolocation.watchPosition(
      (p) => setPosition({ lat: p.coords.latitude, lng: p.coords.longitude, accuracy: p.coords.accuracy }),
      (e) => setError(e.message || 'No fue posible obtener tu ubicación.'),
      { enableHighAccuracy: true, maximumAge: 5000, timeout: 15000 }
    );
    return () => navigator.geolocation.clearWatch(id);
  }, [tracking]);

  const pendingClients = useMemo(() => clients.filter((c) => !completed.includes(c.id)), [clients, completed]);
  const sorted = useMemo(() => {
    if (!position) return pendingClients;
    return [...pendingClients].sort((a, b) => {
      const da = distanceMeters(position, { lat: Number(a.latitude), lng: Number(a.longitude) });
      const db = distanceMeters(position, { lat: Number(b.latitude), lng: Number(b.longitude) });
      return da - db;
    });
  }, [pendingClients, position]);

  const selected = sorted.find((c) => c.id === selectedId) || sorted[0] || null;
  const distance = selected && position ? distanceMeters(position, { lat: Number(selected.latitude), lng: Number(selected.longitude) }) : null;
  const bearing = selected && position ? bearingDegrees(position, { lat: Number(selected.latitude), lng: Number(selected.longitude) }) : null;
  const arrived = distance != null && distance <= 80;

  const start = () => {
    if (!navigator.geolocation) { setError('Este dispositivo no permite geolocalización.'); return; }
    setTracking(true);
    navigator.geolocation.getCurrentPosition(
      (p) => setPosition({ lat: p.coords.latitude, lng: p.coords.longitude, accuracy: p.coords.accuracy }),
      (e) => setError(e.message || 'Activa el permiso de ubicación para navegar.'),
      { enableHighAccuracy: true, timeout: 15000 }
    );
  };

  const finishCurrentAndNext = (message: string) => {
    if (!selected) return;
    setCompleted((prev) => [...prev, selected.id]);
    setSelectedId('');
    setNotice(message);
    setNotes('');
    setRescheduleDate('');
    window.setTimeout(() => setNotice(''), 3500);
  };

  const registerVisit = async (result: 'SUCCESS' | 'NO_CONTACT' | 'NOT_HOME' | 'REFUSED' | 'RESCHEDULED', reason?: string) => {
    if (!selected || !position) { setError('Activa el GPS antes de registrar la visita.'); return; }
    const token = localStorage.getItem('bitalis_access_token');
    if (!token) { router.replace('/'); return; }
    setSavingVisit(true); setError('');
    try {
      const extra = result === 'RESCHEDULED' && rescheduleDate ? `Reagendado para ${rescheduleDate}. ${notes}`.trim() : notes;
      const res = await fetch('/api/collections/visits', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          clientId: selected.id,
          visitType: 'COLLECTION_VISIT',
          result,
          noPaymentReason: reason,
          gpsLatitude: position.lat,
          gpsLongitude: position.lng,
          accuracy: position.accuracy,
          notes: extra || undefined,
          clientCapturedAt: new Date().toISOString(),
          idempotencyKey: `route-visit-${selected.id}-${Date.now()}`,
        }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json?.error || 'No fue posible registrar la visita.');
      finishCurrentAndNext(result === 'SUCCESS' ? 'Visita registrada. Cargando siguiente cliente…' : result === 'RESCHEDULED' ? 'Cliente reagendado. Cargando siguiente cliente…' : 'No pago registrado. Cargando siguiente cliente…');
    } catch (e: any) { setError(e?.message || 'No fue posible registrar la visita.'); }
    finally { setSavingVisit(false); }
  };

  return <div className="min-h-screen bg-slate-950 text-slate-100">
    <header className="sticky top-0 z-30 border-b border-white/5 bg-slate-950/90 backdrop-blur-xl">
      <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-3">
        <div className="flex items-center gap-3"><button onClick={() => router.push('/dashboard')} className="flex h-10 w-10 items-center justify-center rounded-xl border border-slate-800 bg-slate-900"><ArrowLeft className="h-4 w-4"/></button><BitalisLogo size="md" variant="dark" /></div>
        <button onClick={load} className="flex h-10 w-10 items-center justify-center rounded-xl border border-slate-800 bg-slate-900"><RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`}/></button>
      </div>
    </header>

    <main className="mx-auto max-w-6xl px-4 py-5">
      <section className="rounded-[28px] border border-emerald-400/10 bg-gradient-to-br from-slate-900 to-emerald-950/20 p-5">
        <div className="inline-flex items-center gap-2 rounded-full border border-emerald-400/15 bg-emerald-400/5 px-3 py-1.5 text-[10px] font-black uppercase tracking-[.16em] text-emerald-300"><Route className="h-3.5 w-3.5"/> Ruta de cobranza</div>
        <h1 className="mt-4 text-2xl font-black text-white">Modo cobrador</h1>
        <p className="mt-2 text-sm leading-6 text-slate-400">Navega, registra la visita y continúa automáticamente con el siguiente cliente sin salir de BITALIS.</p>
        <div className="mt-4 flex gap-2 text-[11px]"><span className="rounded-lg bg-slate-950 px-3 py-2 text-slate-400">Pendientes: <b className="text-white">{sorted.length}</b></span><span className="rounded-lg bg-emerald-500/10 px-3 py-2 text-emerald-300">Visitados: <b>{completed.length}</b></span></div>
      </section>

      {error && <div className="mt-4 rounded-2xl border border-red-400/20 bg-red-500/10 p-4 text-sm text-red-200">{error}</div>}
      {notice && <div className="mt-4 rounded-2xl border border-emerald-400/20 bg-emerald-500/10 p-4 text-sm font-bold text-emerald-200">{notice}</div>}

      <section className="mt-4 grid gap-4 lg:grid-cols-[1fr_.7fr]">
        <article className="rounded-[26px] border border-white/5 bg-slate-900/70 p-5">
          {!tracking ? <button onClick={start} className="flex w-full items-center justify-center gap-2 rounded-2xl bg-emerald-500 px-4 py-4 text-sm font-black text-slate-950"><Navigation className="h-5 w-5"/> Iniciar ruta con GPS</button> : <div className="flex items-center gap-2 rounded-2xl border border-emerald-400/15 bg-emerald-400/5 p-3 text-xs font-bold text-emerald-300"><ShieldCheck className="h-4 w-4"/> Seguimiento GPS activo</div>}

          <div className="mt-5 rounded-[24px] border border-slate-800 bg-slate-950 p-5 text-center">
            <div className="mx-auto flex h-24 w-24 items-center justify-center rounded-full border border-emerald-400/20 bg-emerald-400/5"><Compass className="h-12 w-12 text-emerald-400" style={{ transform: `rotate(${bearing || 0}deg)` }}/></div>
            <p className="mt-4 text-[10px] font-black uppercase tracking-[.16em] text-slate-500">Siguiente destino</p>
            <h2 className="mt-1 text-xl font-black text-white">{selected ? `${selected.firstName} ${selected.lastName}` : 'Ruta completada'}</h2>
            <p className="mt-1 text-xs text-slate-500">{selected?.clientNumber || (clients.length ? 'No quedan clientes pendientes' : 'Agrega coordenadas al cliente')}</p>
            {distance != null && <p className="mt-4 text-3xl font-black text-emerald-300">{distance < 1000 ? `${Math.round(distance)} m` : `${(distance/1000).toFixed(1)} km`}</p>}
            {bearing != null && <p className="mt-1 text-xs text-slate-500">Dirección aproximada: {directionLabel(bearing)}</p>}
            {arrived && <div className="mt-4 flex items-center justify-center gap-2 rounded-2xl border border-emerald-400/20 bg-emerald-500/10 p-3 text-sm font-black text-emerald-200"><CheckCircle2 className="h-5 w-5"/> Llegaste al domicilio</div>}
          </div>

          {selected && <>
            <div className="mt-4 grid grid-cols-2 gap-2">
              <a href={`tel:${selected.phone}`} className="flex items-center justify-center gap-2 rounded-2xl border border-slate-800 bg-slate-950 px-3 py-3 text-xs font-black text-slate-200"><Phone className="h-4 w-4"/> Llamar</a>
              <button onClick={() => router.push('/collections')} className="flex items-center justify-center gap-2 rounded-2xl bg-emerald-500 px-3 py-3 text-xs font-black text-slate-950"><WalletCards className="h-4 w-4"/> Cobrar</button>
              <a href={`https://www.google.com/maps/dir/?api=1&destination=${selected.latitude},${selected.longitude}&travelmode=driving`} target="_blank" rel="noreferrer" className="col-span-2 flex items-center justify-center gap-2 rounded-2xl border border-slate-800 bg-slate-900 px-3 py-3 text-xs font-black text-slate-300"><MapPin className="h-4 w-4"/> Respaldo: Google Maps</a>
            </div>

            <div className="mt-4 rounded-[22px] border border-white/5 bg-slate-950 p-4">
              <p className="text-xs font-black uppercase tracking-[.14em] text-slate-500">Resultado de visita</p>
              <textarea value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Nota opcional de la visita" className="mt-3 min-h-20 w-full rounded-xl border border-slate-800 bg-slate-900 p-3 text-sm text-white outline-none" />
              <div className="mt-3 grid grid-cols-2 gap-2">
                <button disabled={savingVisit} onClick={() => registerVisit('SUCCESS')} className="flex items-center justify-center gap-2 rounded-xl bg-emerald-500 px-3 py-3 text-xs font-black text-slate-950 disabled:opacity-50"><CheckCircle2 className="h-4 w-4"/> Pagó / atendido</button>
                <button disabled={savingVisit} onClick={() => registerVisit('NOT_HOME','NO_ESTABA')} className="flex items-center justify-center gap-2 rounded-xl border border-slate-700 bg-slate-900 px-3 py-3 text-xs font-black text-slate-200 disabled:opacity-50"><XCircle className="h-4 w-4"/> No estaba</button>
              </div>
              <div className="mt-3 grid gap-2 sm:grid-cols-[1fr_auto]">
                <select value={noPayReason} onChange={(e) => setNoPayReason(e.target.value)} className="rounded-xl border border-slate-800 bg-slate-900 px-3 py-3 text-xs text-white">
                  <option value="NO_TENIA_DINERO">No tenía dinero</option><option value="PROMESA_PAGO">Promesa de pago</option><option value="ESTA_DE_VIAJE">Está de viaje</option><option value="PROBLEMA_FAMILIAR">Problema familiar</option><option value="RECHAZO_PAGAR">Rechazó pagar</option><option value="OTRO">Otro</option>
                </select>
                <button disabled={savingVisit} onClick={() => registerVisit('REFUSED', noPayReason)} className="flex items-center justify-center gap-2 rounded-xl border border-orange-400/20 bg-orange-500/10 px-4 py-3 text-xs font-black text-orange-200 disabled:opacity-50">No pagó</button>
              </div>
              <div className="mt-3 grid gap-2 sm:grid-cols-[1fr_auto]">
                <input type="date" value={rescheduleDate} onChange={(e) => setRescheduleDate(e.target.value)} className="rounded-xl border border-slate-800 bg-slate-900 px-3 py-3 text-xs text-white" />
                <button disabled={savingVisit || !rescheduleDate} onClick={() => registerVisit('RESCHEDULED','PROMESA_PAGO')} className="flex items-center justify-center gap-2 rounded-xl border border-sky-400/20 bg-sky-500/10 px-4 py-3 text-xs font-black text-sky-200 disabled:opacity-40"><CalendarClock className="h-4 w-4"/> Reagendar</button>
              </div>
              <button disabled={savingVisit} onClick={() => finishCurrentAndNext('Cliente omitido temporalmente. Cargando siguiente…')} className="mt-3 flex w-full items-center justify-center gap-2 rounded-xl border border-slate-800 px-3 py-3 text-xs font-black text-slate-400"><SkipForward className="h-4 w-4"/> Omitir y seguir</button>
            </div>
          </>}
        </article>

        <article className="rounded-[26px] border border-white/5 bg-slate-900/70 p-4">
          <div className="flex items-center justify-between"><div><p className="text-sm font-black text-white">Ruta sugerida</p><p className="mt-1 text-[11px] text-slate-500">Se recalcula por cercanía después de cada visita</p></div><Crosshair className="h-5 w-5 text-emerald-400"/></div>
          <div className="mt-4 space-y-2">
            {sorted.length === 0 && <div className="rounded-2xl border border-slate-800 bg-slate-950 p-5 text-center text-sm text-slate-500">{clients.length ? 'Ruta terminada.' : 'No hay clientes con coordenadas registradas.'}</div>}
            {sorted.map((c, index) => {
              const d = position ? distanceMeters(position, { lat: Number(c.latitude), lng: Number(c.longitude) }) : null;
              const active = selected?.id === c.id;
              return <button key={c.id} onClick={() => setSelectedId(c.id)} className={`w-full rounded-2xl border p-3 text-left ${active ? 'border-emerald-400/30 bg-emerald-400/5' : 'border-slate-800 bg-slate-950'}`}>
                <div className="flex items-center gap-3"><div className="flex h-9 w-9 items-center justify-center rounded-xl bg-slate-800 text-xs font-black text-slate-300">{index+1}</div><div className="min-w-0 flex-1"><p className="truncate text-sm font-black text-white">{c.firstName} {c.lastName}</p><p className="mt-1 text-[10px] text-slate-500">{c.clientNumber}{d != null ? ` · ${d < 1000 ? `${Math.round(d)} m` : `${(d/1000).toFixed(1)} km`}` : ''}</p></div><MapPin className="h-4 w-4 text-slate-600"/></div>
              </button>;
            })}
          </div>
        </article>
      </section>
    </main>
  </div>;
}
