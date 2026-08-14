'use client';

import {useEffect,useState} from 'react';
import {CheckCircle2,Loader2,ShieldCheck,XCircle} from 'lucide-react';
import AppShell from '@/components/phase15/AppShell';
import {apiClient} from '@/lib/phase15/apiClient';

type Item={id:string;type:string;status:string;reason?:string|null;createdAt:string;proposedPrice?:number|null;minimumPrice?:number|null;sale?:{saleNumber:string;client?:{firstName:string;lastName:string;clientNumber:string}};product?:{name:string;sku:string}};
const typeLabel=(value:string)=>value.replaceAll('_',' ').toLowerCase().replace(/(^|\s)\S/g,m=>m.toUpperCase());

export default function AuthorizationsPage(){
 const[items,setItems]=useState<Item[]>([]),[loading,setLoading]=useState(true),[busy,setBusy]=useState(''),[error,setError]=useState('');
 const load=async()=>{setLoading(true);try{const j:any=await apiClient('/api/authorizations');setItems(j?.data||[]);}catch(e:any){setError(e.message);}finally{setLoading(false);}};
 useEffect(()=>{load();},[]);
 const decide=async(id:string,decision:'APPROVED'|'REJECTED')=>{if(!confirm(decision==='APPROVED'?'¿Aprobar esta solicitud?':'¿Rechazar esta solicitud?'))return;setBusy(id);try{await apiClient(`/api/authorizations/${id}`,{method:'PATCH',body:JSON.stringify({decision})});await load();}catch(e:any){setError(e.message);}finally{setBusy('');}};
 const pending=items.filter(x=>x.status==='PENDING');
 return <AppShell title="Autorizaciones"><div className="mx-auto max-w-6xl px-3 py-3 sm:px-4 sm:py-5">
  <section className="rounded-[24px] bg-[#12224A] p-4 text-white sm:rounded-[28px] sm:p-5"><div className="flex items-center gap-2 text-[10px] font-black uppercase tracking-[.14em] text-[#C79A3B]"><ShieldCheck className="h-4 w-4"/>Supervisión</div><h1 className="mt-2 text-xl font-black sm:mt-3 sm:text-2xl">Pendientes de autorización</h1><p className="mt-1 text-xs leading-5 text-slate-300 sm:mt-2 sm:text-sm">Revisa excepciones de precio, crédito, enganche y operaciones especiales.</p></section>
  {error&&<div className="mt-3 rounded-2xl border border-red-200 bg-red-50 p-3 text-sm font-bold text-red-700 sm:mt-4 sm:p-4">{error}</div>}
  {loading?<div className="mt-3 flex justify-center p-10 sm:mt-5"><Loader2 className="h-6 w-6 animate-spin text-[#12224A]"/></div>:<div className="mt-3 space-y-2 sm:mt-5 sm:space-y-3">{pending.length===0?<div className="rounded-2xl border border-slate-200 bg-white p-8 text-center text-sm text-slate-500 sm:rounded-3xl">No hay autorizaciones pendientes.</div>:pending.map(x=><article key={x.id} className="rounded-2xl border border-slate-200 bg-white p-3 shadow-sm sm:rounded-3xl sm:p-4"><div className="min-w-0"><span className="inline-flex max-w-full rounded-full bg-orange-50 px-2.5 py-1 text-[9px] font-black text-[#FF6A00]">{typeLabel(x.type)}</span><h2 className="mt-2 truncate text-base font-black text-[#12224A] sm:mt-3 sm:text-lg">{x.sale?.client?`${x.sale.client.firstName} ${x.sale.client.lastName}`:x.product?.name||'Solicitud'}</h2><p className="mt-1 text-[10px] text-slate-500 sm:text-xs">{x.sale?.saleNumber||x.product?.sku||''}{(x.sale?.saleNumber||x.product?.sku)&&' · '}{new Date(x.createdAt).toLocaleString('es-MX')}</p>{x.reason&&<p className="mt-2 text-xs leading-5 text-slate-600 sm:mt-3 sm:text-sm">{x.reason}</p>}{x.proposedPrice!=null&&<p className="mt-2 text-xs font-bold sm:text-sm">Propuesto ${x.proposedPrice.toLocaleString('es-MX')} {x.minimumPrice!=null&&<span className="text-slate-400">· mínimo ${x.minimumPrice.toLocaleString('es-MX')}</span>}</p>}</div><div className="mt-3 grid grid-cols-2 gap-2"><button disabled={busy===x.id} onClick={()=>decide(x.id,'REJECTED')} className="flex min-h-11 items-center justify-center gap-2 rounded-xl border border-red-200 bg-red-50 px-3 text-[10px] font-black text-red-700 sm:min-h-12 sm:rounded-2xl sm:px-4 sm:text-xs"><XCircle className="h-4 w-4"/>Rechazar</button><button disabled={busy===x.id} onClick={()=>decide(x.id,'APPROVED')} className="flex min-h-11 items-center justify-center gap-2 rounded-xl bg-emerald-600 px-3 text-[10px] font-black text-white sm:min-h-12 sm:rounded-2xl sm:px-4 sm:text-xs">{busy===x.id?<Loader2 className="h-4 w-4 animate-spin"/>:<CheckCircle2 className="h-4 w-4"/>}Aprobar</button></div></article>)}</div>}
 </div></AppShell>;
}
