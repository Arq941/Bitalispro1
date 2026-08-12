'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  AlertTriangle, Banknote, Bell, Boxes, CircleDollarSign, ClipboardList, Coins,
  LogOut, Package, RefreshCw, Repeat2, Route, ShieldCheck, ShoppingBag, TrendingUp,
  UserPlus, Users, WalletCards
} from 'lucide-react';
import BitalisLogo from '@/components/BitalisLogo';

type AuthUser = { id: string; email: string; firstName?: string; lastName?: string; role: string };
type ClientRecord = { id: string; clientNumber: string; firstName: string; lastName: string; phone: string; status: string; riskLevel: string };
type SaleRecord = { id: string; saleNumber: string; saleType: string; status: string; totalAmount: string | number; totalFinanced?: string | number };
const money = new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN', maximumFractionDigits: 0 });
const amount = (value: any) => Number.isFinite(Number(value)) ? Number(value) : 0;

const modules = [
  { title: 'Ruta de cobranza', subtitle: 'GPS, cercanía y siguiente cliente', path: '/route', icon: Route },
  { title: 'Clientes / CRM', subtitle: 'Altas, búsqueda y edición', path: '/clients', icon: Users },
  { title: 'Nueva venta', subtitle: 'Contado y crédito', path: '/sales', icon: ShoppingBag },
  { title: 'Cobranza', subtitle: 'Cartera y seguimiento', path: '/collections', icon: WalletCards },
  { title: 'Caja', subtitle: 'Apertura, arqueo y control', path: '/cash', icon: Banknote },
  { title: 'Productos', subtitle: 'Catálogo y precios', path: '/products', icon: Package },
  { title: 'Inventario', subtitle: 'Existencias y almacenes', path: '/inventory', icon: Boxes },
  { title: 'Comisiones', subtitle: 'Ventas y cobranza', path: '/commissions', icon: Coins },
  { title: 'Renovaciones', subtitle: 'Recompra y seguimiento', path: '/renewals', icon: Repeat2 },
  { title: 'Pedidos', subtitle: 'Abastecimiento de producto', path: '/orders', icon: ClipboardList },
  { title: 'Notificaciones', subtitle: 'Alertas del sistema', path: '/notifications', icon: Bell },
];

export default function ProductionDashboardPage() {
  const router = useRouter();
  const [user, setUser] = useState<AuthUser | null>(null);
  const [clients, setClients] = useState<ClientRecord[]>([]);
  const [totalClients, setTotalClients] = useState(0);
  const [sales, setSales] = useState<SaleRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    const token = localStorage.getItem('bitalis_access_token');
    const rawUser = localStorage.getItem('bitalis_auth_user');
    if (!token || !rawUser) { router.replace('/'); return; }
    try {
      setUser(JSON.parse(rawUser));
      setLoading(true); setError('');
      const headers = { Authorization: `Bearer ${token}` };
      const [cr, sr] = await Promise.all([
        fetch('/api/clients?page=1&limit=6', { headers, cache: 'no-store' }),
        fetch('/api/sales', { headers, cache: 'no-store' }),
      ]);
      if (cr.status === 401 || sr.status === 401) { router.replace('/'); return; }
      const cj = await cr.json().catch(() => ({}));
      const sj = await sr.json().catch(() => ({}));
      if (!cr.ok) throw new Error(cj?.error || 'Error al cargar clientes.');
      if (!sr.ok) throw new Error(sj?.error || 'Error al cargar ventas.');
      setClients(Array.isArray(cj?.data) ? cj.data : []);
      setTotalClients(Number(cj?.pagination?.total || 0));
      setSales(Array.isArray(sj?.sales) ? sj.sales : []);
    } catch (e: any) { setError(e?.message || 'No fue posible actualizar el panel.'); }
    finally { setLoading(false); }
  }, [router]);

  useEffect(() => { load(); }, [load]);

  const metrics = useMemo(() => {
    const active = sales.filter((s) => ['APPROVED','COMPLETED'].includes(s.status));
    const pending = sales.filter((s) => ['DRAFT','PENDING_AUTHORIZATION'].includes(s.status));
    const total = active.reduce((sum, s) => sum + amount(s.totalAmount), 0);
    const portfolio = sales.filter((s) => s.saleType === 'CREDIT').reduce((sum, s) => sum + amount(s.totalFinanced ?? s.totalAmount), 0);
    return { active: active.length, pending: pending.length, total, portfolio };
  }, [sales]);

  const logout = () => {
    localStorage.removeItem('bitalis_access_token'); localStorage.removeItem('bitalis_refresh_token'); localStorage.removeItem('bitalis_auth_user'); router.replace('/');
  };
  const displayName = `${user?.firstName || ''} ${user?.lastName || ''}`.trim() || user?.email || 'Administrador';

  return <div className="min-h-screen bg-slate-950 text-slate-100">
    <header className="sticky top-0 z-30 border-b border-white/5 bg-slate-950/90 backdrop-blur-xl">
      <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-3 sm:px-6">
        <BitalisLogo size="md" variant="dark" />
        <div className="flex gap-2">
          <button onClick={load} className="flex h-10 w-10 items-center justify-center rounded-xl border border-slate-800 bg-slate-900"><RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} /></button>
          <button onClick={logout} className="flex items-center gap-2 rounded-xl border border-slate-800 bg-slate-900 px-3 text-xs font-bold"><LogOut className="h-4 w-4" />Salir</button>
        </div>
      </div>
    </header>

    <main className="mx-auto max-w-7xl px-4 py-6 sm:px-6 sm:py-8">
      <section className="rounded-[30px] border border-emerald-400/10 bg-gradient-to-br from-slate-900 via-slate-900 to-emerald-950/30 p-5 sm:p-8">
        <div className="inline-flex items-center gap-2 rounded-full border border-emerald-400/15 bg-emerald-400/5 px-3 py-1.5 text-[10px] font-black uppercase tracking-[.15em] text-emerald-300"><ShieldCheck className="h-3.5 w-3.5" /> Producción MySQL</div>
        <h1 className="mt-4 text-2xl font-black sm:text-4xl">Hola, {displayName}</h1>
        <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-400">Centro operativo BITALIS. Toda la interfaz nueva trabaja sobre las APIs de producción y reemplaza el panel anterior.</p>
        <button onClick={() => router.push('/route')} className="mt-5 inline-flex items-center gap-2 rounded-2xl bg-emerald-500 px-5 py-3 text-sm font-black text-slate-950"><Route className="h-5 w-5"/> Iniciar ruta de cobranza</button>
      </section>

      {error && <div className="mt-4 flex items-center gap-2 rounded-2xl border border-amber-400/20 bg-amber-500/10 p-4 text-sm text-amber-100"><AlertTriangle className="h-5 w-5" />{error}</div>}

      <section className="mt-5 grid grid-cols-2 gap-3 lg:grid-cols-4">
        {[
          ['Clientes', totalClients, 'CRM activo', Users],
          ['Ventas activas', metrics.active, money.format(metrics.total), TrendingUp],
          ['Cartera crédito', money.format(metrics.portfolio), 'Saldo originado', CircleDollarSign],
          ['Por revisar', metrics.pending, 'Pendientes', ShieldCheck],
        ].map(([label,value,detail,Icon]: any) => <article key={label} className="rounded-2xl border border-white/5 bg-slate-900/70 p-4"><Icon className="h-5 w-5 text-emerald-400"/><p className="mt-4 text-[10px] font-bold uppercase text-slate-500">{label}</p><p className="mt-1 break-words text-xl font-black text-white">{loading ? '—' : value}</p><p className="mt-1 text-[10px] text-slate-600">{detail}</p></article>)}
      </section>

      <div className="mt-7 flex items-end justify-between"><div><p className="text-xs font-black uppercase tracking-[.16em] text-emerald-400">Módulos</p><h2 className="mt-1 text-xl font-black text-white">Operación completa</h2></div><button onClick={() => router.push('/clients')} className="hidden items-center gap-2 rounded-xl bg-emerald-500 px-4 py-2.5 text-xs font-black text-slate-950 sm:flex"><UserPlus className="h-4 w-4" />Nuevo cliente</button></div>

      <section className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
        {modules.map((module) => { const Icon = module.icon; return <button key={module.path} onClick={() => router.push(module.path)} className="group rounded-[22px] border border-white/5 bg-slate-900/70 p-4 text-left transition hover:-translate-y-0.5 hover:border-emerald-400/20 hover:bg-slate-900"><div className="flex h-11 w-11 items-center justify-center rounded-2xl border border-emerald-400/10 bg-emerald-400/5 text-emerald-400"><Icon className="h-5 w-5"/></div><p className="mt-4 text-sm font-black text-white">{module.title}</p><p className="mt-1 text-[11px] leading-5 text-slate-500">{module.subtitle}</p></button>; })}
      </section>

      <section className="mt-7 overflow-hidden rounded-[24px] border border-white/5 bg-slate-900/70">
        <div className="border-b border-white/5 px-5 py-4"><p className="text-sm font-black text-white">Clientes recientes</p><p className="text-[11px] text-slate-500">Últimos registros visibles en producción</p></div>
        {clients.length === 0 ? <div className="px-5 py-8 text-center text-sm text-slate-500">Aún no hay clientes.</div> : <div className="divide-y divide-white/5">{clients.map((c) => <div key={c.id} className="flex items-center justify-between gap-3 px-5 py-4"><div><p className="text-sm font-bold text-white">{c.firstName} {c.lastName}</p><p className="text-[11px] text-slate-500">{c.clientNumber} · {c.phone}</p></div><button onClick={() => router.push('/clients')} className="rounded-xl border border-slate-800 px-3 py-2 text-[10px] font-black text-slate-300">Abrir CRM</button></div>)}</div>}
      </section>
    </main>
  </div>;
}