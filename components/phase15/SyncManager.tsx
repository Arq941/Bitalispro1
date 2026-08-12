'use client';

import {useCallback,useEffect,useState} from 'react';
import {CloudUpload,Loader2} from 'lucide-react';
import {listQueued} from '@/lib/phase15/offlineQueue';
import {syncQueuedOperations} from '@/lib/phase15/syncQueue';

export default function SyncManager(){
  const[count,setCount]=useState(0),[syncing,setSyncing]=useState(false);
  const refresh=useCallback(async()=>{try{const rows=await listQueued();setCount(rows.filter(x=>x.state!=='SYNCED').length);}catch{}},[]);
  const sync=useCallback(async()=>{if(syncing||!navigator.onLine)return;setSyncing(true);try{await syncQueuedOperations();}catch{}finally{setSyncing(false);await refresh();}},[refresh,syncing]);
  useEffect(()=>{refresh();const changed=()=>refresh();const online=()=>sync();window.addEventListener('bitalis:queue-changed',changed);window.addEventListener('online',online);const timer=setInterval(()=>{if(navigator.onLine)sync();},30000);return()=>{window.removeEventListener('bitalis:queue-changed',changed);window.removeEventListener('online',online);clearInterval(timer);};},[refresh,sync]);
  if(!count&&!syncing)return null;
  return <button onClick={sync} disabled={syncing||!navigator.onLine} className="fixed right-3 top-3 z-[101] flex min-h-8 items-center gap-1.5 rounded-full border border-orange-200 bg-white px-3 text-[10px] font-black text-[#FF6A00] shadow-sm disabled:opacity-60" aria-label="Sincronizar operaciones pendientes">{syncing?<Loader2 className="h-3 w-3 animate-spin"/>:<CloudUpload className="h-3 w-3"/>}{syncing?'SINCRONIZANDO':`${count} PENDIENTE${count===1?'':'S'}`}</button>;
}
