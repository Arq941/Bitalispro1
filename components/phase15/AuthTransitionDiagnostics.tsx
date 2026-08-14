'use client';

import {useEffect} from 'react';
import {traceAuthTransition} from '@/lib/ux/authTransitionTrace';

export default function AuthTransitionDiagnostics(){
  useEffect(()=>{
    traceAuthTransition('document-mounted');
    requestAnimationFrame(()=>traceAuthTransition('document-first-raf'));

    const onPageShow=(event:PageTransitionEvent)=>traceAuthTransition('pageshow',{persisted:event.persisted});
    const onPageHide=(event:PageTransitionEvent)=>traceAuthTransition('pagehide',{persisted:event.persisted});
    const onVisibility=()=>traceAuthTransition('visibilitychange');
    const onResize=()=>traceAuthTransition('window-resize');
    const onViewportResize=()=>traceAuthTransition('visual-viewport-resize');

    window.addEventListener('pageshow',onPageShow);
    window.addEventListener('pagehide',onPageHide);
    document.addEventListener('visibilitychange',onVisibility);
    window.addEventListener('resize',onResize);
    window.visualViewport?.addEventListener('resize',onViewportResize);

    return()=>{
      window.removeEventListener('pageshow',onPageShow);
      window.removeEventListener('pagehide',onPageHide);
      document.removeEventListener('visibilitychange',onVisibility);
      window.removeEventListener('resize',onResize);
      window.visualViewport?.removeEventListener('resize',onViewportResize);
    };
  },[]);

  return null;
}
