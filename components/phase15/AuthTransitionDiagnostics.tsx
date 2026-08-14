'use client';

import {useEffect,useLayoutEffect} from 'react';
import {usePathname} from 'next/navigation';
import {resetAuthTransitionTrace,traceAuthTransition} from '@/lib/ux/authTransitionTrace';

const watchedApi=(input:RequestInfo|URL)=>{
  const value=typeof input==='string'?input:input instanceof URL?input.toString():input.url;
  try{
    const url=new URL(value,location.origin);
    if(url.pathname==='/api/auth/login')return 'auth-login';
    if(url.pathname==='/api/auth/permissions')return 'auth-permissions';
  }catch{}
  return null;
};

export default function AuthTransitionDiagnostics(){
  const pathname=usePathname();

  useLayoutEffect(()=>{
    traceAuthTransition('pathname-layout',{pathname});
  },[pathname]);

  useEffect(()=>{
    traceAuthTransition('pathname-effect',{pathname});
    requestAnimationFrame(()=>traceAuthTransition('pathname-first-raf',{pathname}));
  },[pathname]);

  useEffect(()=>{
    traceAuthTransition('document-mounted');
    requestAnimationFrame(()=>traceAuthTransition('document-first-raf'));

    const onPageShow=(event:PageTransitionEvent)=>traceAuthTransition('pageshow',{persisted:event.persisted});
    const onPageHide=(event:PageTransitionEvent)=>traceAuthTransition('pagehide',{persisted:event.persisted});
    const onBeforeUnload=()=>traceAuthTransition('beforeunload');
    const onVisibility=()=>traceAuthTransition('visibilitychange');
    const onResize=()=>traceAuthTransition('window-resize');
    const onViewportResize=()=>traceAuthTransition('visual-viewport-resize');
    const onSessionExpired=()=>traceAuthTransition('session-expired-event');

    const originalFetch=window.fetch.bind(window);
    window.fetch=async(input:RequestInfo|URL,init?:RequestInit)=>{
      const watched=watchedApi(input);
      if(!watched)return originalFetch(input,init);
      if(watched==='auth-login')resetAuthTransitionTrace();
      const started=performance.now();
      traceAuthTransition(`${watched}-fetch-start`);
      try{
        const response=await originalFetch(input,init);
        traceAuthTransition(`${watched}-fetch-end`,{status:response.status,ok:response.ok,durationMs:Math.round(performance.now()-started)});
        return response;
      }catch(error){
        traceAuthTransition(`${watched}-fetch-error`,{durationMs:Math.round(performance.now()-started),error:error instanceof Error?error.name:'unknown'});
        throw error;
      }
    };

    const originalPushState=history.pushState.bind(history);
    const originalReplaceState=history.replaceState.bind(history);
    history.pushState=((data:unknown,unused:string,url?:string|URL|null)=>{
      traceAuthTransition('history-push-state',{to:url?String(url):''});
      return originalPushState(data,unused,url);
    }) as History['pushState'];
    history.replaceState=((data:unknown,unused:string,url?:string|URL|null)=>{
      traceAuthTransition('history-replace-state',{to:url?String(url):''});
      return originalReplaceState(data,unused,url);
    }) as History['replaceState'];

    window.addEventListener('pageshow',onPageShow);
    window.addEventListener('pagehide',onPageHide);
    window.addEventListener('beforeunload',onBeforeUnload);
    document.addEventListener('visibilitychange',onVisibility);
    window.addEventListener('resize',onResize);
    window.visualViewport?.addEventListener('resize',onViewportResize);
    window.addEventListener('bitalis:session-expired',onSessionExpired);

    return()=>{
      window.fetch=originalFetch;
      history.pushState=originalPushState;
      history.replaceState=originalReplaceState;
      window.removeEventListener('pageshow',onPageShow);
      window.removeEventListener('pagehide',onPageHide);
      window.removeEventListener('beforeunload',onBeforeUnload);
      document.removeEventListener('visibilitychange',onVisibility);
      window.removeEventListener('resize',onResize);
      window.visualViewport?.removeEventListener('resize',onViewportResize);
      window.removeEventListener('bitalis:session-expired',onSessionExpired);
    };
  },[]);

  return null;
}
