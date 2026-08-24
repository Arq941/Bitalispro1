'use client';
import {offlineStorage,OfflineOperation} from '@/lib/offline-storage';
import {apiClient} from '@/lib/phase15/apiClient';

type SyncReply={success:boolean;results:Array<{idempotencyKey:string;status:string;serverReceivedAt?:string;conflictCode?:string;errorMessage?:string}>};
let active:Promise<SyncReply|null>|null=null;
const BATCH_SIZE=25;

export function offlineIdentity(){
  if(typeof window==='undefined')return null;
  const userId=localStorage.getItem('userId');
  let deviceId=localStorage.getItem('deviceId');
  if(!deviceId){
    deviceId=`PWA-${typeof crypto!=='undefined'&&crypto.randomUUID?crypto.randomUUID():Date.now().toString(36)}`;
    localStorage.setItem('deviceId',deviceId);
  }
  return userId?{userId,deviceId}:null;
}
export async function syncOfflineQueue():Promise<SyncReply|null>{
  if(active)return active;
  active=(async()=>{
    const identity=offlineIdentity();
    if(!identity||typeof navigator==='undefined'||!navigator.onLine)return null;
    await offlineStorage.recoverStuck(identity.userId,identity.deviceId);
    const pending=(await offlineStorage.getPending(identity.userId,identity.deviceId)).slice(0,BATCH_SIZE);
    if(!pending.length)return {success:true,results:[]};
    await offlineStorage.claim(pending.map(x=>x.id));
    try{
      const reply=await apiClient<SyncReply>('/api/offline/sync',{
        method:'POST',timeoutMs:30000,retry:1,
        body:JSON.stringify({deviceId:identity.deviceId,operations:pending.map(toWire)})
      });
      const byKey=new Map(reply.results.map(x=>[x.idempotencyKey,x]));
      for(const op of pending){
        const result=byKey.get(op.idempotencyKey);
        await offlineStorage.applyServerResult(op.id,result||{status:'FAILED',errorMessage:'El servidor no confirmó esta operación'});
      }
      if(reply.results.some(x=>x.status==='SYNCED'||x.status==='DUPLICATE'))
        localStorage.setItem('lastServerSyncAt',new Date().toISOString());
      window.dispatchEvent(new Event('bitalis:offline-queue-changed'));
      return reply;
    }catch(error:any){
      await offlineStorage.releaseAfterNetworkError(pending.map(x=>x.id),error?.message);
      window.dispatchEvent(new Event('bitalis:offline-queue-changed'));
      throw error;
    }
  })();
  try{return await active;}finally{active=null;}
}
function toWire(p:OfflineOperation){
  return {idempotencyKey:p.idempotencyKey,operationType:p.operationType,payload:p.payload,
    clientCapturedAt:p.clientCapturedAt,deviceId:p.deviceId};
}
export function installOfflineAutoSync(){
  if(typeof window==='undefined')return()=>{};
  let timer:number|undefined;
  const run=()=>void syncOfflineQueue().catch(()=>{});
  const visible=()=>{if(document.visibilityState==='visible')run();};
  window.addEventListener('online',run);
  window.addEventListener('focus',run);
  window.addEventListener('bitalis:offline-queue-changed',run);
  document.addEventListener('visibilitychange',visible);
  timer=window.setInterval(run,30000);
  run();
  return()=>{window.removeEventListener('online',run);window.removeEventListener('focus',run);
    window.removeEventListener('bitalis:offline-queue-changed',run);document.removeEventListener('visibilitychange',visible);
    if(timer)window.clearInterval(timer);};
}
