'use client';

import {useCallback,useEffect,useMemo,useRef,useState} from 'react';
import {AlertTriangle,CheckCircle2,CloudUpload,Loader2,RefreshCw,ShieldCheck,WifiOff,X} from 'lucide-react';
import {offlineStorage,OfflineOperation} from '@/lib/offline-storage';
import {installOfflineAutoSync,offlineIdentity,syncOfflineQueue} from '@/lib/offline-sync-client';
import {listQueued,OfflineOperation as LegacyOperation} from '@/lib/phase15/offlineQueue';
import {syncQueuedOperations} from '@/lib/phase15/syncQueue';
import {haptic} from '@/lib/ux/haptics';

const pendingStatuses=new Set(['QUEUED','SYNCING','FAILED']);
const attentionStatuses=new Set(['CONFLICT','REJECTED']);
const operationLabel=(type:string)=>({
  CLIENT:'Alta rápida',SALE:'Venta',PAYMENT:'Abono',DOWN_PAYMENT:'Enganche',VISIT:'Visita',
  NON_PAYMENT_REASON:'No pagó',RESCHEDULE:'Reagendado',PAYMENT_PROMISE:'Promesa de pago',
  EXPENSE:'Gasto',GPS_TRACE:'Recorrido GPS'
}[type]||'Operación de campo');

function statusLabel(status:string){
  if(status==='QUEUED')return'Pendiente de subir';
  if(status==='SYNCING')return'Enviando al servidor';
  if(status==='FAILED')return'Reintento automático pendiente';
  if(status==='CONFLICT')return'Requiere revisión';
  if(status==='REJECTED')return'No pudo enviarse';
  return status;
}
function capturedAt(value:string){
  try{return new Intl.DateTimeFormat('es-MX',{day:'2-digit',month:'short',hour:'2-digit',minute:'2-digit'}).format(new Date(value));}
  catch{return'Fecha protegida';}
}

export default function SyncManager(){
  const[ops,setOps]=useState<OfflineOperation[]>([]);
  const[legacy,setLegacy]=useState<LegacyOperation[]>([]);
  const[syncing,setSyncing]=useState(false);
  const[open,setOpen]=useState(false);
  const[online,setOnline]=useState(true);
  const[feedback,setFeedback]=useState<string|null>(null);
  const activeSync=useRef(false);

  const load=useCallback(async()=>{
    setOnline(typeof navigator!=='undefined'?navigator.onLine:true);
    const identity=offlineIdentity();
    if(!identity){setOps([]);setLegacy([]);return;}
    const [durable,old]=await Promise.all([
      offlineStorage.listForUser(identity.userId,identity.deviceId,true),
      listQueued()
    ]);
    setOps(durable.filter(row=>row.status!=='SYNCED'));
    setLegacy(old.filter(row=>row.state!=='SYNCED'));
  },[]);

  const sync=useCallback(async()=>{
    if(activeSync.current||typeof navigator==='undefined'||!navigator.onLine)return;
    activeSync.current=true;setSyncing(true);setFeedback('Sincronizando capturas protegidas…');
    try{
      await syncOfflineQueue();
      await syncQueuedOperations();
      await load();
      setFeedback('Sincronización terminada. Solo se retiraron operaciones confirmadas.');
    }catch{
      await load();
      setFeedback('La conexión se interrumpió. La información continúa protegida y pendiente.');
    }finally{activeSync.current=false;setSyncing(false);}
  },[load]);

  useEffect(()=>{
    const refresh=()=>void load();
    const reconnect=()=>{void load();void sync();};
    const dispose=installOfflineAutoSync();
    void load();
    if(navigator.onLine)void sync();
    window.addEventListener('online',reconnect);
    window.addEventListener('offline',refresh);
    window.addEventListener('focus',refresh);
    window.addEventListener('bitalis:offline-queue-changed',refresh);
    window.addEventListener('bitalis:queue-changed',refresh);
    const timer=window.setInterval(()=>{void load();if(navigator.onLine)void sync();},30000);
    return()=>{dispose();window.clearInterval(timer);window.removeEventListener('online',reconnect);
      window.removeEventListener('offline',refresh);window.removeEventListener('focus',refresh);
      window.removeEventListener('bitalis:offline-queue-changed',refresh);window.removeEventListener('bitalis:queue-changed',refresh);};
  },[load,sync]);

  const pending=useMemo(()=>ops.filter(row=>pendingStatuses.has(row.status)).length+
    legacy.filter(row=>pendingStatuses.has(row.state)).length,[ops,legacy]);
  const attention=useMemo(()=>ops.filter(row=>attentionStatuses.has(row.status)).length,[ops]);
  const total=pending+attention;
  const rows=useMemo(()=>[
    ...ops.map(row=>({id:row.id,label:operationLabel(row.operationType),status:row.status,at:row.clientCapturedAt,durable:true})),
    ...legacy.map(row=>({id:row.id,label:row.kind==='CLIENT_INTAKE'?'Alta rápida':operationLabel(row.kind),status:row.state,at:row.createdAt,durable:false}))
  ].sort((a,b)=>Date.parse(a.at)-Date.parse(b.at)),[ops,legacy]);

  if(!total&&!syncing&&!open&&!feedback)return null;
  return <>
    {total>0&&<button type="button" onClick={()=>{haptic('tap');setOpen(true);}} className={`fixed bottom-[calc(5.75rem+env(safe-area-inset-bottom))] right-3 z-[115] flex h-14 w-14 items-center justify-center rounded-2xl border-2 bg-white shadow-[0_12px_30px_rgba(6,43,36,.22)] active:scale-95 ${attention?'border-red-300 text-red-700':'border-amber-300 text-amber-700'}`} aria-label={`${total} operación${total===1?'':'es'} pendiente${total===1?'':'s'} de subir`}>
      {syncing?<Loader2 className="h-6 w-6 animate-spin"/>:<CloudUpload className="h-6 w-6"/>}
      <span className={`absolute -right-1.5 -top-1.5 flex min-h-6 min-w-6 items-center justify-center rounded-full px-1 text-[10px] font-black text-white ring-2 ring-white ${attention?'bg-red-600':'bg-amber-500'}`}>{total>99?'99+':total}</span>
    </button>}
    {feedback&&!open&&<button type="button" onClick={()=>setFeedback(null)} className="fixed bottom-[calc(5.75rem+env(safe-area-inset-bottom))] left-3 right-20 z-[114] min-h-12 rounded-2xl bg-[var(--bitalis-primary)] px-3 text-left text-[11px] font-bold leading-4 text-white shadow-lg">{feedback}</button>}
    {open&&<div data-no-swipe className="fixed inset-0 z-[170] flex items-end bg-slate-950/55 backdrop-blur-sm sm:items-center sm:justify-center sm:p-4" onClick={()=>setOpen(false)}>
      <section role="dialog" aria-modal="true" aria-labelledby="offline-pending-title" onClick={event=>event.stopPropagation()} className="bitalis-bottom-sheet max-h-[82svh] w-full overflow-y-auto p-4 pb-[max(1rem,env(safe-area-inset-bottom))] sm:max-w-md sm:rounded-[28px] sm:p-5">
        <div className="flex items-start justify-between gap-3"><div className="flex min-w-0 items-center gap-3"><div className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl ${attention?'bg-red-50 text-red-700':'bg-amber-50 text-amber-700'}`}>{attention?<AlertTriangle className="h-6 w-6"/>:<CloudUpload className="h-6 w-6"/>}</div><div><p className="text-[10px] font-black uppercase tracking-[.13em] text-[var(--bitalis-action)]">Protegido en este dispositivo</p><h2 id="offline-pending-title" className="text-lg font-black text-[var(--bitalis-primary)]">{total} por confirmar</h2></div></div><button type="button" onClick={()=>setOpen(false)} className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-slate-100 text-slate-600" aria-label="Cerrar pendientes"><X className="h-5 w-5"/></button></div>
        <div className={`mt-4 flex items-start gap-2 rounded-2xl p-3 text-xs leading-5 ${online?'bg-emerald-50 text-emerald-800':'bg-amber-50 text-amber-800'}`}>{online?<CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0"/>:<WifiOff className="mt-0.5 h-4 w-4 shrink-0"/>}<span>{online?'Hay conexión. BITALIS intentará enviarlas automáticamente.':'Sin internet. Los datos y fotografías permanecen guardados y se enviarán al recuperar señal.'}</span></div>
        <div className="mt-3 space-y-2">{rows.map((row,index)=><div key={row.id} className="rounded-2xl border border-slate-200 bg-white p-3"><div className="flex items-center justify-between gap-3"><div className="min-w-0"><p className="truncate text-sm font-black text-[var(--bitalis-primary)]">{row.label} {index+1}</p><p className="mt-1 text-[10px] font-bold text-slate-400">{capturedAt(row.at)} · Captura protegida</p></div><span className={`shrink-0 rounded-full px-2 py-1 text-[9px] font-black ${attentionStatuses.has(row.status)?'bg-red-50 text-red-700':row.status==='SYNCING'?'bg-blue-50 text-blue-700':'bg-amber-50 text-amber-700'}`}>{statusLabel(row.status)}</span></div>{row.label==='Alta rápida'&&<p className="mt-2 flex items-center gap-1.5 text-[10px] leading-4 text-slate-500"><ShieldCheck className="h-3.5 w-3.5 shrink-0"/>Por privacidad no se muestran nombre, ubicación ni fotografías.</p>}</div>)}</div>
        {feedback&&<p className="mt-3 rounded-2xl bg-slate-100 p-3 text-xs font-bold leading-5 text-slate-600">{feedback}</p>}
        <button type="button" onClick={()=>{haptic('tap');void sync();}} disabled={syncing||!online||pending===0} className="mt-4 flex min-h-14 w-full items-center justify-center gap-2 rounded-2xl bg-[var(--bitalis-action)] px-4 text-sm font-black text-white disabled:opacity-40">{syncing?<Loader2 className="h-5 w-5 animate-spin"/>:<RefreshCw className="h-5 w-5"/>}{syncing?'SINCRONIZANDO…':online?'SINCRONIZAR AHORA':'ESPERANDO INTERNET'}</button>
        <p className="mt-3 text-center text-[10px] leading-4 text-slate-400">BITALIS no elimina una captura hasta recibir confirmación individual del servidor.</p>
      </section>
    </div>}
  </>;
}
