'use client';

import {apiClient} from '@/lib/phase15/apiClient';
import {listQueued,removeQueued,updateQueued,OfflineOperation} from '@/lib/phase15/offlineQueue';

export type SyncSummary={processed:number;synced:number;failed:number;stoppedOffline:boolean};

export async function syncQueuedOperations():Promise<SyncSummary>{
  if(typeof window==='undefined'||typeof navigator==='undefined'||!navigator.onLine)return{processed:0,synced:0,failed:0,stoppedOffline:true};
  const rows=await listQueued();
  let processed=0,synced=0,failed=0;
  for(const row of rows){
    if(row.state==='SYNCED')continue;
    if(!navigator.onLine)return{processed,synced,failed,stoppedOffline:true};
    processed++;
    const working:OfflineOperation={...row,state:'SYNCING',attempts:row.attempts+1,lastError:undefined};
    await updateQueued(working);
    try{
      const body=row.body==null?undefined:{...row.body,idempotencyKey:row.idempotencyKey};
      const json=await apiClient<any>(row.endpoint,{method:row.method,idempotencyKey:row.idempotencyKey,body:body==null?undefined:JSON.stringify(body),timeoutMs:20000});
      await removeQueued(row.id);synced++;
      window.dispatchEvent(new CustomEvent('bitalis:operation-synced',{detail:{...row,response:json}}));
    }catch(e:any){
      if(e?.status===409){
        await removeQueued(row.id);synced++;
        window.dispatchEvent(new CustomEvent('bitalis:operation-synced',{detail:{...row,response:{conflict:true}}}));
        continue;
      }
      failed++;
      const msg=e?.status===401?'Tu sesión expiró.':e?.status===403?'No tienes autorización para sincronizar esta operación.':e?.message||'No fue posible sincronizar.';
      await updateQueued({...working,state:'FAILED',lastError:msg});
      if(e?.status===401||e?.status===403)break;
      if(!navigator.onLine)return{processed,synced,failed,stoppedOffline:true};
    }
  }
  window.dispatchEvent(new CustomEvent('bitalis:queue-changed'));
  return{processed,synced,failed,stoppedOffline:false};
}
