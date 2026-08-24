'use client';
import {offlineStorage,OfflineOperation} from '@/lib/offline-storage';
import {apiClient} from '@/lib/phase15/apiClient';

type SyncResult={idempotencyKey:string;status:string;serverReceivedAt?:string;conflictCode?:string;errorMessage?:string};
type SyncReply={success:boolean;results:SyncResult[]};
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

function clientIntakeForm(op:OfflineOperation){
  const form=new FormData();
  const payload=(op.payload&&typeof op.payload==='object'?op.payload:{}) as Record<string,unknown>;
  for(const [key,value] of Object.entries(payload)){
    if(value instanceof Blob)form.set(key,value,(value as File).name||`${key}.jpg`);
    else if(value!==undefined&&value!==null&&value!=='')form.set(key,String(value));
  }
  form.set('idempotencyKey',op.idempotencyKey);
  form.set('deviceId',op.deviceId);
  form.set('clientCapturedAt',op.clientCapturedAt);
  return form;
}

async function syncClientIntake(op:OfflineOperation):Promise<SyncResult>{
  try{
    await apiClient('/api/clients/intake',{
      method:'POST',timeoutMs:45000,retry:1,idempotencyKey:op.idempotencyKey,body:clientIntakeForm(op)
    });
    const result:SyncResult={idempotencyKey:op.idempotencyKey,status:'SYNCED',serverReceivedAt:new Date().toISOString()};
    await offlineStorage.delete(op.id);
    return result;
  }catch(error:any){
    if(error?.status===409){
      const result:SyncResult={idempotencyKey:op.idempotencyKey,status:'CONFLICT',conflictCode:error?.code,errorMessage:error?.message};
      await offlineStorage.applyServerResult(op.id,result);
      return result;
    }
    if([400,403,404].includes(Number(error?.status))){
      const result:SyncResult={idempotencyKey:op.idempotencyKey,status:'REJECTED',errorMessage:error?.message};
      await offlineStorage.applyServerResult(op.id,result);
      return result;
    }
    await offlineStorage.releaseAfterNetworkError([op.id],error?.message);
    return {idempotencyKey:op.idempotencyKey,status:'FAILED',errorMessage:error?.message||'Sin confirmación del servidor'};
  }
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
    const results:SyncResult[]=[];
    const clientOps=pending.filter(op=>op.operationType==='CLIENT');
    const batchOps=pending.filter(op=>op.operationType!=='CLIENT');
    for(const op of clientOps)results.push(await syncClientIntake(op));
    if(batchOps.length){
      try{
        const reply=await apiClient<SyncReply>('/api/offline/sync',{
          method:'POST',timeoutMs:30000,retry:1,
          body:JSON.stringify({deviceId:identity.deviceId,operations:batchOps.map(toWire)})
        });
        const byKey=new Map(reply.results.map(x=>[x.idempotencyKey,x]));
        for(const op of batchOps){
          const result=byKey.get(op.idempotencyKey)||{idempotencyKey:op.idempotencyKey,status:'FAILED',errorMessage:'El servidor no confirmó esta operación'};
          await offlineStorage.applyServerResult(op.id,result);
          results.push(result);
        }
      }catch(error:any){
        await offlineStorage.releaseAfterNetworkError(batchOps.map(x=>x.id),error?.message);
        results.push(...batchOps.map(op=>({idempotencyKey:op.idempotencyKey,status:'FAILED',errorMessage:error?.message||'Sin confirmación del servidor'})));
      }
    }
    if(results.some(x=>x.status==='SYNCED'||x.status==='DUPLICATE'))
      localStorage.setItem('lastServerSyncAt',new Date().toISOString());
    window.dispatchEvent(new Event('bitalis:offline-queue-changed'));
    return {success:results.every(x=>x.status==='SYNCED'||x.status==='DUPLICATE'),results};
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
