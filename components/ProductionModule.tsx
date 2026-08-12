'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { ArrowLeft, Database, Loader2, RefreshCw, Search, ShieldCheck } from 'lucide-react';
import BitalisLogo from '@/components/BitalisLogo';

type Props = {
  title: string;
  subtitle: string;
  endpoint: string;
  dataKeys?: string[];
  emptyText?: string;
};

function getRecords(payload: any, keys: string[]) {
  for (const key of keys) {
    if (Array.isArray(payload?.[key])) return payload[key];
    if (Array.isArray(payload?.data?.[key])) return payload.data[key];
  }
  if (Array.isArray(payload?.data)) return payload.data;
  if (Array.isArray(payload)) return payload;
  if (payload?.dashboard && typeof payload.dashboard === 'object') {
    return Object.entries(payload.dashboard).map(([key, value]) => ({ metric: key, value }));
  }
  if (payload?.data && typeof payload.data === 'object') return [payload.data];
  if (payload && typeof payload === 'object') return [payload];
  return [];
}

function valueText(value: any) {
  if (value == null) return '—';
  if (typeof value === 'object') return JSON.stringify(value);
  return String(value);
}

export default function ProductionModule({ title, subtitle, endpoint, dataKeys = [], emptyText = 'Sin registros por mostrar.' }: Props) {
  const router = useRouter();
  const [records, setRecords] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');

  const load = useCallback(async () => {
    const token = localStorage.getItem('bitalis_access_token');
    const rawUser = localStorage.getItem('bitalis_auth_user');
    if (!token || !rawUser) {
      router.replace('/');
      return;
    }
    setLoading(true);
    setError('');
    try {
      let resolvedEndpoint = endpoint;
      if (endpoint.includes('{userId}')) {
        const user = JSON.parse(rawUser);
        resolvedEndpoint = endpoint.replace('{userId}', encodeURIComponent(user?.id || ''));
      }
      const response = await fetch(resolvedEndpoint, {
        headers: { Authorization: `Bearer ${token}` },
        cache: 'no-store',
      });
      if (response.status === 401) {
        localStorage.removeItem('bitalis_access_token');
        localStorage.removeItem('bitalis_refresh_token');
        localStorage.removeItem('bitalis_auth_user');
        router.replace('/');
        return;
      }
      const json = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(json?.error || json?.message || `Error ${response.status}`);
      setRecords(getRecords(json, dataKeys));
    } catch (err: any) {
      setError(err?.message || 'No fue posible cargar este módulo.');
      setRecords([]);
    } finally {
      setLoading(false);
    }
  }, [dataKeys, endpoint, router]);

  useEffect(() => { load(); }, [load]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return records;
    return records.filter((record) => JSON.stringify(record).toLowerCase().includes(q));
  }, [records, search]);

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100">
      <header className="sticky top-0 z-30 border-b border-white/5 bg-slate-950/90 backdrop-blur-xl">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-3 px-4 py-3 sm:px-6">
          <div className="flex items-center gap-3">
            <button onClick={() => router.push('/dashboard')} className="flex h-10 w-10 items-center justify-center rounded-xl border border-slate-800 bg-slate-900 text-slate-300" aria-label="Volver"><ArrowLeft className="h-4 w-4" /></button>
            <BitalisLogo size="md" variant="dark" />
          </div>
          <button onClick={load} disabled={loading} className="flex items-center gap-2 rounded-xl border border-slate-800 bg-slate-900 px-3 py-2 text-xs font-black text-slate-300"><RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} /> Actualizar</button>
        </div>
      </header>

      <main className="mx-auto max-w-7xl px-4 py-6 sm:px-6 sm:py-8">
        <section className="rounded-[28px] border border-emerald-400/10 bg-gradient-to-br from-slate-900 to-emerald-950/20 p-5 sm:p-7">
          <div className="inline-flex items-center gap-2 rounded-full border border-emerald-400/15 bg-emerald-400/5 px-3 py-1.5 text-[10px] font-black uppercase tracking-[0.14em] text-emerald-300"><ShieldCheck className="h-3.5 w-3.5" /> Producción MySQL</div>
          <h1 className="mt-4 text-2xl font-black text-white sm:text-3xl">{title}</h1>
          <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-400">{subtitle}</p>
        </section>

        <section className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-3">
          <div className="rounded-2xl border border-white/5 bg-slate-900/70 p-4"><p className="text-[10px] font-bold uppercase text-slate-500">Registros</p><p className="mt-1 text-2xl font-black text-white">{loading ? '—' : records.length}</p></div>
          <div className="rounded-2xl border border-white/5 bg-slate-900/70 p-4"><p className="text-[10px] font-bold uppercase text-slate-500">Origen</p><p className="mt-1 text-sm font-black text-emerald-300">API producción</p></div>
          <div className="hidden rounded-2xl border border-white/5 bg-slate-900/70 p-4 sm:block"><p className="text-[10px] font-bold uppercase text-slate-500">Estado</p><p className="mt-1 text-sm font-black text-white">{error ? 'Revisar' : 'Operativo'}</p></div>
        </section>

        {error && <div className="mt-4 rounded-2xl border border-amber-400/20 bg-amber-500/10 p-4 text-sm text-amber-100">{error}</div>}

        <div className="relative mt-5"><Search className="absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-600" /><input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Buscar en este módulo..." className="w-full rounded-2xl border border-slate-800 bg-slate-900 py-3 pl-11 pr-4 text-sm text-white outline-none focus:border-emerald-500/40" /></div>

        <section className="mt-4 overflow-hidden rounded-[24px] border border-white/5 bg-slate-900/70">
          {loading ? <div className="flex items-center justify-center gap-2 px-5 py-14 text-sm text-slate-500"><Loader2 className="h-5 w-5 animate-spin" /> Cargando...</div> : filtered.length === 0 ? <div className="flex flex-col items-center justify-center gap-3 px-5 py-14 text-center text-sm text-slate-500"><Database className="h-8 w-8 text-slate-700" />{emptyText}</div> : <div className="divide-y divide-white/5">{filtered.map((record, index) => {
            const entries = Object.entries(record || {}).filter(([, value]) => typeof value !== 'object' || value == null).slice(0, 7);
            const titleEntry = entries.find(([key]) => /name|number|folio|title|metric|sku|status/i.test(key)) || entries[0];
            return <article key={record?.id || index} className="px-5 py-4">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                <div className="min-w-0 flex-1"><p className="truncate text-sm font-black text-white">{titleEntry ? valueText(titleEntry[1]) : `Registro ${index + 1}`}</p><div className="mt-2 flex flex-wrap gap-2">{entries.slice(0, 5).map(([key, value]) => <span key={key} className="rounded-lg border border-slate-800 bg-slate-950 px-2 py-1 text-[10px] text-slate-400"><strong className="text-slate-500">{key}:</strong> {valueText(value).slice(0, 80)}</span>)}</div></div>
              </div>
            </article>;
          })}</div>}
        </section>
      </main>
    </div>
  );
}
