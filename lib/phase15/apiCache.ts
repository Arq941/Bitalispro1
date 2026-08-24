'use client';

const DB='bitalis-offline-api';
const STORE='responses';

type CacheRow={key:string;value:any;updatedAt:string};

function openDb():Promise<IDBDatabase>{
  return new Promise((resolve,reject)=>{
    const r=indexedDB.open(DB,1);
    r.onupgradeneeded=()=>{if(!r.result.objectStoreNames.contains(STORE))r.result.createObjectStore(STORE,{keyPath:'key'});};
    r.onsuccess=()=>resolve(r.result);
    r.onerror=()=>reject(r.error);
  });
}

function userScope(){
  try{return JSON.parse(localStorage.getItem('bitalis_auth_user')||'{}')?.id||'anonymous';}catch{return'anonymous';}
}

export function isOfflineCacheable(path:string,method='GET'){
  if(method.toUpperCase()!=='GET')return false;
  return path.startsWith('/api/collections/portfolio')||
    path.startsWith('/api/cash-sessions/current')||
    path.startsWith('/api/clients')||
    path.startsWith('/api/products')||
    path.startsWith('/api/inventory')||
    path.startsWith('/api/orders')||
    path.startsWith('/api/product-orders')||
    path.startsWith('/api/warehouses')||
    path.startsWith('/api/suppliers')||
    path.startsWith('/api/sales')||
    path.startsWith('/api/renewals')||
    path.startsWith('/api/commissions')||
    path.startsWith('/api/reports')||
    path.startsWith('/api/notifications')||
    path.startsWith('/api/collections/route-plan');
}

function keyFor(path:string){return `${userScope()}:${path}`;}

export async function putApiCache(path:string,value:any){
  if(typeof window==='undefined'||!('indexedDB'in window))return;
  const db=await openDb();
  const row:CacheRow={key:keyFor(path),value,updatedAt:new Date().toISOString()};
  await new Promise<void>((resolve,reject)=>{const tx=db.transaction(STORE,'readwrite');tx.objectStore(STORE).put(row);tx.oncomplete=()=>resolve();tx.onerror=()=>reject(tx.error);});
}

export async function getApiCache<T=any>(path:string):Promise<T|null>{
  if(typeof window==='undefined'||!('indexedDB'in window))return null;
  const db=await openDb();
  return new Promise((resolve,reject)=>{const r=db.transaction(STORE).objectStore(STORE).get(keyFor(path));r.onsuccess=()=>resolve((r.result?.value??null) as T|null);r.onerror=()=>reject(r.error);});
}


export async function clearApiCacheForUser(userId:string){
  if(typeof window==='undefined'||!('indexedDB'in window)||!userId)return;
  const db=await openDb(),prefix=`${userId}:`;
  await new Promise<void>((resolve,reject)=>{
    const tx=db.transaction(STORE,'readwrite'),cursor=tx.objectStore(STORE).openCursor();
    cursor.onsuccess=()=>{const current=cursor.result;if(!current)return;if(String(current.key).startsWith(prefix))current.delete();current.continue();};
    cursor.onerror=()=>reject(cursor.error);tx.oncomplete=()=>resolve();tx.onerror=()=>reject(tx.error);
  });
}
