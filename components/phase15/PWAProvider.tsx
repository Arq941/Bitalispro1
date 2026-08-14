'use client';

import {ReactNode,useEffect} from 'react';
import SyncManager from '@/components/phase15/SyncManager';

const LEGACY_PWA_CACHE_PREFIXES=['bitalis-phase15-','pwa-','workbox-'];
const CLEANUP_KEY='bitalis_legacy_pwa_cleanup_v2';

export default function PWAProvider({children}:{children:ReactNode}){
  useEffect(()=>{
    let cleanupTimer:number|undefined;

    const disableLegacyPwa=async()=>{
      try{
        if(localStorage.getItem(CLEANUP_KEY)==='done')return;
        if('serviceWorker' in navigator){
          const registrations=await navigator.serviceWorker.getRegistrations();
          await Promise.all(registrations.map(registration=>registration.unregister()));
        }
        if('caches' in window){
          const keys=await caches.keys();
          await Promise.all(
            keys
              .filter(key=>LEGACY_PWA_CACHE_PREFIXES.some(prefix=>key.startsWith(prefix)))
              .map(key=>caches.delete(key))
          );
        }
        localStorage.setItem(CLEANUP_KEY,'done');
      }catch(error){
        console.warn('No fue posible limpiar completamente el PWA legacy:',error);
      }
    };

    // No bloquear el primer render: la limpieza legacy se hace después de que la UI ya está estable.
    cleanupTimer=window.setTimeout(()=>{void disableLegacyPwa();},1800);

    const expired=()=>{
      localStorage.removeItem('bitalis_access_token');
      localStorage.removeItem('bitalis_refresh_token');
      location.assign('/');
    };
    window.addEventListener('bitalis:session-expired',expired);

    return()=>{
      if(cleanupTimer!==undefined)window.clearTimeout(cleanupTimer);
      window.removeEventListener('bitalis:session-expired',expired);
    };
  },[]);

  return <>
    {children}
    <SyncManager/>
  </>;
}