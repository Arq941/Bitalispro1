'use client';

import {FormEvent,useRef,useState,type ReactNode} from 'react';
import {useRouter} from 'next/navigation';
import {Camera,CheckCircle2,Crosshair,FileCheck2,Home,Images,Loader2,MapPin,ShieldCheck,UserRound} from 'lucide-react';
import AppShell,{useShellPermissions} from '@/components/phase15/AppShell';
import {apiClient,newIdempotencyKey} from '@/lib/phase15/apiClient';
import {haptic} from '@/lib/ux/haptics';

type Photos={facade:File|null;clientPhoto:File|null;contract:File|null};
const emptyPhotos:Photos={facade:null,clientPhoto:null,contract:null};

async function compressImage(file:File){
 if(!file.type.startsWith('image/'))return file;
 const bitmap=await createImageBitmap(file);
 const max=1280,scale=Math.min(1,max/Math.max(bitmap.width,bitmap.height));
 const canvas=document.createElement('canvas');
 canvas.width=Math.max(1,Math.round(bitmap.width*scale));canvas.height=Math.max(1,Math.round(bitmap.height*scale));
 const ctx=canvas.getContext('2d');if(!ctx){bitmap.close();return file;}
 ctx.drawImage(bitmap,0,0,canvas.width,canvas.height);
 const blob=await new Promise<Blob|null>(resolve=>canvas.toBlob(resolve,'image/jpeg',.76));
 bitmap.close();
 return blob?new File([blob],file.name.replace(/\.[^.]+$/,'.jpg'),{type:'image/jpeg'}):file;
}

export default function QuickClientIntake(){
 const router=useRouter(),permissions=useShellPermissions(),nameRef=useRef<HTMLInputElement|null>(null);
 const[name,setName]=useState(''),[phone,setPhone]=useState(''),[notes,setNotes]=useState(''),[photos,setPhotos]=useState<Photos>(emptyPhotos),[position,setPosition]=useState<{lat:number;lng:number;accuracy?:number}|null>(null);
 const[saving,setSaving]=useState(false),[gpsLoading,setGpsLoading]=useState(false),[error,setError]=useState(''),[success,setSuccess]=useState('');
 const canCreate=permissions?.has('clients.create')===true;
 const completed=[!!position,!!photos.facade,!!photos.clientPhoto,!!photos.contract].filter(Boolean).length;

 const pick=async(key:keyof Photos,file?:File|null)=>{
  if(!file)return;haptic('tap');setError('');
  try{const compact=await compressImage(file);setPhotos(current=>({...current,[key]:compact}));haptic('success');}
  catch{setPhotos(current=>({...current,[key]:file}));}
 };

 const captureGps=()=>{
  haptic('tap');setError('');
  if(!navigator.geolocation){setError('Este dispositivo no permite capturar ubicación.');return;}
  setGpsLoading(true);
  navigator.geolocation.getCurrentPosition(result=>{setPosition({lat:result.coords.latitude,lng:result.coords.longitude,accuracy:result.coords.accuracy});setGpsLoading(false);haptic('success');},()=>{setError('No pudimos capturar la ubicación. Activa el permiso GPS e intenta nuevamente.');setGpsLoading(false);haptic('error');},{enableHighAccuracy:true,maximumAge:0,timeout:10000});
 };

 const submit=async(event:FormEvent)=>{
  event.preventDefault();haptic('tap');
  if(!canCreate){setError('No tienes permiso para registrar clientes.');return;}
  const cleanName=name.trim().replace(/\s+/g,' '),cleanPhone=phone.trim().replace(/\s+/g,'');
  if(!cleanName){setError('Ingresa el nombre del cliente.');nameRef.current?.focus();return;}
  if(!position){setError('Captura la ubicación del cliente antes de guardar.');return;}
  if(!photos.facade||!photos.clientPhoto||!photos.contract){setError('Debes tomar las tres fotografías: fachada, cliente y contrato.');return;}
  setSaving(true);setError('');setSuccess('');
  try{
   const form=new FormData(),idempotencyKey=newIdempotencyKey('field-client');
   form.set('name',cleanName);form.set('phone',cleanPhone);form.set('facade',photos.facade);form.set('clientPhoto',photos.clientPhoto);form.set('contract',photos.contract);
   form.set('idempotencyKey',idempotencyKey);form.set('latitude',String(position.lat));form.set('longitude',String(position.lng));if(position.accuracy!=null)form.set('locationAccuracy',String(position.accuracy));
   const json=await apiClient<any>('/api/clients/intake',{method:'POST',timeoutMs:30000,idempotencyKey,body:form});
   const id=String(json?.client?.id||''),clientNumber=String(json?.client?.clientNumber||'');
   setSuccess(`Cliente guardado · ${clientNumber||'registro completo'}.`);setName('');setPhone('');setNotes('');setPhotos(emptyPhotos);setPosition(null);haptic('success');
   if(id)window.setTimeout(()=>router.push(`/clients/${id}`),450);
  }catch(e:any){if(e?.status===401){router.replace('/');return;}setError(e?.message||'No pudimos guardar el cliente.');haptic('error');}
  finally{setSaving(false);}
 };

 return <AppShell title="Alta rápida"><main className="mx-auto w-full max-w-xl px-3 py-4 sm:px-4">
  <section className="rounded-[24px] bg-[var(--bitalis-primary)] p-4 text-white shadow-[0_10px_30px_rgba(6,43,36,.12)]"><p className="text-[10px] font-black uppercase tracking-[.14em] text-[var(--bitalis-mint)]">CRM en campo</p><h1 className="mt-1 text-xl font-black">Alta rápida</h1><p className="mt-1 text-xs leading-5 text-emerald-50/80">Captura los datos principales, ubicación y evidencias antes de guardar.</p></section>
  {error&&<div role="alert" className="mt-3 rounded-2xl border border-red-200 bg-red-50 p-3 text-sm font-bold leading-5 text-red-700">{error}</div>}
  {success&&<div className="mt-3 flex gap-2 rounded-2xl border border-emerald-200 bg-emerald-50 p-3 text-sm font-bold text-emerald-700"><CheckCircle2 className="h-5 w-5 shrink-0"/><span>{success}</span></div>}
  <form onSubmit={submit} className="bitalis-form-card mt-3 p-3 sm:p-4">
   <div className="mb-4 flex flex-wrap items-start justify-between gap-2 border-b border-slate-100 pb-3"><div className="min-w-0 flex-1"><p className="text-sm font-black text-[var(--bitalis-primary)]">Datos del cliente</p><p className="mt-0.5 text-[11px] leading-4 text-slate-500">Los campos con * son necesarios para guardar el alta.</p></div><span className="shrink-0 rounded-full bg-emerald-50 px-2.5 py-1 text-[9px] font-black text-[var(--bitalis-action-dark)]">{completed}/4 EVIDENCIAS</span></div>
   <label className="block"><span className="bitalis-form-label">Nombre del cliente *</span><input ref={nameRef} autoComplete="name" enterKeyHint="next" value={name} onChange={e=>setName(e.target.value)} placeholder="Nombre completo" className="min-h-14 w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 text-base outline-none focus:border-[var(--bitalis-action)] focus:ring-4 focus:ring-emerald-500/10"/></label>
   <label className="mt-3 block"><span className="bitalis-form-label">Teléfono</span><input type="tel" inputMode="tel" autoComplete="tel" enterKeyHint="next" value={phone} onChange={e=>setPhone(e.target.value)} placeholder="Número telefónico" className="min-h-14 w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 text-base outline-none focus:border-[var(--bitalis-action)] focus:ring-4 focus:ring-emerald-500/10"/><span className="bitalis-form-help">Usa el número principal donde pueda localizarse al cliente.</span></label>
   <label className="mt-3 block"><span className="bitalis-form-label">Notas de la visita <span className="font-medium text-slate-400">(opcional)</span></span><textarea value={notes} onChange={e=>setNotes(e.target.value.slice(0,800))} placeholder="Referencia, detalle importante o pendiente que deba revisar el supervisor" className="min-h-24 w-full resize-y rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-base outline-none focus:border-[var(--bitalis-action)] focus:ring-4 focus:ring-emerald-500/10"/><span className="bitalis-form-help text-right">{notes.length}/800</span></label>

   <section className="bitalis-form-section mt-4"><div className="flex items-start gap-3"><span className={`mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-xl ${position?'bg-emerald-100 text-emerald-700':'bg-white text-[var(--bitalis-primary)]'}`}><MapPin className="h-5 w-5"/></span><div className="min-w-0 flex-1"><p className="text-xs font-black text-[var(--bitalis-primary)]">Ubicación del domicilio *</p><p className="mt-0.5 text-[10px] leading-4 text-slate-500">Captúrala estando frente al domicilio para mejorar rutas y validaciones.</p></div></div><button type="button" onClick={captureGps} disabled={gpsLoading} className={`mt-3 flex min-h-14 w-full items-center justify-center gap-2 rounded-2xl border px-3 text-center text-sm font-black ${position?'border-emerald-200 bg-emerald-50 text-emerald-700':'border-[var(--bitalis-border)] bg-white text-[var(--bitalis-primary)]'}`}>{gpsLoading?<Loader2 className="h-5 w-5 shrink-0 animate-spin"/>:position?<MapPin className="h-5 w-5 shrink-0"/>:<Crosshair className="h-5 w-5 shrink-0"/>}<span>{gpsLoading?'CAPTURANDO GPS…':position?`UBICACIÓN CAPTURADA${position.accuracy?` · ±${Math.round(position.accuracy)} m`:''}`:'CAPTURAR UBICACIÓN'}</span></button></section>

   <section className="bitalis-form-section mt-3"><div className="flex items-center gap-2 text-[11px] font-black text-[var(--bitalis-primary)]"><Images className="h-4 w-4 shrink-0"/>EVIDENCIAS · CÁMARA O GALERÍA</div><p className="mt-1 text-[10px] leading-4 text-slate-500">Adjunta fachada, cliente y contrato al expediente.</p><div className="mt-3 grid grid-cols-1 gap-2 min-[360px]:grid-cols-3"><PhotoCapture title="Fachada" icon={<Home/>} file={photos.facade} onPick={file=>pick('facade',file)}/><PhotoCapture title="Cliente" icon={<UserRound/>} file={photos.clientPhoto} onPick={file=>pick('clientPhoto',file)}/><PhotoCapture title="Contrato" icon={<FileCheck2/>} file={photos.contract} onPick={file=>pick('contract',file)}/></div></section>

   <div className="bitalis-form-sticky-actions mt-3"><button disabled={saving||gpsLoading||completed<4||!canCreate} className="flex min-h-16 w-full items-center justify-center gap-2 rounded-2xl bg-[var(--bitalis-action)] px-4 text-base font-black text-white shadow-[0_10px_24px_rgba(17,166,90,.18)] disabled:opacity-40">{saving?<Loader2 className="h-6 w-6 shrink-0 animate-spin"/>:<ShieldCheck className="h-5 w-5 shrink-0"/>}{saving?'ENVIANDO…':'GUARDAR Y CONTINUAR'}</button></div>
  </form>
 </main></AppShell>;
}

function PhotoCapture({title,icon,file,onPick}:{title:string;icon:ReactNode;file:File|null;onPick:(file:File|null)=>void}){
 const id=`capture-${title.toLowerCase()}`;
 return <label htmlFor={id} className={`flex min-h-20 cursor-pointer items-center gap-3 rounded-2xl border px-3 py-3 text-left min-[360px]:min-h-24 min-[360px]:flex-col min-[360px]:justify-center min-[360px]:gap-2 min-[360px]:px-2 min-[360px]:text-center ${file?'border-emerald-200 bg-emerald-50 text-emerald-700':'border-slate-200 bg-white text-slate-600'}`}><span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-white/70 [&>svg]:h-5 [&>svg]:w-5">{file?<CheckCircle2/>:icon}</span><span className="min-w-0 flex-1 min-[360px]:flex-none"><span className="block text-[11px] font-black min-[360px]:text-[10px]">{file?`${title} lista`:title}</span><span className="mt-0.5 flex items-center gap-1 text-[9px] font-bold opacity-70 min-[360px]:justify-center"><Camera className="h-3 w-3 shrink-0"/>Cámara / Galería</span></span><input id={id} hidden type="file" accept="image/*" onChange={e=>{onPick(e.target.files?.[0]||null);e.currentTarget.value='';}}/></label>;
}
