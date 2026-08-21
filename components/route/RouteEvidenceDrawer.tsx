'use client';

import {useEffect,useState} from 'react';
import {Camera,ChevronDown,FileCheck2,Home,Loader2,RefreshCw,UserRound,X} from 'lucide-react';
import EvidenceImage from '@/components/client/EvidenceImage';

type Credit={id:string;client?:{id:string;firstName:string;lastName:string;clientNumber:string}};
type Media={id:string;mediaType:string;storageKey?:string|null};
const todayMx=()=>new Intl.DateTimeFormat('en-CA',{timeZone:'America/Mexico_City',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date());

export default function RouteEvidenceDrawer({showTrigger=true}:{showTrigger?:boolean}){
 const[open,setOpen]=useState(false),[loading,setLoading]=useState(false),[media,setMedia]=useState<Media[]>([]),[clientId,setClientId]=useState(''),[clientName,setClientName]=useState('Cliente'),[error,setError]=useState('');
 const token=()=>localStorage.getItem('bitalis_access_token');
 const resolveCurrent=async()=>{
  const auth=token(); if(!auth)return;
  try{
   const r=await fetch('/api/collections/portfolio',{headers:{Authorization:`Bearer ${auth}`},cache:'no-store'});const j=await r.json().catch(()=>({}));if(!r.ok)return;const list:Credit[]=Array.isArray(j?.data)?j.data:[];
   let uid='';try{const u=JSON.parse(localStorage.getItem('bitalis_auth_user')||'{}');uid=u?.id||'';}catch{}
   let selected='';let completed:string[]=[];let planIds:string[]=[];
   if(uid){try{const p=JSON.parse(localStorage.getItem(`bitalis_route_progress_${uid}_${todayMx()}`)||'{}');selected=p?.selectedId||'';completed=Array.isArray(p?.completed)?p.completed:[];planIds=Array.isArray(p?.planIds)?p.planIds:[];}catch{}}
   let credit=list.find(c=>c.id===selected);if(!credit){const nextId=planIds.find(id=>!completed.includes(id));credit=list.find(c=>c.id===nextId)||list.find(c=>!completed.includes(c.id));}
   if(credit?.client?.id){const nextClientId=credit.client.id;setClientId(prev=>prev===nextClientId?prev:nextClientId);setClientName(`${credit.client.firstName||''} ${credit.client.lastName||''}`.trim()||credit.client.clientNumber||'Cliente');}
  }catch{}
 };
 useEffect(()=>{resolveCurrent();const id=window.setInterval(resolveCurrent,5000);return()=>window.clearInterval(id);},[]);
 useEffect(()=>{const openEvidence=()=>setOpen(true);window.addEventListener('bitalis:open-evidence',openEvidence);return()=>window.removeEventListener('bitalis:open-evidence',openEvidence);},[]);
 const loadMedia=async(silent=false)=>{if(!clientId)return;const auth=token();if(!auth)return;if(!silent)setLoading(true);setError('');try{const r=await fetch(`/api/clients/${clientId}/media`,{headers:{Authorization:`Bearer ${auth}`},cache:'no-store'});const j=await r.json().catch(()=>({}));if(!r.ok)throw new Error(j?.error||'No pudimos cargar las evidencias.');setMedia(Array.isArray(j?.media)?j.media:[]);}catch(e:any){if(!silent)setError(e?.message||'No pudimos cargar las evidencias.');}finally{if(!silent)setLoading(false);}};
 useEffect(()=>{if(clientId)loadMedia(true);},[clientId]);
 useEffect(()=>{if(open)loadMedia();},[open]);
 const byType=(t:string)=>media.find(m=>m.mediaType===t);
 const facade=byType('FACADE_PHOTO');
 if(!clientId)return null;
 return <>
  {showTrigger&&<button type="button" onClick={()=>setOpen(true)} aria-label={`Ver fotos de ${clientName}`} title="Ver evidencias" className="fixed bottom-28 right-3 z-[75] flex h-14 w-14 items-center justify-center overflow-hidden rounded-full border-2 border-white bg-[#062B24] text-white shadow-2xl shadow-black/40 active:scale-95 print:hidden sm:right-4">
    {facade?.storageKey?<EvidenceImage storageKey={facade.storageKey} alt="Fachada" className="h-full w-full !rounded-none"/>:<Camera className="h-6 w-6 text-[#70E5A6]"/>}
  </button>}
  {open&&<div className="fixed inset-0 z-[120] flex items-end bg-[#062B24]/80 backdrop-blur-sm sm:items-center sm:justify-center sm:p-4 print:hidden" onClick={()=>setOpen(false)}><section onClick={e=>e.stopPropagation()} className="max-h-[88vh] w-full overflow-y-auto rounded-t-[30px] border border-white/10 bg-[#062B24] p-4 text-white sm:max-w-2xl sm:rounded-[30px] sm:p-5"><div className="sticky top-0 z-10 -mx-1 flex items-center justify-between bg-[#062B24]/95 px-1 pb-3 backdrop-blur"><div><p className="text-[10px] font-black uppercase tracking-[.14em] text-[#70E5A6]">Evidencias del domicilio</p><h2 className="mt-1 text-xl font-black">{clientName}</h2><p className="mt-1 text-[11px] text-emerald-100/55">Consulta rápida sin salir de la cobranza.</p></div><button onClick={()=>setOpen(false)} aria-label="Cerrar fotos" className="flex h-11 w-11 items-center justify-center rounded-2xl bg-[#0B3D33]"><X className="h-5 w-5"/></button></div>{error&&<div className="mb-3 rounded-2xl border border-red-400/20 bg-red-500/10 p-3 text-xs font-bold text-red-200">{error}</div>}{loading?<div className="flex min-h-56 items-center justify-center"><Loader2 className="h-7 w-7 animate-spin text-[#11A65A]"/></div>:<div className="grid gap-3 sm:grid-cols-3"><EvidenceCard label="Fachada" icon={<Home className="h-4 w-4"/>} item={facade}/><EvidenceCard label="Cliente" icon={<UserRound className="h-4 w-4"/>} item={byType('CLIENT_PHOTO')}/><EvidenceCard label="Contrato" icon={<FileCheck2 className="h-4 w-4"/>} item={byType('CONTRACT_PHOTO')}/></div>}<button onClick={()=>loadMedia()} disabled={loading} className="mt-4 flex min-h-11 w-full items-center justify-center gap-2 rounded-2xl border border-emerald-800 bg-[#0B3D33] text-xs font-black text-emerald-100 disabled:opacity-50"><RefreshCw className={`h-4 w-4 ${loading?'animate-spin':''}`}/>Actualizar fotografías</button><button onClick={()=>setOpen(false)} className="mt-2 flex min-h-12 w-full items-center justify-center gap-2 rounded-2xl bg-white text-xs font-black text-[#062B24]"><ChevronDown className="h-4 w-4"/>Volver a cobranza</button></section></div>}
 </>;
}

function EvidenceCard({label,icon,item}:{label:string;icon:React.ReactNode;item?:Media}){return <article className="rounded-3xl border border-white/10 bg-[#0B3D33] p-3"><EvidenceImage storageKey={item?.storageKey} alt={label} className="h-52 w-full sm:h-44"/><div className="mt-3 flex items-center justify-center gap-2 text-xs font-black">{icon}{label}</div></article>}
