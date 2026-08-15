'use client';

import {ReactNode,useEffect} from 'react';
import SyncManager from '@/components/phase15/SyncManager';
import {traceAuthTransition} from '@/lib/ux/authTransitionTrace';

const LEGACY_PWA_CACHE_PREFIXES=['bitalis-phase15-','pwa-','workbox-'];
const CLEANUP_KEY='bitalis_legacy_pwa_cleanup_v2';
const permissionCacheKey='bitalis_effective_permissions';

export default function PWAProvider({children}:{children:ReactNode}){
  useEffect(()=>{
    let cleanupTimer:number|undefined;

    const disableLegacyPwa=async()=>{
      try{
        if(localStorage.getItem(CLEANUP_KEY)==='done')return;
        traceAuthTransition('legacy-pwa-cleanup-start');
        if('serviceWorker' in navigator){
          const registrations=await navigator.serviceWorker.getRegistrations();
          traceAuthTransition('legacy-pwa-registrations',{count:registrations.length});
          await Promise.all(registrations.map(registration=>registration.unregister()));
        }
        if('caches' in window){
          const keys=await caches.keys();
          const legacyKeys=keys.filter(key=>LEGACY_PWA_CACHE_PREFIXES.some(prefix=>key.startsWith(prefix)));
          traceAuthTransition('legacy-pwa-caches',{count:legacyKeys.length});
          await Promise.all(legacyKeys.map(key=>caches.delete(key)));
        }
        localStorage.setItem(CLEANUP_KEY,'done');
        traceAuthTransition('legacy-pwa-cleanup-end');
      }catch(error){
        traceAuthTransition('legacy-pwa-cleanup-error',{error:error instanceof Error?error.name:'unknown'});
        console.warn('No fue posible limpiar completamente el PWA legacy:',error);
      }
    };

    cleanupTimer=window.setTimeout(()=>{void disableLegacyPwa();},1800);

    const expired=()=>{
      traceAuthTransition('pwa-session-expired-location-replace');
      localStorage.removeItem('bitalis_access_token');
      localStorage.removeItem('bitalis_refresh_token');
      localStorage.removeItem('bitalis_auth_user');
      sessionStorage.removeItem(permissionCacheKey);
      location.replace('/');
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
