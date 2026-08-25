'use client';
import React,{useCallback,useEffect,useState}from'react';
import{offlineStorage,OfflineOperation}from'@/lib/offline-storage';
import{installOfflineAutoSync,offlineIdentity,syncOfflineQueue}from'@/lib/offline-sync-client';
import{Wifi,WifiOff,RefreshCw,Database}from'lucide-react';

export function OfflineSyncIndicator(){
 const[online,setOnline]=useState(true),[ops,setOps]=useState<OfflineOperation[]>([]),[syncing,setSyncing]=useState(false),[msg,setMsg]=useState<string|null>(null);
 const load=useCallback(async()=>{setOnline(navigator.onLine);const id=offlineIdentity();setOps(id?await offlineStorage.listForUser(id.userId,id.deviceId):[]);},[]);
 const sync=useCallback(async()=>{if(syncing||!navigator.onLine)return;setSyncing(true);setMsg('Sincronizando…');
  try{const result=await syncOfflineQueue();const conflicts=result?.results.filter(x=>x.status==='CONFLICT'||x.status==='REJECTED').length||0;
   setMsg(conflicts?String(conflicts)+' requieren revisión':'Sincronización confirmada');}
  catch{setMsg('Sin confirmar; seguirá pendiente');}finally{await load();setSyncing(false);window.setTimeout(()=>setMsg(null),4000);}},[load,syncing]);
 useEffect(()=>{const refresh=()=>void load();const dispose=installOfflineAutoSync();load();
  window.addEventListener('online',refresh);window.addEventListener('offline',refresh);window.addEventListener('bitalis:offline-queue-changed',refresh);
  const timer=window.setInterval(refresh,10000);return()=>{dispose();clearInterval(timer);window.removeEventListener('online',refresh);window.removeEventListener('offline',refresh);window.removeEventListener('bitalis:offline-queue-changed',refresh);};},[load]);
 const pending=ops.filter(x=>x.status==='QUEUED'||x.status==='SYNCING'||x.status==='FAILED').length;
 const attention=ops.filter(x=>x.status==='CONFLICT'||x.status==='REJECTED').length;
 return <div className="flex items-center gap-2 bg-slate-900/90 text-white px-3 py-1.5 rounded-full text-xs font-medium backdrop-blur shadow-md">
  <div className={'flex items-center gap-1.5 px-2 py-0.5 rounded-full '+(online?'bg-emerald-500/20 text-emerald-400':'bg-amber-500/20 text-amber-400')}>
   {online?<Wifi className="w-3.5 h-3.5"/>:<WifiOff className="w-3.5 h-3.5"/>}<span>{online?'En línea':'Sin conexión'}</span>
  </div>
  {(pending>0||attention>0)&&<div className="flex items-center gap-1 bg-amber-500/20 text-amber-300 px-2 py-0.5 rounded-full"><Database className="w-3.5 h-3.5"/><span>{pending} pendientes{attention?', '+attention+' revisar':''}</span></div>}
  {msg&&<span className="text-slate-300 hidden sm:inline text-[11px]">{msg}</span>}
  <button onClick={sync} disabled={syncing||!online||pending===0} className="flex items-center gap-1 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-40 text-white px-2.5 py-1 rounded-full transition-all active:scale-95" title="Sincronizar ahora">
   <RefreshCw className={'w-3.5 h-3.5 '+(syncing?'animate-spin':'')}/><span>{syncing?'Enviando':'Sincronizar'}</span>
  </button>
 </div>;
}
