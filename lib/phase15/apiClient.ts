'use client';

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

function accessToken(){ if(typeof window==='undefined') return null; return localStorage.getItem('bitalis_access_token'); }
async function refreshAccessToken(){if(typeof window==='undefined')return false;const refreshToken=localStorage.getItem('bitalis_refresh_token');if(!refreshToken)return false;try{const res=await fetch('/api/auth/refresh',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({refreshToken}),cache:'no-store'});const body=await res.json().catch(()=>({}));if(!res.ok)return false;const next=body?.accessToken||body?.access_token||body?.tokens?.accessToken;const nextRefresh=body?.refreshToken||body?.refresh_token||body?.tokens?.refreshToken;if(!next)return false;localStorage.setItem('bitalis_access_token',next);if(nextRefresh)localStorage.setItem('bitalis_refresh_token',nextRefresh);return true;}catch{return false;}}

export async function apiClient<T=any>(path:string, options:ApiOptions={}):Promise<T>{
  const { timeoutMs=15000, retry=0, idempotencyKey, headers, skipRefresh=false, ...init } = options;
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
    if(res.status===401 && !skipRefresh && path!=='/api/auth/refresh'){
      const refreshed=await refreshAccessToken();
      if(refreshed)return apiClient<T>(path,{...options,skipRefresh:true});
      if(typeof window!=='undefined')window.dispatchEvent(new CustomEvent('bitalis:session-expired'));
    }
    if(!res.ok)throw friendly(res.status,body);
    if(typeof window!=='undefined'&&path==='/api/admin/access'&&String(init.method||'GET').toUpperCase()!=='GET'){
      window.dispatchEvent(new Event('bitalis:permissions-changed'));
    }
    return body as T;
  }catch(err:any){
    if(retry>0 && typeof navigator!=='undefined' && navigator.onLine && err?.status!==401 && err?.status!==403) return apiClient<T>(path,{...options,retry:retry-1});
    if(err?.name==='AbortError') throw {status:0,code:'TIMEOUT',message:'La conexión tardó demasiado. Intenta nuevamente.'} satisfies ApiError;
    if(err?.message) throw err;
    throw {status:0,code:'NETWORK',message:'Sin conexión. Verifica tu red.'} satisfies ApiError;
  }finally{clearTimeout(timer);}
}

export const newIdempotencyKey=(prefix='op')=>`${prefix}-${Date.now()}-${typeof crypto!=='undefined'&&crypto.randomUUID?crypto.randomUUID():Math.random().toString(36).slice(2)}`;
