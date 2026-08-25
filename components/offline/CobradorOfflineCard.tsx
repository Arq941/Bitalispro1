'use client';
import React,{useCallback,useEffect,useState}from'react';
import{offlineStorage,OfflineOperation}from'@/lib/offline-storage';
import{offlineIdentity,syncOfflineQueue}from'@/lib/offline-sync-client';
import{Database,Wifi,WifiOff,RefreshCw,CheckCircle2,AlertTriangle,ShieldCheck,Clock}from'lucide-react';

export function CobradorOfflineCard(){
 const[online,setOnline]=useState(true),[ops,setOps]=useState<OfflineOperation[]>([]),[last,setLast]=useState<string|null>(null),[syncing,setSyncing]=useState(false);
 const load=useCallback(async()=>{setOnline(navigator.onLine);const id=offlineIdentity();setOps(id?await offlineStorage.listForUser(id.userId,id.deviceId):[]);
  const value=localStorage.getItem('lastServerSyncAt');setLast(value?new Date(value).toLocaleTimeString():null);},[]);
 useEffect(()=>{const refresh=()=>void load();load();window.addEventListener('online',refresh);window.addEventListener('offline',refresh);window.addEventListener('bitalis:offline-queue-changed',refresh);
  return()=>{window.removeEventListener('online',refresh);window.removeEventListener('offline',refresh);window.removeEventListener('bitalis:offline-queue-changed',refresh);};},[load]);
 const sync=async()=>{setSyncing(true);try{await syncOfflineQueue();}catch{}finally{await load();setSyncing(false);}};
 const pending=ops.filter(x=>x.status==='QUEUED'||x.status==='SYNCING'||x.status==='FAILED');
 const attention=ops.filter(x=>x.status==='CONFLICT'||x.status==='REJECTED');
 return <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-xl text-white">
  <div className="flex items-center justify-between gap-3 mb-4"><div className="flex items-center gap-3">
   <div className={'p-2.5 rounded-xl '+(online?'bg-emerald-500/10 text-emerald-400':'bg-amber-500/10 text-amber-400')}>{online?<Wifi className="w-5 h-5"/>:<WifiOff className="w-5 h-5"/>}</div>
   <div><h3 className="font-semibold flex items-center gap-2">Trabajo sin conexión <ShieldCheck className="w-4 h-4 text-emerald-400"/></h3>
   <p className="text-xs text-slate-400">{online?'Conexión disponible':'Los movimientos se guardan como pendientes'}</p></div></div>
   <button onClick={sync} disabled={syncing||!online||pending.length===0} className="min-h-12 flex items-center gap-2 px-4 py-2 bg-emerald-600 disabled:opacity-40 rounded-xl text-xs font-semibold">
    <RefreshCw className={'w-4 h-4 '+(syncing?'animate-spin':'')}/>{syncing?'Sincronizando…':'Sincronizar ahora'}</button></div>
  <div className="grid grid-cols-3 gap-3 pt-3 border-t border-slate-800">
   <Metric label="Pendientes" value={String(pending.length)} icon={<Database className="w-4 h-4"/>}/>
   <Metric label="Requieren revisión" value={String(attention.length)} icon={<AlertTriangle className="w-4 h-4"/>}/>
   <Metric label="Última confirmación" value={last||'No registrada'} icon={<Clock className="w-4 h-4"/>}/></div>
  {ops.length>0&&<div className="mt-4 space-y-1.5 max-h-40 overflow-y-auto">{ops.slice(0,8).map(op=><div key={op.id} className="flex items-center justify-between text-xs bg-slate-800/50 p-2 rounded-lg">
   <span className="font-mono text-emerald-300">{op.operationType}</span><span className="text-slate-400">{new Date(op.clientCapturedAt).toLocaleTimeString()}</span>
   <span className={op.status==='SYNCED'?'text-emerald-400':'text-amber-400'}>{op.status==='SYNCING'?'ENVIANDO':op.status}</span></div>)}</div>}
  <p className="mt-3 text-[11px] text-slate-400 flex items-center gap-1"><CheckCircle2 className="w-3.5 h-3.5"/>Sólo “confirmado” después de respuesta del servidor.</p>
 </div>;
}
function Metric({label,value,icon}:{label:string;value:string;icon:React.ReactNode}){return <div className="bg-slate-800/60 p-3 rounded-xl"><span className="text-[11px] text-slate-400 block">{label}</span><span className="text-sm font-bold text-slate-100 flex items-center gap-1 mt-1">{icon}{value}</span></div>;}
