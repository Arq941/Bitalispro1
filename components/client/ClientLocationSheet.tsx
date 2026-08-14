'use client';

import {useEffect,useState} from 'react';
import {Crosshair,ExternalLink,Loader2,MapPin,Navigation,Save,X} from 'lucide-react';
import {apiClient} from '@/lib/phase15/apiClient';
import {haptic} from '@/lib/ux/haptics';

export type ClientLocationValue={latitude:number|null;longitude:number|null;locationAccuracy?:number|null;locationCapturedAt?:string|null};

type Props={
 open:boolean;
 clientId:string;
 clientLabel:string;
 value:ClientLocationValue;
 canEdit:boolean;
 onClose:()=>void;
 onUpdated?:(value:ClientLocationValue)=>void;
};

export default function ClientLocationSheet({open,clientId,clientLabel,value,canEdit,onClose,onUpdated}:Props){
 const[latitude,setLatitude]=useState(''),[longitude,setLongitude]=useState(''),[accuracy,setAccuracy]=useState<number|null>(null),[capturing,setCapturing]=useState(false),[saving,setSaving]=useState(false),[error,setError]=useState('');
 useEffect(()=>{if(!open)return;setLatitude(value.latitude==null?'':String(value.latitude));setLongitude(value.longitude==null?'':String(value.longitude));setAccuracy(value.locationAccuracy??null);setError('');},[open,value.latitude,value.longitude,value.locationAccuracy]);
 if(!open)return null;
 const hasDraft=latitude.trim()!==''&&longitude.trim()!=='';
 const openMap=()=>{if(!hasDraft)return;window.open(`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(`${latitude},${longitude}`)}`,'_blank','noopener,noreferrer');};
 const capture=()=>{haptic('tap');if(!navigator.geolocation){setError('Este dispositivo no permite capturar ubicación.');return;}setCapturing(true);setError('');navigator.geolocation.getCurrentPosition(p=>{setLatitude(String(p.coords.latitude));setLongitude(String(p.coords.longitude));setAccuracy(p.coords.accuracy);setCapturing(false);haptic('success');},()=>{setCapturing(false);setError('No pudimos obtener el GPS. Revisa el permiso de ubicación e intenta nuevamente.');haptic('error');},{enableHighAccuracy:true,maximumAge:0,timeout:12000});};
 const save=async()=>{if(!canEdit)return;const lat=Number(latitude),lng=Number(longitude);if(!Number.isFinite(lat)||lat < -90||lat > 90){setError('La latitud debe estar entre -90 y 90.');return;}if(!Number.isFinite(lng)||lng < -180||lng > 180){setError('La longitud debe estar entre -180 y 180.');return;}setSaving(true);setError('');try{const json:any=await apiClient(`/api/clients/${clientId}/location`,{method:'PATCH',body:JSON.stringify({latitude:lat,longitude:lng,locationAccuracy:accuracy})});const client=json?.client||{};const next={latitude:Number(client.latitude??lat),longitude:Number(client.longitude??lng),locationAccuracy:client.locationAccuracy==null?accuracy:Number(client.locationAccuracy),locationCapturedAt:client.locationCapturedAt||new Date().toISOString()};onUpdated?.(next);haptic('success');onClose();}catch(e:any){setError(e.message||'No pudimos guardar la ubicación.');haptic('error');}finally{setSaving(false);}};
 const quality=accuracy==null?'Precisión no disponible':accuracy<=30?`GPS preciso · ±${Math.round(accuracy)} m`:accuracy<=80?`GPS aceptable · ±${Math.round(accuracy)} m`:`GPS por revisar · ±${Math.round(accuracy)} m`;
 return <div data-no-swipe className="fixed inset-0 z-[170] flex items-end bg-slate-950/55 sm:items-center sm:justify-center sm:p-4" onClick={()=>!saving&&onClose()}>
  <section onClick={e=>e.stopPropagation()} className="w-full rounded-t-[28px] bg-white p-4 pb-[max(1rem,env(safe-area-inset-bottom))] shadow-2xl sm:max-w-md sm:rounded-[28px] sm:p-5">
   <div className="mx-auto mb-3 h-1 w-10 rounded-full bg-slate-300"/>
   <div className="flex items-start justify-between gap-3"><div className="min-w-0"><p className="text-[10px] font-black uppercase tracking-[.13em] text-[var(--bitalis-action)]">Ubicación del cliente</p><h2 className="mt-1 truncate text-lg font-black text-[var(--bitalis-primary)]">{clientLabel}</h2><p className="mt-1 text-xs text-slate-500">{hasDraft?quality:'Este cliente todavía no tiene coordenadas.'}</p></div><button disabled={saving} onClick={onClose} className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-slate-100 text-slate-600"><X className="h-4 w-4"/></button></div>
   {error&&<div role="alert" className="mt-3 rounded-2xl border border-red-200 bg-red-50 p-3 text-xs font-bold text-red-700">{error}</div>}
   {hasDraft&&<div className="mt-3 flex items-center gap-3 rounded-2xl border border-emerald-100 bg-emerald-50 p-3"><div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-white text-emerald-700"><MapPin className="h-5 w-5"/></div><div className="min-w-0 flex-1"><p className="truncate text-xs font-black text-[var(--bitalis-primary)]">{Number(latitude).toFixed(6)}, {Number(longitude).toFixed(6)}</p><p className="mt-0.5 text-[10px] text-slate-500">{quality}</p></div><button onClick={openMap} className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-white text-[var(--bitalis-primary)]" aria-label="Abrir ubicación en mapa"><ExternalLink className="h-4 w-4"/></button></div>}
   {canEdit?<><button type="button" disabled={capturing||saving} onClick={capture} className="mt-3 flex min-h-14 w-full items-center justify-center gap-2 rounded-2xl bg-[var(--bitalis-surface-soft)] px-3 text-sm font-black text-[var(--bitalis-primary)] disabled:opacity-50">{capturing?<Loader2 className="h-5 w-5 animate-spin"/>:<Crosshair className="h-5 w-5"/>}{capturing?'CAPTURANDO GPS…':'USAR GPS ACTUAL'}</button><div className="mt-3 grid grid-cols-2 gap-2"><label className="block"><span className="text-[10px] font-black uppercase text-slate-400">Latitud</span><input inputMode="decimal" value={latitude} onChange={e=>{setLatitude(e.target.value);setAccuracy(null);}} placeholder="19.432608" className="mt-1 min-h-12 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 text-sm outline-none focus:border-[var(--bitalis-action)]"/></label><label className="block"><span className="text-[10px] font-black uppercase text-slate-400">Longitud</span><input inputMode="decimal" value={longitude} onChange={e=>{setLongitude(e.target.value);setAccuracy(null);}} placeholder="-99.133209" className="mt-1 min-h-12 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 text-sm outline-none focus:border-[var(--bitalis-action)]"/></label></div><button type="button" disabled={saving||capturing||!hasDraft} onClick={save} className="mt-4 flex min-h-14 w-full items-center justify-center gap-2 rounded-2xl bg-[var(--bitalis-action)] px-3 text-sm font-black text-white disabled:opacity-40">{saving?<Loader2 className="h-5 w-5 animate-spin"/>:<Save className="h-5 w-5"/>}{saving?'GUARDANDO…':'GUARDAR COORDENADAS'}</button></>:<div className="mt-3 rounded-2xl border border-slate-200 bg-slate-50 p-3 text-xs leading-5 text-slate-600"><Navigation className="mb-2 h-4 w-4 text-[var(--bitalis-action)]"/>Puedes consultar la ubicación. Para cambiarla se requiere el permiso <b>Editar clientes</b>.</div>}
  </section>
 </div>;
}
