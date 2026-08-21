'use client';

import {useEffect,useMemo,useRef,useState} from 'react';
import {ArrowLeft,CheckCircle2,Loader2,Minus,Package,Plus,ShieldAlert,ShoppingCart,Trash2,UserRound} from 'lucide-react';
import {useRouter} from 'next/navigation';
import AppShell from '@/components/phase15/AppShell';
import {apiClient,newIdempotencyKey} from '@/lib/phase15/apiClient';
import {haptic} from '@/lib/ux/haptics';

type Client={id:string;clientNumber:string;firstName:string;lastName:string;secondLastName?:string|null};
type Price={priceType:string;price?:number|string;amount?:number|string;isActive?:boolean};
type ProductImage={url:string;isPrimary?:boolean;isMain?:boolean};
type Product={id:string;sku:string;name:string;prices?:Price[];images?:ProductImage[]};
type SaleItem={productId:string;proposed:string;quantity:number};

const money=new Intl.NumberFormat('es-MX',{style:'currency',currency:'MXN'});
const num=(v:any)=>Number(v||0);
function priceOf(p:Product,type:string){const x=(p.prices||[]).find(v=>v.priceType===type&&v.isActive!==false);return num(x?.amount??x?.price);}
function listPrice(p:Product){return priceOf(p,'LIST')||priceOf(p,'LIST_PRICE')||priceOf(p,'CREDIT')||priceOf(p,'CASH')||num((p.prices||[]).find(x=>x.isActive!==false)?.amount??(p.prices||[]).find(x=>x.isActive!==false)?.price);}
function minPrice(p:Product){return priceOf(p,'MINIMUM_AUTHORIZED')||listPrice(p);}
function imageOf(p:Product){return (p.images||[]).find(i=>i.isPrimary||i.isMain)?.url||(p.images||[])[0]?.url||'';}
function dateAfter(days:number){const date=new Date();date.setDate(date.getDate()+days);return date.toISOString().slice(0,10);}

export default function NewSalePage(){
 const router=useRouter();
 const submittingRef=useRef(false),saleAttemptKeyRef=useRef('');
 const[clients,setClients]=useState<Client[]>([]),[products,setProducts]=useState<Product[]>([]),[loading,setLoading]=useState(true),[saving,setSaving]=useState(false),[error,setError]=useState(''),[clientId,setClientId]=useState(''),[items,setItems]=useState<SaleItem[]>([]),[saleType,setSaleType]=useState<'CASH'|'CREDIT'>('CREDIT'),[down,setDown]=useState(''),[weekly,setWeekly]=useState('100'),[firstPaymentDate,setFirstPaymentDate]=useState(dateAfter(7)),[result,setResult]=useState<any>(null),[role,setRole]=useState('');

 useEffect(()=>{
   try{
     const raw=localStorage.getItem('bitalis_auth_user');
     const u=raw?JSON.parse(raw):null;
     setRole(String(u?.role||'').toUpperCase());
     const preselected=new URLSearchParams(window.location.search).get('clientId');
     if(preselected)setClientId(preselected);
   }catch{}
   Promise.all([apiClient('/api/clients?page=1&limit=100'),apiClient('/api/products')])
     .then(([c,p]:any[])=>{setClients(c?.data||[]);setProducts(p?.products||[]);})
     .catch((e:any)=>setError(e.message))
     .finally(()=>setLoading(false));
 },[]);

 const detailed=useMemo(()=>items.map(i=>{
   const product=products.find(p=>p.id===i.productId)||null;
   const list=product?listPrice(product):0,min=product?minPrice(product):0,price=num(i.proposed||list),qty=Math.max(1,i.quantity);
   return{...i,product,list,min,price,qty,subtotal:price*qty,listSubtotal:list*qty,requiresAuth:!!product&&price<min};
 }),[items,products]);

 const totalList=detailed.reduce((a,i)=>a+i.listSubtotal,0);
 const totalProposed=detailed.reduce((a,i)=>a+i.subtotal,0);
 const priceDiscount=Math.max(0,totalList-totalProposed);
 const enganche=saleType==='CREDIT'?num(down):0;
 const aporte=saleType==='CREDIT'?Math.min(enganche,200):0;
 const commercialDiscount=enganche+aporte;
 const financed=saleType==='CREDIT'?Math.max(0,totalProposed-commercialDiscount):0;
 const cashTotal=saleType==='CASH'?totalProposed:0;
 const weeklyPayment=Math.max(100,num(weekly)||100);
 const estimatedWeeks=financed>0?Math.ceil(financed/weeklyPayment):0;
 const requiresAuth=detailed.some(i=>i.requiresAuth)||items.length===2;
 const finalTotal=saleType==='CREDIT'?financed:cashTotal;

 const addProduct=(p:Product)=>{haptic('tap');setItems(prev=>{const existing=prev.find(x=>x.productId===p.id);if(existing)return prev.map(x=>x.productId===p.id?{...x,quantity:x.quantity+1}:x);if(prev.length>=2)return prev;return[...prev,{productId:p.id,proposed:String(listPrice(p)),quantity:1}];});};
 const updateQty=(id:string,delta:number)=>{haptic('tap');setItems(prev=>prev.map(x=>x.productId===id?{...x,quantity:Math.max(1,x.quantity+delta)}:x));};
 const removeProduct=(id:string)=>{haptic('warning');setItems(prev=>prev.filter(x=>x.productId!==id));};
 const setProposed=(id:string,value:string)=>setItems(prev=>prev.map(x=>x.productId===id?{...x,proposed:value}:x));

 const submit=async()=>{
   if(submittingRef.current||saving)return;
   submittingRef.current=true;
   haptic('tap');
   if(!clientId||!detailed.length){setError('Selecciona cliente y al menos un producto.');submittingRef.current=false;return;}
   if(detailed.some(i=>!i.product||i.price<=0)){setError('Revisa los productos y precios.');submittingRef.current=false;return;}
   if(saleType==='CREDIT'&&commercialDiscount>totalProposed){setError('El enganche y aporte empresa no pueden superar el precio acordado.');submittingRef.current=false;return;}
   if(saleType==='CREDIT'&&!firstPaymentDate){setError('Selecciona la primera fecha de abono.');submittingRef.current=false;return;}
   if(requiresAuth&&role!=='SUPERVISORA'&&role!=='ADMIN'&&!confirm('Esta venta requiere autorización de supervisión. ¿Continuar?')){submittingRef.current=false;return;}
   setSaving(true);setError('');
   const key=saleAttemptKeyRef.current||newIdempotencyKey('sale');
   saleAttemptKeyRef.current=key;
   try{
     const j:any=await apiClient('/api/sales',{method:'POST',idempotencyKey:key,body:JSON.stringify({clientId,saleType,items:detailed.map(i=>({productId:i.product!.id,quantity:i.qty,unitPrice:i.list||i.price,negotiatedPrice:i.price,minimumAuthorizedPrice:i.min||i.price})),engancheCliente:enganche,paymentFrequency:'WEEKLY',installmentsCount:Math.max(1,estimatedWeeks),firstPaymentDate:`${firstPaymentDate}T12:00:00`,idempotencyKey:key})});
     if(saleType==='CREDIT'&&j?.status!=='PENDING_AUTHORIZATION'){await apiClient(`/api/sales/${j.id}/credit`,{method:'POST',idempotencyKey:`${key}-credit`,body:JSON.stringify({paymentFrequency:'WEEKLY',installmentsCount:Math.max(1,estimatedWeeks),firstPaymentDate:`${firstPaymentDate}T12:00:00`,idempotencyKey:`${key}-credit`})});j.firstPaymentDate=firstPaymentDate;}
     haptic('success');
     setResult(j);
     saleAttemptKeyRef.current='';
   }catch(e:any){haptic('error');setError(e.message);}finally{setSaving(false);submittingRef.current=false;}
 };

 return <AppShell title="Nueva venta"><main className="mx-auto max-w-4xl px-3 pb-36 pt-4 sm:px-4 sm:pb-8 sm:pt-5">
   <button onClick={()=>{haptic('tap');router.push('/sales');}} className="mb-3 flex min-h-11 touch-manipulation items-center gap-2 rounded-xl px-1 text-xs font-black text-[#12224A] active:scale-95"><ArrowLeft className="h-4 w-4"/>Ventas</button>
   <section className="rounded-[24px] bg-[#12224A] p-4 text-white sm:rounded-[28px] sm:p-5"><p className="text-[10px] font-black uppercase tracking-[.14em] text-[#C79A3B]">Venta en campo</p><h1 className="mt-2 text-2xl font-black">Nueva venta</h1><p className="mt-2 text-sm text-slate-300">Contado o pagos · máximo 2 productos · confirmación segura.</p></section>
   {error&&<div role="alert" className="mt-4 rounded-2xl border border-red-200 bg-red-50 p-4 text-sm font-bold text-red-700">{error}</div>}
   {result?<section className={`mt-4 rounded-3xl border p-5 sm:p-6 ${result?.status==='PENDING_AUTHORIZATION'?'border-amber-200 bg-amber-50':'border-emerald-200 bg-emerald-50'}`}>
     {result?.status==='PENDING_AUTHORIZATION'?<ShieldAlert className="h-7 w-7 text-amber-600"/>:<CheckCircle2 className="h-7 w-7 text-emerald-600"/>}
     <h2 className="mt-3 text-xl font-black text-[#12224A]">{result?.status==='PENDING_AUTHORIZATION'?'Venta pendiente de autorización':'Venta registrada'}</h2>
     <p className="mt-1 text-sm text-slate-600">{result?.saleNumber||result?.id}</p>
     {saleType==='CREDIT'&&result?.saldoFinanciado!=null&&<p className="mt-3 text-lg font-black text-[#12224A]">Saldo financiado confirmado: {money.format(num(result.saldoFinanciado))}</p>}
     <button onClick={()=>{haptic('tap');router.push(`/sales/${result?.id}`);}} className="mt-5 min-h-12 w-full touch-manipulation rounded-2xl bg-[#12224A] text-sm font-black text-white active:scale-[.98]">VER VENTA</button>
   </section>:loading?<div className="flex justify-center p-12"><Loader2 className="h-6 w-6 animate-spin"/></div>:<div className="mt-4 space-y-3 sm:space-y-4">
     <section className="rounded-[22px] border border-slate-200 bg-white p-3 sm:rounded-[24px] sm:p-4"><span className="flex items-center gap-2 text-xs font-black text-slate-500"><UserRound className="h-4 w-4"/>Cliente</span><select value={clientId} onChange={e=>{haptic('tap');setClientId(e.target.value);}} className="mt-2 min-h-12 w-full rounded-2xl border border-slate-200 bg-slate-50 px-3 text-sm sm:px-4"><option value="">Seleccionar cliente</option>{clients.map(c=><option key={c.id} value={c.id}>{c.firstName} {c.lastName} · {c.clientNumber}</option>)}</select></section>
     <section className="rounded-[22px] border border-slate-200 bg-white p-3 sm:rounded-[24px] sm:p-4"><p className="text-xs font-black text-slate-500">Tipo de venta</p><div className="mt-2 grid grid-cols-2 gap-2"><button type="button" onClick={()=>{haptic('tap');setSaleType('CASH');}} className={`min-h-13 touch-manipulation rounded-2xl text-sm font-black active:scale-[.98] ${saleType==='CASH'?'bg-[#12224A] text-white':'border border-slate-200 bg-slate-50 text-[#12224A]'}`}>CONTADO</button><button type="button" onClick={()=>{haptic('tap');setSaleType('CREDIT');}} className={`min-h-13 touch-manipulation rounded-2xl text-sm font-black active:scale-[.98] ${saleType==='CREDIT'?'bg-[#12224A] text-white':'border border-slate-200 bg-slate-50 text-[#12224A]'}`}>PAGOS</button></div></section>
     <section className="rounded-[22px] border border-slate-200 bg-white p-3 sm:rounded-[24px] sm:p-4"><div className="flex items-center justify-between gap-2"><span className="flex items-center gap-2 text-xs font-black text-slate-500"><Package className="h-4 w-4"/>Productos</span><span className="text-[9px] font-black text-slate-400 sm:text-[10px]">Máx. 2 diferentes</span></div><div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-3 sm:gap-3">{products.map(p=>{const img=imageOf(p),selected=items.find(i=>i.productId===p.id);return <button key={p.id} type="button" onClick={()=>addProduct(p)} className={`touch-manipulation overflow-hidden rounded-2xl border text-left transition active:scale-[.98] ${selected?'border-[#FF6A00] bg-orange-50 ring-2 ring-orange-100':'border-slate-200 bg-white'}`}>{img?<img src={img} alt={p.name} className="h-24 w-full object-cover sm:h-28"/>:<div className="flex h-24 items-center justify-center bg-slate-100 sm:h-28"><Package className="h-8 w-8 text-slate-300"/></div>}<div className="p-2.5 sm:p-3"><p className="line-clamp-2 min-h-8 text-xs font-black leading-4 text-[#12224A]">{p.name}</p><p className="mt-1 text-sm font-black text-[#FF6A00]">{money.format(listPrice(p))}</p>{selected&&<p className="mt-1 text-[9px] font-black text-emerald-700 sm:text-[10px]">En carrito · {selected.quantity}</p>}</div></button>;})}</div></section>
     {detailed.length>0&&<section className="rounded-[22px] border border-slate-200 bg-white p-3 sm:rounded-[24px] sm:p-4"><div className="flex items-center gap-2 text-xs font-black text-slate-500"><ShoppingCart className="h-4 w-4"/>Carrito · {detailed.reduce((s,i)=>s+i.qty,0)} artículo(s)</div><div className="mt-3 space-y-3">{detailed.map(item=><article key={item.productId} className="rounded-2xl bg-slate-50 p-3"><div className="flex gap-3">{item.product&&imageOf(item.product)?<img src={imageOf(item.product)} alt={item.product.name} className="h-16 w-16 rounded-xl object-cover"/>:<div className="flex h-16 w-16 items-center justify-center rounded-xl bg-white"><Package className="h-5 w-5 text-slate-300"/></div>}<div className="min-w-0 flex-1"><p className="truncate text-sm font-black text-[#12224A]">{item.product?.name}</p><p className="text-[10px] text-slate-500">Lista {money.format(item.list)} c/u</p><div className="mt-2 flex items-center gap-2"><button aria-label="Restar producto" type="button" onClick={()=>updateQty(item.productId,-1)} className="flex h-11 w-11 touch-manipulation items-center justify-center rounded-xl border border-slate-200 bg-white active:scale-90"><Minus className="h-4 w-4"/></button><span className="min-w-8 text-center text-base font-black">{item.qty}</span><button aria-label="Agregar producto" type="button" onClick={()=>updateQty(item.productId,1)} className="flex h-11 w-11 touch-manipulation items-center justify-center rounded-xl bg-[#12224A] text-white active:scale-90"><Plus className="h-4 w-4"/></button><button aria-label="Quitar producto" type="button" onClick={()=>removeProduct(item.productId)} className="ml-auto flex h-11 w-11 touch-manipulation items-center justify-center rounded-xl bg-red-50 text-red-600 active:scale-90"><Trash2 className="h-4 w-4"/></button></div></div></div><label className="mt-3 block"><span className="text-[10px] font-black uppercase text-slate-400">Precio acordado por unidad</span><input inputMode="decimal" value={item.proposed} onChange={e=>setProposed(item.productId,e.target.value)} className="mt-1 min-h-12 w-full rounded-xl border border-slate-200 bg-white px-3 text-lg font-black outline-none focus:border-[#FF6A00] focus:ring-2 focus:ring-orange-100"/></label><p className="mt-2 text-right text-xs font-black text-[#12224A]">Subtotal {money.format(item.subtotal)}</p>{item.requiresAuth&&role!=='SUPERVISORA'&&role!=='ADMIN'&&<p className="mt-1 text-[10px] font-bold text-amber-700">Precio debajo del mínimo: requiere supervisión.</p>}</article>)}</div></section>}
     {saleType==='CREDIT'&&<section className="rounded-[22px] border border-slate-200 bg-white p-3 sm:rounded-[24px] sm:p-4"><label className="block"><span className="text-xs font-black text-slate-500">Enganche del cliente</span><input inputMode="decimal" value={down} onChange={e=>setDown(e.target.value)} placeholder="0" className="mt-2 min-h-12 w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 text-lg font-black outline-none focus:border-[#FF6A00] focus:ring-2 focus:ring-orange-100"/></label><div className="mt-3"><p className="text-xs font-black text-slate-500">Pago semanal deseado</p><div className="mt-2 grid grid-cols-4 gap-2">{['100','150','200','300'].map(v=><button type="button" key={v} onClick={()=>{haptic('tap');setWeekly(v);}} className={`min-h-11 touch-manipulation rounded-xl text-xs font-black active:scale-95 ${weekly===v?'bg-[#12224A] text-white':'border border-slate-200 bg-slate-50'}`}>${v}</button>)}</div><input inputMode="decimal" value={weekly} onChange={e=>setWeekly(e.target.value)} className="mt-2 min-h-11 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 text-sm font-black"/><p className="mt-2 text-[11px] text-slate-500">Mínimo semanal: $100. Puede pagar más para terminar antes.</p></div><label className="mt-4 block"><span className="text-xs font-black text-slate-500">Primera fecha de abono *</span><input type="date" min={dateAfter(0)} value={firstPaymentDate} onChange={e=>setFirstPaymentDate(e.target.value)} className="mt-2 min-h-12 w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 text-sm font-black outline-none focus:border-[#FF6A00]"/></label><p className="mt-2 text-[11px] text-slate-500">Desde esta fecha se genera el calendario y el aviso de primer cobro.</p></section>}
     {detailed.length>0&&<section className="rounded-[22px] bg-slate-50 p-4 sm:rounded-[24px] sm:p-5"><Row label="Precio lista" value={totalList}/>{priceDiscount>0&&<Row label="Descuento por precio" value={-priceDiscount}/>}<Row label="Precio acordado" value={totalProposed} strong/>{saleType==='CREDIT'&&<><div className="my-3 border-t border-slate-200"/><Row label="Enganche cliente" value={-enganche}/><Row label="Aporte empresa" value={-aporte}/><Row label="DESCUENTO TOTAL" value={-commercialDiscount} strong/></>}<div className="mt-3 rounded-2xl bg-white p-4"><p className="text-[10px] font-black uppercase text-slate-400">{saleType==='CREDIT'?'SALDO FINANCIADO':'TOTAL CONTADO'}</p><p className="break-words text-3xl font-black text-[#12224A]">{money.format(finalTotal)}</p>{saleType==='CREDIT'&&<p className="mt-2 text-xs font-bold text-slate-500">Pago {money.format(weeklyPayment)} / semana · aprox. {estimatedWeeks} semanas</p>}</div>{saleType==='CREDIT'&&<p className="mt-3 text-[11px] leading-5 text-slate-500">La empresa iguala el enganche hasta $200: cliente $100 + empresa $100; cliente $200 + empresa $200; cliente $300 + empresa $200. El aporte empresa es descuento, no efectivo recibido.</p>}</section>}
     {requiresAuth&&role!=='SUPERVISORA'&&role!=='ADMIN'&&<div className="flex gap-3 rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm font-bold text-amber-800"><ShieldAlert className="h-5 w-5 shrink-0"/>La operación requiere autorización de supervisión.</div>}
     <button disabled={saving||!detailed.length} onClick={submit} className="hidden min-h-16 w-full touch-manipulation items-center justify-center rounded-2xl bg-[#FF6A00] text-base font-black text-white active:scale-[.99] disabled:opacity-50 sm:flex">{saving?<Loader2 className="h-5 w-5 animate-spin"/>:'CONFIRMAR VENTA'}</button>
   </div>}
   {!result&&!loading&&detailed.length>0&&<div className="fixed inset-x-0 bottom-[72px] z-40 px-3 sm:hidden"><div className="mx-auto max-w-4xl rounded-2xl border border-slate-200 bg-white/95 p-3 shadow-[0_-12px_35px_rgba(18,34,74,.16)] backdrop-blur"><div className="mb-2 flex items-center justify-between gap-3"><div className="min-w-0"><p className="text-[9px] font-black uppercase tracking-[.1em] text-slate-400">{saleType==='CREDIT'?'Saldo financiado':'Total contado'}</p><p className="truncate text-xl font-black text-[#12224A]">{money.format(finalTotal)}</p></div>{saleType==='CREDIT'&&<div className="text-right"><p className="text-[9px] font-black uppercase text-slate-400">Semanal</p><p className="text-sm font-black text-[#12224A]">{money.format(weeklyPayment)}</p></div>}</div><button disabled={saving||!clientId} onClick={submit} className="flex min-h-14 w-full touch-manipulation items-center justify-center rounded-2xl bg-[#FF6A00] text-sm font-black text-white shadow-lg shadow-orange-500/20 active:scale-[.98] disabled:opacity-50">{saving?<Loader2 className="h-5 w-5 animate-spin"/>:'CONFIRMAR VENTA'}</button></div></div>}
 </main></AppShell>;
}

function Row({label,value,strong=false}:{label:string;value:number;strong?:boolean}){return <div className={`flex justify-between gap-3 py-1.5 text-sm ${strong?'font-black text-[#12224A]':'text-slate-600'}`}><span>{label}</span><span className="font-black">{value<0?'-':''}{money.format(Math.abs(value))}</span></div>}
