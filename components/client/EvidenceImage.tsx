'use client';

import {useEffect,useState} from 'react';
import {Camera,Loader2,RefreshCw} from 'lucide-react';
import {apiBlob} from '@/lib/phase15/apiClient';

export default function EvidenceImage({storageKey,alt,className='h-44 w-full'}:{storageKey?:string|null;alt:string;className?:string}){
  const[src,setSrc]=useState(''),[error,setError]=useState(''),[attempt,setAttempt]=useState(0);
  useEffect(()=>{let url='';let cancelled=false;setSrc('');setError('');(async()=>{if(!storageKey)return;try{const blob=await apiBlob(`/api/client-media/${storageKey}`);if(cancelled)return;url=URL.createObjectURL(blob);setSrc(url);}catch(e:any){if(!cancelled)setError(e?.status===403?'No tienes acceso a esta imagen.':e?.status===404?'La imagen ya no está disponible.':'No pudimos cargar la imagen.');}})();return()=>{cancelled=true;if(url)URL.revokeObjectURL(url);};},[storageKey,attempt]);
  if(!storageKey)return <div className={`${className} flex items-center justify-center rounded-2xl bg-slate-100 text-slate-400`}><Camera className="h-6 w-6"/><span className="ml-2 text-xs font-bold">Sin fotografía</span></div>;
  if(error)return <div className={`${className} flex flex-col items-center justify-center rounded-2xl bg-slate-100 p-3 text-center text-slate-500`}><Camera className="h-6 w-6"/><span className="mt-2 text-[10px] font-bold">{error}</span><button type="button" onClick={()=>setAttempt(x=>x+1)} className="mt-2 flex min-h-11 items-center gap-1.5 rounded-xl bg-white px-3 text-[10px] font-black text-[var(--bitalis-primary)] shadow-sm"><RefreshCw className="h-3.5 w-3.5"/>REINTENTAR</button></div>;
  if(!src)return <div className={`${className} flex items-center justify-center rounded-2xl bg-slate-100`}><Loader2 className="h-5 w-5 animate-spin text-slate-400"/></div>;
  return <img src={src} alt={alt} loading="lazy" decoding="async" className={`${className} rounded-2xl object-cover`}/>;
}
