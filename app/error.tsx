'use client';

import {useEffect,useState} from 'react';

async function recover(){
  try{
    if('serviceWorker' in navigator){
      const registrations=await navigator.serviceWorker.getRegistrations();
      await Promise.all(registrations.map(registration=>registration.unregister()));
    }
    if('caches' in window){
      const keys=await caches.keys();
      await Promise.all(keys.map(key=>caches.delete(key)));
    }
  }catch{}
  const url=new URL(window.location.href);
  url.searchParams.set('__bitalis_recover',String(Date.now()));
  window.location.replace(url.toString());
}

export default function ErrorPage({error,reset}:{error:Error&{digest?:string};reset:()=>void}){
  const[working,setWorking]=useState(false);
  useEffect(()=>{
    console.error('BITALIS client route error',error);
    try{
      localStorage.setItem('bitalis:last-client-error',JSON.stringify({
        at:new Date().toISOString(),
        reason:'route-error-boundary',
        name:error?.name||'Error',
        message:error?.message||'',
        digest:error?.digest||'',
        stack:String(error?.stack||'').slice(0,1400),
        path:location.pathname,
      }));
    }catch{}
  },[error]);
  const retry=()=>{try{reset();}catch{}};
  const cleanReload=async()=>{setWorking(true);await recover();};
  return <main className="flex min-h-[100svh] items-center justify-center bg-[#F5F8F7] p-5 text-[#062B24]">
    <section className="w-full max-w-md rounded-[28px] border border-emerald-100 bg-white p-6 text-center shadow-xl">
      <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-emerald-50 text-2xl font-black">B</div>
      <h1 className="mt-5 text-2xl font-black">BITALIS encontró un error temporal</h1>
      <p className="mt-3 text-sm leading-6 text-slate-500">La referencia quedó guardada en DIAG. Primero intenta continuar sin cerrar la aplicación.</p>
      <button disabled={working} onClick={retry} className="mt-6 min-h-14 w-full rounded-2xl bg-[#11A65A] px-4 text-sm font-black text-white disabled:opacity-60">REINTENTAR</button>
      <button disabled={working} onClick={cleanReload} className="mt-2 min-h-12 w-full rounded-2xl border border-emerald-100 bg-white px-4 text-xs font-black disabled:opacity-60">{working?'RECARGANDO…':'RECARGA LIMPIA'}</button>
      {error.digest&&<p className="mt-3 text-[10px] font-bold text-slate-400">Referencia {error.digest}</p>}
    </section>
  </main>;
}
