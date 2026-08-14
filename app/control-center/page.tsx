'use client';

import {useEffect,useState} from 'react';
import {AlertTriangle,Boxes,ChartNoAxesCombined,Loader2,ReceiptText,ShieldAlert,Users,WalletCards} from 'lucide-react';
import AppShell from '@/components/phase15/AppShell';
import {apiClient} from '@/lib/phase15/apiClient';

const money=new Intl.NumberFormat('es-MX',{style:'currency',currency:'MXN'});

export default function ControlCenterPage(){
 const[data,setData]=useState<any>({}),[loading,setLoading]=useState(true),[error,setError]=useState('');
 useEffect(()=>{(async()=>{try{const [clients,sales,portfolio,inventory,notifications]=await Promise.allSettled([apiClient('/api/clients'),apiClient('/api/sales'),apiClient('/api/collections/portfolio'),apiClient('/api/inventory'),apiClient('/api/notifications')]);setData({clients:clients.status==='fulfilled'?clients.value:null,sales:sales.status==='fulfilled'?sales.value:null,portfolio:portfolio.status==='fulfilled'?portfolio.value:null,inventory:inventory.status==='fulfilled'?inventory.value:null,notifications:notifications.status==='fulfilled'?notifications.value:null});}catch(e:any){setError(e.message);}finally{setLoading(false);}})();},[]);
 const clients=Array.isArray(data.clients?.data)?data.clients.data:Array.isArray(data.clients?.clients)?data.clients.clients:[];
 const sales=Array.isArray(data.sales?.data)?data.sales.data:Array.isArray(data.sales?.sales)?data.sales.sales:[];
 const portfolio=Array.isArray(data.portfolio?.data)?data.portfolio.data:[];
 const inv=Array.isArray(data.inventory?.data)?data.inventory.data:Array.isArray(data.inventory?.inventory)?data.inventory.inventory:[];
 const alerts=Array.isArray(data.notifications?.data)?data.notifications.data:Array.isArray(data.notifications?.notifications)?data.notifications.notifications:[];
 const cartera=portfolio.reduce((s:number,x:any)=>s+Number(x.saldoActual||0),0);
 const critical=portfolio.filter((x:any)=>['HIGH','CRITICAL'].includes(String(x.client?.riskLevel||''))).length;
 return <AppShell title="Centro de control"><div className="mx-auto max-w-7xl px-3 py-3 sm:px-4 sm:py-5">
  <section className="rounded-[24px] bg-[#12224A] p-4 text-white sm:rounded-[30px] sm:p-6"><div className="flex items-center gap-2 text-[10px] font-black uppercase tracking-[.14em] text-[#C79A3B]"><ChartNoAxesCombined className="h-4 w-4"/>Operación</div><h1 className="mt-2 text-xl font-black sm:mt-3 sm:text-3xl">Centro de control</h1><p className="mt-1 text-xs leading-5 text-slate-300 sm:mt-2 sm:max-w-2xl sm:text-sm">Ventas, cobranza, cartera, stock y alertas en un solo lugar.</p></section>
  {error&&<div className="mt-3 rounded-2xl border border-red-200 bg-red-50 p-3 text-sm font-bold text-red-700 sm:mt-4 sm:p-4">{error}</div>}
  {loading?<div className="flex justify-center p-12 sm:p-16"><Loader2 className="h-7 w-7 animate-spin text-[#12224A]"/></div>:<>
   <section className="mt-3 grid grid-cols-2 gap-2 sm:mt-5 sm:gap-3 lg:grid-cols-5">{[[Users,'Clientes',clients.length],[ReceiptText,'Ventas',sales.length],[WalletCards,'Cartera',money.format(cartera)],[ShieldAlert,'Riesgo alto',critical],[AlertTriangle,'Alertas',alerts.length]].map(([Icon,label,value]:any)=><div key={label} className="rounded-2xl border border-slate-200 bg-white p-3 shadow-sm sm:rounded-3xl sm:p-4"><Icon className="h-4 w-4 text-[#C79A3B] sm:h-5 sm:w-5"/><p className="mt-2 text-[9px] font-black uppercase tracking-[.1em] text-slate-400 sm:mt-3 sm:text-[10px] sm:tracking-[.12em]">{label}</p><p className="mt-1 break-words text-base font-black text-[#12224A] sm:text-xl">{value}</p></div>)}</section>
   <section className="mt-3 grid gap-3 sm:mt-5 sm:gap-4 lg:grid-cols-2">
    <article className="rounded-2xl border border-slate-200 bg-white p-4 sm:rounded-3xl sm:p-5"><h2 className="font-black text-[#12224A]">Riesgo de cobranza</h2><div className="mt-3 space-y-2 sm:mt-4">{portfolio.slice(0,8).map((x:any)=><div key={x.id} className="flex items-center justify-between gap-3 rounded-xl bg-slate-50 p-3 sm:rounded-2xl"><div className="min-w-0"><p className="truncate text-sm font-black">{x.client?.firstName} {x.client?.lastName}</p><p className="text-[10px] text-slate-500">{x.client?.riskLevel||'LOW'}</p></div><b className="shrink-0 text-xs text-[#12224A] sm:text-sm">{money.format(Number(x.saldoActual||0))}</b></div>)}{!portfolio.length&&<p className="text-sm text-slate-500">Sin cartera activa.</p>}</div></article>
    <article className="rounded-2xl border border-slate-200 bg-white p-4 sm:rounded-3xl sm:p-5"><div className="flex items-center gap-2"><Boxes className="h-5 w-5 text-[#C79A3B]"/><h2 className="font-black text-[#12224A]">Stock</h2></div><div className="mt-3 space-y-2 sm:mt-4">{inv.slice(0,8).map((x:any,i:number)=><div key={x.id||i} className="flex items-center justify-between gap-3 rounded-xl bg-slate-50 p-3 sm:rounded-2xl"><div className="min-w-0"><p className="truncate text-sm font-black">{x.product?.name||x.name||x.sku||'Producto'}</p><p className="truncate text-[10px] text-slate-500">{x.product?.sku||x.sku||''}</p></div><b className="shrink-0 text-sm text-[#12224A]">{x.availableQuantity??x.available??x.quantity??0}</b></div>)}{!inv.length&&<p className="text-sm text-slate-500">Sin datos de stock disponibles.</p>}</div></article>
   </section>
  </>}
 </div></AppShell>;
}
