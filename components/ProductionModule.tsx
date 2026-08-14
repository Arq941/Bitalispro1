'use client';

import {useCallback,useEffect,useMemo,useState} from 'react';
import {useRouter} from 'next/navigation';
import {Database,Loader2,RefreshCw,Search,ShieldCheck} from 'lucide-react';
import AppShell from '@/components/phase15/AppShell';

type Props={title:string;subtitle:string;endpoint:string;dataKeys?:string[];emptyText?:string};

function getRecords(payload:any,keys:string[]){
  for(const key of keys){
    if(Array.isArray(payload?.[key])) return payload[key];
    if(Array.isArray(payload?.data?.[key])) return payload.data[key];
  }
  if(Array.isArray(payload?.data)) return payload.data;
  if(Array.isArray(payload)) return payload;
  if(payload?.dashboard&&typeof payload.dashboard==='object') return Object.entries(payload.dashboard).map(([key,value])=>({metric:key,value}));
  if(payload?.data&&typeof payload.data==='object') return [payload.data];
  if(payload&&typeof payload==='object') return [payload];
  return [];
}

function valueText(value:any){
  if(value==null) return '—';
  if(typeof value==='object') return JSON.stringify(value);
  return String(value);
}

function fieldLabel(key:string){
 const labels:Record<string,string>={status:'Estado',name:'Nombre',title:'Título',number:'Número',folio:'Folio',sku:'SKU',metric:'Indicador',amount:'Importe',total:'Total',createdAt:'Fecha',updatedAt:'Actualizado',email:'Correo',phone:'Teléfono',role:'Rol',type:'Tipo',priority:'Prioridad'};
 return labels[key]||key.replace(/([a-z])([A-Z])/g,'$1 $2').replaceAll('_',' ');
}

export default function ProductionModule({title,subtitle,endpoint,dataKeys=[],emptyText='Sin registros por mostrar.'}:Props){
  const router=useRouter();
  const[records,setRecords]=useState<any[]>([]),[loading,setLoading]=useState(true),[error,setError]=useState(''),[search,setSearch]=useState('');

  const load=useCallback(async()=>{
    const token=localStorage.getItem('bitalis_access_token');
    const rawUser=localStorage.getItem('bitalis_auth_user');
    if(!token||!rawUser){router.replace('/');return;}
    setLoading(true);setError('');
    try{
      let resolvedEndpoint=endpoint;
      if(endpoint.includes('{userId}')){
        const user=JSON.parse(rawUser);
        resolvedEndpoint=endpoint.replace('{userId}',encodeURIComponent(user?.id||''));
      }
      const response=await fetch(resolvedEndpoint,{headers:{Authorization:`Bearer ${token}`},cache:'no-store'});
      if(response.status===401){
        localStorage.removeItem('bitalis_access_token');localStorage.removeItem('bitalis_refresh_token');localStorage.removeItem('bitalis_auth_user');router.replace('/');return;
      }
      const json=await response.json().catch(()=>({}));
      if(!response.ok) throw new Error(json?.error||json?.message||`Error ${response.status}`);
      setRecords(getRecords(json,dataKeys));
    }catch(err:any){setError(err?.message||'No fue posible cargar este módulo.');setRecords([]);}finally{setLoading(false);}
  },[dataKeys,endpoint,router]);

  useEffect(()=>{load();},[load]);
  const filtered=useMemo(()=>{const query=search.trim().toLowerCase();return query?records.filter(record=>JSON.stringify(record).toLowerCase().includes(query)):records;},[records,search]);

  return <AppShell title={title}><div className="mx-auto max-w-7xl px-3 py-3 sm:px-4 sm:py-5">
    <section className="rounded-[24px] bg-[#12224A] p-4 text-white shadow-lg shadow-slate-900/10 sm:rounded-[28px] sm:p-6">
      <div className="flex items-start justify-between gap-3"><div className="min-w-0"><div className="flex items-center gap-2 text-[10px] font-black uppercase tracking-[.14em] text-[#C79A3B]"><ShieldCheck className="h-4 w-4"/>BITALIS</div><h1 className="mt-2 text-xl font-black sm:mt-3 sm:text-3xl">{title}</h1><p className="mt-1 max-w-3xl text-xs leading-5 text-slate-300 sm:mt-2 sm:text-sm">{subtitle}</p></div><button onClick={load} disabled={loading} className="flex min-h-10 shrink-0 touch-manipulation items-center gap-2 rounded-xl bg-white/10 px-3 text-[10px] font-black text-white active:scale-95 disabled:opacity-50 sm:min-h-11 sm:rounded-2xl sm:text-xs" aria-label="Actualizar"><RefreshCw className={`h-4 w-4 ${loading?'animate-spin':''}`}/><span className="hidden min-[390px]:inline">Actualizar</span></button></div>
    </section>

    <section className="mt-3 grid grid-cols-2 gap-2 sm:mt-4 sm:grid-cols-3 sm:gap-3">
      <div className="rounded-2xl border border-slate-200 bg-white p-3 shadow-sm sm:rounded-3xl sm:p-4"><p className="text-[9px] font-black uppercase tracking-[.1em] text-slate-400">Registros</p><p className="mt-1 text-xl font-black text-[#12224A] sm:mt-2 sm:text-2xl">{loading?'—':records.length}</p></div>
      <div className="rounded-2xl border border-slate-200 bg-white p-3 shadow-sm sm:rounded-3xl sm:p-4"><p className="text-[9px] font-black uppercase tracking-[.1em] text-slate-400">Sincronización</p><p className="mt-1 text-sm font-black text-[#00A86B] sm:mt-2">En línea</p></div>
      <div className="col-span-2 rounded-2xl border border-slate-200 bg-white p-3 shadow-sm sm:col-span-1 sm:rounded-3xl sm:p-4"><p className="text-[9px] font-black uppercase tracking-[.1em] text-slate-400">Estado</p><p className={`mt-1 text-sm font-black sm:mt-2 ${error?'text-amber-700':'text-[#12224A]'}`}>{error?'Revisar':'Disponible'}</p></div>
    </section>

    {error&&<div className="mt-3 rounded-2xl border border-amber-200 bg-amber-50 p-3 text-sm font-bold leading-5 text-amber-800 sm:mt-4">{error}</div>}
    <div className="relative mt-3 sm:mt-4"><Search className="absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400"/><input value={search} onChange={event=>setSearch(event.target.value)} placeholder="Buscar" className="min-h-11 w-full rounded-2xl border border-slate-200 bg-white pl-11 pr-4 text-sm text-[#2B2B2B] shadow-sm outline-none focus:border-[#00A86B] focus:ring-4 focus:ring-[#00A86B]/10 sm:min-h-12"/></div>

    <section className="mt-3 overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm sm:rounded-3xl">
      {loading?<div className="flex items-center justify-center gap-2 px-5 py-12 text-sm font-bold text-slate-500 sm:py-14"><Loader2 className="h-5 w-5 animate-spin"/>Cargando...</div>:filtered.length===0?<div className="flex flex-col items-center justify-center gap-3 px-5 py-12 text-center text-sm text-slate-500 sm:py-14"><Database className="h-8 w-8 text-slate-300"/>{emptyText}</div>:<div className="divide-y divide-slate-100">{filtered.map((record,index)=>{
        const entries=Object.entries(record||{}).filter(([,value])=>typeof value!=='object'||value==null).slice(0,7);
        const titleEntry=entries.find(([key])=>/name|number|folio|title|metric|sku|status/i.test(key))||entries[0];
        return <article key={record?.id||index} className="p-3 sm:p-5"><p className="break-words text-sm font-black text-[#12224A]">{titleEntry?valueText(titleEntry[1]):`Registro ${index+1}`}</p><div className="mt-2 flex flex-wrap gap-1.5">{entries.slice(0,5).map(([key,value])=><span key={key} className="max-w-full break-words rounded-xl bg-slate-50 px-2.5 py-1.5 text-[10px] leading-4 text-slate-600"><strong className="capitalize text-slate-400">{fieldLabel(key)}:</strong> {valueText(value).slice(0,80)}</span>)}</div></article>;
      })}</div>}
    </section>
  </div></AppShell>;
}
