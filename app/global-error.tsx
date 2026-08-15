'use client';

import {useEffect} from 'react';
import {traceAuthTransition} from '@/lib/ux/authTransitionTrace';

export default function GlobalError({error,reset}:{error:Error&{digest?:string};reset:()=>void}){
 useEffect(()=>{
  const detail={name:error?.name||'Error',digest:error?.digest||'',path:typeof location!=='undefined'?location.pathname:''};
  traceAuthTransition('client-global-error',detail);
  try{localStorage.setItem('bitalis:last-client-error',JSON.stringify({at:new Date().toISOString(),...detail}));}catch{}
 },[error]);

 const page:React.CSSProperties={minHeight:'100vh',display:'flex',alignItems:'center',justifyContent:'center',padding:'24px',background:'#F5F7F6',color:'#16332C',fontFamily:'system-ui,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif'};
 const card:React.CSSProperties={width:'100%',maxWidth:'430px',background:'#fff',border:'1px solid #DDE8E2',borderRadius:'28px',padding:'24px',boxShadow:'0 18px 48px rgba(6,43,36,.10)',textAlign:'center'};
 const icon:React.CSSProperties={width:'56px',height:'56px',margin:'0 auto',borderRadius:'18px',display:'flex',alignItems:'center',justifyContent:'center',background:'#EEF7F2',color:'#062B24',fontSize:'24px',fontWeight:900};
 const primary:React.CSSProperties={width:'100%',minHeight:'52px',border:0,borderRadius:'16px',background:'#11A65A',color:'#fff',fontWeight:900,fontSize:'14px',marginTop:'18px'};
 const secondary:React.CSSProperties={width:'100%',minHeight:'48px',border:'1px solid #DDE8E2',borderRadius:'16px',background:'#fff',color:'#062B24',fontWeight:900,fontSize:'13px',marginTop:'10px'};
 return <html lang="es"><body style={{margin:0}}><main style={page}><section style={card}><div style={icon}>!</div><div style={{marginTop:'16px',fontSize:'11px',fontWeight:900,letterSpacing:'.12em',color:'#0C7A46'}}>DIAGNÓSTICO BITALIS</div><h1 style={{margin:'8px 0 0',fontSize:'22px',color:'#062B24'}}>La aplicación encontró un error</h1><p style={{margin:'10px 0 0',fontSize:'14px',lineHeight:1.55,color:'#64748B'}}>Tus datos no se borraron. Puedes reintentar la pantalla o volver al acceso. El incidente quedó registrado en la traza local para diagnóstico.</p><p style={{margin:'12px 0 0',fontSize:'11px',fontWeight:800,color:'#64748B'}}>Referencia: {error?.digest||error?.name||'CLIENT'}</p><button type="button" style={primary} onClick={()=>reset()}>REINTENTAR</button><button type="button" style={secondary} onClick={()=>location.replace('/')}>VOLVER AL ACCESO</button></section></main></body></html>;
}
