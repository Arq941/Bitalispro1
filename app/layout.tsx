import type {Metadata,Viewport} from 'next';
import './globals.css';
import { ImageLightboxProvider } from '@/components/ImageLightboxContext';
import PWAProvider from '@/components/phase15/PWAProvider';
import AppShell from '@/components/phase15/AppShell';
import RoutePrefetcher from '@/components/phase15/RoutePrefetcher';
import AuthTransitionDiagnostics from '@/components/phase15/AuthTransitionDiagnostics';

const cssDeliveryGuard = String.raw`(()=>{
  const KEY='bitalis:css-recovery-attempts:v1';
  const RECOVERY_PARAM='__bitalis_css';
  const primaryReady=()=>{
    try{return getComputedStyle(document.documentElement).getPropertyValue('--bitalis-primary').trim().length>0;}catch{return false;}
  };
  const getAttempts=()=>{try{return Number(sessionStorage.getItem(KEY)||'0')||0;}catch{return 0;}};
  const setAttempts=(value)=>{try{sessionStorage.setItem(KEY,String(value));}catch{}};
  const clearAttempts=()=>{try{sessionStorage.removeItem(KEY);}catch{}};
  const cleanupRecoveryParam=()=>{
    try{
      const url=new URL(location.href);
      if(!url.searchParams.has(RECOVERY_PARAM))return;
      url.searchParams.delete(RECOVERY_PARAM);
      history.replaceState(history.state,'',url.pathname+url.search+url.hash);
    }catch{}
  };
  const showRecovery=(failed)=>{
    if(document.getElementById('bitalis-css-recovery'))return;
    try{if(document.body)document.body.style.visibility='hidden';}catch{}
    const panel=document.createElement('div');
    panel.id='bitalis-css-recovery';
    panel.style.cssText='position:fixed;inset:0;z-index:2147483647;display:flex;align-items:center;justify-content:center;padding:24px;background:#F5F7F6;color:#062B24;font-family:Arial,sans-serif;visibility:visible';
    const card=document.createElement('div');
    card.style.cssText='width:100%;max-width:390px;padding:28px 22px;border:1px solid #DDE8E2;border-radius:24px;background:#fff;text-align:center;box-shadow:0 16px 48px rgba(6,43,36,.12)';
    const title=document.createElement('div');
    title.style.cssText='font-size:24px;font-weight:900;line-height:1.15';
    title.textContent=failed?'BITALIS necesita recargarse':'Recargando BITALIS';
    const text=document.createElement('div');
    text.style.cssText='margin-top:12px;color:#64748B;font-size:14px;line-height:1.5';
    text.textContent=failed?'No se pudieron cargar los estilos de la aplicación. Pulsa reintentar para solicitar una copia nueva.':'Detectamos archivos incompletos de la interfaz. Estamos solicitando una copia nueva sin borrar tu sesión ni tus datos.';
    card.appendChild(title);card.appendChild(text);
    if(failed){
      const button=document.createElement('button');
      button.type='button';button.textContent='REINTENTAR';
      button.style.cssText='width:100%;min-height:52px;margin-top:20px;border:0;border-radius:16px;background:#11A65A;color:#fff;font-size:14px;font-weight:900';
      button.onclick=()=>{setAttempts(0);const url=new URL(location.href);url.searchParams.set(RECOVERY_PARAM,String(Date.now()));location.replace(url.toString());};
      card.appendChild(button);
    }
    panel.appendChild(card);document.documentElement.appendChild(panel);
  };
  const clearDeliveryCaches=async()=>{
    try{
      if('serviceWorker' in navigator){const regs=await navigator.serviceWorker.getRegistrations();await Promise.all(regs.map(reg=>reg.unregister()));}
      if('caches' in window){const keys=await caches.keys();await Promise.all(keys.map(key=>caches.delete(key)));}
    }catch{}
  };
  const verify=async()=>{
    if(primaryReady()){
      clearAttempts();cleanupRecoveryParam();
      const panel=document.getElementById('bitalis-css-recovery');if(panel)panel.remove();
      try{if(document.body)document.body.style.visibility='';}catch{}
      return;
    }
    const attempts=getAttempts();
    if(attempts>=2){showRecovery(true);return;}
    setAttempts(attempts+1);showRecovery(false);
    await clearDeliveryCaches();
    const url=new URL(location.href);
    url.searchParams.set(RECOVERY_PARAM,String(Date.now())+'-'+String(attempts+1));
    setTimeout(()=>location.replace(url.toString()),120);
  };
  const start=()=>setTimeout(()=>void verify(),700);
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
        <script dangerouslySetInnerHTML={{__html:cssDeliveryGuard}} />
        <link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css" integrity="sha256-p4NxAoJBhIIN+hmNHrzRCf9tD/miZyoHS5obTRR9BMY=" crossOrigin="" />
        <link rel="stylesheet" href="https://api.mapbox.com/mapbox-gl-js/v3.1.0/mapbox-gl.css" />
      </head>
      <body className="bitalis-app-shell min-h-screen overflow-x-hidden antialiased" suppressHydrationWarning>
        <PWAProvider><AuthTransitionDiagnostics/><ImageLightboxProvider><RoutePrefetcher/><AppShell>{children}</AppShell></ImageLightboxProvider></PWAProvider>
      </body>
    </html>
  );
}
