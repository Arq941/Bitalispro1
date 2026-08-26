/**
 * Durable, user-scoped IndexedDB queue for field operations.
 * Records are never considered confirmed until the server acknowledges that exact idempotency key.
 */
export type OfflineStatus = 'QUEUED'|'SYNCING'|'SYNCED'|'CONFLICT'|'FAILED'|'REJECTED';
export interface OfflineOperation {
  id:string; idempotencyKey:string;
  operationType:'PAYMENT'|'DOWN_PAYMENT'|'VISIT'|'NON_PAYMENT_REASON'|'RESCHEDULE'|'PAYMENT_PROMISE'|'EXPENSE'|'GPS_TRACE'|'CLIENT'|'SALE';
  payload:unknown; clientCapturedAt:string; deviceId:string; userId:string;
  status:OfflineStatus; retryCount:number; nextRetryAt?:string; lastAttemptAt?:string;
  serverReceivedAt?:string; conflictCode?:string; errorMessage?:string;
  createdAt:string; updatedAt:string;
}
const DB_NAME='CobranzaOfflineDB';
const DB_VERSION=2;
const STORE='offline_operations';
const ACTIVE:OfflineStatus[]=['QUEUED','SYNCING','FAILED'];

function requestResult<T>(req:IDBRequest<T>):Promise<T>{
  return new Promise((resolve,reject)=>{req.onsuccess=()=>resolve(req.result);req.onerror=()=>reject(req.error);});
}
function txDone(tx:IDBTransaction):Promise<void>{
  return new Promise((resolve,reject)=>{tx.oncomplete=()=>resolve();tx.onerror=()=>reject(tx.error);tx.onabort=()=>reject(tx.error);});
}
export class OfflineStorageService {
  private dbPromise:Promise<IDBDatabase>|null=null;
  constructor(){if(typeof window!=='undefined'&&'indexedDB'in window)this.dbPromise=this.initDB();}
  private initDB():Promise<IDBDatabase>{
    return new Promise((resolve,reject)=>{
      const req=indexedDB.open(DB_NAME,DB_VERSION);
      req.onupgradeneeded=()=>{
        const db=req.result;
        let store:IDBObjectStore;
        if(!db.objectStoreNames.contains(STORE)){
          store=db.createObjectStore(STORE,{keyPath:'id'});
        }else store=req.transaction!.objectStore(STORE);
        const indexes:[string,string,IDBIndexParameters][]=[
          ['idempotencyKey','idempotencyKey',{unique:true}],['status','status',{unique:false}],
          ['userId','userId',{unique:false}],['deviceId','deviceId',{unique:false}],
          ['clientCapturedAt','clientCapturedAt',{unique:false}],['nextRetryAt','nextRetryAt',{unique:false}]
        ];
        for(const [name,key,opts] of indexes)if(!store.indexNames.contains(name))store.createIndex(name,key,opts);
        for(const name of ['cached_clients','cached_routes','cached_credits','sync_metadata'])
          if(!db.objectStoreNames.contains(name))db.createObjectStore(name,{keyPath:'id'});
      };
      req.onsuccess=()=>{const db=req.result;db.onversionchange=()=>db.close();resolve(db);};
      req.onerror=()=>reject(req.error);
      req.onblocked=()=>reject(new Error('La base offline está abierta en otra pestaña. Cierra otras ventanas de BITALIS.'));
    });
  }
  private async db(){if(typeof window==='undefined'||!('indexedDB'in window))return null;if(!this.dbPromise)this.dbPromise=this.initDB();return this.dbPromise;}
  async create(op:Omit<OfflineOperation,'createdAt'|'updatedAt'|'retryCount'|'status'> & {status?:OfflineStatus}):Promise<OfflineOperation>{
    if(!op.userId||!op.deviceId||!op.idempotencyKey)throw new Error('Operación offline sin propietario, dispositivo o clave idempotente');
    const now=new Date().toISOString();
    const value:OfflineOperation={...op,status:op.status||'QUEUED',retryCount:0,createdAt:now,updatedAt:now};
    const db=await this.db();if(!db)throw new Error('IndexedDB no está disponible; la operación no fue guardada');
    const tx=db.transaction(STORE,'readwrite');tx.objectStore(STORE).add(value);await txDone(tx);return value;
  }
  async get(id:string){const db=await this.db();if(!db)return null;return (await requestResult(db.transaction(STORE).objectStore(STORE).get(id)))||null;}
  async update(id:string,updates:Partial<OfflineOperation>){
    const db=await this.db();if(!db)return null;const tx=db.transaction(STORE,'readwrite');const store=tx.objectStore(STORE);
    const current=await requestResult<OfflineOperation|undefined>(store.get(id));if(!current){tx.abort();return null;}
    const value={...current,...updates,id:current.id,idempotencyKey:current.idempotencyKey,userId:current.userId,deviceId:current.deviceId,updatedAt:new Date().toISOString()};
    store.put(value);await txDone(tx);return value;
  }
  async listForUser(userId:string,deviceId?:string,includeTerminal=false){
    const db=await this.db();if(!db)return[];const all=await requestResult<OfflineOperation[]>(db.transaction(STORE).objectStore(STORE).index('userId').getAll(userId));
    return all.filter(o=>(!deviceId||o.deviceId===deviceId)&&(includeTerminal||ACTIVE.includes(o.status)))
      .sort((a,b)=>Date.parse(a.clientCapturedAt)-Date.parse(b.clientCapturedAt));
  }
  async getPending(userId?:string,deviceId?:string){
    if(!userId&&typeof window!=='undefined')userId=localStorage.getItem('userId')||undefined;
    if(!userId)return [];
    const now=Date.now();return (await this.listForUser(userId,deviceId)).filter(o=>o.status!=='FAILED'||!o.nextRetryAt||Date.parse(o.nextRetryAt)<=now);
  }
  async claim(ids:string[]){
    const now=new Date().toISOString();
    for(const id of ids)await this.update(id,{status:'SYNCING',lastAttemptAt:now});
  }
  async recoverStuck(userId:string,deviceId:string,maxAgeMs=120000){
    const cutoff=Date.now()-maxAgeMs;const ops=await this.listForUser(userId,deviceId);
    for(const op of ops)if(op.status==='SYNCING'&&Date.parse(op.lastAttemptAt||op.updatedAt)<cutoff)await this.update(op.id,{status:'QUEUED',errorMessage:'Sincronización interrumpida; se reintentará'});
  }
  async applyServerResult(id:string,result:any){
    if(result?.status==='SYNCED'||result?.status==='DUPLICATE')
      return this.update(id,{status:'SYNCED',serverReceivedAt:result.serverReceivedAt,errorMessage:undefined,conflictCode:undefined});
    if(result?.status==='CONFLICT')
      return this.update(id,{status:'CONFLICT',conflictCode:result.conflictCode,errorMessage:result.errorMessage});
    if(result?.status==='REJECTED')
      return this.update(id,{status:'REJECTED',errorMessage:result.errorMessage});
    const current=await this.get(id);const retry=(current?.retryCount||0)+1;
    const delay=Math.min(300000,Math.max(5000,2**Math.min(retry,6)*1000))+Math.floor(Math.random()*1500);
    return this.update(id,{status:'FAILED',retryCount:retry,nextRetryAt:new Date(Date.now()+delay).toISOString(),errorMessage:result?.errorMessage||'No confirmado por el servidor'});
  }
  async releaseAfterNetworkError(ids:string[],message='Sin conexión; la operación sigue pendiente'){
    for(const id of ids){const op=await this.get(id);const retry=(op?.retryCount||0)+1;const delay=Math.min(300000,2**Math.min(retry,6)*1000);
      await this.update(id,{status:'FAILED',retryCount:retry,nextRetryAt:new Date(Date.now()+delay).toISOString(),errorMessage:message});}
  }
  async delete(id:string){const db=await this.db();if(!db)return false;const tx=db.transaction(STORE,'readwrite');tx.objectStore(STORE).delete(id);await txDone(tx);return true;}
  async clearSynced(){const userId=typeof window!=='undefined'?localStorage.getItem('userId'):null;return userId?this.clearConfirmed(userId,0):0;}
  async clearConfirmed(userId:string,olderThanMs=86400000){
    const db=await this.db();if(!db)return 0;const all=await this.listForUser(userId,undefined,true);const cutoff=Date.now()-olderThanMs;let count=0;
    const tx=db.transaction(STORE,'readwrite');for(const op of all)if(op.status==='SYNCED'&&Date.parse(op.updatedAt)<cutoff){tx.objectStore(STORE).delete(op.id);count++;}
    await txDone(tx);return count;
  }
  async clearCachedUserData(userId:string){
    const db=await this.db();if(!db||!userId)return;
    const names=['cached_clients','cached_routes','cached_credits','sync_metadata'];
    const tx=db.transaction(names,'readwrite');
    for(const name of names){
      const store=tx.objectStore(name),rows=await requestResult<any[]>(store.getAll());
      for(const row of rows)if(row?.__ownerUserId===userId)store.delete(row.id);
    }
    await txDone(tx);
  }
  async clearUserData(userId:string){
    const db=await this.db();if(!db)return;const tx=db.transaction([STORE,'cached_clients','cached_routes','cached_credits','sync_metadata'],'readwrite');
    const ops=await requestResult<OfflineOperation[]>(tx.objectStore(STORE).index('userId').getAll(userId));
    for(const op of ops)tx.objectStore(STORE).delete(op.id);
    for(const name of ['cached_clients','cached_routes','cached_credits','sync_metadata']){
      const store=tx.objectStore(name),rows=await requestResult<any[]>(store.getAll());
      for(const row of rows)if(row?.__ownerUserId===userId)store.delete(row.id);
    }
    await txDone(tx);
  }
  async saveCachedData(storeName:'cached_clients'|'cached_routes'|'cached_credits',items:any[],userId?:string){
    if(!userId)throw new Error('No se puede guardar caché offline sin usuario');
    const db=await this.db();if(!db)throw new Error('IndexedDB no disponible');const tx=db.transaction(storeName,'readwrite');const store=tx.objectStore(storeName);
    const previous=await requestResult<any[]>(store.getAll());for(const row of previous)if(row?.__ownerUserId===userId)store.delete(row.id);
    for(const item of items)store.put({...item,id:String(item.id),__ownerUserId:userId});await txDone(tx);
  }
  async getCachedData(storeName:'cached_clients'|'cached_routes'|'cached_credits',userId?:string){
    if(!userId)return[];const db=await this.db();if(!db)return[];const all=await requestResult<any[]>(db.transaction(storeName).objectStore(storeName).getAll());
    return all.filter(x=>x.__ownerUserId===userId).map(({__ownerUserId,...x})=>x);
  }
}
export const offlineStorage=new OfflineStorageService();
