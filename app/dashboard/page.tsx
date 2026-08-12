'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  Activity,
  AlertTriangle,
  ArrowRight,
  BadgeCheck,
  Banknote,
  BriefcaseBusiness,
  CircleDollarSign,
  Clock3,
  LogOut,
  RefreshCw,
  ShieldCheck,
  ShoppingBag,
  Sparkles,
  TrendingUp,
  UserRound,
  Users,
} from 'lucide-react';
import BitalisLogo from '@/components/BitalisLogo';

type AuthUser = {
  id: string;
  email: string;
  firstName?: string;
  lastName?: string;
  role: string;
};

type ClientRecord = {
  id: string;
  clientNumber: string;
  firstName: string;
  lastName: string;
  secondLastName?: string | null;
  phone: string;
  status: string;
  riskLevel: string;
  createdAt: string;
};

type SaleRecord = {
  id: string;
  saleNumber: string;
  saleType: string;
  status: string;
  totalAmount: string | number;
  totalFinanced?: string | number;
  createdAt: string;
};

type DashboardState = {
  clients: ClientRecord[];
  totalClients: number;
  sales: SaleRecord[];
};

const money = new Intl.NumberFormat('es-MX', {
  style: 'currency',
  currency: 'MXN',
  maximumFractionDigits: 0,
});

function amount(value: string | number | undefined) {
  const n = Number(value || 0);
  return Number.isFinite(n) ? n : 0;
}

function riskClass(risk: string) {
  if (risk === 'CRITICAL') return 'border-red-400/20 bg-red-500/10 text-red-300';
  if (risk === 'HIGH') return 'border-orange-400/20 bg-orange-500/10 text-orange-300';
  if (risk === 'MEDIUM') return 'border-amber-400/20 bg-amber-500/10 text-amber-300';
  return 'border-emerald-400/20 bg-emerald-500/10 text-emerald-300';
}

export default function ProductionDashboardPage() {
  const router = useRouter();
  const [user, setUser] = useState<AuthUser | null>(null);
  const [data, setData] = useState<DashboardState>({ clients: [], totalClients: 0, sales: [] });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);

  const loadDashboard = useCallback(async () => {
    const token = localStorage.getItem('bitalis_access_token');
    const rawUser = localStorage.getItem('bitalis_auth_user');

    if (!token || !rawUser) {
      router.replace('/');
      return;
    }

    try {
      const parsedUser = JSON.parse(rawUser) as AuthUser;
      setUser(parsedUser);
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
      setLastUpdated(new Date());
    } catch (err: any) {
      setError(err?.message || 'No fue posible cargar el panel de producción.');
    } finally {
      setLoading(false);
    }
  }, [router]);

  useEffect(() => {
    loadDashboard();
  }, [loadDashboard]);

  const metrics = useMemo(() => {
    const approvedSales = data.sales.filter((sale) => ['APPROVED', 'COMPLETED'].includes(sale.status));
    const creditSales = data.sales.filter((sale) => sale.saleType === 'CREDIT');
    const portfolio = creditSales.reduce((sum, sale) => sum + amount(sale.totalFinanced || sale.totalAmount), 0);
    const totalSold = approvedSales.reduce((sum, sale) => sum + amount(sale.totalAmount), 0);
    const pending = data.sales.filter((sale) => ['DRAFT', 'PENDING_AUTHORIZATION'].includes(sale.status)).length;
    return { approvedSales: approvedSales.length, portfolio, totalSold, pending };
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
          <div className="flex min-w-0 items-center gap-3">
            <BitalisLogo size="md" variant="dark" />
            <div className="hidden border-l border-white/10 pl-3 sm:block">
              <p className="text-[10px] font-black uppercase tracking-[0.2em] text-emerald-400">Producción</p>
              <p className="text-xs text-slate-400">MySQL · Prisma · JWT</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={loadDashboard}
              disabled={loading}
              className="flex h-10 w-10 items-center justify-center rounded-xl border border-slate-800 bg-slate-900 text-slate-300 transition hover:border-emerald-500/40 hover:text-emerald-300 disabled:opacity-50"
              aria-label="Actualizar panel"
            >
              <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
            </button>
            <button
              type="button"
              onClick={logout}
              className="flex items-center gap-2 rounded-xl border border-slate-800 bg-slate-900 px-3 py-2 text-xs font-bold text-slate-300 transition hover:border-red-400/30 hover:text-red-300"
            >
              <LogOut className="h-4 w-4" />
              <span className="hidden sm:inline">Salir</span>
            </button>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-7xl px-4 py-6 sm:px-6 sm:py-8">
        <section className="relative overflow-hidden rounded-[28px] border border-emerald-400/10 bg-gradient-to-br from-slate-900 via-slate-900 to-emerald-950/30 p-5 shadow-2xl shadow-black/20 sm:p-7">
          <div className="absolute -right-16 -top-20 h-52 w-52 rounded-full bg-emerald-400/10 blur-3xl" />
          <div className="relative flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <div className="mb-3 inline-flex items-center gap-2 rounded-full border border-emerald-400/15 bg-emerald-400/5 px-3 py-1.5 text-[11px] font-bold text-emerald-300">
                <BadgeCheck className="h-3.5 w-3.5" /> Sistema operativo conectado
              </div>
              <h1 className="text-2xl font-black tracking-tight text-white sm:text-3xl">Buenos días, {displayName}</h1>
              <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-400">
                Vista ejecutiva de BITALIS con datos consultados directamente desde la base MySQL de producción.
              </p>
            </div>
            <div className="flex items-center gap-3 rounded-2xl border border-white/5 bg-slate-950/50 px-4 py-3">
              <ShieldCheck className="h-8 w-8 text-emerald-400" />
              <div>
                <p className="text-xs font-black text-white">Sesión protegida</p>
                <p className="mt-0.5 text-[11px] text-slate-500">Rol: {user?.role || 'ADMIN'}</p>
              </div>
            </div>
          </div>
        </section>

        {error && (
          <div className="mt-5 flex items-start gap-3 rounded-2xl border border-red-400/20 bg-red-500/10 p-4 text-sm text-red-200">
            <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0" />
            <div className="flex-1">
              <p className="font-bold">No pudimos actualizar algunos datos.</p>
              <p className="mt-1 text-xs text-red-200/80">{error}</p>
            </div>
          </div>
        )}

        <section className="mt-5 grid grid-cols-2 gap-3 lg:grid-cols-4">
          {[
            { label: 'Clientes', value: data.totalClients.toLocaleString('es-MX'), detail: 'CRM MySQL', icon: Users },
            { label: 'Ventas activas', value: metrics.approvedSales.toLocaleString('es-MX'), detail: money.format(metrics.totalSold), icon: ShoppingBag },
            { label: 'Cartera crédito', value: money.format(metrics.portfolio), detail: 'Saldo originado', icon: CircleDollarSign },
            { label: 'Por revisar', value: metrics.pending.toLocaleString('es-MX'), detail: 'Ventas pendientes', icon: Clock3 },
          ].map((item) => {
            const Icon = item.icon;
            return (
              <article key={item.label} className="rounded-2xl border border-white/5 bg-slate-900/70 p-4 shadow-lg shadow-black/10">
                <div className="mb-4 flex items-center justify-between">
                  <div className="flex h-9 w-9 items-center justify-center rounded-xl border border-emerald-400/10 bg-emerald-400/5 text-emerald-400">
                    <Icon className="h-4 w-4" />
                  </div>
                  <TrendingUp className="h-4 w-4 text-slate-700" />
                </div>
                <p className="text-[11px] font-bold uppercase tracking-wide text-slate-500">{item.label}</p>
                <p className="mt-1 break-words text-xl font-black text-white sm:text-2xl">{loading ? '—' : item.value}</p>
                <p className="mt-1 text-[10px] text-slate-500">{item.detail}</p>
              </article>
            );
          })}
        </section>

        <section className="mt-5 grid gap-5 lg:grid-cols-[1.25fr_.75fr]">
          <article className="overflow-hidden rounded-[24px] border border-white/5 bg-slate-900/70">
            <div className="flex items-center justify-between border-b border-white/5 px-5 py-4">
              <div>
                <p className="text-sm font-black text-white">Clientes recientes</p>
                <p className="mt-1 text-[11px] text-slate-500">Registros reales del CRM de producción</p>
              </div>
              <UserRound className="h-5 w-5 text-emerald-400" />
            </div>
            <div className="divide-y divide-white/5">
              {!loading && data.clients.length === 0 && (
                <div className="px-5 py-8 text-center text-sm text-slate-500">Aún no hay clientes registrados.</div>
              )}
              {data.clients.map((client) => (
                <div key={client.id} className="flex items-center gap-3 px-5 py-4">
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-slate-800 text-xs font-black text-slate-300">
                    {client.firstName?.[0]}{client.lastName?.[0]}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-bold text-white">{client.firstName} {client.lastName} {client.secondLastName || ''}</p>
                    <p className="mt-0.5 truncate text-[11px] text-slate-500">{client.clientNumber} · {client.phone}</p>
                  </div>
                  <span className={`shrink-0 rounded-lg border px-2 py-1 text-[9px] font-black ${riskClass(client.riskLevel)}`}>
                    {client.riskLevel}
                  </span>
                </div>
              ))}
            </div>
          </article>

          <article className="rounded-[24px] border border-white/5 bg-slate-900/70 p-5">
            <div className="flex items-center gap-2">
              <Sparkles className="h-5 w-5 text-emerald-400" />
              <h2 className="text-sm font-black text-white">Centro operativo</h2>
            </div>
            <p className="mt-2 text-xs leading-5 text-slate-500">La nueva UX se está migrando módulo por módulo sobre las APIs MySQL ya validadas.</p>

            <div className="mt-5 space-y-2.5">
              {[
                { icon: BriefcaseBusiness, title: 'Clientes / CRM', status: 'API activa', ready: true },
                { icon: ShoppingBag, title: 'Ventas', status: 'API activa', ready: true },
                { icon: Banknote, title: 'Cobranza y caja', status: 'Siguiente', ready: false },
                { icon: Activity, title: 'Inventario y rutas', status: 'En migración', ready: false },
              ].map((module) => {
                const Icon = module.icon;
                return (
                  <div key={module.title} className="flex items-center gap-3 rounded-2xl border border-white/5 bg-slate-950/50 p-3">
                    <Icon className={`h-4 w-4 ${module.ready ? 'text-emerald-400' : 'text-slate-600'}`} />
                    <div className="min-w-0 flex-1">
                      <p className="text-xs font-bold text-slate-200">{module.title}</p>
                      <p className="mt-0.5 text-[10px] text-slate-600">{module.status}</p>
                    </div>
                    <ArrowRight className="h-4 w-4 text-slate-700" />
                  </div>
                );
              })}
            </div>
          </article>
        </section>

        <div className="mt-5 flex flex-wrap items-center justify-between gap-2 text-[10px] text-slate-600">
          <span>BITALIS Producción · Hostinger MySQL</span>
          <span>{lastUpdated ? `Actualizado ${lastUpdated.toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit' })}` : 'Cargando estado...'}</span>
        </div>
      </main>
    </div>
  );
}
