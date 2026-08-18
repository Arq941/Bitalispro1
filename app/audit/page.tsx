'use client';

import {useCallback,useEffect,useMemo,useState} from 'react';
import {ChevronDown,Clock3,Download,Filter,Loader2,RefreshCw,Search,ShieldCheck} from 'lucide-react';
import AppShell from '@/components/phase15/AppShell';
import {apiClient} from '@/lib/phase15/apiClient';

const userName=(x:any)=>x.user?([x.user.firstName,x.user.lastName].filter(Boolean).join(' ')||x.user.email):'Sistema';
const jsonText=(value:any)=>{
  if(value===null||value===undefined||value==='')return 'Sin información';
  try{const parsed=typeof value==='string'?JSON.parse(value):value;return JSON.stringify(parsed,null,2);}catch{return String(value);}
};
const csvCell=(value:any)=>`"${String(value??'').replace(/"/g,'""')}"`;

function ValueBox({label,value}:{label:string;value:any}){
  return <div className="rounded-2xl border border-slate-200 bg-slate-50 p-3"><p className="mb-2 text-[10px] font-black uppercase tracking-wider text-slate-500">{label}</p><pre className="max-h-64 overflow-auto whitespace-pre-wrap break-all text-[11px] leading-5 text-slate-700">{jsonText(value)}</pre></div>;
}

export default function AuditPage(){
  const[logs,setLogs]=useState<any[]>([]);
  const[loading,setLoading]=useState(true);
  const[error,setError]=useState('');
  const[query,setQuery]=useState('');
  const[from,setFrom]=useState('');
  const[to,setTo]=useState('');
  const[action,setAction]=useState('');
  const[entity,setEntity]=useState('');
  const[userId,setUserId]=useState('');
  const[expanded,setExpanded]=useState<string|null>(null);

  const load=useCallback(async()=>{
    setLoading(true);setError('');
    try{const j:any=await apiClient('/api/audit?limit=500');setLogs(j?.data||[]);}
    catch(e:any){setError(e.message||'No pudimos cargar la auditoría.');}
    finally{setLoading(false);}
  },[]);
  useEffect(()=>{load();},[load]);

  const actions=useMemo(()=>Array.from(new Set(logs.map(x=>x.action).filter(Boolean))).sort(),[logs]);
  const entities=useMemo(()=>Array.from(new Set(logs.map(x=>x.entity).filter(Boolean))).sort(),[logs]);
  const users=useMemo(()=>{
    const map=new Map<string,string>();
    logs.forEach(x=>{if(x.user?.id)map.set(x.user.id,userName(x));});
    return Array.from(map.entries()).sort((a,b)=>a[1].localeCompare(b[1]));
  },[logs]);

  const filtered=useMemo(()=>logs.filter(x=>{
    const created=new Date(x.createdAt);
    const haystack=[x.action,x.entity,x.entityId,userName(x),x.user?.email,x.user?.role,x.ipAddress].filter(Boolean).join(' ').toLowerCase();
    return(!query||haystack.includes(query.toLowerCase()))&&(!from||created>=new Date(from+'T00:00:00'))&&(!to||created<=new Date(to+'T23:59:59.999'))&&(!action||x.action===action)&&(!entity||x.entity===entity)&&(!userId||x.user?.id===userId);
  }),[logs,query,from,to,action,entity,userId]);

  const clearFilters=()=>{setQuery('');setFrom('');setTo('');setAction('');setEntity('');setUserId('');};
  const exportCsv=()=>{
    const header=['Fecha','Usuario','Correo','Rol','Acción','Módulo/Entidad','Registro','IP','Valor anterior','Valor nuevo'];
    const rows=filtered.map(x=>[new Date(x.createdAt).toLocaleString('es-MX'),userName(x),x.user?.email||'',x.user?.role||'SYSTEM',x.action,x.entity,x.entityId,x.ipAddress||'',jsonText(x.oldValues),jsonText(x.newValues)]);
    const csv='\uFEFF'+[header,...rows].map(row=>row.map(csvCell).join(',')).join('\n');
    const url=URL.createObjectURL(new Blob([csv],{type:'text/csv;charset=utf-8'}));
    const a=document.createElement('a');a.href=url;a.download=`auditoria-${new Date().toISOString().slice(0,10)}.csv`;a.click();URL.revokeObjectURL(url);
  };

  return <AppShell title="Auditoría 360"><div className="mx-auto max-w-7xl px-4 py-5">
    <section className="rounded-[28px] bg-[#12224A] p-5 text-white">
      <div className="flex items-center gap-2 text-xs font-black uppercase tracking-[.14em] text-[#C79A3B]"><ShieldCheck className="h-4 w-4"/>Solo lectura</div>
      <div className="mt-3 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between"><div><h1 className="text-2xl font-black">Auditoría 360</h1><p className="mt-2 text-sm text-slate-300">Rastrea acciones operativas y financieras sin alterar el historial.</p></div><div className="flex gap-2"><button onClick={load} disabled={loading} className="flex items-center gap-2 rounded-2xl border border-white/20 px-3 py-2 text-xs font-black disabled:opacity-50"><RefreshCw className={`h-4 w-4 ${loading?'animate-spin':''}`}/>Actualizar</button><button onClick={exportCsv} disabled={!filtered.length} className="flex items-center gap-2 rounded-2xl bg-[#C79A3B] px-3 py-2 text-xs font-black text-[#12224A] disabled:opacity-50"><Download className="h-4 w-4"/>Exportar CSV</button></div></div>
    </section>

    <section className="mt-4 rounded-3xl border border-slate-200 bg-white p-4 shadow-sm">
      <div className="mb-3 flex items-center justify-between"><div className="flex items-center gap-2 text-xs font-black uppercase tracking-wider text-[#12224A]"><Filter className="h-4 w-4"/>Filtros</div><button onClick={clearFilters} className="text-xs font-black text-[#B7791F]">Limpiar</button></div>
      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
        <label className="relative xl:col-span-2"><Search className="absolute left-3 top-3 h-4 w-4 text-slate-400"/><input value={query} onChange={e=>setQuery(e.target.value)} placeholder="Buscar usuario, acción, registro o IP" className="w-full rounded-2xl border border-slate-200 py-2.5 pl-10 pr-3 text-sm outline-none focus:border-[#C79A3B]"/></label>
        <label className="text-[10px] font-black uppercase text-slate-500">Desde<input type="date" value={from} onChange={e=>setFrom(e.target.value)} className="mt-1 block w-full rounded-2xl border border-slate-200 px-3 py-2 text-sm font-medium text-slate-700"/></label>
        <label className="text-[10px] font-black uppercase text-slate-500">Hasta<input type="date" value={to} onChange={e=>setTo(e.target.value)} className="mt-1 block w-full rounded-2xl border border-slate-200 px-3 py-2 text-sm font-medium text-slate-700"/></label>
        <select value={action} onChange={e=>setAction(e.target.value)} className="rounded-2xl border border-slate-200 px-3 py-2.5 text-sm"><option value="">Todas las acciones</option>{actions.map(x=><option key={x} value={x}>{x}</option>)}</select>
        <select value={entity} onChange={e=>setEntity(e.target.value)} className="rounded-2xl border border-slate-200 px-3 py-2.5 text-sm"><option value="">Todos los módulos</option>{entities.map(x=><option key={x} value={x}>{x}</option>)}</select>
        <select value={userId} onChange={e=>setUserId(e.target.value)} className="rounded-2xl border border-slate-200 px-3 py-2.5 text-sm md:col-span-2"><option value="">Todos los usuarios</option>{users.map(([id,name])=><option key={id} value={id}>{name}</option>)}</select>
      </div>
    </section>

    {error&&<div className="mt-4 rounded-2xl border border-red-200 bg-red-50 p-4 text-sm font-bold text-red-700">{error}</div>}
    {loading?<div className="flex justify-center p-14"><Loader2 className="h-7 w-7 animate-spin text-[#12224A]"/></div>:<div className="mt-5">
      <div className="mb-3 flex items-center justify-between text-xs font-bold text-slate-500"><span>{filtered.length} de {logs.length} eventos</span><span>Máximo 500 recientes</span></div>
      <div className="space-y-3">{filtered.map((x:any)=><article key={x.id} className="rounded-3xl border border-slate-200 bg-white p-4 shadow-sm">
        <button onClick={()=>setExpanded(expanded===x.id?null:x.id)} className="flex w-full items-start gap-3 text-left">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-slate-100"><Clock3 className="h-4 w-4 text-[#12224A]"/></div>
          <div className="min-w-0 flex-1"><div className="flex flex-wrap items-center gap-2"><span className="rounded-full bg-[#12224A] px-2.5 py-1 text-[9px] font-black text-white">{x.action}</span><span className="break-all text-[10px] font-bold text-slate-400">{x.entity} · {x.entityId}</span></div><p className="mt-2 text-sm font-black text-[#12224A]">{userName(x)}</p><p className="mt-1 text-xs text-slate-500">{new Date(x.createdAt).toLocaleString('es-MX')} · {x.user?.role||'SYSTEM'} {x.ipAddress?`· IP ${x.ipAddress}`:''}</p></div>
          <ChevronDown className={`h-5 w-5 shrink-0 text-slate-400 transition-transform ${expanded===x.id?'rotate-180':''}`}/>
        </button>
        {expanded===x.id&&<div className="mt-4 grid gap-3 border-t border-slate-100 pt-4 lg:grid-cols-2"><ValueBox label="Valor anterior" value={x.oldValues}/><ValueBox label="Valor nuevo" value={x.newValues}/></div>}
      </article>)}
      {!filtered.length&&<div className="rounded-3xl border border-slate-200 bg-white p-8 text-center text-sm text-slate-500">No hay eventos que coincidan con los filtros.</div>}</div>
    </div>}
  </div></AppShell>;
}
