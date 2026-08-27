'use client';

import Link from 'next/link';
import {useEffect,useMemo,useState} from 'react';
import {useRouter} from 'next/navigation';
import {AlertTriangle,Bell,BellRing,Boxes,CheckCheck,CheckCircle2,ChevronRight,Info,Loader2,MapPinned,RefreshCw,Search,ShieldAlert,Stamp} from 'lucide-react';
import AppShell from '@/components/phase15/AppShell';
import {apiClient} from '@/lib/phase15/apiClient';
import {haptic} from '@/lib/ux/haptics';
import {nativeNotificationPermission,requestNativeNotificationPermission,showNewNativeNotifications,type NativeNotificationState} from '@/lib/notifications-client';

type Notification={id:string;type?:string;priority?:string;title?:string;message?:string;entity?:string;entityId?:string;status?:string;createdAt?:string;readAt?:string|null};
type Filter='ALL'|'UNREAD'|'CRITICAL'|'COLLECTIONS'|'INVENTORY'|'APPROVALS'|'SYNC';

function priorityMeta(priority?:string){
 const p=String(priority||'INFO').toUpperCase();
 if(p==='CRITICAL'||p==='HIGH')return{label:p==='CRITICAL'?'Crítica':'Alta',className:'bg-red-50 text-red-700',icon:ShieldAlert};
 if(p==='MEDIUM')return{label:'Media',className:'bg-amber-50 text-amber-700',icon:AlertTriangle};
 return{label:'Info',className:'bg-emerald-50 text-emerald-700',icon:Info};
}
const groupOf=(item:Notification)=>{
 const type=String(item.type||'').toUpperCase();
 if(['FIRST_COLLECTION_DUE','OVERDUE_CLIENT','COLLECTION_ROUTE_DUE','BROKEN_PROMISE','COLLECTION_RISK'].includes(type))return'COLLECTIONS';
 if(type.includes('INVENTORY')||type.includes('PURCHASE_ORDER'))return'INVENTORY';
 if(type.includes('AUTHORIZATION'))return'APPROVALS';
 if(type.includes('OFFLINE')||type.includes('CONFLICT'))return'SYNC';
 return'OTHER';
};
const actionFor=(item:Notification)=>{
 switch(groupOf(item)){
  case'COLLECTIONS':return{href:'/route',label:'Abrir ruta',icon:MapPinned};
  case'INVENTORY':return{href:'/inventory',label:'Ver inventario',icon:Boxes};
  case'APPROVALS':return{href:'/authorizations',label:'Revisar',icon:Stamp};
  case'SYNC':return{href:'/offline/conflicts',label:'Resolver',icon:RefreshCw};
  default:return null;
 }
};
function notifyUnreadChanged(){if(typeof window!=='undefined')window.dispatchEvent(new Event('bitalis:notifications-changed'));}

export default function NotificationsPage(){
 const router=useRouter();
 const[items,setItems]=useState<Notification[]>([]),[loading,setLoading]=useState(true),[working,setWorking]=useState(''),[error,setError]=useState(''),[query,setQuery]=useState(''),[filter,setFilter]=useState<Filter>('ALL'),[nativePermission,setNativePermission]=useState<NativeNotificationState>('checking');
 const load=async()=>{setLoading(true);setError('');try{const j:any=await apiClient('/api/notifications/unread');setItems(Array.isArray(j?.data)?j.data:[]);}catch(e:any){setError(e?.message||'No pudimos cargar tus alertas.');setItems([]);}finally{setLoading(false);}};
 useEffect(()=>{setNativePermission(nativeNotificationPermission());void load();},[]);
 const counts=useMemo(()=>({unread:items.filter(x=>String(x.status).toUpperCase()!=='READ').length,critical:items.filter(x=>['CRITICAL','HIGH'].includes(String(x.priority).toUpperCase())&&String(x.status).toUpperCase()!=='READ').length,collections:items.filter(x=>groupOf(x)==='COLLECTIONS'&&String(x.status).toUpperCase()!=='READ').length,inventory:items.filter(x=>groupOf(x)==='INVENTORY'&&String(x.status).toUpperCase()!=='READ').length}),[items]);
 const filtered=useMemo(()=>{const q=query.trim().toLowerCase();return items.filter(x=>{const read=String(x.status).toUpperCase()==='READ',priority=String(x.priority).toUpperCase();const matchesFilter=filter==='ALL'||(filter==='UNREAD'&&!read)||(filter==='CRITICAL'&&['CRITICAL','HIGH'].includes(priority))||groupOf(x)===filter;const matchesQuery=!q||`${x.title||''} ${x.message||''} ${x.type||''}`.toLowerCase().includes(q);return matchesFilter&&matchesQuery;});},[items,query,filter]);
 const markRead=async(item:Notification)=>{if(String(item.status).toUpperCase()==='READ'||working)return false;haptic('tap');setWorking(item.id);try{await apiClient(`/api/notifications/${encodeURIComponent(item.id)}/read`,{method:'POST'});setItems(current=>current.filter(x=>x.id!==item.id));notifyUnreadChanged();haptic('success');return true;}catch(e:any){setError(e?.message||'No pudimos marcar la alerta como vista.');haptic('error');return false;}finally{setWorking('');}};
 const openAction=async(item:Notification,href:string)=>{if(await markRead(item))router.push(href);};
 const markAll=async()=>{if(!counts.unread||working)return;setWorking('all');try{await apiClient('/api/notifications/read-all',{method:'POST'});setItems([]);notifyUnreadChanged();haptic('success');}catch(e:any){setError(e?.message||'No pudimos eliminar las alertas vistas.');}finally{setWorking('');}};
 const enableNative=async()=>{if(working||nativePermission!=='default')return;setWorking('permission');setError('');try{const permission=await requestNativeNotificationPermission();setNativePermission(permission);if(permission==='granted'){await showNewNativeNotifications(items.slice(0,1));haptic('success');}else if(permission==='denied')haptic('error');}catch{setError('No pudimos activar los avisos nativos. Inténtalo nuevamente desde Chrome.');}finally{setWorking('');}};
 const filters:{id:Filter;label:string}[]=[{id:'ALL',label:'Todas'},{id:'UNREAD',label:'Pendientes'},{id:'CRITICAL',label:'Críticas'},{id:'COLLECTIONS',label:'Cobranza'},{id:'INVENTORY',label:'Inventario'},{id:'APPROVALS',label:'Autorizaciones'},{id:'SYNC',label:'Sincronización'}];

 return <AppShell title="Alertas"><div className="mx-auto max-w-5xl px-3 py-3 sm:px-4 sm:py-5">
  <section className="rounded-[24px] bg-[var(--bitalis-primary)] p-4 text-white sm:p-5"><div className="flex items-start justify-between gap-3"><div><div className="flex items-center gap-2 text-[10px] font-black uppercase tracking-[.14em] text-[var(--bitalis-mint)]"><Bell className="h-4 w-4"/>Centro operativo</div><h1 className="mt-2 text-xl font-black sm:text-2xl">Alertas y tareas</h1><p className="mt-1 text-xs leading-5 text-emerald-50/80 sm:text-sm">Prioriza cobros, inventario, autorizaciones y conflictos sin cambiar de módulo.</p></div><button onClick={()=>void load()} disabled={loading} className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-white/10" aria-label="Actualizar"><RefreshCw className={`h-5 w-5 ${loading?'animate-spin':''}`}/></button></div>
   <div className="mt-4 grid grid-cols-4 gap-2"><Metric label="Pendientes" value={counts.unread}/><Metric label="Críticas" value={counts.critical}/><Metric label="Cobranza" value={counts.collections}/><Metric label="Stock" value={counts.inventory}/></div>
  </section>
  {nativePermission==='default'&&<button onClick={()=>void enableNative()} disabled={!!working} className="mt-3 flex min-h-12 w-full items-center justify-center gap-2 rounded-2xl bg-[var(--bitalis-action)] px-4 text-xs font-black text-white shadow-sm">{working==='permission'?<Loader2 className="h-4 w-4 animate-spin"/>:<BellRing className="h-4 w-4"/>}ACTIVAR AVISOS EN ESTE DISPOSITIVO</button>}
  {nativePermission==='denied'&&<NotificationStatus tone="warning" title="Avisos bloqueados" message="Permite las notificaciones desde Ajustes de Android > Aplicaciones > BITALIS o desde la configuración del navegador."/>}
  {(nativePermission==='unsupported'||nativePermission==='insecure')&&<NotificationStatus tone="info" title="Alertas internas activas" message="Este navegador no permite avisos fuera de BITALIS. Instala la app o ábrela en Chrome para habilitarlos; tus alertas seguirán disponibles aquí."/>}
  {error&&<div role="alert" className="mt-3 rounded-2xl border border-red-200 bg-red-50 p-3 text-sm font-bold text-red-700">{error}</div>}
  <div className="mt-3 relative"><Search className="absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400"/><input value={query} onChange={e=>setQuery(e.target.value)} placeholder="Buscar cliente, producto o alerta" className="min-h-12 w-full rounded-2xl border border-slate-200 bg-white pl-11 pr-4 text-sm outline-none focus:ring-2 focus:ring-emerald-500/20"/></div>
  <div className="mt-2 flex gap-2 overflow-x-auto pb-1">{filters.map(x=><button key={x.id} onClick={()=>setFilter(x.id)} className={`min-h-11 shrink-0 rounded-2xl px-4 text-xs font-black ${filter===x.id?'bg-[var(--bitalis-primary)] text-white':'border border-slate-200 bg-white text-slate-600'}`}>{x.label}</button>)}</div>
  {!loading&&counts.unread>0&&<button onClick={()=>void markAll()} disabled={!!working} className="mt-2 flex min-h-12 w-full items-center justify-center gap-2 rounded-2xl bg-[var(--bitalis-surface-soft)] px-4 text-xs font-black text-[var(--bitalis-primary)]">{working==='all'?<Loader2 className="h-4 w-4 animate-spin"/>:<CheckCheck className="h-4 w-4"/>}MARCAR TODAS COMO VISTAS</button>}
  {loading?<div className="flex justify-center p-12"><Loader2 className="h-6 w-6 animate-spin text-[var(--bitalis-primary)]"/></div>:<section className="mt-3 space-y-2">{filtered.map(item=>{const meta=priorityMeta(item.priority),Icon=meta.icon,read=String(item.status).toUpperCase()==='READ',action=actionFor(item),ActionIcon=action?.icon;return <article key={item.id} className={`rounded-2xl border p-4 shadow-sm ${read?'border-slate-200 bg-white':'border-emerald-200 bg-emerald-50/50'}`}>
   <button onClick={()=>void markRead(item)} disabled={read||!!working} className="flex w-full items-start gap-3 text-left disabled:opacity-100"><div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${meta.className}`}><Icon className="h-4 w-4"/></div><div className="min-w-0 flex-1"><div className="flex justify-between gap-2"><h2 className="break-words text-sm font-black text-[var(--bitalis-primary)]">{item.title||'Aviso BITALIS'}</h2>{working===item.id?<Loader2 className="h-4 w-4 animate-spin"/>:read?<CheckCircle2 className="h-4 w-4 text-emerald-600"/>:<span className="mt-1 h-2.5 w-2.5 rounded-full bg-[var(--bitalis-action)]"/>}</div><p className="mt-1 text-xs leading-5 text-slate-600">{item.message||'Sin detalle adicional.'}</p><div className="mt-2 flex flex-wrap items-center gap-1.5 text-[9px] font-black uppercase"><span className={`rounded-full px-2 py-1 ${meta.className}`}>{meta.label}</span><span className="rounded-full bg-slate-100 px-2 py-1 text-slate-500">{read?'Leída':'Pendiente'}</span>{item.createdAt&&<span className="text-slate-400">{new Date(item.createdAt).toLocaleString('es-MX',{dateStyle:'short',timeStyle:'short'})}</span>}</div></div></button>
   {action&&ActionIcon&&<Link href={action.href} onClick={event=>{event.preventDefault();void openAction(item,action.href);}} className="mt-3 flex min-h-11 items-center justify-center gap-2 rounded-xl bg-[var(--bitalis-primary)] px-4 text-xs font-black text-white"><ActionIcon className="h-4 w-4"/>{action.label}<ChevronRight className="h-4 w-4"/></Link>}
  </article>})}{!filtered.length&&<div className="rounded-2xl border border-slate-200 bg-white p-8 text-center text-sm text-slate-500">No tienes alertas pendientes.</div>}</section>}
 </div></AppShell>;
}
function Metric({label,value}:{label:string;value:number}){return <div className="rounded-2xl bg-white/10 px-2 py-2 text-center"><p className="text-[8px] font-black uppercase text-emerald-50/70">{label}</p><p className="mt-1 text-lg font-black">{value}</p></div>}
function NotificationStatus({tone,title,message}:{tone:'info'|'warning';title:string;message:string}){const style=tone==='warning'?'border-amber-200 bg-amber-50 text-amber-900':'border-slate-200 bg-white text-slate-700';return <div role="status" className={`mt-3 rounded-2xl border p-3 ${style}`}><p className="text-sm font-black">{title}</p><p className="mt-1 text-xs leading-5">{message}</p></div>}
