'use client';

import {ReactNode,useEffect} from 'react';
import SyncManager from '@/components/phase15/SyncManager';
import {BITALIS_BUILD_COMMIT} from '@/lib/generated/buildInfo';
import {traceAuthTransition} from '@/lib/ux/authTransitionTrace';

const LEGACY_PWA_CACHE_PREFIXES=['bitalis-phase15-','pwa-','workbox-'];
const CLEANUP_KEY=`bitalis_legacy_pwa_cleanup_v4:${BITALIS_BUILD_COMMIT}`;
const LAST_MISMATCH_KEY='bitalis:last-build-mismatch';
const permissionCacheKey='bitalis_effective_permissions';

function parseCommit(text:string){
  return text.match(/^commit=(.+)$/m)?.[1]?.trim()||'';
}

async function clearBrowserDeliveryState(allCaches=false){
  if(allCaches&&'serviceWorker' in navigator){
    const registrations=await navigator.serviceWorker.getRegistrations();
    traceAuthTransition('pwa-registrations-cleanup',{count:registrations.length,allCaches});
    await Promise.all(registrations.map(registration=>registration.unregister()));
  }
  if('caches' in window){
    const keys=await caches.keys();
    const targets=allCaches?keys:keys.filter(key=>LEGACY_PWA_CACHE_PREFIXES.some(prefix=>key.startsWith(prefix)));
    traceAuthTransition('pwa-cache-cleanup',{count:targets.length,allCaches});
    await Promise.all(targets.map(key=>caches.delete(key)));
  }
}

async function registerOfflineWorker(){
  if(!('serviceWorker' in navigator))return;
  try{
    const registration=await navigator.serviceWorker.register('/sw.js',{scope:'/',updateViaCache:'none'});
    traceAuthTransition('pwa-offline-worker-registered',{scope:registration.scope});
    void registration.update().catch(()=>{});
  }catch(error){
    traceAuthTransition('pwa-offline-worker-error',{error:error instanceof Error?error.name:'unknown'});
    console.warn('No fue posible activar el modo offline de BITALIS:',error);
  }
}

export default function PWAProvider({children}:{children:ReactNode}){
  useEffect(()=>{
    let disposed=false;

    const verifyClientBuild=async()=>{
      try{
        const response=await fetch(`/build-version.txt?ts=${Date.now()}`,{cache:'no-store',headers:{'Cache-Control':'no-store'}});
        if(!response.ok)throw new Error(`BUILD_VERSION_${response.status}`);
        const serverText=await response.text();
        const serverCommit=parseCommit(serverText);
        const clientCommit=String(BITALIS_BUILD_COMMIT||'').trim();
        const clientKnown=!!clientCommit&&!['development','unknown'].includes(clientCommit);
        const serverKnown=!!serverCommit&&serverCommit!=='unknown';
        const matches=!clientKnown||!serverKnown||clientCommit===serverCommit;
        traceAuthTransition('build-version-check',{client:clientCommit.slice(0,12)||'unknown',server:serverCommit.slice(0,12)||'unknown',matches});
        if(disposed)return false;

        if(clientKnown&&serverKnown&&clientCommit!==serverCommit){
          try{localStorage.setItem(LAST_MISMATCH_KEY,JSON.stringify({at:new Date().toISOString(),client:clientCommit,server:serverCommit,path:location.pathname}));}catch{}
          traceAuthTransition('build-version-mismatch',{client:clientCommit.slice(0,12),server:serverCommit.slice(0,12)});
          await clearBrowserDeliveryState(true);
          if(disposed)return false;
          const url=new URL(location.href);
          const recovery=serverCommit.slice(0,12);
          if(url.searchParams.get('__bitalis_build')!==recovery){
            url.searchParams.set('__bitalis_build',recovery);
            traceAuthTransition('build-version-reload',{server:recovery});
            location.replace(`${url.pathname}${url.search}${url.hash}`);
          }
          return false;
        }

        const url=new URL(location.href);
        if(url.searchParams.has('__bitalis_build')){
          url.searchParams.delete('__bitalis_build');
          history.replaceState(history.state,'',`${url.pathname}${url.search}${url.hash}`);
        }

        if(localStorage.getItem(CLEANUP_KEY)!=='done'){
          traceAuthTransition('legacy-pwa-cleanup-start',{client:clientCommit.slice(0,12)||'unknown'});
          await clearBrowserDeliveryState(false);
          localStorage.setItem(CLEANUP_KEY,'done');
          traceAuthTransition('legacy-pwa-cleanup-end',{client:clientCommit.slice(0,12)||'unknown'});
        }
        return true;
      }catch(error){
        traceAuthTransition('build-version-check-error',{error:error instanceof Error?error.name:'unknown'});
        console.warn('No fue posible comprobar la versión activa de BITALIS:',error);
        return true;
      }
    };

    void (async()=>{
      const ready=await verifyClientBuild();
      if(ready&&!disposed)await registerOfflineWorker();
    })();

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
      disposed=true;
      window.removeEventListener('bitalis:session-expired',expired);
    };
  },[]);

  return <>
    {children}
    <SyncManager/>
  </>;
}
