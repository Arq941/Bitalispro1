'use client';

import {ReactNode,useEffect} from 'react';
import SyncManager from '@/components/phase15/SyncManager';
import {BITALIS_BUILD_AT,BITALIS_BUILD_COMMIT} from '@/lib/generated/buildInfo';
import {traceAuthTransition} from '@/lib/ux/authTransitionTrace';

const LEGACY_PWA_CACHE_PREFIXES=['bitalis-phase15-','pwa-','workbox-'];
const CLIENT_BUILD_ID=`${BITALIS_BUILD_COMMIT}@${BITALIS_BUILD_AT}`;
const CLEANUP_KEY=`bitalis_legacy_pwa_cleanup_v5:${CLIENT_BUILD_ID}`;
const REGISTERED_KEY=`bitalis_pwa_registered:${CLIENT_BUILD_ID}`;
const LAST_MISMATCH_KEY='bitalis:last-build-mismatch';
const permissionCacheKey='bitalis_effective_permissions';

function parseBuild(text:string){
  return {
    commit:text.match(/^commit=(.+)$/m)?.[1]?.trim()||'',
    builtAt:text.match(/^built_at=(.+)$/m)?.[1]?.trim()||'',
  };
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
    if(sessionStorage.getItem(REGISTERED_KEY)==='done'){
      traceAuthTransition('pwa-offline-worker-session-reused');
      return;
    }
    const existing=await navigator.serviceWorker.getRegistration('/');
    if(existing?.active&&!existing.waiting){
      sessionStorage.setItem(REGISTERED_KEY,'done');
      traceAuthTransition('pwa-offline-worker-active-reused',{scope:existing.scope});
      return;
    }
    const registration=await navigator.serviceWorker.register('/sw.js',{scope:'/',updateViaCache:'none'});
    sessionStorage.setItem(REGISTERED_KEY,'done');
    traceAuthTransition('pwa-offline-worker-registered',{scope:registration.scope});
    if(registration.waiting)traceAuthTransition('pwa-update-waiting',{scope:registration.scope});
    registration.addEventListener('updatefound',()=>traceAuthTransition('pwa-update-found',{scope:registration.scope}));
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
        const serverBuild=parseBuild(serverText);
        const clientCommit=String(BITALIS_BUILD_COMMIT||'').trim();
        const clientBuiltAt=String(BITALIS_BUILD_AT||'').trim();
        const clientKnown=!!clientCommit&&!['development','unknown'].includes(clientCommit)&&!!clientBuiltAt&&clientBuiltAt!=='development';
        const serverKnown=!!serverBuild.commit&&serverBuild.commit!=='unknown'&&!!serverBuild.builtAt;
        const matches=!clientKnown||!serverKnown||(clientCommit===serverBuild.commit&&clientBuiltAt===serverBuild.builtAt);
        traceAuthTransition('build-version-check',{
          client:clientCommit.slice(0,12)||'unknown',
          server:serverBuild.commit.slice(0,12)||'unknown',
          clientBuiltAt,
          serverBuiltAt:serverBuild.builtAt,
          matches,
        });
        if(disposed)return false;

        if(clientKnown&&serverKnown&&!matches){
          try{localStorage.setItem(LAST_MISMATCH_KEY,JSON.stringify({
            at:new Date().toISOString(),
            client:CLIENT_BUILD_ID,
            server:`${serverBuild.commit}@${serverBuild.builtAt}`,
            path:location.pathname,
          }));}catch{}
          traceAuthTransition('build-version-mismatch',{
            client:clientCommit.slice(0,12),
            server:serverBuild.commit.slice(0,12),
            clientBuiltAt,
            serverBuiltAt:serverBuild.builtAt,
          });
          await clearBrowserDeliveryState(true);
          if(disposed)return false;
          const returnTo=`${location.pathname}${location.search}${location.hash}`;
          traceAuthTransition('build-version-reload',{server:serverBuild.commit.slice(0,12),serverBuiltAt:serverBuild.builtAt});
          location.replace(`/api/system/recover?return=${encodeURIComponent(returnTo)}&build=${encodeURIComponent(serverBuild.builtAt)}`);
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
