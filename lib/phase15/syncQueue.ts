'use client';

import {listQueued,removeQueued,updateQueued,OfflineOperation} from '@/lib/phase15/offlineQueue';

export type SyncSummary={processed:number;synced:number;failed:number;stoppedOffline:boolean};

export async function syncQueuedOperations():Promise<SyncSummary>{
  if(typeof window==='undefined'||typeof navigator==='undefined'||!navigator.onLine)return{processed:0,synced:0,failed:0,stoppedOffline:true};
  const token=localStorage.getItem('bitalis_access_token');
  if(!token)throw new Error('Tu sesión expiró. Inicia sesión nuevamente.');
  const rows=await listQueued();
  let processed=0,synced=0,failed=0;
  for(const row of rows){
    if(row.state==='SYNCED')continue;
    if(!navigator.onLine)return{processed,synced,failed,stoppedOffline:true};
    processed++;
    const working:OfflineOperation={...row,state:'SYNCING',attempts:row.attempts+1,lastError:undefined};
    await updateQueued(working);
    try{
      const res=await fetch(row.endpoint,{method:row.method,headers:{'Content-Type':'application/json',Authorization:`Bearer ${token}`,'Idempotency-Key':row.idempotencyKey},body:row.body==null?undefined:JSON.stringify({...row.body,idempotencyKey:row.idempotencyKey}),cache:'no-store'});
      const json=await res.json().catch(()=>({}));
      if(res.ok||res.status===409){
        await removeQueued(row.id);synced++;
        window.dispatchEvent(new CustomEvent('bitalis:operation-synced',{detail:{...row,response:json}}));
      }else{
        failed++;
        const msg=res.status===401?'Tu sesión expiró.':res.status===403?'No tienes autorización para sincronizar esta operación.':json?.error||json?.message||'No fue posible sincronizar.';
        await updateQueued({...working,state:'FAILED',lastError:msg});
        if(res.status===401||res.status===403)break;
      }
    }catch(e:any){
      failed++;
      await updateQueued({...working,state:'FAILED',lastError:e?.message||'Sin conexión.'});
      if(!navigator.onLine)return{processed,synced,failed,stoppedOffline:true};
    }
  }
  window.dispatchEvent(new CustomEvent('bitalis:queue-changed'));
  return{processed,synced,failed,stoppedOffline:false};
}
