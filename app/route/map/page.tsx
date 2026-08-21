'use client';

import dynamic from 'next/dynamic';
import { useEffect, useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { CheckCircle2, Crosshair, Loader2, MapPinned, Navigation, Route } from 'lucide-react';

const CollectorRouteMap = dynamic(() => import('@/components/CollectorRouteMap'), { ssr: false });

type Position = { lat: number; lng: number; accuracy?: number };
type Client = { id:string; clientNumber:string; firstName:string; lastName:string; latitude?:number|null; longitude?:number|null; riskLevel?:string };
type Credit = { id:string; saldoActual:number; client:Client };
type SavedProgress = { planIds?: string[]; completed?: string[]; selectedId?: string; arrivalCreditId?:string; arrivalAt?:string };

const todayMx=()=>new Intl.DateTimeFormat('en-CA',{timeZone:'America/Mexico_City',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date());
const routeKey=(uid:string)=>`bitalis_route_progress_${uid}_${todayMx()}`;
const toRad=(v:number)=>(v*Math.PI)/180;
function distanceMeters(a:Position,b:{lat:number;lng:number}){const R=6371000,dLat=toRad(b.lat-a.lat),dLng=toRad(b.lng-a.lng);const x=Math.sin(dLat/2)**2+Math.cos(toRad(a.lat))*Math.cos(toRad(b.lat))*Math.sin(dLng/2)**2;return 2*R*Math.atan2(Math.sqrt(x),Math.sqrt(1-x));}

export default function RouteMapPage(){
  const router = useRouter();
  const [position,setPosition] = useState<Position|null>(null);
  const [credits,setCredits] = useState<Credit[]>([]);
  const [planIds,setPlanIds] = useState<string[]>([]);
  const [completed,setCompleted] = useState<string[]>([]);
  const [selectedId,setSelectedId] = useState('');
  const [mode,setMode] = useState<'overview'|'navigation'>('navigation');
  const [loading,setLoading] = useState(true);
  const [error,setError] = useState('');
  const [userId,setUserId] = useState('');
  const [arrivalCountdown,setArrivalCountdown] = useState<number|null>(null);
  const arrivalHits = useRef(0);
  const redirected = useRef(false);

  const token = () => localStorage.getItem('bitalis_access_token');
  const saveSelection=(creditId:string,arrival=false)=>{
    if(!userId)return;
    try{
      const key=routeKey(userId);
      const current=JSON.parse(localStorage.getItem(key)||'{}');
      localStorage.setItem(key,JSON.stringify({...current,selectedId:creditId,...(arrival?{arrivalCreditId:creditId,arrivalAt:new Date().toISOString()}:{})}));
    }catch{}
  };

  const load = async () => {
    const auth = token();
    const rawUser = localStorage.getItem('bitalis_auth_user');
    if(!auth || !rawUser){ router.replace('/'); return; }
    let user:any;
    try{ user=JSON.parse(rawUser); setUserId(user.id); }catch{ router.replace('/'); return; }
    if(!navigator.geolocation){ setError('Este dispositivo no permite geolocalización.'); setLoading(false); return; }

    let saved:SavedProgress={};
    try{ saved=JSON.parse(localStorage.getItem(routeKey(user.id)) || '{}'); }catch{}
    setCompleted(Array.isArray(saved.completed)?saved.completed:[]);
    if(Array.isArray(saved.planIds)) setPlanIds(saved.planIds);
    if(saved.selectedId) setSelectedId(saved.selectedId);

    setLoading(true); setError('');
    try{
      const portfolioRes = await fetch('/api/collections/portfolio',{headers:{Authorization:`Bearer ${auth}`},cache:'no-store'});
      const portfolio = await portfolioRes.json().catch(()=>({}));
      if(!portfolioRes.ok) throw new Error(portfolio?.error || 'No fue posible cargar la cartera.');
      const list=(Array.isArray(portfolio?.data)?portfolio.data:[]).filter((c:Credit)=>c.client?.latitude!=null&&c.client?.longitude!=null);
      setCredits(list);
    }catch(e:any){setError(e?.message || 'No fue posible cargar el mapa de ruta.');}
    finally{setLoading(false);}
  };

  useEffect(()=>{load();},[]);
  useEffect(()=>{
    if(!navigator.geolocation) return;
    const watch=navigator.geolocation.watchPosition(
      p=>setPosition({lat:p.coords.latitude,lng:p.coords.longitude,accuracy:p.coords.accuracy}),
      e=>setError(e.message || 'Activa el permiso de ubicación para usar el mapa en vivo.'),
      {enableHighAccuracy:true,maximumAge:2000,timeout:15000}
    );
    return()=>navigator.geolocation.clearWatch(watch);
  },[]);

  const pending=useMemo(()=>credits.filter(c=>!completed.includes(c.id)),[credits,completed]);
  const ordered=useMemo(()=>{const map=new Map(pending.map(c=>[c.id,c]));const fixed=planIds.map(id=>map.get(id)).filter(Boolean) as Credit[];const extra=pending.filter(c=>!planIds.includes(c.id));return [...fixed,...extra];},[pending,planIds]);

  useEffect(()=>{
    if(!selectedId && ordered[0]) setSelectedId(ordered[0].id);
    if(selectedId && !ordered.some(c=>c.id===selectedId) && ordered[0]) setSelectedId(ordered[0].id);
  },[ordered,selectedId]);

  const active=ordered.find(c=>c.id===selectedId) || ordered[0] || null;
  const activeDistance=active&&position?distanceMeters(position,{lat:Number(active.client.latitude),lng:Number(active.client.longitude)}):null;
  const arrived=activeDistance!=null&&activeDistance<=80;

  useEffect(()=>{
    if(!active||!position||mode!=='navigation'||redirected.current){arrivalHits.current=0;setArrivalCountdown(null);return;}
    const d=distanceMeters(position,{lat:Number(active.client.latitude),lng:Number(active.client.longitude)});
    const accuracy=position.accuracy||999;
    if(d<=80&&accuracy<=100){
      arrivalHits.current+=1;
      const remaining=Math.max(0,3-arrivalHits.current);
      setArrivalCountdown(remaining);
      if(arrivalHits.current>=3){
        redirected.current=true;
        saveSelection(active.id,true);
        window.setTimeout(()=>router.push('/route'),700);
      }
    }else{arrivalHits.current=0;setArrivalCountdown(null);}
  },[position?.lat,position?.lng,position?.accuracy,active?.id,mode,userId]);

  const selectStop=(id:string)=>{setSelectedId(id);saveSelection(id,false);arrivalHits.current=0;setArrivalCountdown(null);};
  const openCollection=()=>{if(active){saveSelection(active.id,arrived);router.push('/route');}};
  const stops=ordered.map((c,index)=>({id:c.id,order:index+1,lat:Number(c.client.latitude),lng:Number(c.client.longitude),name:`${c.client.firstName} ${c.client.lastName}`,clientNumber:c.client.clientNumber,balance:Number(c.saldoActual),riskLevel:c.client.riskLevel,active:c.id===active?.id}));

  return <div className="min-h-screen bg-[#062B24] text-white">
    <main className="mx-auto max-w-6xl px-3 pb-28 pt-3 sm:px-4 sm:pt-5">
      <section className="rounded-[28px] border border-[#70E5A6]/10 bg-gradient-to-br from-[#0B3D33] to-[#062B24] p-5"><div className="flex flex-wrap items-center justify-between gap-3"><div><div className="inline-flex items-center gap-2 rounded-full border border-[#70E5A6]/15 bg-[#70E5A6]/5 px-3 py-1.5 text-[10px] font-black uppercase tracking-[.16em] text-[#70E5A6]"><MapPinned className="h-3.5 w-3.5"/> Mapa interno</div><h1 className="mt-4 text-2xl font-black">Navegación de cobranza</h1><p className="mt-2 text-sm text-emerald-100/75">GPS en vivo, distancia dinámica y llegada automática al siguiente cliente.</p></div><button onClick={()=>setMode(m=>m==='navigation'?'overview':'navigation')} className="flex items-center gap-2 rounded-xl border border-emerald-400/20 bg-emerald-500/10 px-4 py-3 text-xs font-black text-emerald-100">{mode==='navigation'?<Crosshair className="h-4 w-4"/>:<Navigation className="h-4 w-4"/>}{mode==='navigation'?'Ver ruta completa':'Seguir mi posición'}</button></div></section>
      {error&&<div className="mt-4 rounded-2xl border border-red-400/20 bg-red-500/10 p-4 text-sm text-red-200">{error}</div>}
      {active&&<section className={`mt-4 rounded-2xl border p-4 ${arrived?'border-[#70E5A6]/30 bg-[#11A65A]/10':'border-[#70E5A6]/10 bg-[#0B3D33]/80'}`}><div className="flex items-center justify-between gap-3"><div><p className="text-[10px] font-black uppercase tracking-[.14em] text-[#70E5A6]">{arrived?'Llegada detectada':'Siguiente parada'}</p><p className="mt-1 text-lg font-black">{active.client.firstName} {active.client.lastName}</p><p className="text-xs text-emerald-100/55">{active.client.clientNumber} · Saldo ${Number(active.saldoActual).toLocaleString('es-MX')}</p>{activeDistance!=null&&<p className="mt-2 text-2xl font-black text-[#70E5A6]">{activeDistance<1000?`${Math.round(activeDistance)} m`:`${(activeDistance/1000).toFixed(1)} km`}</p>}{arrived&&<p className="mt-1 flex items-center gap-1 text-xs font-bold text-emerald-200"><CheckCircle2 className="h-4 w-4"/> Dentro del radio de 80 m{arrivalCountdown!=null&&arrivalCountdown>0?` · confirmando GPS ${3-arrivalCountdown}/3`:''}</p>}</div><button onClick={openCollection} className="rounded-xl bg-[#11A65A] px-4 py-3 text-xs font-black text-[#062B24]">Abrir cobranza</button></div></section>}
      {loading&&!position?<div className="mt-5 flex items-center justify-center gap-2 rounded-[24px] border border-white/5 bg-[#0B3D33]/70 p-10 text-sm text-emerald-100/75"><Loader2 className="h-5 w-5 animate-spin"/>Obteniendo GPS y preparando ruta…</div>:position?<section className="mt-5"><CollectorRouteMap position={position} stops={stops} onSelect={selectStop} mode={mode}/><div className="mt-4 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">{ordered.map((c,index)=><button key={c.id} onClick={()=>selectStop(c.id)} className={`rounded-2xl border p-3 text-left ${active?.id===c.id?'border-[#70E5A6]/30 bg-[#11A65A]/10':'border-emerald-800 bg-[#0B3D33]'}`}><div className="flex items-center gap-3"><div className="flex h-9 w-9 items-center justify-center rounded-xl bg-[#062B24] text-xs font-black">{index+1}</div><div><p className="text-sm font-black">{c.client.firstName} {c.client.lastName}</p><p className="text-[10px] text-emerald-100/55">{c.client.clientNumber} · Saldo ${Number(c.saldoActual).toLocaleString('es-MX')}</p></div></div></button>)}</div><button onClick={()=>router.push('/route')} className="mt-5 flex w-full items-center justify-center gap-2 rounded-2xl bg-[#11A65A] px-4 py-4 text-sm font-black text-[#062B24]"><Route className="h-5 w-5"/>Volver al modo cobranza</button></section>:null}
    </main>
  </div>;
}
