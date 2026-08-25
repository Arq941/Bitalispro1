export type HapticPattern = 'tap' | 'success' | 'warning' | 'error' | 'selection' | 'heavy';

const patterns: Record<HapticPattern, number | number[]> = {
  tap: 12,
  selection: 8,
  success: [18, 35, 18],
  warning: [28, 45, 28],
  error: [45, 35, 45],
  heavy: 55,
};

type NativeHaptics={perform:(pattern:string)=>void};
declare global{interface Window{BitalisHaptics?:NativeHaptics}}

export function haptic(pattern: HapticPattern = 'tap') {
  if (typeof window === 'undefined' || typeof navigator === 'undefined') return;
  try {
    if(window.BitalisHaptics?.perform){
      window.BitalisHaptics.perform(pattern);
      return;
    }
    if ('vibrate' in navigator && typeof navigator.vibrate === 'function') navigator.vibrate(patterns[pattern]);
  } catch {}
}

export function installGlobalHaptics(){
  if(typeof document==='undefined')return()=>{};
  const onPointer=(event:PointerEvent)=>{
    if(event.pointerType==='mouse')return;
    const target=event.target instanceof Element?event.target.closest('button,a,[role="button"],input[type="checkbox"],input[type="radio"],select'):null;
    if(!target||target.matches(':disabled,[aria-disabled="true"]'))return;
    haptic(target.matches('input,select')?'selection':'tap');
  };
  document.addEventListener('pointerdown',onPointer,{passive:true});
  return()=>document.removeEventListener('pointerdown',onPointer);
}
