'use client';

import {FormEvent,useRef,useState} from 'react';
import {useRouter} from 'next/navigation';
import {Camera,CheckCircle2,Crosshair,FileCheck2,Home,Loader2,MapPin,ShieldCheck,Sparkles,UserRound} from 'lucide-react';
import AppShell,{useShellPermissions} from '@/components/phase15/AppShell';
import {newIdempotencyKey} from '@/lib/phase15/apiClient';
import {haptic} from '@/lib/ux/haptics';

type Photos={facade:File|null;clientPhoto:File|null;contract:File|null};
type OcrData={
 folio?:string;fechaVenta?:string;vendedora?:string;nombreCompleto?:string;telefono?:string;
 domicilio?:{calle?:string;entreCalles?:string;colonia?:string;manzana?:string;lote?:string;referencias?:string};
 productos?:Array<{nombreProducto?:string;importe?:number}>;
 montoTotal?:number;montoEnganche?:number;montoDescuento?:number;pagoSemanal?:number;frecuenciaPago?:string;fechaPrimerPago?:string;observaciones?:string;textoVisible?:string;
};

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

function fileToBase64(file:File){
 return new Promise<string>((resolve,reject)=>{
  const reader=new FileReader();
  reader.onload=()=>resolve(String(reader.result||'').split(',')[1]||'');
  reader.onerror=()=>reject(new Error('No pudimos leer la fotografía del contrato.'));
  reader.readAsDataURL(file);
 });
}

function money(value?:number){return value==null?'':new Intl.NumberFormat('es-MX',{style:'currency',currency:'MXN'}).format(value);}

export default function QuickClientIntake(){
 const router=useRouter(),permissions=useShellPermissions(),nameRef=useRef<HTMLInputElement|null>(null);
 const[name,setName]=useState(''),[phone,setPhone]=useState(''),[photos,setPhotos]=useState<Photos>(emptyPhotos),[position,setPosition]=useState<{lat:number;lng:number;accuracy?:number}|null>(null);
 const[saving,setSaving]=useState(false),[gpsLoading,setGpsLoading]=useState(false),[ocrLoading,setOcrLoading]=useState(false),[ocr,setOcr]=useState<OcrData|null>(null),[error,setError]=useState(''),[success,setSuccess]=useState('');
 const canCreate=permissions?.has('clients.create')===true;
 const completed=[!!position,!!photos.facade,!!photos.clientPhoto,!!photos.contract].filter(Boolean).length;

 const pick=async(key:keyof Photos,file?:File|null)=>{
  if(!file)return;haptic('tap');setError('');
  try{const compact=await compressImage(file);setPhotos(current=>({...current,[key]:compact}));if(key==='contract')setOcr(null);haptic('success');}
  catch{setPhotos(current=>({...current,[key]:file}));}
 };

 const captureGps=()=>{
  haptic('tap');setError('');
  if(!navigator.geolocation){setError('Este dispositivo no permite capturar ubicación.');return;}
  setGpsLoading(true);
  navigator.geolocation.getCurrentPosition(result=>{setPosition({lat:result.coords.latitude,lng:result.coords.longitude,accuracy:result.coords.accuracy});setGpsLoading(false);haptic('success');},()=>{setError('No pudimos capturar la ubicación. Activa el permiso GPS e intenta nuevamente.');setGpsLoading(false);haptic('error');},{enableHighAccuracy:true,maximumAge:0,timeout:10000});
 };

 const extractContract=async()=>{
  if(!photos.contract){setError('Primero toma o selecciona la fotografía del contrato.');return;}
  haptic('tap');setOcrLoading(true);setError('');setSuccess('');
  try{
   const imageBase64=await fileToBase64(photos.contract);
   const token=localStorage.getItem('bitalis_access_token');
   const response=await fetch('/api/ocr-contract',{method:'POST',headers:{'Content-Type':'application/json',...(token?{Authorization:`Bearer ${token}`}:{})},body:JSON.stringify({imageBase64,mimeType:photos.contract.type||'image/jpeg'})});
   const json=await response.json().catch(()=>({}));
   if(!response.ok||!json?.success)throw new Error(json?.error||'No pudimos extraer el contrato.');
   const data=(json?.data||{}) as OcrData;
   setOcr(data);
   if(data.nombreCompleto)setName(data.nombreCompleto);
   if(data.telefono)setPhone(data.telefono);
   setSuccess('Contrato leído. Revisa los datos extraídos antes de guardar.');
   haptic('success');
  }catch(e:any){setError(e?.message||'No pudimos extraer el contrato.');haptic('error');}
  finally{setOcrLoading(false);}
 };

 const submit=async(event:FormEvent)=>{
  event.preventDefault();haptic('tap');
  if(!canCreate){setError('No tienes permiso para registrar clientes.');return;}
  const cleanName=name.trim().replace(/\s+/g,' '),cleanPhone=phone.trim().replace(/\s+/g,'');
  if(!cleanName){setError('Ingresa o extrae el nombre del cliente.');nameRef.current?.focus();return;}
  if(!position){setError('Captura la ubicación del cliente antes de guardar.');return;}
  if(!photos.facade||!photos.clientPhoto||!photos.contract){setError('Debes tomar las tres fotografías: fachada, cliente y contrato.');return;}
  setSaving(true);setError('');setSuccess('');
  try{
   const form=new FormData();
   form.set('name',cleanName);form.set('phone',cleanPhone);form.set('facade',photos.facade);form.set('clientPhoto',photos.clientPhoto);form.set('contract',photos.contract);
   form.set('idempotencyKey',newIdempotencyKey('field-client'));form.set('latitude',String(position.lat));form.set('longitude',String(position.lng));if(position.accuracy!=null)form.set('locationAccuracy',String(position.accuracy));
   const token=localStorage.getItem('bitalis_access_token');
   const response=await fetch('/api/clients/intake',{method:'POST',headers:token?{Authorization:`Bearer ${token}`}:{},body:form});
   const json=await response.json().catch(()=>({}));if(!response.ok)throw new Error(json?.error||'No pudimos enviar el registro.');
   const id=String(json?.client?.id||''),clientNumber=String(json?.client?.clientNumber||'');
   setSuccess(`Cliente guardado · ${clientNumber||'registro completo'}.`);setName('');setPhone('');setPhotos(emptyPhotos);setPosition(null);setOcr(null);haptic('success');
   if(id)window.setTimeout(()=>router.push(`/clients/${id}`),450);
  }catch(e:any){setError(e?.message||'No pudimos guardar el cliente.');haptic('error');}
  finally{setSaving(false);}
 };

 return <AppShell title="Alta rápida"><main className="mx-auto max-w-xl px-3 py-4">
  <section className="rounded-[24px] bg-[var(--bitalis-primary)] p-4 text-white"><p className="text-[10px] font-black uppercase tracking-[.14em] text-[var(--bitalis-mint)]">CRM en campo</p><h1 className="mt-1 text-xl font-black">Alta rápida</h1><p className="mt-1 text-xs text-emerald-50/80">Captura el contrato y usa Gemini para completar los datos visibles.</p></section>
  {error&&<div role="alert" className="mt-3 rounded-2xl border border-red-200 bg-red-50 p-3 text-sm font-bold text-red-700">{error}</div>}
  {success&&<div className="mt-3 flex gap-2 rounded-2xl border border-emerald-200 bg-emerald-50 p-3 text-sm font-bold text-emerald-700"><CheckCircle2 className="h-5 w-5 shrink-0"/><span>{success}</span></div>}
  <form onSubmit={submit} className="mt-3 rounded-[24px] border border-[var(--bitalis-border)] bg-white p-3 sm:p-4">
   <div className="mb-3 flex items-center justify-between gap-3"><div><p className="text-sm font-black text-[var(--bitalis-primary)]">Datos del cliente</p><p className="text-[11px] text-slate-500">Puedes escribirlos o extraerlos del contrato.</p></div><span className="rounded-full bg-emerald-50 px-2.5 py-1 text-[9px] font-black text-[var(--bitalis-action-dark)]">{completed}/4 LISTO</span></div>
   <label className="block"><span className="text-xs font-black text-slate-500">Nombre del cliente *</span><input ref={nameRef} value={name} onChange={e=>setName(e.target.value)} placeholder="Nombre completo" className="mt-2 min-h-14 w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 text-base outline-none focus:border-[var(--bitalis-action)] focus:ring-4 focus:ring-emerald-500/10"/></label>
   <label className="mt-3 block"><span className="text-xs font-black text-slate-500">Teléfono</span><input inputMode="tel" value={phone} onChange={e=>setPhone(e.target.value)} placeholder="Número telefónico" className="mt-2 min-h-14 w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 text-base outline-none focus:border-[var(--bitalis-action)] focus:ring-4 focus:ring-emerald-500/10"/></label>
   <button type="button" onClick={captureGps} disabled={gpsLoading} className={`mt-3 flex min-h-14 w-full items-center justify-center gap-2 rounded-2xl border px-3 text-sm font-black ${position?'border-emerald-200 bg-emerald-50 text-emerald-700':'border-[var(--bitalis-border)] bg-[var(--bitalis-surface-soft)] text-[var(--bitalis-primary)]'}`}>{gpsLoading?<Loader2 className="h-5 w-5 animate-spin"/>:position?<MapPin className="h-5 w-5"/>:<Crosshair className="h-5 w-5"/>}{gpsLoading?'CAPTURANDO GPS…':position?`UBICACIÓN CAPTURADA${position.accuracy?` · ±${Math.round(position.accuracy)} m`:''}`:'CAPTURAR UBICACIÓN'}</button>
   <div className="mt-3 grid grid-cols-3 gap-2"><PhotoCapture title="Fachada" icon={<Home/>} file={photos.facade} onPick={file=>pick('facade',file)}/><PhotoCapture title="Cliente" icon={<UserRound/>} file={photos.clientPhoto} onPick={file=>pick('clientPhoto',file)}/><PhotoCapture title="Contrato" icon={<FileCheck2/>} file={photos.contract} onPick={file=>pick('contract',file)}/></div>
   <button type="button" onClick={extractContract} disabled={!photos.contract||ocrLoading||saving} className="mt-3 flex min-h-14 w-full items-center justify-center gap-2 rounded-2xl border border-violet-200 bg-violet-50 px-4 text-sm font-black text-violet-800 disabled:opacity-40">{ocrLoading?<Loader2 className="h-5 w-5 animate-spin"/>:<Sparkles className="h-5 w-5"/>}{ocrLoading?'EXTRAYENDO CONTRATO…':'EXTRAER DATOS DEL CONTRATO'}</button>
   {ocr&&<section className="mt-3 rounded-2xl border border-violet-100 bg-violet-50/60 p-3"><p className="text-[10px] font-black uppercase tracking-[.12em] text-violet-700">Contrato extraído · revisar</p><div className="mt-2 grid gap-1 text-xs text-slate-700">{ocr.folio&&<p><b>Folio:</b> {ocr.folio}</p>}{ocr.fechaVenta&&<p><b>Fecha:</b> {ocr.fechaVenta}</p>}{ocr.vendedora&&<p><b>Vendedora:</b> {ocr.vendedora}</p>}{ocr.domicilio?.calle&&<p><b>Domicilio:</b> {[ocr.domicilio.calle,ocr.domicilio.colonia,ocr.domicilio.manzana&&`MZN ${ocr.domicilio.manzana}`,ocr.domicilio.lote&&`LTE ${ocr.domicilio.lote}`].filter(Boolean).join(' · ')}</p>}{ocr.productos?.length?<p><b>Productos:</b> {ocr.productos.map(p=>`${p.nombreProducto||'Producto'}${p.importe!=null?` ${money(p.importe)}`:''}`).join(' · ')}</p>:null}{ocr.montoTotal!=null&&<p><b>Total:</b> {money(ocr.montoTotal)}</p>}{ocr.montoEnganche!=null&&<p><b>Enganche:</b> {money(ocr.montoEnganche)}</p>}{ocr.frecuenciaPago&&<p><b>Pago:</b> {ocr.frecuenciaPago}{ocr.pagoSemanal!=null?` · ${money(ocr.pagoSemanal)}`:''}</p>}{ocr.fechaPrimerPago&&<p><b>Primer abono:</b> {ocr.fechaPrimerPago}</p>}</div><p className="mt-2 text-[10px] font-bold text-violet-700">Nombre y teléfono se colocaron arriba cuando fueron legibles. Puedes corregirlos antes de guardar.</p></section>}
   <button disabled={saving||gpsLoading||completed<4||!canCreate} className="mt-4 flex min-h-16 w-full items-center justify-center gap-2 rounded-2xl bg-[var(--bitalis-action)] text-base font-black text-white shadow-[0_10px_24px_rgba(17,166,90,.18)] disabled:opacity-40">{saving?<Loader2 className="h-6 w-6 animate-spin"/>:<ShieldCheck className="h-5 w-5"/>}{saving?'ENVIANDO…':'GUARDAR Y CONTINUAR'}</button>
  </form>
 </main></AppShell>;
}

function PhotoCapture({title,icon,file,onPick}:{title:string;icon:React.ReactNode;file:File|null;onPick:(file:File|null)=>void}){
 const id=`capture-${title.toLowerCase()}`;
 return <label htmlFor={id} className={`flex min-h-24 cursor-pointer flex-col items-center justify-center gap-2 rounded-2xl border px-2 text-center ${file?'border-emerald-200 bg-emerald-50 text-emerald-700':'border-slate-200 bg-slate-50 text-slate-600'}`}><span className="[&>svg]:h-5 [&>svg]:w-5">{file?<CheckCircle2/>:icon}</span><span className="text-[10px] font-black">{file?`${title} lista`:title}</span><span className="flex items-center gap-1 text-[9px] font-bold opacity-70"><Camera className="h-3 w-3"/>Tomar</span><input id={id} hidden type="file" accept="image/*" capture="environment" onChange={e=>onPick(e.target.files?.[0]||null)}/></label>;
}
