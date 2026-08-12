'use client';

import {useEffect,useMemo,useState} from 'react';
import {ArrowLeft,CheckCircle2,Loader2,Minus,Package,Plus,ShieldAlert,ShoppingCart,Trash2,UserRound} from 'lucide-react';
import {useRouter} from 'next/navigation';
import AppShell from '@/components/phase15/AppShell';
import {apiClient,newIdempotencyKey} from '@/lib/phase15/apiClient';

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

export default function NewSalePage(){
 const router=useRouter();
 const[clients,setClients]=useState<Client[]>([]),[products,setProducts]=useState<Product[]>([]),[loading,setLoading]=useState(true),[saving,setSaving]=useState(false),[error,setError]=useState(''),[clientId,setClientId]=useState(''),[items,setItems]=useState<SaleItem[]>([]),[saleType,setSaleType]=useState<'CASH'|'CREDIT'>('CREDIT'),[down,setDown]=useState(''),[weekly,setWeekly]=useState('100'),[result,setResult]=useState<any>(null),[role,setRole]=useState('');

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
 const aporte=saleType==='CREDIT'?enganche:0;
 const commercialDiscount=enganche+aporte;
 const financed=saleType==='CREDIT'?Math.max(0,totalProposed-commercialDiscount):0;
 const cashTotal=saleType==='CASH'?totalProposed:0;
 const weeklyPayment=Math.max(100,num(weekly)||100);
 const estimatedWeeks=financed>0?Math.ceil(financed/weeklyPayment):0;
 const requiresAuth=detailed.some(i=>i.requiresAuth)||items.length===2;

 const addProduct=(p:Product)=>setItems(prev=>{const existing=prev.find(x=>x.productId===p.id);if(existing)return prev.map(x=>x.productId===p.id?{...x,quantity:x.quantity+1}:x);if(prev.length>=2)return prev;return[...prev,{productId:p.id,proposed:String(listPrice(p)),quantity:1}];});
 const updateQty=(id:string,delta:number)=>setItems(prev=>prev.map(x=>x.productId===id?{...x,quantity:Math.max(1,x.quantity+delta)}:x));
 const removeProduct=(id:string)=>setItems(prev=>prev.filter(x=>x.productId!==id));
 const setProposed=(id:string,value:string)=>setItems(prev=>prev.map(x=>x.productId===id?{...x,proposed:value}:x));

 const submit=async()=>{
   if(!clientId||!detailed.length){setError('Selecciona cliente y al menos un producto.');return;}
   if(detailed.some(i=>!i.product||i.price<=0)){setError('Revisa los productos y precios.');return;}
   if(saleType==='CREDIT'&&commercialDiscount>totalProposed){setError('El enganche y aporte empresa no pueden superar el precio acordado.');return;}
   if(requiresAuth&&role!=='SUPERVISORA'&&role!=='ADMIN'&&!confirm('Esta venta requiere autorización de supervisión. ¿Continuar?'))return;
   setSaving(true);setError('');
   const key=newIdempotencyKey('sale');
   try{
     const j:any=await apiClient('/api/sales',{method:'POST',idempotencyKey:key,body:JSON.stringify({clientId,saleType,items:detailed.map(i=>({productId:i.product!.id,quantity:i.qty,unitPrice:i.list||i.price,negotiatedPrice:i.price,minimumAuthorizedPrice:i.min||i.price})),engancheCliente:enganche,aporteEmpresaRatio:saleType==='CREDIT'?1:0,idempotencyKey:key})});
     setResult(j);
   }catch(e:any){setError(e.message);}finally{setSaving(false);}
 };

 return <AppShell title="Nueva venta"><main className="mx-auto max-w-4xl px-4 py-5">
   <button onClick={()=>router.push('/sales')} className="mb-3 flex min-h-11 items-center gap-2 text-xs font-black text-[#12224A]"><ArrowLeft className="h-4 w-4"/>Ventas</button>
   <section className="rounded-[28px] bg-[#12224A] p-5 text-white"><p className="text-[10px] font-black uppercase tracking-[.14em] text-[#C79A3B]">Venta en campo</p><h1 className="mt-2 text-2xl font-black">Nueva venta</h1><p className="mt-2 text-sm text-slate-300">Primero define contado o pagos. Después agrega productos como carrito.</p></section>
   {error&&<div role="alert" className="mt-4 rounded-2xl border border-red-200 bg-red-50 p-4 text-sm font-bold text-red-700">{error}</div>}
   {result?<section className={`mt-4 rounded-3xl border p-6 ${result?.status==='PENDING_AUTHORIZATION'?'border-amber-200 bg-amber-50':'border-emerald-200 bg-emerald-50'}`}>
     {result?.status==='PENDING_AUTHORIZATION'?<ShieldAlert className="h-7 w-7 text-amber-600"/>:<CheckCircle2 className="h-7 w-7 text-emerald-600"/>}
     <h2 className="mt-3 text-xl font-black text-[#12224A]">{result?.status==='PENDING_AUTHORIZATION'?'Venta pendiente de autorización':'Venta registrada'}</h2>
     <p className="mt-1 text-sm text-slate-600">{result?.saleNumber||result?.id}</p>
     {saleType==='CREDIT'&&result?.saldoFinanciado!=null&&<p className="mt-3 text-lg font-black text-[#12224A]">Saldo financiado confirmado: {money.format(num(result.saldoFinanciado))}</p>}
     <button onClick={()=>router.push(`/sales/${result?.id}`)} className="mt-5 min-h-12 w-full rounded-2xl bg-[#12224A] text-sm font-black text-white">VER VENTA</button>
   </section>:loading?<div className="flex justify-center p-12"><Loader2 className="h-6 w-6 animate-spin"/></div>:<div className="mt-4 space-y-4">
     <section className="rounded-[24px] border border-slate-200 bg-white p-4"><span className="flex items-center gap-2 text-xs font-black text-slate-500"><UserRound className="h-4 w-4"/>Cliente</span><select value={clientId} onChange={e=>setClientId(e.target.value)} className="mt-2 min-h-12 w-full rounded-2xl border border-slate-200 bg-slate-50 px-4"><option value="">Seleccionar cliente</option>{clients.map(c=><option key={c.id} value={c.id}>{c.firstName} {c.lastName} · {c.clientNumber}</option>)}</select></section>
     <section className="rounded-[24px] border border-slate-200 bg-white p-4"><p className="text-xs font-black text-slate-500">Tipo de venta</p><div className="mt-2 grid grid-cols-2 gap-2"><button type="button" onClick={()=>setSaleType('CASH')} className={`min-h-14 rounded-2xl text-sm font-black ${saleType==='CASH'?'bg-[#12224A] text-white':'border border-slate-200 bg-slate-50 text-[#12224A]'}`}>CONTADO</button><button type="button" onClick={()=>setSaleType('CREDIT')} className={`min-h-14 rounded-2xl text-sm font-black ${saleType==='CREDIT'?'bg-[#12224A] text-white':'border border-slate-200 bg-slate-50 text-[#12224A]'}`}>PAGOS</button></div></section>
     <section className="rounded-[24px] border border-slate-200 bg-white p-4"><div className="flex items-center justify-between"><span className="flex items-center gap-2 text-xs font-black text-slate-500"><Package className="h-4 w-4"/>Productos</span><span className="text-[10px] font-black text-slate-400">Máx. 2 diferentes</span></div><div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-3">{products.map(p=>{const img=imageOf(p),selected=items.find(i=>i.productId===p.id);return <button key={p.id} type="button" onClick={()=>addProduct(p)} className={`overflow-hidden rounded-2xl border text-left ${selected?'border-[#FF6A00] bg-orange-50':'border-slate-200 bg-white'}`}>{img?<img src={img} alt={p.name} className="h-28 w-full object-cover"/>:<div className="flex h-28 items-center justify-center bg-slate-100"><Package className="h-8 w-8 text-slate-300"/></div>}<div className="p-3"><p className="line-clamp-2 text-xs font-black text-[#12224A]">{p.name}</p><p className="mt-1 text-sm font-black text-[#FF6A00]">{money.format(listPrice(p))}</p>{selected&&<p className="mt-1 text-[10px] font-black text-emerald-700">En carrito · {selected.quantity}</p>}</div></button>;})}</div></section>
     {detailed.length>0&&<section className="rounded-[24px] border border-slate-200 bg-white p-4"><div className="flex items-center gap-2 text-xs font-black text-slate-500"><ShoppingCart className="h-4 w-4"/>Carrito</div><div className="mt-3 space-y-3">{detailed.map(item=><article key={item.productId} className="rounded-2xl bg-slate-50 p-3"><div className="flex gap-3">{item.product&&imageOf(item.product)?<img src={imageOf(item.product)} alt={item.product.name} className="h-16 w-16 rounded-xl object-cover"/>:<div className="flex h-16 w-16 items-center justify-center rounded-xl bg-white"><Package className="h-5 w-5 text-slate-300"/></div>}<div className="min-w-0 flex-1"><p className="truncate text-sm font-black text-[#12224A]">{item.product?.name}</p><p className="text-[10px] text-slate-500">Lista {money.format(item.list)} c/u</p><div className="mt-2 flex items-center gap-2"><button type="button" onClick={()=>updateQty(item.productId,-1)} className="flex h-9 w-9 items-center justify-center rounded-xl border border-slate-200 bg-white"><Minus className="h-4 w-4"/></button><span className="min-w-8 text-center text-sm font-black">{item.qty}</span><button type="button" onClick={()=>updateQty(item.productId,1)} className="flex h-9 w-9 items-center justify-center rounded-xl bg-[#12224A] text-white"><Plus className="h-4 w-4"/></button><button type="button" onClick={()=>removeProduct(item.productId)} className="ml-auto flex h-9 w-9 items-center justify-center rounded-xl bg-red-50 text-red-600"><Trash2 className="h-4 w-4"/></button></div></div></div><label className="mt-3 block"><span className="text-[10px] font-black uppercase text-slate-400">Precio acordado por unidad</span><input inputMode="decimal" value={item.proposed} onChange={e=>setProposed(item.productId,e.target.value)} className="mt-1 min-h-11 w-full rounded-xl border border-slate-200 bg-white px-3 text-base font-black"/></label><p className="mt-2 text-right text-xs font-black text-[#12224A]">Subtotal {money.format(item.subtotal)}</p>{item.requiresAuth&&role!=='SUPERVISORA'&&role!=='ADMIN'&&<p className="mt-1 text-[10px] font-bold text-amber-700">Precio debajo del mínimo: requiere supervisión.</p>}</article>)}</div></section>}
     {saleType==='CREDIT'&&<section className="rounded-[24px] border border-slate-200 bg-white p-4"><label className="block"><span className="text-xs font-black text-slate-500">Enganche del cliente</span><input inputMode="decimal" value={down} onChange={e=>setDown(e.target.value)} placeholder="0" className="mt-2 min-h-12 w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 text-lg font-black"/></label><div className="mt-3"><p className="text-xs font-black text-slate-500">Pago semanal deseado</p><div className="mt-2 grid grid-cols-4 gap-2">{['100','150','200','300'].map(v=><button type="button" key={v} onClick={()=>setWeekly(v)} className={`min-h-11 rounded-xl text-xs font-black ${weekly===v?'bg-[#12224A] text-white':'border border-slate-200 bg-slate-50'}`}>${v}</button>)}</div><input inputMode="decimal" value={weekly} onChange={e=>setWeekly(e.target.value)} className="mt-2 min-h-11 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 text-sm font-black"/><p className="mt-2 text-[11px] text-slate-500">Mínimo semanal: $100. Puede pagar más para terminar antes.</p></div></section>}
     {detailed.length>0&&<section className="rounded-[24px] bg-slate-50 p-5"><Row label="Precio lista" value={totalList}/>{priceDiscount>0&&<Row label="Descuento por precio" value={-priceDiscount}/>}<Row label="Precio acordado" value={totalProposed} strong/>{saleType==='CREDIT'&&<><div className="my-3 border-t border-slate-200"/><Row label="Enganche cliente" value={-enganche}/><Row label="Aporte empresa" value={-aporte}/><Row label="DESCUENTO TOTAL" value={-commercialDiscount} strong/></>}<div className="mt-3 rounded-2xl bg-white p-4"><p className="text-[10px] font-black uppercase text-slate-400">{saleType==='CREDIT'?'SALDO FINANCIADO':'TOTAL CONTADO'}</p><p className="text-3xl font-black text-[#12224A]">{money.format(saleType==='CREDIT'?financed:cashTotal)}</p>{saleType==='CREDIT'&&<p className="mt-2 text-xs font-bold text-slate-500">Pago {money.format(weeklyPayment)} / semana · aprox. {estimatedWeeks} semanas</p>}</div>{saleType==='CREDIT'&&<p className="mt-3 text-[11px] leading-5 text-slate-500">Ejemplo: $1,490 − $200 enganche − $200 aporte empresa = $1,090 financiado. El aporte empresa es descuento, no efectivo recibido.</p>}</section>}
     {requiresAuth&&role!=='SUPERVISORA'&&role!=='ADMIN'&&<div className="flex gap-3 rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm font-bold text-amber-800"><ShieldAlert className="h-5 w-5 shrink-0"/>La operación requiere autorización de supervisión.</div>}
     <button disabled={saving||!detailed.length} onClick={submit} className="flex min-h-16 w-full items-center justify-center rounded-2xl bg-[#FF6A00] text-base font-black text-white disabled:opacity-50">{saving?<Loader2 className="h-5 w-5 animate-spin"/>:'CONFIRMAR VENTA'}</button>
   </div>}
 </main></AppShell>;
}

function Row({label,value,strong=false}:{label:string;value:number;strong?:boolean}){return <div className={`flex justify-between gap-3 py-1.5 text-sm ${strong?'font-black text-[#12224A]':'text-slate-600'}`}><span>{label}</span><span className="font-black">{value<0?'-':''}{money.format(Math.abs(value))}</span></div>}
