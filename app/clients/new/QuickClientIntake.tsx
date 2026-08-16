'use client';

import {FormEvent,useRef,useState,type ReactNode} from 'react';
import {useRouter} from 'next/navigation';
import {Camera,CheckCircle2,CircleAlert,Crosshair,FileCheck2,Home,Images,Loader2,MapPin,ShieldCheck,Sparkles,UserRound} from 'lucide-react';
import AppShell,{useShellPermissions} from '@/components/phase15/AppShell';
import {apiClient,newIdempotencyKey} from '@/lib/phase15/apiClient';
import {haptic} from '@/lib/ux/haptics';

type Photos={facade:File|null;clientPhoto:File|null;contract:File|null};
type AiReview={status:'READY'|'REVIEW';summary:string;checks:Array<{label:string;ok:boolean;message:string}>;nextAction:string};
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
 const[saving,setSaving]=useState(false),[gpsLoading,setGpsLoading]=useState(false),[aiLoading,setAiLoading]=useState(false),[aiReview,setAiReview]=useState<AiReview|null>(null),[error,setError]=useState(''),[success,setSuccess]=useState('');
 const canCreate=permissions?.has('clients.create')===true;
 const completed=[!!position,!!photos.facade,!!photos.clientPhoto,!!photos.contract].filter(Boolean).length;
 const invalidateReview=()=>setAiReview(null);

 const pick=async(key:keyof Photos,file?:File|null)=>{
  if(!file)return;haptic('tap');setError('');invalidateReview();
  try{const compact=await compressImage(file);setPhotos(current=>({...current,[key]:compact}));haptic('success');}
  catch{setPhotos(current=>({...current,[key]:file}));}
 };

 const captureGps=()=>{
  haptic('tap');setError('');invalidateReview();
  if(!navigator.geolocation){setError('Este dispositivo no permite capturar ubicación.');return;}
  setGpsLoading(true);
  navigator.geolocation.getCurrentPosition(result=>{setPosition({lat:result.coords.latitude,lng:result.coords.longitude,accuracy:result.coords.accuracy});setGpsLoading(false);haptic('success');},()=>{setError('No pudimos capturar la ubicación. Activa el permiso GPS e intenta nuevamente.');setGpsLoading(false);haptic('error');},{enableHighAccuracy:true,maximumAge:0,timeout:10000});
 };

 const reviewWithGemini=async()=>{
  if(!navigator.onLine){setError('La revisión con Gemini necesita internet. Puedes seguir capturando los datos y guardar cuando el flujo lo permita.');return;}
  haptic('tap');setAiLoading(true);setError('');setSuccess('');
  try{
   const json=await apiClient<any>('/api/ai/client-intake-review',{method:'POST',timeoutMs:30000,body:JSON.stringify({name:name.trim(),phone:phone.trim(),gpsAccuracy:position?.accuracy??null,facadeReady:!!photos.facade,clientPhotoReady:!!photos.clientPhoto,contractReady:!!photos.contract,notes:notes.trim()})});
   if(!json?.success)throw new Error(json?.error||'No pudimos revisar el alta con Gemini.');
   setAiReview(json.data as AiReview);haptic('success');
  }catch(e:any){if(e?.status===401){router.replace('/');return;}setError(e?.message||'No pudimos revisar el alta con Gemini.');haptic('error');}
  finally{setAiLoading(false);}
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
   setSuccess(`Cliente guardado · ${clientNumber||'registro completo'}.`);setName('');setPhone('');setNotes('');setPhotos(emptyPhotos);setPosition(null);setAiReview(null);haptic('success');
   if(id)window.setTimeout(()=>router.push(`/clients/${id}`),450);
  }catch(e:any){if(e?.status===401){router.replace('/');return;}setError(e?.message||'No pudimos guardar el cliente.');haptic('error');}
  finally{setSaving(false);}
 };

 return <AppShell title="Alta rápida"><main className="mx-auto max-w-xl px-3 py-4">
  <section className="rounded-[24px] bg-[var(--bitalis-primary)] p-4 text-white"><p className="text-[10px] font-black uppercase tracking-[.14em] text-[var(--bitalis-mint)]">CRM en campo</p><h1 className="mt-1 text-xl font-black">Alta rápida</h1><p className="mt-1 text-xs text-emerald-50/80">Captura los datos y deja que Gemini revise la calidad del alta antes de guardarla.</p></section>
  {error&&<div role="alert" className="mt-3 rounded-2xl border border-red-200 bg-red-50 p-3 text-sm font-bold text-red-700">{error}</div>}
  {success&&<div className="mt-3 flex gap-2 rounded-2xl border border-emerald-200 bg-emerald-50 p-3 text-sm font-bold text-emerald-700"><CheckCircle2 className="h-5 w-5 shrink-0"/><span>{success}</span></div>}
  <form onSubmit={submit} className="mt-3 rounded-[24px] border border-[var(--bitalis-border)] bg-white p-3 sm:p-4">
   <div className="mb-3 flex items-center justify-between gap-3"><div><p className="text-sm font-black text-[var(--bitalis-primary)]">Datos del cliente</p><p className="text-[11px] text-slate-500">Captura manual segura; Gemini solo revisa lo que tú ingresas.</p></div><span className="rounded-full bg-emerald-50 px-2.5 py-1 text-[9px] font-black text-[var(--bitalis-action-dark)]">{completed}/4 LISTO</span></div>
   <label className="block"><span className="text-xs font-black text-slate-500">Nombre del cliente *</span><input ref={nameRef} value={name} onChange={e=>{setName(e.target.value);invalidateReview();}} placeholder="Nombre completo" className="mt-2 min-h-14 w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 text-base outline-none focus:border-[var(--bitalis-action)] focus:ring-4 focus:ring-emerald-500/10"/></label>
   <label className="mt-3 block"><span className="text-xs font-black text-slate-500">Teléfono</span><input inputMode="tel" value={phone} onChange={e=>{setPhone(e.target.value);invalidateReview();}} placeholder="Número telefónico" className="mt-2 min-h-14 w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 text-base outline-none focus:border-[var(--bitalis-action)] focus:ring-4 focus:ring-emerald-500/10"/></label>
   <label className="mt-3 block"><span className="text-xs font-black text-slate-500">Notas de la visita <span className="font-medium text-slate-400">(opcional)</span></span><textarea value={notes} onChange={e=>{setNotes(e.target.value.slice(0,800));invalidateReview();}} placeholder="Referencia, detalle importante o pendiente que deba revisar el supervisor" className="mt-2 min-h-24 w-full resize-none rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm outline-none focus:border-[var(--bitalis-action)] focus:ring-4 focus:ring-emerald-500/10"/></label>
   <button type="button" onClick={captureGps} disabled={gpsLoading} className={`mt-3 flex min-h-14 w-full items-center justify-center gap-2 rounded-2xl border px-3 text-sm font-black ${position?'border-emerald-200 bg-emerald-50 text-emerald-700':'border-[var(--bitalis-border)] bg-[var(--bitalis-surface-soft)] text-[var(--bitalis-primary)]'}`}>{gpsLoading?<Loader2 className="h-5 w-5 animate-spin"/>:position?<MapPin className="h-5 w-5"/>:<Crosshair className="h-5 w-5"/>}{gpsLoading?'CAPTURANDO GPS…':position?`UBICACIÓN CAPTURADA${position.accuracy?` · ±${Math.round(position.accuracy)} m`:''}`:'CAPTURAR UBICACIÓN'}</button>
   <div className="mt-3 rounded-2xl border border-slate-200 bg-slate-50 p-3"><div className="flex items-center gap-2 text-[11px] font-black text-[var(--bitalis-primary)]"><Images className="h-4 w-4"/>EVIDENCIAS · CÁMARA O GALERÍA</div><p className="mt-1 text-[10px] text-slate-500">Las fotos se adjuntan al expediente. La revisión de Gemini no recibe ni analiza estas imágenes.</p><div className="mt-3 grid grid-cols-3 gap-2"><PhotoCapture title="Fachada" icon={<Home/>} file={photos.facade} onPick={file=>pick('facade',file)}/><PhotoCapture title="Cliente" icon={<UserRound/>} file={photos.clientPhoto} onPick={file=>pick('clientPhoto',file)}/><PhotoCapture title="Contrato" icon={<FileCheck2/>} file={photos.contract} onPick={file=>pick('contract',file)}/></div></div>
   <button type="button" onClick={reviewWithGemini} disabled={aiLoading||saving||!canCreate} className="mt-3 flex min-h-16 w-full items-center justify-center gap-2 rounded-2xl border-2 border-violet-300 bg-violet-50 px-4 text-sm font-black text-violet-800 shadow-sm disabled:border-slate-200 disabled:bg-slate-50 disabled:text-slate-400">{aiLoading?<Loader2 className="h-5 w-5 animate-spin"/>:<Sparkles className="h-5 w-5"/>}{aiLoading?'REVISANDO CON GEMINI…':'REVISAR ALTA CON GEMINI'}</button>
   <p className="mt-1.5 text-center text-[10px] font-bold text-slate-500">Gemini es una ayuda de calidad: no modifica datos ni toma decisiones de crédito, riesgo o autorización.</p>
   {aiReview&&<section className={`mt-3 rounded-2xl border p-3 ${aiReview.status==='READY'?'border-emerald-200 bg-emerald-50':'border-amber-200 bg-amber-50'}`}><div className="flex items-center gap-2"><span className={`flex h-8 w-8 items-center justify-center rounded-xl ${aiReview.status==='READY'?'bg-emerald-100 text-emerald-700':'bg-amber-100 text-amber-700'}`}>{aiReview.status==='READY'?<CheckCircle2 className="h-5 w-5"/>:<CircleAlert className="h-5 w-5"/>}</span><div><p className="text-[10px] font-black uppercase tracking-[.12em]">Revisión Gemini · {aiReview.status==='READY'?'LISTA':'REVISAR'}</p><p className="mt-0.5 text-xs text-slate-700">{aiReview.summary}</p></div></div><div className="mt-3 space-y-2">{aiReview.checks?.map((check,index)=><div key={`${check.label}-${index}`} className="flex gap-2 rounded-xl bg-white/70 p-2 text-xs"><span className={`mt-0.5 h-2.5 w-2.5 shrink-0 rounded-full ${check.ok?'bg-emerald-500':'bg-amber-500'}`}/><div><b>{check.label}</b><p className="mt-0.5 text-slate-600">{check.message}</p></div></div>)}</div><p className="mt-3 text-xs font-black text-[var(--bitalis-primary)]">Siguiente acción: <span className="font-bold text-slate-700">{aiReview.nextAction}</span></p></section>}
   <button disabled={saving||gpsLoading||completed<4||!canCreate} className="mt-4 flex min-h-16 w-full items-center justify-center gap-2 rounded-2xl bg-[var(--bitalis-action)] text-base font-black text-white shadow-[0_10px_24px_rgba(17,166,90,.18)] disabled:opacity-40">{saving?<Loader2 className="h-6 w-6 animate-spin"/>:<ShieldCheck className="h-5 w-5"/>}{saving?'ENVIANDO…':'GUARDAR Y CONTINUAR'}</button>
  </form>
 </main></AppShell>;
}

function PhotoCapture({title,icon,file,onPick}:{title:string;icon:ReactNode;file:File|null;onPick:(file:File|null)=>void}){
 const id=`capture-${title.toLowerCase()}`;
 return <label htmlFor={id} className={`flex min-h-24 cursor-pointer flex-col items-center justify-center gap-2 rounded-2xl border px-2 text-center ${file?'border-emerald-200 bg-emerald-50 text-emerald-700':'border-slate-200 bg-white text-slate-600'}`}><span className="[&>svg]:h-5 [&>svg]:w-5">{file?<CheckCircle2/>:icon}</span><span className="text-[10px] font-black">{file?`${title} lista`:title}</span><span className="flex items-center gap-1 text-[9px] font-bold opacity-70"><Camera className="h-3 w-3"/>Cámara / Galería</span><input id={id} hidden type="file" accept="image/*" onChange={e=>{onPick(e.target.files?.[0]||null);e.currentTarget.value='';}}/></label>;
}
