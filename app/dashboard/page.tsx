'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  AlertTriangle,
  CircleDollarSign,
  Clock3,
  LogOut,
  RefreshCw,
  ShieldCheck,
  ShoppingBag,
  TrendingUp,
  UserPlus,
  Users,
} from 'lucide-react';
import BitalisLogo from '@/components/BitalisLogo';

type AuthUser = { id: string; email: string; firstName?: string; lastName?: string; role: string };
type ClientRecord = { id: string; clientNumber: string; firstName: string; lastName: string; secondLastName?: string | null; phone: string; status: string; riskLevel: string; createdAt: string };
type SaleRecord = { id: string; saleNumber: string; saleType: string; status: string; totalAmount: string | number; totalFinanced?: string | number; createdAt: string };

type DashboardState = { clients: ClientRecord[]; totalClients: number; sales: SaleRecord[] };

const money = new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN', maximumFractionDigits: 0 });
const amount = (value: string | number | undefined) => { const n = Number(value || 0); return Number.isFinite(n) ? n : 0; };

export default function ProductionDashboardPage() {
  const router = useRouter();
  const [user, setUser] = useState<AuthUser | null>(null);
  const [data, setData] = useState<DashboardState>({ clients: [], totalClients: 0, sales: [] });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const loadDashboard = useCallback(async () => {
    const token = localStorage.getItem('bitalis_access_token');
    const rawUser = localStorage.getItem('bitalis_auth_user');
    if (!token || !rawUser) { router.replace('/'); return; }

    try {
      setUser(JSON.parse(rawUser));
      setLoading(true);
      setError('');
      const headers = { Authorization: `Bearer ${token}` };
      const [clientsResponse, salesResponse] = await Promise.all([
        fetch('/api/clients?page=1&limit=6', { headers, cache: 'no-store' }),
        fetch('/api/sales', { headers, cache: 'no-store' }),
      ]);
      if (clientsResponse.status === 401 || salesResponse.status === 401) {
        localStorage.removeItem('bitalis_access_token');
        localStorage.removeItem('bitalis_refresh_token');
        localStorage.removeItem('bitalis_auth_user');
        router.replace('/');
        return;
      }
      const clientsJson = await clientsResponse.json().catch(() => ({}));
      const salesJson = await salesResponse.json().catch(() => ({}));
      if (!clientsResponse.ok) throw new Error(clientsJson?.error || 'No fue posible cargar clientes.');
      if (!salesResponse.ok) throw new Error(salesJson?.error || 'No fue posible cargar ventas.');
      setData({
        clients: Array.isArray(clientsJson?.data) ? clientsJson.data : [],
        totalClients: Number(clientsJson?.pagination?.total || 0),
        sales: Array.isArray(salesJson?.sales) ? salesJson.sales : [],
      });
    } catch (err: any) {
      setError(err?.message || 'No fue posible cargar el panel.');
    } finally {
      setLoading(false);
    }
  }, [router]);

  useEffect(() => { loadDashboard(); }, [loadDashboard]);

  const metrics = useMemo(() => {
    const approvedSales = data.sales.filter((sale) => ['APPROVED', 'COMPLETED'].includes(sale.status));
    const creditSales = data.sales.filter((sale) => sale.saleType === 'CREDIT');
    return {
      approvedSales: approvedSales.length,
      totalSold: approvedSales.reduce((sum, sale) => sum + amount(sale.totalAmount), 0),
      portfolio: creditSales.reduce((sum, sale) => sum + amount(sale.totalFinanced || sale.totalAmount), 0),
      pending: data.sales.filter((sale) => ['DRAFT', 'PENDING_AUTHORIZATION'].includes(sale.status)).length,
    };
  }, [data.sales]);

  const logout = () => {
    localStorage.removeItem('bitalis_access_token');
    localStorage.removeItem('bitalis_refresh_token');
    localStorage.removeItem('bitalis_auth_user');
    router.replace('/');
  };

  const displayName = `${user?.firstName || ''} ${user?.lastName || ''}`.trim() || user?.email || 'Administrador';

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100">
      <header className="sticky top-0 z-30 border-b border-white/5 bg-slate-950/90 backdrop-blur-xl">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-3 px-4 py-3 sm:px-6">
          <BitalisLogo size="md" variant="dark" />
          <div className="flex items-center gap-2">
            <button onClick={loadDashboard} disabled={loading} className="flex h-10 w-10 items-center justify-center rounded-xl border border-slate-800 bg-slate-900 text-slate-300"><RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} /></button>
            <button onClick={logout} className="flex items-center gap-2 rounded-xl border border-slate-800 bg-slate-900 px-3 py-2 text-xs font-bold text-slate-300"><LogOut className="h-4 w-4" /> Salir</button>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-7xl px-4 py-6 sm:px-6 sm:py-8">
        <section className="rounded-[28px] border border-emerald-400/10 bg-gradient-to-br from-slate-900 to-emerald-950/30 p-5 sm:p-7">
          <div className="inline-flex items-center gap-2 rounded-full border border-emerald-400/15 bg-emerald-400/5 px-3 py-1.5 text-[11px] font-bold text-emerald-300"><ShieldCheck className="h-3.5 w-3.5" /> Sistema operativo conectado</div>
          <h1 className="mt-4 text-2xl font-black text-white sm:text-3xl">Bienvenido, {displayName}</h1>
          <p className="mt-2 text-sm text-slate-400">Selecciona un módulo para trabajar en producción.</p>

          <div className="mt-6 grid gap-3 sm:grid-cols-2">
            <button onClick={() => router.push('/clients')} className="flex items-center gap-4 rounded-2xl border border-emerald-400/20 bg-emerald-500/10 p-5 text-left transition hover:bg-emerald-500/15 active:scale-[.99]">
              <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-emerald-500 text-slate-950"><UserPlus className="h-6 w-6" /></div>
              <div><p className="text-base font-black text-white">Clientes / CRM</p><p className="mt-1 text-xs text-slate-400">Ver, buscar, editar y agregar nuevos clientes</p></div>
            </button>
            <button onClick={() => router.push('/sales')} className="flex items-center gap-4 rounded-2xl border border-cyan-400/20 bg-cyan-500/10 p-5 text-left transition hover:bg-cyan-500/15 active:scale-[.99]">
              <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-cyan-500 text-slate-950"><ShoppingBag className="h-6 w-6" /></div>
              <div><p className="text-base font-black text-white">Ventas</p><p className="mt-1 text-xs text-slate-400">Registrar ventas de contado y crédito</p></div>
            </button>
          </div>
        </section>

        {error && <div className="mt-5 flex items-start gap-3 rounded-2xl border border-red-400/20 bg-red-500/10 p-4 text-sm text-red-200"><AlertTriangle className="h-5 w-5 shrink-0" /><span>{error}</span></div>}

        <section className="mt-5 grid grid-cols-2 gap-3 lg:grid-cols-4">
          {[
            { label: 'Clientes', value: data.totalClients.toLocaleString('es-MX'), detail: 'CRM MySQL', icon: Users },
            { label: 'Ventas activas', value: metrics.approvedSales.toLocaleString('es-MX'), detail: money.format(metrics.totalSold), icon: ShoppingBag },
            { label: 'Cartera crédito', value: money.format(metrics.portfolio), detail: 'Saldo originado', icon: CircleDollarSign },
            { label: 'Por revisar', value: metrics.pending.toLocaleString('es-MX'), detail: 'Pendientes', icon: Clock3 },
          ].map((item) => {
            const Icon = item.icon;
            return <article key={item.label} className="rounded-2xl border border-white/5 bg-slate-900/70 p-4"><div className="mb-3 flex items-center justify-between"><Icon className="h-4 w-4 text-emerald-400" /><TrendingUp className="h-4 w-4 text-slate-700" /></div><p className="text-[10px] font-bold uppercase text-slate-500">{item.label}</p><p className="mt-1 text-xl font-black text-white">{loading ? '—' : item.value}</p><p className="mt-1 text-[10px] text-slate-600">{item.detail}</p></article>;
          })}
        </section>
      </main>
    </div>
  );
}
