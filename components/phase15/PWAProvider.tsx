'use client';

import {ReactNode,useEffect,useState} from 'react';
import {Wifi,WifiOff} from 'lucide-react';
import SyncManager from '@/components/phase15/SyncManager';

const LEGACY_PWA_CACHE_PREFIXES=['bitalis-phase15-','pwa-','workbox-'];

export default function PWAProvider({children}:{children:ReactNode}){
  const[online,setOnline]=useState(true);

  useEffect(()=>{
    setOnline(navigator.onLine);
    const on=()=>setOnline(true);
    const off=()=>setOnline(false);
    window.addEventListener('online',on);
    window.addEventListener('offline',off);

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
      window.removeEventListener('online',on);
      window.removeEventListener('offline',off);
      window.removeEventListener('bitalis:session-expired',expired);
    };
  },[]);

  return <>
    {children}
    <div className={`fixed left-3 top-3 z-[100] flex items-center gap-1 rounded-full border px-2.5 py-1 text-[10px] font-black shadow-sm ${online?'border-emerald-200 bg-white text-emerald-700':'border-red-200 bg-red-50 text-red-700'}`}>
      {online?<Wifi className="h-3 w-3"/>:<WifiOff className="h-3 w-3"/>}
      {online?'CONECTADO':'SIN CONEXIÓN'}
    </div>
    <SyncManager/>
  </>;
}
