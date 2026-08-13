'use client';

import {useEffect,useState} from 'react';
import {useRouter} from 'next/navigation';
import {AlertTriangle,Banknote,Boxes,ChevronRight,ClipboardList,Coins,Loader2,MapPinned,Repeat2,Route,ShieldCheck,ShoppingBag,TrendingUp,UserCog,UserPlus,Users,WalletCards,Camera,Sparkles} from 'lucide-react';
import AppShell from '@/components/phase15/AppShell';
import {apiClient} from '@/lib/phase15/apiClient';
import {haptic} from '@/lib/ux/haptics';

type User={id:string;role:string;firstName?:string;lastName?:string;email?:string};
const money=new Intl.NumberFormat('es-MX',{style:'currency',currency:'MXN',maximumFractionDigits:0});

const sellerModules=[
 ['Alta rápida','Fotos + GPS + nombre','/clients/new',Camera],
 ['Nueva venta','Contado o crédito','/sales/new',ShoppingBag],
 ['Clientes','CRM y prospectos','/clients',Users],
 ['Productos','Catálogo visual','/products',Boxes],
 ['Renovaciones','Seguimiento','/renewals',Repeat2],
 ['Comisiones','Ventas y total','/commissions',Coins],
];
const supervisorModules=[
 ['Alta rápida','Campo: fotos + GPS','/clients/new',Camera],
 ['Enganches','Corte y entrega diaria','/supervision/down-payments',Banknote],
 ['Renovaciones','Cartera por renovar','/renewals',Repeat2],
 ['Autorizaciones','Pendientes del equipo','/authorizations',ShieldCheck],
 ['Centro de control','Operación 360','/control-center',TrendingUp],
 ['Ruta','Cobranza en campo','/route',MapPinned],
 ['Caja','Diferencias y arqueo','/cash',Banknote],
 ['Reportes','Equipo y zona','/reports',ClipboardList],
];
const roleModules:Record<string,any[]>={
 COBRADOR:[['Ruta','Navegar y visitar','/route',Route],['Cobrar','Cobro rápido','/collections',WalletCards],['Clientes','Expediente 360','/clients',Users],['Caja','Efectivo y arqueo','/cash',Banknote],['Comisiones','Cobranza efectiva','/commissions',Coins]],
 VENDEDORA:sellerModules,VENDEDOR:sellerModules,SUPERVISORA:supervisorModules,SUPERVISOR:supervisorModules,
 ADMIN:[
  ['Usuarios','Roles y permisos','/settings/users',UserCog],
  ['Clientes','CRM 360','/clients',Users],
  ['Ventas','Operación comercial','/sales',ShoppingBag],
  ['Autorizaciones','Excepciones','/authorizations',ShieldCheck],
  ['Reportes','Analítica','/reports',ClipboardList],
  ['Comisiones','Esquemas y cálculo','/commissions',Coins],
 ],
};

export default function Dashboard(){
 const router=useRouter();
 const[user,setUser]=useState<User|null>(null),[portfolio,setPortfolio]=useState<any[]>([]),[sales,setSales]=useState<any[]>([]),[clients,setClients]=useState<any[]>([]),[cash,setCash]=useState<any>(null),[loading,setLoading]=useState(true),[error,setError]=useState('');
 const go=(p:string)=>{haptic('tap');router.push(p)};
 useEffect(()=>{(async()=>{const raw=localStorage.getItem('bitalis_auth_user');if(!raw){router.replace('/');return;}let u:User;try{u=JSON.parse(raw);setUser(u);}catch{router.replace('/');return;}try{const [p,s,c,cs]=await Promise.allSettled([apiClient('/api/collections/portfolio'),apiClient('/api/sales'),apiClient('/api/clients?page=1&limit=100'),apiClient(`/api/cash-sessions/current?userId=${encodeURIComponent(u.id)}`)]);if(p.status==='fulfilled')setPortfolio((p.value as any)?.data||[]);if(s.status==='fulfilled')setSales((s.value as any)?.sales||(s.value as any)?.data||[]);if(c.status==='fulfilled')setClients((c.value as any)?.data||[]);if(cs.status==='fulfilled')setCash((cs.value as any)?.data||null);}catch(e:any){setError(e.message);}finally{setLoading(false);}})();},[router]);

 const role=String(user?.role||'ADMIN').toUpperCase();
 const modules=roleModules[role]||roleModules.ADMIN;
 const cartera=portfolio.reduce((sum,x)=>sum+Number(x.saldoActual||0),0);
 const overdue=portfolio.filter(x=>x.collection?.overdue||['HIGH','CRITICAL'].includes(String(x.client?.riskLevel||''))).length;
 const promises=portfolio.filter(x=>x.collection?.latestRescheduleDate).length;
 const approvedSales=sales.filter(x=>['APPROVED','COMPLETED'].includes(x.status));
 const creditSales=approvedSales.filter(x=>x.saleType==='CREDIT').length;
 const salesAmount=approvedSales.reduce((s,x)=>s+Number(x.totalAmount||0),0);
 const name=[user?.firstName,user?.lastName].filter(Boolean).join(' ')||user?.email||'Usuario';
 const isCollector=role==='COBRADOR',isSeller=['VENDEDORA','VENDEDOR'].includes(role),isSupervisor=['SUPERVISORA','SUPERVISOR'].includes(role),isAdmin=role==='ADMIN';
 const heroTitle=isCollector?'Tu jornada de cobranza':isSeller?'Captura rápida y venta en campo':isSupervisor?'Supervisión operativa en campo':'Resumen ejecutivo de hoy';
 const kpis=isCollector?[[WalletCards,'Cobros pendientes',portfolio.length],[TrendingUp,'Cartera',money.format(cartera)],[AlertTriangle,'Atrasados',overdue],[Repeat2,'Promesas',promises],[Users,'Clientes',new Set(portfolio.map(x=>x.clientId)).size],[Banknote,'Caja actual',cash?money.format(Number(cash.expectedCash||0)):'Sin abrir']]:isSeller?[[ShoppingBag,'Ventas',approvedSales.length],[TrendingUp,'Monto vendido',money.format(salesAmount)],[Users,'Clientes',clients.length],[WalletCards,'Ventas crédito',creditSales]]:[[ShoppingBag,'Ventas',approvedSales.length],[WalletCards,'Cartera',money.format(cartera)],[Users,'Clientes',clients.length],[AlertTriangle,'Riesgo alto',overdue]];

 return <AppShell title="Inicio"><div className="mx-auto max-w-7xl px-3 py-3 sm:px-4 sm:py-5">
  <section className={`overflow-hidden bg-[#12224A] text-white shadow-lg shadow-slate-900/10 ${isAdmin?'rounded-[24px] p-4':'rounded-[28px] p-4 sm:p-7'}`}>
   <div className="flex items-start justify-between gap-3"><div className="min-w-0"><p className="text-[10px] font-black uppercase tracking-[.16em] text-[#C79A3B]">{role}</p><h1 className={`${isAdmin?'mt-1 text-xl':'mt-2 text-2xl sm:text-3xl'} truncate font-black`}>Hola, {name}</h1><p className={`${isAdmin?'mt-1':'mt-2'} text-sm leading-5 text-slate-300`}>{heroTitle}</p></div><div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-white/10"><Sparkles className="h-5 w-5 text-[#C79A3B]"/></div></div>
   {isCollector&&<div className="mt-5 grid grid-cols-2 gap-2"><button onClick={()=>go('/collections')} className="min-h-14 touch-manipulation rounded-2xl bg-[#FF6A00] px-2 text-xs font-black active:scale-95 sm:text-sm">+ COBRAR</button><button onClick={()=>go('/route')} className="min-h-14 touch-manipulation rounded-2xl bg-white/10 px-2 text-xs font-black active:scale-95 sm:text-sm">VER RUTA</button></div>}
   {(isSeller||isSupervisor)&&<div className="mt-5 grid grid-cols-2 gap-2"><button onClick={()=>go('/clients/new')} className="min-h-14 touch-manipulation rounded-2xl bg-[#FF6A00] px-2 text-xs font-black active:scale-95 sm:text-sm">ALTA RÁPIDA</button><button onClick={()=>go('/sales/new')} className="min-h-14 touch-manipulation rounded-2xl bg-white/10 px-2 text-xs font-black active:scale-95 sm:text-sm">NUEVA VENTA</button></div>}
  </section>

  {error&&<div className="mt-4 flex items-start gap-2 rounded-2xl border border-amber-200 bg-amber-50 p-3 text-sm font-bold text-amber-800"><AlertTriangle className="mt-0.5 h-5 w-5 shrink-0"/><span className="min-w-0 break-words">{error}</span></div>}
  {loading?<div className="flex justify-center p-14"><Loader2 className="h-7 w-7 animate-spin text-[#12224A]"/></div>:<>
   <section className={`${isAdmin?'mt-3':'mt-4'} grid grid-cols-2 gap-2 sm:gap-3 lg:grid-cols-4`}>{kpis.map(([Icon,l,v]:any)=><K key={l} I={Icon} l={l} v={v} compact={isAdmin}/>)}</section>
   <div className={`${isAdmin?'mt-4':'mt-6'} flex items-center justify-between gap-3`}><div><p className="text-[10px] font-black uppercase tracking-[.14em] text-[#C79A3B]">{isAdmin?'Administración':'Accesos'}</p><h2 className="text-lg font-black text-[#12224A] sm:text-xl">{isAdmin?'Gestión rápida':'Tu operación'}</h2></div>{(isSeller||isSupervisor)&&<button onClick={()=>go('/clients/new')} className="flex min-h-11 shrink-0 touch-manipulation items-center gap-2 rounded-xl bg-white px-3 text-xs font-black text-[#12224A] shadow-sm active:scale-95"><UserPlus className="h-4 w-4"/><span className="hidden min-[370px]:inline">Cliente</span></button>}</div>
   <section className={`${isAdmin?'mt-2 grid grid-cols-2 gap-2':'mt-3 grid gap-2 sm:grid-cols-2 sm:gap-3'} lg:grid-cols-3 xl:grid-cols-4`}>{modules.map(([title,sub,path,Icon])=><button key={path} onClick={()=>go(path)} className={`group touch-manipulation border border-slate-200 bg-white text-left shadow-sm transition active:scale-[.98] ${isAdmin?'flex min-h-[86px] flex-col justify-between gap-2 rounded-2xl p-3':'flex min-h-[92px] items-center gap-3 rounded-3xl p-3 sm:min-h-28 sm:p-4'}`}><div className={`${isAdmin?'h-9 w-9 rounded-xl':'h-11 w-11 rounded-2xl sm:h-12 sm:w-12'} flex shrink-0 items-center justify-center bg-[#12224A] text-white`}><Icon className="h-5 w-5"/></div><div className="min-w-0 flex-1"><div className="flex items-center justify-between gap-1"><p className={`${isAdmin?'text-sm':'font-black'} truncate font-black text-[#12224A]`}>{title}</p>{isAdmin&&<ChevronRight className="h-3.5 w-3.5 shrink-0 text-slate-300"/>}</div><p className={`${isAdmin?'mt-0.5 text-[10px] leading-3':'mt-1 text-xs leading-4'} line-clamp-2 text-slate-500`}>{sub}</p></div>{!isAdmin&&<ChevronRight className="h-4 w-4 shrink-0 text-slate-300"/>}</button>)}</section>
  </>}
 </div></AppShell>;
}

function K({I,l,v,compact=false}:{I:any;l:string;v:any;compact?:boolean}){return <div className={`min-w-0 border border-slate-200 bg-white shadow-sm ${compact?'rounded-2xl p-3':'rounded-3xl p-3 sm:p-4'}`}><I className={`${compact?'h-4 w-4':'h-5 w-5'} text-[#C79A3B]`}/><p className={`${compact?'mt-2 text-[8px]':'mt-3 text-[9px] sm:text-[10px]'} truncate font-black uppercase tracking-[.09em] text-slate-400`}>{l}</p><p className={`${compact?'text-base':'text-lg sm:text-xl'} mt-1 break-words font-black leading-tight text-[#12224A]`}>{v}</p></div>}
