'use client';

import {getApiCache,isOfflineCacheable,putApiCache} from '@/lib/phase15/apiCache';

export type ApiError = { status:number; code?:string; message:string; queued?:boolean };
export type ApiOptions = RequestInit & { timeoutMs?:number; retry?:number; idempotencyKey?:string; skipRefresh?:boolean };

const friendly = (status:number, raw:any):ApiError => {
  const msg = String(raw?.error || raw?.message || '').toLowerCase();
  if(status===401) return {status,code:'SESSION_EXPIRED',message:'Tu sesión expiró. Inicia sesión nuevamente.'};
  if(status===403) return {status,code:'FORBIDDEN',message:'No tienes autorización para realizar esta operación.'};
  if(status===409) return {status,code:'CONFLICT',message:'La operación ya fue registrada o existe un conflicto pendiente.'};
  if(status>=500 || msg.includes('prisma') || msg.includes('sql')) return {status,code:'SERVER_ERROR',message:'No pudimos completar la operación. Intenta nuevamente.'};
  return {status,code:raw?.code,message:raw?.error || raw?.message || 'No pudimos completar la operación.'};
};

let refreshPromise:Promise<boolean>|null=null;
let sessionExpiredDispatched=false;

function accessToken(){ if(typeof window==='undefined') return null; return localStorage.getItem('bitalis_access_token'); }
function dispatchSessionExpiredOnce(){
  if(typeof window==='undefined'||sessionExpiredDispatched)return;
  sessionExpiredDispatched=true;
  window.dispatchEvent(new CustomEvent('bitalis:session-expired'));
}
async function refreshAccessTokenOnce(){
  if(typeof window==='undefined')return false;
  const refreshToken=localStorage.getItem('bitalis_refresh_token');
  if(!refreshToken)return false;
  try{
    const res=await fetch('/api/auth/refresh',{method:'POST',headers:{'Content-Type':'application/json','Cache-Control':'no-store'},body:JSON.stringify({refreshToken}),cache:'no-store'});
    const body=await res.json().catch(()=>({}));
    if(!res.ok)return false;
    const next=body?.accessToken||body?.access_token||body?.tokens?.accessToken;
    const nextRefresh=body?.refreshToken||body?.refresh_token||body?.tokens?.refreshToken;
    if(!next)return false;
    localStorage.setItem('bitalis_access_token',next);
    if(nextRefresh)localStorage.setItem('bitalis_refresh_token',nextRefresh);
    sessionExpiredDispatched=false;
    return true;
  }catch{return false;}
}
async function refreshAccessToken(){
  if(refreshPromise)return refreshPromise;
  const pending=refreshAccessTokenOnce();
  refreshPromise=pending;
  try{return await pending;}finally{if(refreshPromise===pending)refreshPromise=null;}
}

async function cachedFallback<T>(path:string,method:string){
  if(!isOfflineCacheable(path,method))return null;
  try{return await getApiCache<T>(path);}catch{return null;}
}

export async function apiClient<T=any>(path:string, options:ApiOptions={}):Promise<T>{
  const { timeoutMs=15000, retry=0, idempotencyKey, headers, skipRefresh=false, ...init } = options;
  const method=String(init.method||'GET').toUpperCase();
  if(typeof navigator!=='undefined'&&!navigator.onLine&&isOfflineCacheable(path,method)){
    const cached=await cachedFallback<T>(path,method);
    if(cached!==null)return cached;
  }
  const controller = new AbortController();
  const timer = setTimeout(()=>controller.abort(), timeoutMs);
  const token = accessToken();
  const finalHeaders = new Headers(headers || {});
  const isFormData = typeof FormData !== 'undefined' && init.body instanceof FormData;
  if(!finalHeaders.has('Content-Type') && init.body && !isFormData) finalHeaders.set('Content-Type','application/json');
  if(token) finalHeaders.set('Authorization',`Bearer ${token}`);
  if(idempotencyKey) finalHeaders.set('Idempotency-Key',idempotencyKey);
  try{
    const res = await fetch(path,{...init,headers:finalHeaders,signal:controller.signal,cache:'no-store'});
    const body = await res.json().catch(()=>({}));
    if(res.status===401 && !skipRefresh && path!=='/api/auth/refresh'){
      const currentToken=accessToken();
      if(token&&currentToken&&currentToken!==token){
        return apiClient<T>(path,{...options,skipRefresh:true});
      }
      const refreshed=await refreshAccessToken();
      if(refreshed)return apiClient<T>(path,{...options,skipRefresh:true});
      dispatchSessionExpiredOnce();
    }
    if(!res.ok){
      if(res.status>=500){const cached=await cachedFallback<T>(path,method);if(cached!==null)return cached;}
      throw friendly(res.status,body);
    }
    if(isOfflineCacheable(path,method))void putApiCache(path,body).catch(()=>{});
    if(typeof window!=='undefined'&&path==='/api/admin/access'&&method!=='GET'){
      window.dispatchEvent(new Event('bitalis:permissions-changed'));
    }
    return body as T;
  }catch(err:any){
    if(retry>0 && typeof navigator!=='undefined' && navigator.onLine && err?.status!==401 && err?.status!==403) return apiClient<T>(path,{...options,retry:retry-1});
    if(err?.status!==401&&err?.status!==403&&err?.status!==400&&err?.status!==404){
      const cached=await cachedFallback<T>(path,method);
      if(cached!==null)return cached;
    }
    if(err?.name==='AbortError') throw {status:0,code:'TIMEOUT',message:'La conexión tardó demasiado. Intenta nuevamente.'} satisfies ApiError;
    if(err?.message) throw err;
    throw {status:0,code:'NETWORK',message:'Sin conexión. Verifica tu red.'} satisfies ApiError;
  }finally{clearTimeout(timer);}
}

export const newIdempotencyKey=(prefix='op')=>`${prefix}-${Date.now()}-${typeof crypto!=='undefined'&&crypto.randomUUID?crypto.randomUUID():Math.random().toString(36).slice(2)}`;