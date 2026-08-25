'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  AlertTriangle, Banknote, CalendarClock, Camera, ChevronRight, CircleDollarSign,
  Loader2, MapPin, MessageCircle, Navigation, Phone, RefreshCw, Search,
  SlidersHorizontal, UserRound, UserX, Users, WalletCards, X,
} from 'lucide-react';
import AppShell from '@/components/phase15/AppShell';
import EvidenceImage from '@/components/client/EvidenceImage';
import { apiClient, newIdempotencyKey } from '@/lib/phase15/apiClient';
import { haptic } from '@/lib/ux/haptics';

type Address = { street?: string; exteriorNumber?: string; neighborhood?: string; postalCode?: string };
type Credit = {
  id: string; saldoActual: number; suggestedInstallment: number; status: string;
  hasActiveCredit?: boolean; activeCreditCount?: number;
  client: {
    id: string; clientNumber: string; firstName: string; lastName: string; secondLastName?: string | null;
    phone?: string | null; latitude?: number | null; longitude?: number | null; riskLevel?: string;
    status?: string; preferredCollectionDay?: string | null; facadeStorageKey?: string | null;
    primaryAddress?: Address | null;
  };
  collection: {
    overdue: boolean; dueToday: boolean; preferredToday: boolean; priorityScore: number;
    nextScheduledDate?: string | null;
  };
};
type Tab = 'ALL' | 'TODAY' | 'OVERDUE' | 'RISK' | 'NO_CREDIT';
const money = new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN', maximumFractionDigits: 0 });
const reasons = [
  ['NO_ESTABA', 'No estaba'], ['NO_TENIA_DINERO', 'No tenía dinero'],
  ['ESTA_DE_VIAJE', 'Está de viaje'], ['PROBLEMA_FAMILIAR', 'Problema familiar'],
  ['PROMESA_PAGO', 'Promesa de pago'], ['RECHAZO_PAGAR', 'Rechazó pagar'], ['OTRO', 'Otro'],
];

export default function PortfolioPage() {
  const router = useRouter();
  const [data, setData] = useState<Credit[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [query, setQuery] = useState('');
  const [tab, setTab] = useState<Tab>('ALL');
  const [noPay, setNoPay] = useState<Credit | null>(null);
  const [reason, setReason] = useState('NO_ESTABA');
  const [saving, setSaving] = useState(false);

  const load = async () => {
    setLoading(true); setError('');
    try {
      const response: any = await apiClient('/api/collections/portfolio?scope=all');
      setData(response?.data || []);
    } catch (e: any) { setError(e?.message || 'No pudimos cargar la cartera.'); }
    finally { setLoading(false); }
  };
  useEffect(() => { void load(); }, []);

  const stats = useMemo(() => ({
    clients: data.length,
    without: data.filter((item) => item.hasActiveCredit === false).length,
    balance: data.reduce((sum, item) => sum + Number(item.saldoActual || 0), 0),
    overdue: data.filter((item) => item.collection.overdue).reduce((sum, item) => sum + Number(item.saldoActual || 0), 0),
    today: data.filter((item) => item.collection.dueToday || item.collection.preferredToday).length,
    risk: data.filter((item) => ['HIGH', 'CRITICAL'].includes(item.client.riskLevel || '')).length,
  }), [data]);

  const filtered = useMemo(() => data.filter((item) => {
    const q = query.trim().toLowerCase();
    const address = item.client.primaryAddress;
    const searchable = `${item.client.clientNumber} ${item.client.firstName} ${item.client.lastName} ${item.client.secondLastName || ''} ${item.client.phone || ''} ${address?.street || ''} ${address?.neighborhood || ''}`.toLowerCase();
    if (q && !searchable.includes(q)) return false;
    if (tab === 'TODAY') return item.collection.overdue || item.collection.dueToday || item.collection.preferredToday;
    if (tab === 'OVERDUE') return item.collection.overdue;
    if (tab === 'RISK') return ['HIGH', 'CRITICAL'].includes(item.client.riskLevel || '');
    if (tab === 'NO_CREDIT') return item.hasActiveCredit === false;
    return true;
  }).sort((a, b) => b.collection.priorityScore - a.collection.priorityScore || b.saldoActual - a.saldoActual), [data, query, tab]);

  const chooseTab = (next: Tab) => { haptic('tap'); setTab(next); };
  const recordNoPay = () => {
    if (!noPay || noPay.hasActiveCredit === false) return;
    navigator.geolocation.getCurrentPosition(async (position) => {
      setSaving(true);
      try {
        const key = newIdempotencyKey('no-payment');
        await apiClient('/api/collections/visits', {
          method: 'POST', idempotencyKey: key,
          body: JSON.stringify({
            clientId: noPay.client.id, creditId: noPay.id, visitType: 'COLLECTION_VISIT',
            result: reason === 'NO_ESTABA' ? 'NOT_HOME' : 'REFUSED', noPaymentReason: reason,
            gpsLatitude: position.coords.latitude, gpsLongitude: position.coords.longitude,
            accuracy: position.coords.accuracy, clientCapturedAt: new Date().toISOString(), idempotencyKey: key,
          }),
        });
        haptic('success'); setNoPay(null); await load();
      } catch (e: any) { setError(e?.message || 'No pudimos registrar la visita.'); haptic('error'); }
      finally { setSaving(false); }
    }, () => setError('Activa la ubicación para registrar No pagó.'), { enableHighAccuracy: true, timeout: 10000 });
  };

  return <AppShell title="Cartera">
    <main className="mx-auto max-w-6xl px-3 pb-28 pt-3 sm:px-4">
      <PortfolioHero stats={stats} loading={loading} onRefresh={() => void load()} />
      {error && <button onClick={() => setError('')} className="mt-3 flex w-full items-center justify-between rounded-2xl border border-red-200 bg-red-50 p-3 text-left text-sm font-bold text-red-700"><span>{error}</span><X className="h-4 w-4 shrink-0" /></button>}

      <section className="sticky top-[72px] z-20 -mx-3 mt-3 border-y border-slate-200/70 bg-[var(--bitalis-bg)]/95 px-3 py-3 backdrop-blur-xl sm:mx-0 sm:rounded-3xl sm:border sm:px-4">
        <div className="flex gap-2">
          <label className="relative min-w-0 flex-1">
            <Search className="absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-slate-400" />
            <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Cliente, teléfono, calle o colonia" className="min-h-14 w-full rounded-2xl border border-slate-200 bg-white pl-12 pr-11 text-base font-semibold outline-none focus:border-[var(--bitalis-action)] focus:ring-4 focus:ring-emerald-100" />
            {query && <button onClick={() => setQuery('')} className="absolute right-1.5 top-1/2 flex h-11 w-11 -translate-y-1/2 items-center justify-center rounded-xl" aria-label="Limpiar búsqueda"><X className="h-4 w-4" /></button>}
          </label>
          <button onClick={() => chooseTab('RISK')} className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl border border-slate-200 bg-white text-[var(--bitalis-primary)] active:scale-95" aria-label="Filtrar por riesgo"><SlidersHorizontal className="h-5 w-5" /></button>
        </div>
        <div data-no-swipe className="mt-2 flex gap-2 overflow-x-auto pb-1">
          <Chip active={tab === 'ALL'} label={`Todos ${stats.clients}`} onClick={() => chooseTab('ALL')} />
          <Chip active={tab === 'TODAY'} label={`Hoy ${stats.today}`} onClick={() => chooseTab('TODAY')} />
          <Chip active={tab === 'OVERDUE'} label="Vencidos" alert onClick={() => chooseTab('OVERDUE')} />
          <Chip active={tab === 'RISK'} label={`Riesgo ${stats.risk}`} onClick={() => chooseTab('RISK')} />
          <Chip active={tab === 'NO_CREDIT'} label={`Sin crédito ${stats.without}`} onClick={() => chooseTab('NO_CREDIT')} />
        </div>
      </section>

      <div className="mb-2 mt-4 flex items-end justify-between px-1">
        <div><p className="text-[10px] font-black uppercase tracking-[.14em] text-slate-400">Resultados</p><p className="text-sm font-black text-[var(--bitalis-primary)]">{filtered.length} cliente{filtered.length === 1 ? '' : 's'}</p></div>
        <p className="text-[10px] font-bold text-slate-400">Ordenados por prioridad</p>
      </div>

      {loading ? <CardSkeletons /> : <section className="grid gap-2.5 lg:grid-cols-2">
        {filtered.map((item, index) => <ClientCard key={item.id} item={item} priority={index + 1} router={router} onNoPay={() => { setReason('NO_ESTABA'); setNoPay(item); haptic('tap'); }} />)}
        {!filtered.length && <div className="rounded-[28px] border border-dashed border-slate-300 bg-white p-10 text-center lg:col-span-2"><Search className="mx-auto h-8 w-8 text-slate-300" /><p className="mt-3 text-sm font-black text-slate-600">No encontramos clientes</p><p className="mt-1 text-xs text-slate-400">Prueba otro nombre, teléfono o filtro.</p></div>}
      </section>}
    </main>
    {noPay && <NoPaySheet client={noPay} reason={reason} saving={saving} onReason={setReason} onClose={() => !saving && setNoPay(null)} onConfirm={recordNoPay} />}
  </AppShell>;
}

function PortfolioHero({ stats, loading, onRefresh }: { stats: any; loading: boolean; onRefresh: () => void }) {
  return <section className="overflow-hidden rounded-[28px] bg-[var(--bitalis-primary)] text-white shadow-[0_18px_45px_-26px_rgba(6,43,36,.8)]">
    <div className="relative p-4 pb-3"><div className="absolute -right-10 -top-16 h-40 w-40 rounded-full bg-emerald-400/10" /><div className="relative flex items-start justify-between gap-3"><div><p className="text-[10px] font-black uppercase tracking-[.16em] text-[var(--bitalis-mint)]">Control de cobranza</p><h1 className="mt-1 text-2xl font-black">Cartera de clientes</h1><p className="mt-1 max-w-md text-xs leading-5 text-emerald-50/75">Saldo, riesgo, domicilio y acciones de campo en una sola vista.</p></div><button onClick={onRefresh} className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-white/10 active:scale-95" aria-label="Actualizar cartera"><RefreshCw className={`h-5 w-5 ${loading ? 'animate-spin' : ''}`} /></button></div></div>
    <div className="grid grid-cols-2 border-t border-white/10 sm:grid-cols-4"><Metric icon={<Users />} label="Clientes" value={String(stats.clients)} /><Metric icon={<WalletCards />} label="Saldo total" value={money.format(stats.balance)} /><Metric icon={<AlertTriangle />} label="Vencido" value={money.format(stats.overdue)} danger /><Metric icon={<UserRound />} label="Sin crédito" value={String(stats.without)} /></div>
  </section>;
}

function ClientCard({ item, priority, router, onNoPay }: { item: Credit; priority: number; router: ReturnType<typeof useRouter>; onNoPay: () => void }) {
  const active = item.hasActiveCredit !== false, client = item.client, phone = client.phone || '';
  const gps = client.latitude != null && client.longitude != null, address = client.primaryAddress;
  const addressText = address ? `${address.street || ''} ${address.exteriorNumber || ''}${address.neighborhood ? ` · ${address.neighborhood}` : ''}`.trim() : '';
  const fullName = `${client.firstName} ${client.lastName} ${client.secondLastName || ''}`.trim();
  const nextDate = item.collection.nextScheduledDate ? new Date(item.collection.nextScheduledDate).toLocaleDateString('es-MX', { day: 'numeric', month: 'short' }) : null;
  const [offset, setOffset] = useState(0);
  const [menu, setMenu] = useState(false);
  const gesture = useRef<{ x: number; y: number; timer?: ReturnType<typeof setTimeout>; moved: boolean } | null>(null);
  const openRecord = () => { haptic('tap'); router.push(`/clients/${client.id}`); };
  const call = () => { if (phone) { haptic('tap'); window.location.href = `tel:${phone}`; } };
  const whatsapp = () => { if (phone) { haptic('tap'); window.open(`https://wa.me/52${phone.replace(/\D/g, '').replace(/^52/, '')}`, '_blank', 'noopener,noreferrer'); } };
  const navigate = () => { if (gps) { haptic('tap'); window.open(`https://www.google.com/maps/dir/?api=1&destination=${client.latitude},${client.longitude}&travelmode=driving`, '_blank', 'noopener,noreferrer'); } };
  const collect = () => { if (active) { haptic('success'); router.push(`/collections?credit=${item.id}`); } };
  const beginGesture = (event: React.PointerEvent<HTMLElement>) => {
    if ((event.target as Element).closest('button,a')) return;
    gesture.current = { x: event.clientX, y: event.clientY, moved: false };
    gesture.current.timer = setTimeout(() => {
      if (!gesture.current?.moved) { haptic('heavy'); setMenu(true); setOffset(0); }
    }, 520);
    event.currentTarget.setPointerCapture(event.pointerId);
  };
  const moveGesture = (event: React.PointerEvent<HTMLElement>) => {
    if (!gesture.current) return;
    const dx = event.clientX - gesture.current.x, dy = event.clientY - gesture.current.y;
    if (Math.abs(dx) > 8 || Math.abs(dy) > 8) {
      gesture.current.moved = true;
      if (gesture.current.timer) clearTimeout(gesture.current.timer);
    }
    if (Math.abs(dx) > Math.abs(dy)) setOffset(Math.max(-96, Math.min(96, dx)));
  };
  const endGesture = () => {
    const dx = offset;
    if (gesture.current?.timer) clearTimeout(gesture.current.timer);
    gesture.current = null;
    setOffset(0);
    if (dx >= 72 && active) collect();
    else if (dx <= -72 && active) { haptic('warning'); onNoPay(); }
  };

  return <article className="relative overflow-hidden rounded-[22px] border border-[var(--bitalis-border)] bg-slate-100 shadow-[0_10px_28px_-24px_rgba(15,23,42,.55)]">
    <div className="absolute inset-y-0 left-0 flex w-24 items-center justify-center bg-emerald-600 text-xs font-black text-white"><Banknote className="mr-1 h-5 w-5" />COBRAR</div>
    <div className="absolute inset-y-0 right-0 flex w-24 items-center justify-center bg-amber-500 text-xs font-black text-slate-950"><UserX className="mr-1 h-5 w-5" />NO PAGÓ</div>
    <section
      onPointerDown={beginGesture}
      onPointerMove={moveGesture}
      onPointerUp={endGesture}
      onPointerCancel={endGesture}
      style={{ transform: `translateX(${offset}px)`, touchAction: 'pan-y' }}
      className="relative bg-white p-3 transition-transform duration-150"
      aria-label={`${fullName}. Desliza a la derecha para cobrar o a la izquierda para registrar no pagó.`}
    >
      <div className="flex min-w-0 gap-3">
        <button onClick={openRecord} className="relative h-16 w-16 shrink-0 overflow-hidden rounded-2xl bg-slate-100" aria-label={`Abrir expediente de ${fullName}`}>
          <EvidenceImage storageKey={client.facadeStorageKey} alt={`Fachada de ${fullName}`} className="h-full w-full object-cover !rounded-none" />
          {!client.facadeStorageKey && <Camera className="absolute inset-0 m-auto h-5 w-5 text-slate-400" />}
        </button>
        <div className="min-w-0 flex-1">
          <div className="flex items-start justify-between gap-2">
            <button onClick={openRecord} className="min-w-0 text-left"><h2 className="truncate text-[15px] font-black leading-5 text-[var(--bitalis-primary)]">{fullName}</h2><p className="text-[9px] font-bold uppercase tracking-wide text-slate-400">{client.clientNumber}</p></button>
            <div className="flex shrink-0 gap-1">{active && <StatusBadge tone="dark">#{priority}</StatusBadge>}{item.collection.overdue && <StatusBadge tone="red">VENCIDO</StatusBadge>}</div>
          </div>
          <div className="mt-1 flex items-center gap-2"><RiskBadge risk={client.riskLevel || 'LOW'} /><span className="truncate text-[9px] font-bold text-slate-400">{nextDate ? `Próximo ${nextDate}` : active ? 'Cobro pendiente' : 'Sin crédito'}</span></div>
          <p title={addressText} className="mt-1 flex min-w-0 items-center gap-1 text-[11px] font-semibold text-slate-600"><MapPin className="h-3.5 w-3.5 shrink-0 text-emerald-700" /><span className="truncate">{addressText || 'Domicilio pendiente'}</span></p>
        </div>
      </div>

      <div className="mt-2 grid grid-cols-[1fr_1fr_auto] items-stretch overflow-hidden rounded-2xl border border-slate-200 bg-slate-50">
        <div className="px-3 py-2"><p className="text-[8px] font-black uppercase tracking-wide text-slate-400">Cobrar ahora</p><p className="text-lg font-black leading-5 text-emerald-700">{active ? money.format(item.suggestedInstallment || 0) : '—'}</p></div>
        <div className="border-l border-slate-200 px-3 py-2"><p className="text-[8px] font-black uppercase tracking-wide text-slate-400">Saldo pendiente</p><p className="text-lg font-black leading-5 text-[var(--bitalis-primary)]">{active ? money.format(item.saldoActual) : 'Sin saldo'}</p></div>
        <button disabled={!active} onClick={collect} className="flex min-h-12 min-w-24 items-center justify-center gap-1.5 bg-[var(--bitalis-action)] px-3 text-xs font-black text-white active:scale-[.98] disabled:bg-slate-200 disabled:text-slate-400"><Banknote className="h-4 w-4" />Cobrar</button>
      </div>

      <div className="mt-1 flex items-center justify-between">
        <p className="text-[9px] font-bold text-slate-400">↔ Desliza · mantén pulsado para más acciones</p>
        <button onClick={() => { haptic('tap'); setMenu((value) => !value); }} className="flex min-h-12 items-center px-3 text-[10px] font-black text-[var(--bitalis-primary)]" aria-expanded={menu}>MÁS</button>
      </div>

      {menu && <div className="absolute inset-x-2 bottom-2 z-10 flex items-center justify-between rounded-2xl border border-slate-200 bg-white p-2 shadow-xl">
        <NativeAction label="Llamar" icon={<Phone />} disabled={!phone} onClick={call} />
        <NativeAction label="WhatsApp" icon={<MessageCircle />} disabled={!phone} onClick={whatsapp} />
        <NativeAction label="Navegar" icon={<Navigation />} disabled={!gps} onClick={navigate} />
        <NativeAction label="Expediente" icon={<Users />} onClick={openRecord} />
        <button onClick={() => setMenu(false)} className="flex h-12 w-12 items-center justify-center rounded-xl bg-slate-100" aria-label="Cerrar acciones"><X className="h-4 w-4" /></button>
      </div>}
    </section>
  </article>;
}

function NativeAction({ label, icon, disabled, onClick }: { label: string; icon: React.ReactNode; disabled?: boolean; onClick: () => void }) { return <button disabled={disabled} onClick={onClick} title={label} aria-label={label} className="flex h-12 w-12 items-center justify-center rounded-xl border border-slate-200 bg-white text-[var(--bitalis-primary)] active:scale-95 disabled:opacity-30 [&>svg]:h-5 [&>svg]:w-5">{icon}</button>; }

function NoPaySheet({ client, reason, saving, onReason, onClose, onConfirm }: { client: Credit; reason: string; saving: boolean; onReason: (value: string) => void; onClose: () => void; onConfirm: () => void }) { return <div className="fixed inset-0 z-[170] flex items-end bg-black/50 backdrop-blur-[2px]" onClick={onClose}><section className="bitalis-bottom-sheet bitalis-safe-bottom w-full p-4 pb-6" onClick={(event) => event.stopPropagation()}><div className="mx-auto max-w-xl"><div className="mx-auto mb-4 h-1.5 w-12 rounded-full bg-slate-200" /><div className="flex justify-between"><div><p className="text-[10px] font-black uppercase tracking-widest text-amber-600">Visita de cobranza</p><p className="mt-1 text-xl font-black text-[var(--bitalis-primary)]">Registrar No pagó</p><p className="text-xs text-slate-500">{client.client.firstName} {client.client.lastName}</p></div><button disabled={saving} onClick={onClose} className="h-12 w-12 rounded-full bg-slate-100"><X className="mx-auto h-5 w-5" /></button></div><p className="mt-4 text-xs font-black uppercase text-slate-500">Selecciona el motivo</p><div className="mt-2 grid grid-cols-2 gap-2">{reasons.map(([value, label]) => <button key={value} onClick={() => { haptic('tap'); onReason(value); }} className={`min-h-12 rounded-2xl border px-3 text-xs font-bold ${reason === value ? 'border-amber-500 bg-amber-50 text-amber-900 ring-2 ring-amber-100' : 'border-slate-200'}`}>{label}</button>)}</div><button disabled={saving} onClick={onConfirm} className="mt-4 flex min-h-14 w-full items-center justify-center gap-2 rounded-2xl bg-[var(--bitalis-primary)] font-black text-white active:scale-[.99]">{saving ? <Loader2 className="h-5 w-5 animate-spin" /> : <MapPin className="h-5 w-5" />}CONFIRMAR CON UBICACIÓN</button></div></section></div>; }
function Metric({ icon, label, value, danger }: { icon: React.ReactNode; label: string; value: string; danger?: boolean }) { return <div className="border-r border-t border-white/10 p-3 last:border-r-0 sm:border-t-0"><div className="flex items-center gap-1.5 text-[9px] font-black uppercase text-emerald-50/65"><span className="[&>svg]:h-3.5 [&>svg]:w-3.5">{icon}</span>{label}</div><p className={`mt-1 truncate text-lg font-black ${danger ? 'text-amber-300' : ''}`}>{value}</p></div>; }
function ValueBlock({ icon, label, value, green }: { icon: React.ReactNode; label: string; value: string; green?: boolean }) { return <div className="min-w-0 border-r border-slate-200 p-3 last:border-r-0"><p className="flex items-center gap-1 text-[9px] font-black uppercase text-slate-400"><span className="[&>svg]:h-3.5 [&>svg]:w-3.5">{icon}</span>{label}</p><p className={`mt-1 truncate text-base font-black ${green ? 'text-emerald-700' : 'text-[var(--bitalis-primary)]'}`}>{value}</p></div>; }
function RiskBadge({ risk }: { risk: string }) { const style = risk === 'CRITICAL' ? 'bg-red-100 text-red-800' : risk === 'HIGH' ? 'bg-orange-100 text-orange-800' : risk === 'MEDIUM' ? 'bg-amber-100 text-amber-800' : 'bg-emerald-100 text-emerald-800'; return <span className={`rounded-full px-2.5 py-1 text-[9px] font-black ${style}`}>RIESGO {risk === 'CRITICAL' ? 'CRÍTICO' : risk === 'HIGH' ? 'ALTO' : risk === 'MEDIUM' ? 'MEDIO' : 'BAJO'}</span>; }
function StatusBadge({ children, tone }: { children: React.ReactNode; tone: 'dark' | 'red' | 'blue' }) { const style = tone === 'red' ? 'bg-red-600 text-white' : tone === 'blue' ? 'bg-blue-600 text-white' : 'bg-slate-950/65 text-white backdrop-blur'; return <span className={`rounded-full px-2.5 py-1 text-[9px] font-black shadow-sm ${style}`}>{children}</span>; }
function Chip({ active, label, onClick, alert }: { active: boolean; label: string; onClick: () => void; alert?: boolean }) { return <button onClick={onClick} className={`min-h-11 shrink-0 rounded-full px-4 text-xs font-black transition active:scale-95 ${active ? alert ? 'bg-red-600 text-white' : 'bg-[var(--bitalis-primary)] text-white' : 'border border-slate-200 bg-white text-slate-600'}`}>{label}</button>; }
function CardSkeletons() { return <div className="grid gap-2.5 lg:grid-cols-2">{[1, 2].map((item) => <div key={item} className="overflow-hidden rounded-[28px] border border-slate-200 bg-white"><div className="h-40 animate-pulse bg-slate-200" /><div className="space-y-3 p-4"><div className="h-5 w-2/3 animate-pulse rounded bg-slate-100" /><div className="h-16 animate-pulse rounded-2xl bg-slate-100" /><div className="h-14 animate-pulse rounded-2xl bg-slate-100" /></div></div>)}</div>; }
