'use client';

import {ReactNode,useEffect} from 'react';
import SyncManager from '@/components/phase15/SyncManager';

const LEGACY_PWA_CACHE_PREFIXES=['bitalis-phase15-','pwa-','workbox-'];

export default function PWAProvider({children}:{children:ReactNode}){
  useEffect(()=>{
    const disableLegacyPwa=async()=>{
      try{
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
      }catch(error){
        console.warn('No fue posible limpiar completamente el PWA legacy:',error);
      }
    };

    disableLegacyPwa();

    const expired=()=>{
      localStorage.removeItem('bitalis_access_token');
      localStorage.removeItem('bitalis_refresh_token');
      location.assign('/');
    };
    window.addEventListener('bitalis:session-expired',expired);

    return()=>{
      window.removeEventListener('bitalis:session-expired',expired);
    };
  },[]);

  return <>
    {children}
    <SyncManager/>
  </>;
}
