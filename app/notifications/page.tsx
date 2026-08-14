'use client';

import {useEffect,useMemo,useState} from 'react';
import {AlertTriangle,Bell,CheckCircle2,Info,Loader2,Search,ShieldAlert} from 'lucide-react';
import AppShell from '@/components/phase15/AppShell';
import {apiClient} from '@/lib/phase15/apiClient';

type Notification={id:string;type?:string;priority?:string;title?:string;message?:string;status?:string;createdAt?:string;readAt?:string|null};

function priorityMeta(priority?:string){
 const p=String(priority||'INFO').toUpperCase();
 if(p==='CRITICAL'||p==='HIGH') return {label:p==='CRITICAL'?'Crítica':'Alta',className:'bg-red-50 text-red-700',icon:ShieldAlert};
 if(p==='MEDIUM') return {label:'Media',className:'bg-amber-50 text-amber-700',icon:AlertTriangle};
 return {label:'Info',className:'bg-blue-50 text-blue-700',icon:Info};
}

export default function NotificationsPage(){
 const[items,setItems]=useState<Notification[]>([]),[loading,setLoading]=useState(true),[error,setError]=useState(''),[query,setQuery]=useState('');
 const load=async()=>{setLoading(true);setError('');try{const j:any=await apiClient('/api/notifications');setItems(Array.isArray(j?.data)?j.data:Array.isArray(j?.notifications)?j.notifications:[]);}catch(e:any){setError(e?.message||'No pudimos cargar tus notificaciones.');setItems([]);}finally{setLoading(false);}};
 useEffect(()=>{load();},[]);
 const unread=items.filter(x=>String(x.status||'').toUpperCase()!=='READ').length;
 const filtered=useMemo(()=>{const q=query.trim().toLowerCase();return q?items.filter(x=>`${x.title||''} ${x.message||''} ${x.type||''}`.toLowerCase().includes(q)):items;},[items,query]);
 return <AppShell title="Notificaciones"><div className="mx-auto max-w-4xl px-3 py-3 sm:px-4 sm:py-5">
  <section className="rounded-[24px] bg-[#12224A] p-4 text-white sm:p-5"><div className="flex items-start justify-between gap-3"><div><div className="flex items-center gap-2 text-[10px] font-black uppercase tracking-[.14em] text-[#C79A3B]"><Bell className="h-4 w-4"/>Avisos</div><h1 className="mt-2 text-xl font-black sm:text-2xl">Notificaciones</h1><p className="mt-1 text-xs leading-5 text-slate-300 sm:text-sm">Alertas y avisos importantes para tu operación.</p></div><div className="rounded-2xl bg-white/10 px-3 py-2 text-center"><p className="text-[9px] font-black uppercase text-slate-300">Pendientes</p><p className="text-lg font-black">{loading?'—':unread}</p></div></div></section>
  {error&&<div role="alert" className="mt-3 rounded-2xl border border-red-200 bg-red-50 p-3 text-sm font-bold text-red-700">{error}</div>}
  <div className="relative mt-3"><Search className="absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400"/><input value={query} onChange={e=>setQuery(e.target.value)} placeholder="Buscar aviso" aria-label="Buscar notificaciones" className="min-h-11 w-full rounded-2xl border border-slate-200 bg-white pl-11 pr-4 text-sm outline-none focus:ring-2 focus:ring-[#FF6A00]"/></div>
  {loading?<div className="flex justify-center p-12"><Loader2 className="h-6 w-6 animate-spin text-[#12224A]"/></div>:<section className="mt-3 space-y-2">{filtered.map(item=>{const meta=priorityMeta(item.priority);const Icon=meta.icon;const read=String(item.status||'').toUpperCase()==='READ';return <article key={item.id} className={`rounded-2xl border p-4 shadow-sm ${read?'border-slate-200 bg-white':'border-blue-200 bg-blue-50/40'}`}><div className="flex items-start gap-3"><div className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl ${meta.className}`}><Icon className="h-4 w-4"/></div><div className="min-w-0 flex-1"><div className="flex items-start justify-between gap-2"><div className="min-w-0"><h2 className="break-words text-sm font-black text-[#12224A]">{item.title||'Aviso BITALIS'}</h2><p className="mt-1 text-xs leading-5 text-slate-600">{item.message||'Sin detalle adicional.'}</p></div>{read&&<CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-600"/>}</div><div className="mt-2 flex flex-wrap items-center gap-1.5 text-[9px] font-black uppercase"><span className={`rounded-full px-2 py-1 ${meta.className}`}>{meta.label}</span><span className="rounded-full bg-slate-100 px-2 py-1 text-slate-500">{read?'Leída':'Pendiente'}</span>{item.createdAt&&<span className="text-slate-400">{new Date(item.createdAt).toLocaleString('es-MX',{dateStyle:'short',timeStyle:'short'})}</span>}</div></div></div></article>})}{!filtered.length&&<div className="rounded-2xl border border-slate-200 bg-white p-8 text-center text-sm text-slate-500">No hay notificaciones que coincidan con la búsqueda.</div>}</section>}
 </div></AppShell>;
}
