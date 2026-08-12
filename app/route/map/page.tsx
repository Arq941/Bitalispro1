'use client';

import dynamic from 'next/dynamic';
import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { ArrowLeft, Crosshair, Loader2, MapPinned, RefreshCw, Route } from 'lucide-react';
import BitalisLogo from '@/components/BitalisLogo';

const CollectorRouteMap = dynamic(() => import('@/components/CollectorRouteMap'), { ssr: false });

type Position = { lat: number; lng: number; accuracy?: number };
type Client = { id:string; clientNumber:string; firstName:string; lastName:string; latitude?:number|null; longitude?:number|null; riskLevel?:string };
type Credit = { id:string; saldoActual:number; client:Client };

export default function RouteMapPage(){
  const router = useRouter();
  const [position,setPosition] = useState<Position|null>(null);
  const [credits,setCredits] = useState<Credit[]>([]);
  const [planIds,setPlanIds] = useState<string[]>([]);
  const [selectedId,setSelectedId] = useState('');
  const [loading,setLoading] = useState(true);
  const [error,setError] = useState('');

  const token = () => localStorage.getItem('bitalis_access_token');
  const load = async () => {
    const auth = token();
    if(!auth){ router.replace('/'); return; }
    if(!navigator.geolocation){ setError('Este dispositivo no permite geolocalización.'); setLoading(false); return; }
    setLoading(true); setError('');
    navigator.geolocation.getCurrentPosition(async p => {
      const pos={lat:p.coords.latitude,lng:p.coords.longitude,accuracy:p.coords.accuracy};
      setPosition(pos);
      try{
        const [portfolioRes, planRes] = await Promise.all([
          fetch('/api/collections/portfolio',{headers:{Authorization:`Bearer ${auth}`},cache:'no-store'}),
          fetch(`/api/collections/route-plan?lat=${encodeURIComponent(pos.lat)}&lng=${encodeURIComponent(pos.lng)}`,{headers:{Authorization:`Bearer ${auth}`},cache:'no-store'})
        ]);
        const portfolio = await portfolioRes.json().catch(()=>({}));
        const plan = await planRes.json().catch(()=>({}));
        if(!portfolioRes.ok) throw new Error(portfolio?.error || 'No fue posible cargar la cartera.');
        const list=(Array.isArray(portfolio?.data)?portfolio.data:[]).filter((c:Credit)=>c.client?.latitude!=null&&c.client?.longitude!=null);
        setCredits(list);
        const ids=Array.isArray(plan?.data?.orderedCreditIds)?plan.data.orderedCreditIds:Array.isArray(plan?.orderedCreditIds)?plan.orderedCreditIds:[];
        setPlanIds(ids.length?ids:list.map((c:Credit)=>c.id));
        setSelectedId(ids[0] || list[0]?.id || '');
      }catch(e:any){setError(e?.message || 'No fue posible cargar el mapa de ruta.');}
      finally{setLoading(false);}
    },e=>{setError(e.message || 'Activa el permiso de ubicación.');setLoading(false);},{enableHighAccuracy:true,timeout:15000});
  };

  useEffect(()=>{load();},[]);
  const ordered=useMemo(()=>{const map=new Map(credits.map(c=>[c.id,c]));const fixed=planIds.map(id=>map.get(id)).filter(Boolean) as Credit[];const extra=credits.filter(c=>!planIds.includes(c.id));return [...fixed,...extra];},[credits,planIds]);
  const stops=ordered.map((c,index)=>({id:c.id,order:index+1,lat:Number(c.client.latitude),lng:Number(c.client.longitude),name:`${c.client.firstName} ${c.client.lastName}`,clientNumber:c.client.clientNumber,balance:Number(c.saldoActual),riskLevel:c.client.riskLevel,active:c.id===selectedId}));

  return <div className="min-h-screen bg-slate-950 text-slate-100">
    <header className="sticky top-0 z-30 border-b border-white/5 bg-slate-950/90 backdrop-blur-xl"><div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-3"><div className="flex items-center gap-3"><button onClick={()=>router.push('/route')} className="flex h-10 w-10 items-center justify-center rounded-xl border border-slate-800 bg-slate-900"><ArrowLeft className="h-4 w-4"/></button><BitalisLogo size="md" variant="dark"/></div><button onClick={load} className="flex h-10 w-10 items-center justify-center rounded-xl border border-slate-800 bg-slate-900"><RefreshCw className={`h-4 w-4 ${loading?'animate-spin':''}`}/></button></div></header>
    <main className="mx-auto max-w-6xl px-4 py-5">
      <section className="rounded-[28px] border border-emerald-400/10 bg-gradient-to-br from-slate-900 to-emerald-950/20 p-5"><div className="inline-flex items-center gap-2 rounded-full border border-emerald-400/15 bg-emerald-400/5 px-3 py-1.5 text-[10px] font-black uppercase tracking-[.16em] text-emerald-300"><MapPinned className="h-3.5 w-3.5"/> Mapa interno</div><h1 className="mt-4 text-2xl font-black">Ruta visual del cobrador</h1><p className="mt-2 text-sm text-slate-400">Tu ubicación y todas las paradas del plan del día, sin salir de BITALIS.</p></section>
      {error&&<div className="mt-4 rounded-2xl border border-red-400/20 bg-red-500/10 p-4 text-sm text-red-200">{error}</div>}
      {loading&&!position?<div className="mt-5 flex items-center justify-center gap-2 rounded-[24px] border border-white/5 bg-slate-900/70 p-10 text-sm text-slate-400"><Loader2 className="h-5 w-5 animate-spin"/>Obteniendo GPS y preparando ruta…</div>:position?<section className="mt-5"><CollectorRouteMap position={position} stops={stops} onSelect={setSelectedId}/><div className="mt-4 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">{ordered.map((c,index)=><button key={c.id} onClick={()=>setSelectedId(c.id)} className={`rounded-2xl border p-3 text-left ${selectedId===c.id?'border-emerald-400/30 bg-emerald-500/10':'border-slate-800 bg-slate-900'}`}><div className="flex items-center gap-3"><div className="flex h-9 w-9 items-center justify-center rounded-xl bg-slate-950 text-xs font-black">{index+1}</div><div><p className="text-sm font-black">{c.client.firstName} {c.client.lastName}</p><p className="text-[10px] text-slate-500">{c.client.clientNumber} · Saldo ${Number(c.saldoActual).toLocaleString('es-MX')}</p></div></div></button>)}</div><button onClick={()=>router.push('/route')} className="mt-5 flex w-full items-center justify-center gap-2 rounded-2xl bg-emerald-500 px-4 py-4 text-sm font-black text-slate-950"><Route className="h-5 w-5"/>Volver al modo cobranza</button></section>:null}
    </main>
  </div>;
}
