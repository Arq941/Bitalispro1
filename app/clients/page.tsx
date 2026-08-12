'use client';

import { FormEvent, useCallback, useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  AlertTriangle,
  ArrowLeft,
  ChevronLeft,
  ChevronRight,
  CirclePlus,
  Loader2,
  MapPin,
  Pencil,
  Phone,
  RefreshCw,
  Search,
  ShieldCheck,
  UserRound,
  Users,
  X,
} from 'lucide-react';
import BitalisLogo from '@/components/BitalisLogo';

type ClientRecord = {
  id: string;
  clientNumber: string;
  firstName: string;
  lastName: string;
  secondLastName?: string | null;
  phone: string;
  secondaryPhone?: string | null;
  email?: string | null;
  occupation?: string | null;
  customerType?: string | null;
  status: string;
  riskLevel: string;
  latitude?: number | null;
  longitude?: number | null;
  zoneId?: string | null;
  createdAt: string;
};

type FormState = {
  firstName: string;
  lastName: string;
  secondLastName: string;
  phone: string;
  secondaryPhone: string;
  email: string;
  occupation: string;
  customerType: string;
  latitude: string;
  longitude: string;
};

const emptyForm: FormState = {
  firstName: '', lastName: '', secondLastName: '', phone: '', secondaryPhone: '', email: '', occupation: '', customerType: 'NEW', latitude: '', longitude: '',
};

function riskStyle(level: string) {
  if (level === 'CRITICAL') return 'border-red-400/20 bg-red-500/10 text-red-300';
  if (level === 'HIGH') return 'border-orange-400/20 bg-orange-500/10 text-orange-300';
  if (level === 'MEDIUM') return 'border-amber-400/20 bg-amber-500/10 text-amber-300';
  return 'border-emerald-400/20 bg-emerald-500/10 text-emerald-300';
}

function statusStyle(status: string) {
  if (status === 'ACTIVE') return 'border-emerald-400/20 bg-emerald-500/10 text-emerald-300';
  if (status === 'BLOCKED' || status === 'SUSPENDED') return 'border-red-400/20 bg-red-500/10 text-red-300';
  return 'border-slate-700 bg-slate-800 text-slate-300';
}

export default function ClientsPage() {
  const router = useRouter();
  const [clients, setClients] = useState<ClientRecord[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [search, setSearch] = useState('');
  const [searchDraft, setSearchDraft] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<ClientRecord | null>(null);
  const [form, setForm] = useState<FormState>(emptyForm);

  const getAuth = useCallback(() => {
    const token = localStorage.getItem('bitalis_access_token');
    const user = localStorage.getItem('bitalis_auth_user');
    if (!token || !user) {
      router.replace('/');
      return null;
    }
    return token;
  }, [router]);

  const loadClients = useCallback(async () => {
    const token = getAuth();
    if (!token) return;
    setLoading(true);
    setError('');
    try {
      const params = new URLSearchParams({ page: String(page), limit: '20' });
      if (search) params.set('search', search);
      const response = await fetch(`/api/clients?${params.toString()}`, {
        headers: { Authorization: `Bearer ${token}` }, cache: 'no-store',
      });
      if (response.status === 401) {
        localStorage.removeItem('bitalis_access_token');
        localStorage.removeItem('bitalis_refresh_token');
        localStorage.removeItem('bitalis_auth_user');
        router.replace('/');
        return;
      }
      const json = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(json?.error || 'No fue posible cargar clientes.');
      setClients(Array.isArray(json?.data) ? json.data : []);
      setTotal(Number(json?.pagination?.total || 0));
      setTotalPages(Math.max(1, Number(json?.pagination?.totalPages || 1)));
    } catch (err: any) {
      setError(err?.message || 'No fue posible cargar el CRM.');
    } finally {
      setLoading(false);
    }
  }, [getAuth, page, search, router]);

  useEffect(() => { loadClients(); }, [loadClients]);

  const openCreate = () => {
    setEditing(null);
    setForm(emptyForm);
    setModalOpen(true);
  };

  const openEdit = (client: ClientRecord) => {
    setEditing(client);
    setForm({
      firstName: client.firstName || '', lastName: client.lastName || '', secondLastName: client.secondLastName || '', phone: client.phone || '', secondaryPhone: client.secondaryPhone || '', email: client.email || '', occupation: client.occupation || '', customerType: client.customerType || 'NEW', latitude: client.latitude == null ? '' : String(client.latitude), longitude: client.longitude == null ? '' : String(client.longitude),
    });
    setModalOpen(true);
  };

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    const token = getAuth();
    if (!token) return;
    if (!form.firstName.trim() || !form.lastName.trim() || !form.phone.trim()) {
      setError('Nombre, apellido y teléfono son obligatorios.');
      return;
    }
    setSaving(true);
    setError('');
    try {
      const payload: any = {
        firstName: form.firstName.trim(), lastName: form.lastName.trim(), secondLastName: form.secondLastName.trim() || undefined, phone: form.phone.trim(), secondaryPhone: form.secondaryPhone.trim() || undefined, email: form.email.trim() || undefined, occupation: form.occupation.trim() || undefined, customerType: form.customerType || 'NEW',
      };
      if (form.latitude.trim()) payload.latitude = Number(form.latitude);
      if (form.longitude.trim()) payload.longitude = Number(form.longitude);
      if (!editing) payload.idempotencyKey = `crm-web-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

      const response = await fetch(editing ? `/api/clients/${editing.id}` : '/api/clients', {
        method: editing ? 'PATCH' : 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify(payload),
      });
      const json = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(json?.error || 'No fue posible guardar el cliente.');
      setModalOpen(false);
      if (!editing) setPage(1);
      await loadClients();
    } catch (err: any) {
      setError(err?.message || 'No fue posible guardar el cliente.');
    } finally {
      setSaving(false);
    }
  };

  const activeCount = useMemo(() => clients.filter((c) => c.status === 'ACTIVE').length, [clients]);
  const highRiskCount = useMemo(() => clients.filter((c) => ['HIGH', 'CRITICAL'].includes(c.riskLevel)).length, [clients]);

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100">
      <header className="sticky top-0 z-30 border-b border-white/5 bg-slate-950/90 backdrop-blur-xl">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-3 px-4 py-3 sm:px-6">
          <div className="flex items-center gap-3">
            <BitalisLogo size="md" variant="dark" />
            <div className="hidden border-l border-white/10 pl-3 sm:block">
              <p className="text-[10px] font-black uppercase tracking-[0.2em] text-emerald-400">CRM Producción</p>
              <p className="text-xs text-slate-400">Clientes · MySQL</p>
            </div>
          </div>
          <button onClick={() => router.push('/dashboard')} className="flex items-center gap-2 rounded-xl border border-slate-800 bg-slate-900 px-3 py-2 text-xs font-bold text-slate-300 hover:text-white">
            <ArrowLeft className="h-4 w-4" /> Panel
          </button>
        </div>
      </header>

      <main className="mx-auto max-w-7xl px-4 py-6 sm:px-6 sm:py-8">
        <section className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <div className="mb-2 inline-flex items-center gap-2 rounded-full border border-emerald-400/15 bg-emerald-400/5 px-3 py-1.5 text-[11px] font-bold text-emerald-300"><ShieldCheck className="h-3.5 w-3.5" /> CRM conectado a producción</div>
            <h1 className="text-2xl font-black text-white sm:text-3xl">Clientes</h1>
            <p className="mt-2 text-sm text-slate-400">Alta, búsqueda y edición directa sobre MySQL.</p>
          </div>
          <button onClick={openCreate} className="flex items-center justify-center gap-2 rounded-2xl bg-emerald-500 px-4 py-3 text-sm font-black text-slate-950 shadow-lg shadow-emerald-500/10 transition active:scale-[.98]"><CirclePlus className="h-4 w-4" /> Nuevo cliente</button>
        </section>

        {error && <div className="mt-5 flex items-start gap-3 rounded-2xl border border-red-400/20 bg-red-500/10 p-4 text-sm text-red-200"><AlertTriangle className="mt-0.5 h-5 w-5 shrink-0" /><span>{error}</span></div>}

        <section className="mt-5 grid grid-cols-3 gap-3">
          <article className="rounded-2xl border border-white/5 bg-slate-900/70 p-4"><p className="text-[10px] font-bold uppercase text-slate-500">Total CRM</p><p className="mt-1 text-2xl font-black text-white">{total}</p></article>
          <article className="rounded-2xl border border-white/5 bg-slate-900/70 p-4"><p className="text-[10px] font-bold uppercase text-slate-500">Activos en página</p><p className="mt-1 text-2xl font-black text-emerald-300">{activeCount}</p></article>
          <article className="rounded-2xl border border-white/5 bg-slate-900/70 p-4"><p className="text-[10px] font-bold uppercase text-slate-500">Riesgo alto</p><p className="mt-1 text-2xl font-black text-orange-300">{highRiskCount}</p></article>
        </section>

        <form onSubmit={(e) => { e.preventDefault(); setPage(1); setSearch(searchDraft.trim()); }} className="mt-5 flex gap-2 rounded-2xl border border-white/5 bg-slate-900/70 p-3">
          <div className="relative flex-1"><Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-600" /><input value={searchDraft} onChange={(e) => setSearchDraft(e.target.value)} placeholder="Buscar por nombre, folio o teléfono" className="w-full rounded-xl border border-slate-800 bg-slate-950 py-3 pl-10 pr-3 text-sm text-white outline-none focus:border-emerald-500/50" /></div>
          <button type="submit" className="rounded-xl bg-slate-800 px-4 text-xs font-black text-slate-200">Buscar</button>
          <button type="button" onClick={loadClients} className="flex h-11 w-11 items-center justify-center rounded-xl border border-slate-800 bg-slate-950 text-slate-400"><RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} /></button>
        </form>

        <section className="mt-4 overflow-hidden rounded-[24px] border border-white/5 bg-slate-900/70">
          {loading ? <div className="flex items-center justify-center gap-2 px-5 py-14 text-sm text-slate-500"><Loader2 className="h-5 w-5 animate-spin" /> Cargando clientes...</div> : clients.length === 0 ? <div className="px-5 py-14 text-center text-sm text-slate-500">No encontramos clientes.</div> : <div className="divide-y divide-white/5">{clients.map((client) => (
            <div key={client.id} className="flex flex-col gap-3 px-4 py-4 sm:flex-row sm:items-center sm:px-5">
              <div className="flex min-w-0 flex-1 items-center gap-3"><div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-slate-800 text-sm font-black text-slate-300"><UserRound className="h-5 w-5" /></div><div className="min-w-0"><p className="truncate text-sm font-black text-white">{client.firstName} {client.lastName} {client.secondLastName || ''}</p><p className="mt-1 truncate text-[11px] text-slate-500">{client.clientNumber} · {client.phone}</p><div className="mt-2 flex flex-wrap gap-1.5"><span className={`rounded-lg border px-2 py-1 text-[9px] font-black ${statusStyle(client.status)}`}>{client.status}</span><span className={`rounded-lg border px-2 py-1 text-[9px] font-black ${riskStyle(client.riskLevel)}`}>RIESGO {client.riskLevel}</span></div></div></div>
              <div className="flex gap-2 sm:justify-end"><a href={`tel:${client.phone}`} className="flex h-10 w-10 items-center justify-center rounded-xl border border-slate-800 bg-slate-950 text-slate-400"><Phone className="h-4 w-4" /></a>{client.latitude != null && client.longitude != null && <a href={`https://www.google.com/maps?q=${client.latitude},${client.longitude}`} target="_blank" rel="noreferrer" className="flex h-10 w-10 items-center justify-center rounded-xl border border-slate-800 bg-slate-950 text-slate-400"><MapPin className="h-4 w-4" /></a>}<button onClick={() => openEdit(client)} className="flex items-center gap-2 rounded-xl border border-emerald-400/20 bg-emerald-400/5 px-3 text-xs font-black text-emerald-300"><Pencil className="h-4 w-4" /> Editar</button></div>
            </div>
          ))}</div>}
        </section>

        <div className="mt-4 flex items-center justify-between gap-3"><p className="text-[11px] text-slate-600">Página {page} de {totalPages}</p><div className="flex gap-2"><button disabled={page <= 1} onClick={() => setPage((p) => Math.max(1, p - 1))} className="flex h-10 w-10 items-center justify-center rounded-xl border border-slate-800 bg-slate-900 text-slate-300 disabled:opacity-30"><ChevronLeft className="h-4 w-4" /></button><button disabled={page >= totalPages} onClick={() => setPage((p) => Math.min(totalPages, p + 1))} className="flex h-10 w-10 items-center justify-center rounded-xl border border-slate-800 bg-slate-900 text-slate-300 disabled:opacity-30"><ChevronRight className="h-4 w-4" /></button></div></div>
      </main>

      {modalOpen && <div className="fixed inset-0 z-50 flex items-end justify-center bg-slate-950/85 p-0 backdrop-blur-md sm:items-center sm:p-4" onClick={() => !saving && setModalOpen(false)}><div className="max-h-[92vh] w-full max-w-2xl overflow-y-auto rounded-t-[28px] border border-white/10 bg-slate-900 shadow-2xl sm:rounded-[28px]" onClick={(e) => e.stopPropagation()}><div className="sticky top-0 z-10 flex items-center justify-between border-b border-white/5 bg-slate-900/95 px-5 py-4 backdrop-blur"><div><p className="text-base font-black text-white">{editing ? 'Editar cliente' : 'Nuevo cliente'}</p><p className="mt-1 text-[11px] text-slate-500">Los cambios se guardan directamente en MySQL.</p></div><button disabled={saving} onClick={() => setModalOpen(false)} className="flex h-9 w-9 items-center justify-center rounded-xl bg-slate-800 text-slate-400"><X className="h-4 w-4" /></button></div><form onSubmit={submit} className="grid gap-4 p-5 sm:grid-cols-2">
        {[['firstName','Nombre *'],['lastName','Apellido paterno *'],['secondLastName','Apellido materno'],['phone','Teléfono *'],['secondaryPhone','Teléfono secundario'],['email','Correo'],['occupation','Ocupación']].map(([key,label]) => <label key={key} className="block"><span className="mb-2 block text-xs font-bold text-slate-400">{label}</span><input type={key === 'email' ? 'email' : key.includes('phone') ? 'tel' : 'text'} value={(form as any)[key]} onChange={(e) => setForm((f) => ({ ...f, [key]: e.target.value }))} className="w-full rounded-xl border border-slate-800 bg-slate-950 px-3 py-3 text-sm text-white outline-none focus:border-emerald-500/50" /></label>)}
        <label className="block"><span className="mb-2 block text-xs font-bold text-slate-400">Tipo de cliente</span><select value={form.customerType} onChange={(e) => setForm((f) => ({ ...f, customerType: e.target.value }))} className="w-full rounded-xl border border-slate-800 bg-slate-950 px-3 py-3 text-sm text-white"><option value="NEW">Nuevo</option><option value="RECURRENT">Recurrente</option><option value="REFERRED">Referido</option></select></label>
        <label className="block"><span className="mb-2 block text-xs font-bold text-slate-400">Latitud</span><input inputMode="decimal" value={form.latitude} onChange={(e) => setForm((f) => ({ ...f, latitude: e.target.value }))} className="w-full rounded-xl border border-slate-800 bg-slate-950 px-3 py-3 text-sm text-white" /></label><label className="block"><span className="mb-2 block text-xs font-bold text-slate-400">Longitud</span><input inputMode="decimal" value={form.longitude} onChange={(e) => setForm((f) => ({ ...f, longitude: e.target.value }))} className="w-full rounded-xl border border-slate-800 bg-slate-950 px-3 py-3 text-sm text-white" /></label>
        <div className="sm:col-span-2 flex justify-end gap-2 border-t border-white/5 pt-4"><button type="button" disabled={saving} onClick={() => setModalOpen(false)} className="rounded-xl border border-slate-700 px-4 py-3 text-xs font-black text-slate-300">Cancelar</button><button type="submit" disabled={saving} className="flex items-center gap-2 rounded-xl bg-emerald-500 px-5 py-3 text-xs font-black text-slate-950 disabled:opacity-50">{saving && <Loader2 className="h-4 w-4 animate-spin" />}{editing ? 'Guardar cambios' : 'Crear cliente'}</button></div>
      </form></div></div>}
    </div>
  );
}
