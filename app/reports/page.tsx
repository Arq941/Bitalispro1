'use client';

import {useEffect,useMemo,useState} from 'react';
import {BarChart3,Loader2,ShieldAlert,ShoppingBag,Users,WalletCards} from 'lucide-react';
import AppShell from '@/components/phase15/AppShell';
import {apiClient} from '@/lib/phase15/apiClient';

const money=new Intl.NumberFormat('es-MX',{style:'currency',currency:'MXN'});
const riskLabel:Record<string,string>={LOW:'Bajo',MEDIUM:'Medio',HIGH:'Alto',CRITICAL:'Crítico'};

export default function ReportsPage(){
 const[sales,setSales]=useState<any[]>([]),[portfolio,setPortfolio]=useState<any[]>([]),[clients,setClients]=useState<any[]>([]),[loading,setLoading]=useState(true),[error,setError]=useState('');
 useEffect(()=>{(async()=>{try{const [s,p,c]:any[]=await Promise.all([apiClient('/api/sales'),apiClient('/api/collections/portfolio'),apiClient('/api/clients?page=1&limit=200')]);setSales(s?.sales||s?.data||[]);setPortfolio(p?.data||[]);setClients(c?.data||[]);}catch(e:any){setError(e.message);}finally{setLoading(false);}})();},[]);
 const totals=useMemo(()=>({sales:sales.reduce((n,x)=>n+Number(x.totalAmount||0),0),cartera:portfolio.reduce((n,x)=>n+Number(x.saldoActual||0),0),critical:portfolio.filter(x=>['HIGH','CRITICAL'].includes(String(x.client?.riskLevel||''))).length}),[sales,portfolio]);
 return <AppShell title="Reportes"><div className="mx-auto max-w-7xl px-3 py-3 sm:px-4 sm:py-5">
  <section className="rounded-[24px] bg-[#12224A] p-4 text-white sm:rounded-[28px] sm:p-5"><div className="flex items-center gap-2 text-[10px] font-black uppercase tracking-[.14em] text-[#C79A3B]"><BarChart3 className="h-4 w-4"/>Resumen</div><h1 className="mt-2 text-xl font-black sm:mt-3 sm:text-2xl">Reportes operativos</h1><p className="mt-1 text-xs leading-5 text-slate-300 sm:mt-2 sm:text-sm">Ventas, cartera, clientes y riesgo en una sola vista.</p></section>
  {error&&<div className="mt-3 rounded-2xl border border-red-200 bg-red-50 p-3 text-sm font-bold text-red-700 sm:mt-4 sm:p-4">{error}</div>}
  {loading?<div className="flex justify-center p-12 sm:p-14"><Loader2 className="h-7 w-7 animate-spin text-[#12224A]"/></div>:<>
   <section className="mt-3 grid grid-cols-2 gap-2 sm:mt-5 sm:gap-3 lg:grid-cols-4">{[[ShoppingBag,'Ventas',money.format(totals.sales)],[WalletCards,'Cartera',money.format(totals.cartera)],[Users,'Clientes',clients.length],[ShieldAlert,'Riesgo alto',totals.critical]].map(([I,l,v]:any)=><div key={l} className="rounded-2xl border border-slate-200 bg-white p-3 sm:rounded-3xl sm:p-4"><I className="h-4 w-4 text-[#C79A3B] sm:h-5 sm:w-5"/><p className="mt-2 text-[9px] font-black uppercase text-slate-400 sm:mt-3 sm:text-[10px]">{l}</p><p className="mt-1 break-words text-base font-black text-[#12224A] sm:text-xl">{v}</p></div>)}</section>
   <section className="mt-3 rounded-2xl border border-slate-200 bg-white p-4 sm:mt-5 sm:rounded-3xl sm:p-5"><h2 className="font-black text-[#12224A]">Cartera por nivel de riesgo</h2><div className="mt-3 grid grid-cols-2 gap-2 sm:mt-4 sm:grid-cols-4 sm:gap-3">{['LOW','MEDIUM','HIGH','CRITICAL'].map(r=>{const rows=portfolio.filter(x=>String(x.client?.riskLevel||'LOW')===r);return <div key={r} className="rounded-xl bg-slate-50 p-3 sm:rounded-2xl sm:p-4"><p className="text-[9px] font-black text-slate-400 sm:text-[10px]">{riskLabel[r]}</p><p className="mt-1 text-base font-black text-[#12224A] sm:text-lg">{rows.length}</p><p className="text-[11px] text-slate-500 sm:text-xs">{money.format(rows.reduce((s,x)=>s+Number(x.saldoActual||0),0))}</p></div>})}</div></section>
  </>}
 </div></AppShell>;
}
