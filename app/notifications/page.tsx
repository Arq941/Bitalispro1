'use client';

import {useEffect,useMemo,useState} from 'react';
import {AlertTriangle,Bell,CheckCheck,CheckCircle2,Info,Loader2,RefreshCw,Search,ShieldAlert} from 'lucide-react';
import AppShell from '@/components/phase15/AppShell';
import {apiClient} from '@/lib/phase15/apiClient';
import {haptic} from '@/lib/ux/haptics';

type Notification={id:string;type?:string;priority?:string;title?:string;message?:string;status?:string;createdAt?:string;readAt?:string|null};

function priorityMeta(priority?:string){
 const p=String(priority||'INFO').toUpperCase();
 if(p==='CRITICAL'||p==='HIGH') return {label:p==='CRITICAL'?'Crítica':'Alta',className:'bg-red-50 text-red-700',icon:ShieldAlert};
 if(p==='MEDIUM') return {label:'Media',className:'bg-amber-50 text-amber-700',icon:AlertTriangle};
 return {label:'Info',className:'bg-emerald-50 text-emerald-700',icon:Info};
}

function notifyUnreadChanged(){
 if(typeof window!=='undefined')window.dispatchEvent(new Event('bitalis:notifications-changed'));
}

export default function NotificationsPage(){
 const[items,setItems]=useState<Notification[]>([]),[loading,setLoading]=useState(true),[working,setWorking]=useState(''),[error,setError]=useState(''),[query,setQuery]=useState('');
 const load=async()=>{setLoading(true);setError('');try{const j:any=await apiClient('/api/notifications');setItems(Array.isArray(j?.data)?j.data:Array.isArray(j?.notifications)?j.notifications:[]);}catch(e:any){setError(e?.message||'No pudimos cargar tus notificaciones.');setItems([]);}finally{setLoading(false);}};
 useEffect(()=>{void load();},[]);
 const unread=items.filter(x=>String(x.status||'').toUpperCase()!=='READ').length;
 const filtered=useMemo(()=>{const q=query.trim().toLowerCase();return q?items.filter(x=>`${x.title||''} ${x.message||''} ${x.type||''}`.toLowerCase().includes(q)):items;},[items,query]);
 const markRead=async(item:Notification)=>{if(String(item.status||'').toUpperCase()==='READ'||working)return;haptic('tap');setWorking(item.id);setError('');try{await apiClient(`/api/notifications/${encodeURIComponent(item.id)}/read`,{method:'POST'});setItems(current=>current.map(x=>x.id===item.id?{...x,status:'READ',readAt:new Date().toISOString()}:x));notifyUnreadChanged();haptic('success');}catch(e:any){setError(e?.message||'No pudimos marcar la notificación como leída.');haptic('error');}finally{setWorking('');}};
 const markAll=async()=>{if(!unread||working)return;haptic('tap');setWorking('all');setError('');try{await apiClient('/api/notifications/read-all',{method:'POST'});const now=new Date().toISOString();setItems(current=>current.map(x=>({...x,status:'READ',readAt:x.readAt||now})));notifyUnreadChanged();haptic('success');}catch(e:any){setError(e?.message||'No pudimos marcar todas como leídas.');haptic('error');}finally{setWorking('');}};
 return <AppShell title="Notificaciones"><div className="mx-auto max-w-4xl px-3 py-3 sm:px-4 sm:py-5">
  <section className="rounded-[24px] bg-[var(--bitalis-primary)] p-4 text-white sm:p-5"><div className="flex items-start justify-between gap-3"><div><div className="flex items-center gap-2 text-[10px] font-black uppercase tracking-[.14em] text-[var(--bitalis-mint)]"><Bell className="h-4 w-4"/>Avisos</div><h1 className="mt-2 text-xl font-black sm:text-2xl">Notificaciones</h1><p className="mt-1 text-xs leading-5 text-emerald-50/80 sm:text-sm">Alertas y avisos importantes para tu operación.</p></div><div className="rounded-2xl bg-white/10 px-3 py-2 text-center"><p className="text-[9px] font-black uppercase text-emerald-50/70">Pendientes</p><p className="text-lg font-black">{loading?'—':unread}</p></div></div></section>
  {error&&<div role="alert" className="mt-3 rounded-2xl border border-red-200 bg-red-50 p-3 text-sm font-bold text-red-700">{error}</div>}
  <div className="mt-3 grid grid-cols-[1fr_auto] gap-2"><div className="relative"><Search className="absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400"/><input value={query} onChange={e=>setQuery(e.target.value)} placeholder="Buscar aviso" aria-label="Buscar notificaciones" className="min-h-12 w-full rounded-2xl border border-slate-200 bg-white pl-11 pr-4 text-sm outline-none focus:ring-2 focus:ring-emerald-500/20"/></div><button type="button" onClick={()=>void load()} disabled={loading} className="flex h-12 w-12 items-center justify-center rounded-2xl border border-[var(--bitalis-border)] bg-white text-[var(--bitalis-primary)]" aria-label="Actualizar notificaciones"><RefreshCw className={`h-5 w-5 ${loading?'animate-spin':''}`}/></button></div>
  {!loading&&unread>0&&<button type="button" onClick={markAll} disabled={!!working} className="mt-2 flex min-h-12 w-full items-center justify-center gap-2 rounded-2xl bg-[var(--bitalis-surface-soft)] px-4 text-xs font-black text-[var(--bitalis-primary)] disabled:opacity-50">{working==='all'?<Loader2 className="h-4 w-4 animate-spin"/>:<CheckCheck className="h-4 w-4"/>}MARCAR TODAS COMO LEÍDAS</button>}
  {loading?<div className="flex justify-center p-12"><Loader2 className="h-6 w-6 animate-spin text-[var(--bitalis-primary)]"/></div>:<section className="mt-3 space-y-2">{filtered.map(item=>{const meta=priorityMeta(item.priority);const Icon=meta.icon;const read=String(item.status||'').toUpperCase()==='READ';return <button type="button" key={item.id} onClick={()=>void markRead(item)} disabled={read||!!working} className={`block w-full rounded-2xl border p-4 text-left shadow-sm disabled:opacity-100 ${read?'border-[var(--bitalis-border)] bg-white':'border-emerald-200 bg-emerald-50/50'}`}><div className="flex items-start gap-3"><div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${meta.className}`}><Icon className="h-4 w-4"/></div><div className="min-w-0 flex-1"><div className="flex items-start justify-between gap-2"><div className="min-w-0"><h2 className="break-words text-sm font-black text-[var(--bitalis-primary)]">{item.title||'Aviso BITALIS'}</h2><p className="mt-1 text-xs leading-5 text-slate-600">{item.message||'Sin detalle adicional.'}</p></div>{working===item.id?<Loader2 className="h-4 w-4 shrink-0 animate-spin text-[var(--bitalis-action)]"/>:read?<CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-600"/>:<span className="mt-1 h-2.5 w-2.5 shrink-0 rounded-full bg-[var(--bitalis-action)]"/>}</div><div className="mt-2 flex flex-wrap items-center gap-1.5 text-[9px] font-black uppercase"><span className={`rounded-full px-2 py-1 ${meta.className}`}>{meta.label}</span><span className="rounded-full bg-slate-100 px-2 py-1 text-slate-500">{read?'Leída':'Toca para marcar leída'}</span>{item.createdAt&&<span className="text-slate-400">{new Date(item.createdAt).toLocaleString('es-MX',{dateStyle:'short',timeStyle:'short'})}</span>}</div></div></div></button>})}{!filtered.length&&<div className="rounded-2xl border border-[var(--bitalis-border)] bg-white p-8 text-center text-sm text-slate-500">{query?'No hay notificaciones que coincidan con la búsqueda.':'No tienes notificaciones pendientes.'}</div>}</section>}
 </div></AppShell>;
}
