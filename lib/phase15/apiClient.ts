'use client';

export type ApiError = { status:number; code?:string; message:string; queued?:boolean };
export type ApiOptions = RequestInit & { timeoutMs?:number; retry?:number; idempotencyKey?:string };

const friendly = (status:number, raw:any):ApiError => {
  const msg = String(raw?.error || raw?.message || '').toLowerCase();
  if(status===401) return {status,code:'SESSION_EXPIRED',message:'Tu sesión expiró. Inicia sesión nuevamente.'};
  if(status===403) return {status,code:'FORBIDDEN',message:'No tienes autorización para realizar esta operación.'};
  if(status===409) return {status,code:'CONFLICT',message:'La operación ya fue registrada o existe un conflicto pendiente.'};
  if(status>=500 || msg.includes('prisma') || msg.includes('sql')) return {status,code:'SERVER_ERROR',message:'No pudimos completar la operación. Intenta nuevamente.'};
  return {status,code:raw?.code,message:raw?.error || raw?.message || 'No pudimos completar la operación.'};
};

function accessToken(){ if(typeof window==='undefined') return null; return localStorage.getItem('bitalis_access_token'); }

export async function apiClient<T=any>(path:string, options:ApiOptions={}):Promise<T>{
  const { timeoutMs=15000, retry=0, idempotencyKey, headers, ...init } = options;
  const controller = new AbortController();
  const timer = setTimeout(()=>controller.abort(), timeoutMs);
  const token = accessToken();
  const finalHeaders = new Headers(headers || {});
  if(!finalHeaders.has('Content-Type') && init.body) finalHeaders.set('Content-Type','application/json');
  if(token) finalHeaders.set('Authorization',`Bearer ${token}`);
  if(idempotencyKey) finalHeaders.set('Idempotency-Key',idempotencyKey);
  try{
    const res = await fetch(path,{...init,headers:finalHeaders,signal:controller.signal,cache:'no-store'});
    const body = await res.json().catch(()=>({}));
    if(!res.ok){
      if(res.status===401 && typeof window!=='undefined') window.dispatchEvent(new CustomEvent('bitalis:session-expired'));
      throw friendly(res.status,body);
    }
    return body as T;
  }catch(err:any){
    if(retry>0 && typeof navigator!=='undefined' && navigator.onLine) return apiClient<T>(path,{...options,retry:retry-1});
    if(err?.name==='AbortError') throw {status:0,code:'TIMEOUT',message:'La conexión tardó demasiado. Intenta nuevamente.'} satisfies ApiError;
    if(err?.message) throw err;
    throw {status:0,code:'NETWORK',message:'Sin conexión. Verifica tu red.'} satisfies ApiError;
  }finally{clearTimeout(timer);}
}

export const newIdempotencyKey=(prefix='op')=>`${prefix}-${Date.now()}-${typeof crypto!=='undefined'&&crypto.randomUUID?crypto.randomUUID():Math.random().toString(36).slice(2)}`;
