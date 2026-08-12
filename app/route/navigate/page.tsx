'use client';

import dynamic from 'next/dynamic';
import { useEffect, useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { ArrowLeft, CheckCircle2, Crosshair, Loader2, MapPinned, Navigation, RefreshCw, Route } from 'lucide-react';
import BitalisLogo from '@/components/BitalisLogo';

const RoadNavigationMap = dynamic(() => import('@/components/RoadNavigationMap'), { ssr: false });

type Position = { lat:number; lng:number; accuracy?:number };
type Client = { id:string; clientNumber:string; firstName:string; lastName:string; latitude?:number|null; longitude?:number|null };
type Credit = { id:string; saldoActual:number; client:Client };
type Step = { instruction:string; maneuver?:string; modifier?:string|null; distanceMeters:number; durationSeconds:number; start?:Position|null; end?:Position|null };
type Directions = { distanceMeters:number; durationSeconds:number; geometry:Position[]; steps:Step[] };
type SavedProgress = { planIds?:string[]; completed?:string[]; selectedId?:string };

const todayMx=()=>new Intl.DateTimeFormat('en-CA',{timeZone:'America/Mexico_City',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date());
const routeKey=(uid:string)=>`bitalis_route_progress_${uid}_${todayMx()}`;
const toRad=(v:number)=>(v*Math.PI)/180;
function distanceMeters(a:Position,b:Position){const R=6371000,dLat=toRad(b.lat-a.lat),dLng=toRad(b.lng-a.lng);const x=Math.sin(dLat/2)**2+Math.cos(toRad(a.lat))*Math.cos(toRad(b.lat))*Math.sin(dLng/2)**2;return 2*R*Math.atan2(Math.sqrt(x),Math.sqrt(1-x));}
function fmtDistance(m:number){return m<1000?`${Math.round(m)} m`:`${(m/1000).toFixed(1)} km`;}
function fmtDuration(s:number){const min=Math.max(1,Math.round(s/60));return min<60?`${min} min`:`${Math.floor(min/60)} h ${min%60} min`;}

export default function NavigatePage(){
  const router=useRouter();
  const [position,setPosition]=useState<Position|null>(null);
  const [credits,setCredits]=useState<Credit[]>([]);
  const [planIds,setPlanIds]=useState<string[]>([]);
  const [completed,setCompleted]=useState<string[]>([]);
  const [selectedId,setSelectedId]=useState('');
  const [directions,setDirections]=useState<Directions|null>(null);
  const [provider,setProvider]=useState('');
  const [loading,setLoading]=useState(true);
  const [routing,setRouting]=useState(false);
  const [error,setError]=useState('');
  const [follow,setFollow]=useState(true);
  const arrivalReads=useRef(0);
  const lastRouteAt=useRef(0);
  const lastOrigin=useRef<Position|null>(null);

  const token=()=>localStorage.getItem('bitalis_access_token');

  const load=async()=>{
    const auth=token();const raw=localStorage.getItem('bitalis_auth_user');
    if(!auth||!raw){router.replace('/');return;}
    let user:any;try{user=JSON.parse(raw);}catch{router.replace('/');return;}
    let saved:SavedProgress={};try{saved=JSON.parse(localStorage.getItem(routeKey(user.id))||'{}');}catch{}
    setPlanIds(Array.isArray(saved.planIds)?saved.planIds:[]);setCompleted(Array.isArray(saved.completed)?saved.completed:[]);if(saved.selectedId)setSelectedId(saved.selectedId);
    try{const res=await fetch('/api/collections/portfolio',{headers:{Authorization:`Bearer ${auth}`},cache:'no-store'});const json=await res.json().catch(()=>({}));if(!res.ok)throw new Error(json?.error||'No fue posible cargar la cartera.');setCredits((Array.isArray(json?.data)?json.data:[]).filter((c:Credit)=>c.client?.latitude!=null&&c.client?.longitude!=null));}catch(e:any){setError(e?.message||'No fue posible cargar la navegación.');}finally{setLoading(false);}
  };

  useEffect(()=>{load();},[]);
  const pending=useMemo(()=>credits.filter(c=>!completed.includes(c.id)),[credits,completed]);
  const ordered=useMemo(()=>{const map=new Map(pending.map(c=>[c.id,c]));const fixed=planIds.map(id=>map.get(id)).filter(Boolean) as Credit[];const extra=pending.filter(c=>!planIds.includes(c.id));return[...fixed,...extra];},[pending,planIds]);
  const active=ordered.find(c=>c.id===selectedId)||ordered[0]||null;

  const saveSelected=(id:string)=>{setSelectedId(id);try{const raw=localStorage.getItem('bitalis_auth_user');if(!raw)return;const user=JSON.parse(raw);const key=routeKey(user.id);const saved=JSON.parse(localStorage.getItem(key)||'{}');localStorage.setItem(key,JSON.stringify({...saved,selectedId:id,updatedAt:new Date().toISOString()}));}catch{}};

  const fetchDirections=async(pos:Position,force=false)=>{
    if(!active)return;const auth=token();if(!auth)return;
    const now=Date.now();const moved=lastOrigin.current?distanceMeters(lastOrigin.current,pos):9999;
    if(!force&&now-lastRouteAt.current<20000&&moved<60)return;
    setRouting(true);
    try{const res=await fetch(`/api/collections/directions?originLat=${pos.lat}&originLng=${pos.lng}&destinationLat=${active.client.latitude}&destinationLng=${active.client.longitude}`,{headers:{Authorization:`Bearer ${auth}`},cache:'no-store'});const json=await res.json().catch(()=>({}));if(!res.ok)throw new Error(json?.error||'No fue posible calcular la ruta por calles.');setDirections(json?.data||null);setProvider(json?.provider||'');lastRouteAt.current=now;lastOrigin.current=pos;setError('');}catch(e:any){setError(e?.message||'No fue posible calcular indicaciones.');}finally{setRouting(false);}
  };

  useEffect(()=>{if(!navigator.geolocation)return;const id=navigator.geolocation.watchPosition(async p=>{const pos={lat:p.coords.latitude,lng:p.coords.longitude,accuracy:p.coords.accuracy};setPosition(pos);if(active)await fetchDirections(pos);},e=>setError(e.message||'Activa ubicación para navegar.'),{enableHighAccuracy:true,maximumAge:3000,timeout:15000});return()=>navigator.geolocation.clearWatch(id);},[active?.id]);

  useEffect(()=>{if(!active||!position)return;const target={lat:Number(active.client.latitude),lng:Number(active.client.longitude)};const d=distanceMeters(position,target);const accurate=(position.accuracy||999)<=100;if(d<=80&&accurate)arrivalReads.current+=1;else arrivalReads.current=0;if(arrivalReads.current>=3){saveSelected(active.id);router.replace('/route');}},[position,active?.id]);

  useEffect(()=>{if(active&&position)fetchDirections(position,true);},[active?.id]);

  const currentStep=useMemo(()=>{if(!directions?.steps?.length||!position)return directions?.steps?.[0]||null;let best=directions.steps[0],bestD=Infinity;for(const s of directions.steps){if(!s.start)continue;const d=distanceMeters(position,s.start);if(d<bestD){best=s;bestD=d;}}return best;},[directions,position]);
  const directDistance=active&&position?distanceMeters(position,{lat:Number(active.client.latitude),lng:Number(active.client.longitude)}):null;

  return <div className="min-h-screen bg-slate-950 pb-24 text-slate-100">
    <header className="sticky top-0 z-30 border-b border-white/5 bg-slate-950/90 backdrop-blur-xl"><div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-3"><div className="flex items-center gap-3"><button onClick={()=>router.push('/route')} className="flex h-10 w-10 items-center justify-center rounded-xl border border-slate-800 bg-slate-900"><ArrowLeft className="h-4 w-4"/></button><BitalisLogo size="md" variant="dark"/></div><button disabled={!position||routing} onClick={()=>position&&fetchDirections(position,true)} className="flex h-10 w-10 items-center justify-center rounded-xl border border-slate-800 bg-slate-900 disabled:opacity-40"><RefreshCw className={`h-4 w-4 ${routing?'animate-spin':''}`}/></button></div></header>
    <main className="mx-auto max-w-6xl px-4 py-4">
      {!active&&!loading?<div className="rounded-[26px] border border-emerald-400/15 bg-emerald-500/5 p-8 text-center"><CheckCircle2 className="mx-auto h-10 w-10 text-emerald-400"/><h1 className="mt-3 text-xl font-black">Ruta completada</h1><button onClick={()=>router.push('/route/close')} className="mt-5 rounded-xl bg-emerald-500 px-4 py-3 text-xs font-black text-slate-950">Cerrar jornada</button></div>:null}
      {active&&<><section className="rounded-[24px] border border-emerald-400/10 bg-slate-900/80 p-4"><div className="flex items-center justify-between gap-3"><div><p className="text-[10px] font-black uppercase tracking-[.14em] text-emerald-300">Navegando a</p><p className="mt-1 text-xl font-black">{active.client.firstName} {active.client.lastName}</p><p className="mt-1 text-xs text-slate-500">{active.client.clientNumber} · Saldo ${Number(active.saldoActual).toLocaleString('es-MX')}</p></div><Navigation className="h-7 w-7 text-emerald-400"/></div>{directions&&<div className="mt-4 grid grid-cols-2 gap-2"><div className="rounded-xl bg-slate-950 p-3"><p className="text-[9px] uppercase text-slate-600">Ruta vial</p><p className="mt-1 text-lg font-black">{fmtDistance(directions.distanceMeters)}</p></div><div className="rounded-xl bg-slate-950 p-3"><p className="text-[9px] uppercase text-slate-600">Tiempo aprox.</p><p className="mt-1 text-lg font-black text-emerald-300">{fmtDuration(directions.durationSeconds)}</p></div></div>}</section>
      {currentStep&&<section className="mt-3 rounded-[24px] border border-blue-400/10 bg-blue-500/5 p-4"><p className="text-[10px] font-black uppercase tracking-[.14em] text-blue-300">Siguiente indicación</p><p className="mt-2 text-xl font-black">{currentStep.instruction}</p><p className="mt-1 text-xs text-slate-400">Tramo {fmtDistance(currentStep.distanceMeters)}{provider?` · ${provider}`:''}</p></section>}
      {error&&<div className="mt-3 rounded-2xl border border-red-400/20 bg-red-500/10 p-4 text-sm text-red-200">{error}</div>}
      {loading||!position?<div className="mt-4 flex items-center justify-center gap-2 rounded-[24px] border border-white/5 bg-slate-900/70 p-10 text-sm text-slate-400"><Loader2 className="h-5 w-5 animate-spin"/>Preparando navegación…</div>:<section className="mt-4"><RoadNavigationMap position={position} destination={{lat:Number(active.client.latitude),lng:Number(active.client.longitude),name:`${active.client.firstName} ${active.client.lastName}`}} geometry={directions?.geometry||[]} follow={follow}/><div className="mt-3 grid grid-cols-2 gap-2"><button onClick={()=>setFollow(v=>!v)} className="flex items-center justify-center gap-2 rounded-xl border border-blue-400/20 bg-blue-500/10 px-3 py-3 text-xs font-black text-blue-200">{follow?<MapPinned className="h-4 w-4"/>:<Crosshair className="h-4 w-4"/>}{follow?'Ver ruta completa':'Seguir posición'}</button><button onClick={()=>{saveSelected(active.id);router.push('/route');}} className="flex items-center justify-center gap-2 rounded-xl bg-emerald-500 px-3 py-3 text-xs font-black text-slate-950"><Route className="h-4 w-4"/>Abrir cobranza</button></div>{directDistance!=null&&<p className="mt-2 text-center text-[10px] text-slate-600">Distancia directa al domicilio: {fmtDistance(directDistance)}</p>}</section>}</>}
    </main>
  </div>;
}
