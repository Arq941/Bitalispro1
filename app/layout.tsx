import type {Metadata,Viewport} from 'next';
import './globals.css';
import { ImageLightboxProvider } from '@/components/ImageLightboxContext';
import PWAProvider from '@/components/phase15/PWAProvider';
import AppShell from '@/components/phase15/AppShell';
import RoutePrefetcher from '@/components/phase15/RoutePrefetcher';
import AuthTransitionDiagnostics from '@/components/phase15/AuthTransitionDiagnostics';
import GeminiCopilot from '@/components/phase15/GeminiCopilot';

const deliveryGuard = String.raw`(()=>{
  const KEY='bitalis:delivery-recovery-attempts:v2';
  const RECOVERY_PARAM='__bitalis_recover';
  let recovering=false;
  const primaryReady=()=>{
    try{return getComputedStyle(document.documentElement).getPropertyValue('--bitalis-primary').trim().length>0;}catch{return false;}
  };
  const getAttempts=()=>{try{return Number(sessionStorage.getItem(KEY)||'0')||0;}catch{return 0;}};
  const setAttempts=(value)=>{try{sessionStorage.setItem(KEY,String(value));}catch{}};
  const clearAttempts=()=>{try{sessionStorage.removeItem(KEY);}catch{}};
  const remember=(reason,detail)=>{
    try{localStorage.setItem('bitalis:last-bootstrap-error',JSON.stringify({at:new Date().toISOString(),reason,detail:String(detail||'').slice(0,900),path:location.pathname,href:location.href}));}catch{}
  };
  const rememberClientError=(reason,detail)=>{
    try{localStorage.setItem('bitalis:last-client-error',JSON.stringify({at:new Date().toISOString(),reason,detail:String(detail||'').slice(0,1400),path:location.pathname,href:location.href}));}catch{}
  };
  const cleanupRecoveryParam=()=>{
    try{
      const url=new URL(location.href);
      if(!url.searchParams.has(RECOVERY_PARAM))return;
      url.searchParams.delete(RECOVERY_PARAM);
      history.replaceState(history.state,'',url.pathname+url.search+url.hash);
    }catch{}
  };
  const isNextAsset=(value)=>String(value||'').includes('/_next/');
  const isDeliveryError=(value)=>{
    const text=String(value||'').toLowerCase();
    return text.includes('chunkloaderror')||text.includes('loading chunk')||text.includes('loading css chunk')||text.includes('failed to fetch dynamically imported module')||text.includes('importing a module script failed')||text.includes('failed to load module script')||text.includes('webpack')||text.includes('/_next/static/')||text.includes("unexpected token '<'")||text.includes('mime type');
  };
  const showRecovery=(failed,detail)=>{
    const current=document.getElementById('bitalis-delivery-recovery');
    if(current)current.remove();
    const panel=document.createElement('div');
    panel.id='bitalis-delivery-recovery';
    panel.style.cssText='position:fixed;inset:0;z-index:2147483647;display:flex;align-items:center;justify-content:center;padding:24px;background:#F5F7F6;color:#062B24;font-family:Arial,sans-serif;visibility:visible';
    const card=document.createElement('div');
    card.style.cssText='width:100%;max-width:390px;padding:28px 22px;border:1px solid #DDE8E2;border-radius:24px;background:#fff;text-align:center;box-shadow:0 16px 48px rgba(6,43,36,.12)';
    const badge=document.createElement('div');
    badge.style.cssText='width:54px;height:54px;margin:0 auto;border-radius:17px;display:flex;align-items:center;justify-content:center;background:#EAF8F0;color:#062B24;font-size:24px;font-weight:900';
    badge.textContent='B';
    const title=document.createElement('div');
    title.style.cssText='margin-top:16px;font-size:23px;font-weight:900;line-height:1.15';
    title.textContent=failed?'BITALIS necesita una recarga limpia':'Recargando BITALIS';
    const text=document.createElement('div');
    text.style.cssText='margin-top:12px;color:#64748B;font-size:14px;line-height:1.5';
    text.textContent=failed?'La aplicación recibió archivos incompletos o de otra compilación. Reintenta para solicitar una copia nueva sin borrar tu sesión.':'Detectamos un problema de carga. Estamos descartando archivos temporales y solicitando una copia nueva de la aplicación.';
    card.appendChild(badge);card.appendChild(title);card.appendChild(text);
    if(failed){
      if(detail){
        const ref=document.createElement('div');
        ref.style.cssText='margin-top:12px;color:#94A3B8;font-size:10px;font-weight:700;word-break:break-word';
        ref.textContent='Referencia: '+String(detail).slice(0,180);
        card.appendChild(ref);
      }
      const button=document.createElement('button');
      button.type='button';button.textContent='REINTENTAR CARGA LIMPIA';
      button.style.cssText='width:100%;min-height:52px;margin-top:20px;border:0;border-radius:16px;background:#11A65A;color:#fff;font-size:14px;font-weight:900';
      button.onclick=()=>{setAttempts(0);const url=new URL(location.href);url.searchParams.set(RECOVERY_PARAM,String(Date.now()));location.replace(url.toString());};
      card.appendChild(button);
    }
    panel.appendChild(card);
    (document.body||document.documentElement).appendChild(panel);
  };
  const clearDeliveryCaches=async()=>{
    try{
      if('serviceWorker' in navigator){const regs=await navigator.serviceWorker.getRegistrations();await Promise.all(regs.map(reg=>reg.unregister()));}
      if('caches' in window){const keys=await caches.keys();await Promise.all(keys.map(key=>caches.delete(key)));}
    }catch{}
  };
  const recover=async(reason,detail)=>{
    if(recovering)return;
    recovering=true;
    remember(reason,detail);
    const attempts=getAttempts();
    if(attempts>=2){showRecovery(true,detail||reason);recovering=false;return;}
    setAttempts(attempts+1);
    showRecovery(false,detail||reason);
    await clearDeliveryCaches();
    const url=new URL(location.href);
    url.searchParams.set(RECOVERY_PARAM,String(Date.now())+'-'+String(attempts+1));
    setTimeout(()=>location.replace(url.toString()),120);
  };
  window.addEventListener('error',(event)=>{
    try{
      const target=event.target;
      const asset=target&&target!==window?(target.src||target.href||''):'';
      const message=event.message||event.error?.stack||event.error?.message||asset||'window-error';
      if(isNextAsset(asset)||isDeliveryError(message)){
        remember('delivery-window-error',message);
        void recover(isNextAsset(asset)?'next-asset-error':'delivery-runtime-error',message);
        return;
      }
      rememberClientError('window-error',message);
    }catch{}
  },true);
  window.addEventListener('unhandledrejection',(event)=>{
    try{
      const reason=event.reason;
      const detail=reason?.stack||reason?.message||String(reason||'unhandled-rejection');
      if(isDeliveryError(detail)){
        remember('delivery-unhandled-rejection',detail);
        void recover('delivery-unhandled-rejection',detail);
        return;
      }
      rememberClientError('unhandled-rejection',detail);
    }catch{}
  });
  const verifyStyles=async()=>{
    if(primaryReady())return;
    await recover('missing-css','--bitalis-primary no disponible');
  };
  const start=()=>{
    setTimeout(()=>void verifyStyles(),900);
    setTimeout(()=>{
      if(!primaryReady()||recovering)return;
      clearAttempts();cleanupRecoveryParam();
      const panel=document.getElementById('bitalis-delivery-recovery');if(panel)panel.remove();
    },5000);
  };
  if(document.readyState==='complete')start();else window.addEventListener('load',start,{once:true});
})();`;

export const metadata: Metadata = {
  title: 'BITALIS • ERP CRM Cobranza en Ruta',
  description: 'Sistema integral BITALIS para ventas, cobranza en ruta, CRM, inventario, caja, comisiones y auditoría.',
  manifest: '/manifest.json',
  icons: { icon: '/bitalis-symbol.svg', apple: '/bitalis-symbol.svg' },
  appleWebApp: { capable: true, statusBarStyle: 'black-translucent', title: 'BITALIS' },
  formatDetection: { telephone: true, email: false, address: false },
};
export const viewport: Viewport = { themeColor:'#062B24', width:'device-width', initialScale:1, viewportFit:'cover' };

export default function RootLayout({children}: {children: React.ReactNode}) {
  return (
    <html lang="es">
      <head>
        <meta name="mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <script dangerouslySetInnerHTML={{__html:deliveryGuard}} />
        <link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css" integrity="sha256-p4NxAoJBhIIN+hmNHrzRCf9tD/miZyoHS5obTRR9BMY=" crossOrigin="" />
        <link rel="stylesheet" href="https://api.mapbox.com/mapbox-gl-js/v3.1.0/mapbox-gl.css" />
      </head>
      <body className="bitalis-app-shell min-h-screen overflow-x-hidden antialiased" suppressHydrationWarning>
        <PWAProvider><AuthTransitionDiagnostics/><ImageLightboxProvider><RoutePrefetcher/><AppShell>{children}<GeminiCopilot/></AppShell></ImageLightboxProvider></PWAProvider>
      </body>
    </html>
  );
}