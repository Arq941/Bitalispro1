'use client';

import {useEffect,useState} from 'react';
import {traceAuthTransition} from '@/lib/ux/authTransitionTrace';

const CHUNK_RECOVERY_KEY='bitalis:chunk-recovery:v1';

function isChunkLoadError(error:Error&{digest?:string}){
 const text=`${error?.name||''} ${error?.message||''} ${error?.stack||''}`.toLowerCase();
 return text.includes('chunkloaderror')||text.includes('loading chunk')||text.includes('failed to fetch dynamically imported module')||text.includes('/_next/static/');
}

async function recoverDelivery(destination?:string){
 try{
  if('serviceWorker' in navigator){
   const registrations=await navigator.serviceWorker.getRegistrations();
   await Promise.all(registrations.map(registration=>registration.unregister()));
  }
  if('caches' in window){
   const keys=await caches.keys();
   await Promise.all(keys.map(key=>caches.delete(key)));
  }
 }catch{}
 const target=new URL(destination||'/',location.origin);
 target.searchParams.set('__bitalis_recover',String(Date.now()));
 location.replace(target.pathname+target.search+target.hash);
}

export default function GlobalError({error,reset}:{error:Error&{digest?:string};reset:()=>void}){
 const[working,setWorking]=useState(false);
 useEffect(()=>{
  const detail={name:error?.name||'Error',message:error?.message||'',digest:error?.digest||'',path:typeof location!=='undefined'?location.pathname:''};
  traceAuthTransition('client-global-error',detail);
  try{localStorage.setItem('bitalis:last-client-error',JSON.stringify({at:new Date().toISOString(),reason:'global-error-boundary',...detail,stack:String(error?.stack||'').slice(0,1400)}));}catch{}

  if(!isChunkLoadError(error)||typeof location==='undefined')return;
  try{
   const stored=JSON.parse(sessionStorage.getItem(CHUNK_RECOVERY_KEY)||'{}') as {path?:string;attempts?:number};
   const currentPath=location.pathname;
   const attempts=stored.path===currentPath?Number(stored.attempts||0):0;
   if(attempts>=2)return;
   sessionStorage.setItem(CHUNK_RECOVERY_KEY,JSON.stringify({path:currentPath,attempts:attempts+1,at:Date.now()}));
   setWorking(true);
   void recoverDelivery(location.pathname+location.search+location.hash);
  }catch{}
 },[error]);
 const recover=async()=>{setWorking(true);try{reset();}catch{}try{sessionStorage.removeItem(CHUNK_RECOVERY_KEY);}catch{}await recoverDelivery(location.pathname+location.search+location.hash);};
 const page:React.CSSProperties={minHeight:'100vh',display:'flex',alignItems:'center',justifyContent:'center',padding:'24px',background:'#F5F7F6',color:'#16332C',fontFamily:'system-ui,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif'};
 const card:React.CSSProperties={width:'100%',maxWidth:'430px',background:'#fff',border:'1px solid #DDE8E2',borderRadius:'28px',padding:'24px',boxShadow:'0 18px 48px rgba(6,43,36,.10)',textAlign:'center'};
 const icon:React.CSSProperties={width:'56px',height:'56px',margin:'0 auto',borderRadius:'18px',display:'flex',alignItems:'center',justifyContent:'center',background:'#EEF7F2',color:'#062B24',fontSize:'24px',fontWeight:900};
 const primary:React.CSSProperties={width:'100%',minHeight:'52px',border:0,borderRadius:'16px',background:'#11A65A',color:'#fff',fontWeight:900,fontSize:'14px',marginTop:'18px',opacity:working?.65:1};
 const secondary:React.CSSProperties={width:'100%',minHeight:'48px',border:'1px solid #DDE8E2',borderRadius:'16px',background:'#fff',color:'#062B24',fontWeight:900,fontSize:'13px',marginTop:'10px'};
 return <html lang="es"><body style={{margin:0}}><main style={page}><section style={card}><div style={icon}>!</div><div style={{marginTop:'16px',fontSize:'11px',fontWeight:900,letterSpacing:'.12em',color:'#0C7A46'}}>RECUPERACIÓN BITALIS</div><h1 style={{margin:'8px 0 0',fontSize:'22px',color:'#062B24'}}>{working&&isChunkLoadError(error)?'Actualizando archivos de BITALIS':'BITALIS encontró un error temporal'}</h1><p style={{margin:'10px 0 0',fontSize:'14px',lineHeight:1.55,color:'#64748B'}}>{working&&isChunkLoadError(error)?'Detectamos un módulo de una compilación anterior. Estamos solicitando automáticamente la versión actual sin cerrar tu sesión.':'La referencia quedó guardada para diagnóstico. Tus datos, sesión y permisos se conservarán.'}</p><p style={{margin:'12px 0 0',fontSize:'11px',fontWeight:800,color:'#64748B'}}>Referencia: {error?.digest||error?.name||'CLIENT'}</p><button disabled={working} type="button" style={primary} onClick={recover}>{working?'RECARGANDO…':'REINTENTAR BITALIS'}</button><button disabled={working} type="button" style={secondary} onClick={()=>location.replace('/')}>VOLVER AL ACCESO</button></section></main></body></html>;
}
