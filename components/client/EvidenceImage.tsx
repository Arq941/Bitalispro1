'use client';

import {useEffect,useState} from 'react';
import {Camera,Loader2} from 'lucide-react';

export default function EvidenceImage({storageKey,alt,className='h-44 w-full'}:{storageKey?:string|null;alt:string;className?:string}){
  const[src,setSrc]=useState(''),[error,setError]=useState(false);
  useEffect(()=>{let url='';let cancelled=false;(async()=>{if(!storageKey)return;try{const token=localStorage.getItem('bitalis_access_token');const res=await fetch(`/api/client-media/${storageKey}`,{headers:token?{Authorization:`Bearer ${token}`}:{},cache:'no-store'});if(!res.ok)throw new Error();const blob=await res.blob();if(cancelled)return;url=URL.createObjectURL(blob);setSrc(url);}catch{if(!cancelled)setError(true);}})();return()=>{cancelled=true;if(url)URL.revokeObjectURL(url);};},[storageKey]);
  if(!storageKey||error)return <div className={`${className} flex items-center justify-center rounded-2xl bg-slate-100 text-slate-400`}><Camera className="h-6 w-6"/><span className="ml-2 text-xs font-bold">Sin evidencia</span></div>;
  if(!src)return <div className={`${className} flex items-center justify-center rounded-2xl bg-slate-100`}><Loader2 className="h-5 w-5 animate-spin text-slate-400"/></div>;
  return <img src={src} alt={alt} className={`${className} rounded-2xl object-cover`} />;
}
