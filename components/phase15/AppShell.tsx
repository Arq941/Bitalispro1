'use client';

import {ReactNode,useEffect,useMemo,useState} from 'react';
import {usePathname,useRouter} from 'next/navigation';
import {Bell,Boxes,ClipboardCheck,Coins,Home,Loader2,LogOut,ReceiptText,Repeat2,Route,Settings,ShieldCheck,ShoppingCart,UserPlus,Users,WalletCards,X} from 'lucide-react';
import BitalisLogo from '@/components/BitalisLogo';
import {haptic} from '@/lib/ux/haptics';

type User={id:string;role:string;firstName?:string;lastName?:string;email?:string};
const collector=[{href:'/dashboard',label:'Inicio',icon:Home},{href:'/route',label:'Ruta',icon:Route},{href:'/collections',label:'Cobrar',icon:WalletCards},{href:'/clients',label:'Clientes',icon:Users},{href:'/cash',label:'Caja',icon:ReceiptText}];
const seller=[{href:'/dashboard',label:'Inicio',icon:Home},{href:'/clients/new',label:'Alta',icon:UserPlus},{href:'/sales/new',label:'Venta',icon:ShoppingCart},{href:'/clients',label:'Clientes',icon:Users},{href:'/commissions',label:'Comisión',icon:Coins}];
const supervisor=[{href:'/dashboard',label:'Inicio',icon:Home},{href:'/clients/new',label:'Alta',icon:UserPlus},{href:'/authorizations',label:'Autorizar',icon:ShieldCheck},{href:'/renewals',label:'Renovar',icon:ClipboardCheck},{href:'/control-center',label:'Control',icon:Boxes}];
const admin=[{href:'/dashboard',label:'Inicio',icon:Home},{href:'/control-center',label:'Control',icon:Boxes},{href:'/cash',label:'Caja',icon:ReceiptText},{href:'/inventory',label:'Stock',icon:ClipboardCheck},{href:'/settings',label:'Config.',icon:Settings}];
const menus:Record<string,{href:string;label:string;icon:any}[]>={COBRADOR:collector,VENDEDORA:seller,VENDEDOR:seller,SUPERVISORA:supervisor,SUPERVISOR:supervisor,ADMIN:admin};
const authKeys=['bitalis_access_token','bitalis_refresh_token','bitalis_auth_user'];

export default function AppShell({children,title}:{children:ReactNode;title?:string}){
 const router=useRouter(),pathname=usePathname();
 const[user,setUser]=useState<User|null>(null),[accountOpen,setAccountOpen]=useState(false),[loggingOut,setLoggingOut]=useState(false);
 useEffect(()=>{try{const raw=localStorage.getItem('bitalis_auth_user');if(raw)setUser(JSON.parse(raw));}catch{}},[]);
 const role=(user?.role||'').toUpperCase();
 const nav=useMemo(()=>menus[role]||[],[role]);
 const go=(href:string)=>{haptic('tap');router.push(href);};
 const initials=`${user?.firstName?.[0]||''}${user?.lastName?.[0]||''}`.toUpperCase()||'U';
 const endSession=async()=>{
  if(loggingOut)return;
  setLoggingOut(true);haptic('tap');
  const token=localStorage.getItem('bitalis_access_token');
  try{if(token)await fetch('/api/auth/logout',{method:'POST',headers:{Authorization:`Bearer ${token}`,'Cache-Control':'no-store'},cache:'no-store'});}catch{}
  finally{
   authKeys.forEach(key=>localStorage.removeItem(key));
   setUser(null);setAccountOpen(false);
   window.location.replace('/');
  }
 };
 return <div className="min-h-screen bg-[#F3F4F6] text-[#2B2B2B] pb-24"><header className="sticky top-0 z-40 border-b border-slate-200/80 bg-white/95 backdrop-blur"><div className="mx-auto flex max-w-7xl items-center justify-between px-3 py-2.5 sm:px-4 sm:py-3"><div className="flex min-w-0 items-center gap-2.5 sm:gap-3"><BitalisLogo size="md" variant="light"/><div className="min-w-0"><p className="text-[8px] font-black uppercase tracking-[.12em] text-[#C79A3B] sm:text-[10px] sm:tracking-[.14em]">{role||'BITALIS'}</p><h1 className="max-w-[125px] truncate text-xs font-black text-[#12224A] min-[390px]:max-w-[160px] sm:max-w-none sm:text-sm">{title||'BITALIS'}</h1></div></div><div className="flex items-center gap-1.5"><button onClick={()=>go('/notifications')} className="relative flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl border border-slate-200 bg-white text-[#12224A] active:scale-95 sm:h-11 sm:w-11" aria-label="Notificaciones"><Bell className="h-5 w-5"/></button><button onClick={()=>{haptic('tap');setAccountOpen(true);}} className="flex h-10 min-w-10 shrink-0 items-center justify-center rounded-2xl bg-[#12224A] px-2 text-[10px] font-black text-white active:scale-95 sm:h-11 sm:min-w-11" aria-label="Cuenta y sesión">{initials}</button></div></div></header><main>{children}</main>{nav.length>0&&<nav className="fixed inset-x-0 bottom-0 z-50 border-t border-slate-200 bg-white/98 px-2 pb-[max(.5rem,env(safe-area-inset-bottom))] pt-2 shadow-[0_-12px_30px_rgba(18,34,74,.08)]" aria-label="Navegación principal"><div className="mx-auto grid max-w-xl grid-cols-5 gap-1">{nav.map(({href,label,icon:Icon})=>{const active=href==='/dashboard'?pathname===href:pathname.startsWith(href);return <button key={href} onClick={()=>go(href)} aria-current={active?'page':undefined} className={`flex min-h-14 min-w-0 flex-col items-center justify-center gap-1 rounded-xl px-1 text-[9px] font-black transition active:scale-95 focus:outline-none focus:ring-2 focus:ring-[#FF6A00] sm:text-[10px] ${active?'bg-[#12224A] text-white':'text-slate-500 hover:bg-slate-100'}`}><Icon className="h-5 w-5 shrink-0"/><span className="max-w-full truncate">{label}</span></button>})}</div></nav>}{accountOpen&&<div className="fixed inset-0 z-[140] flex items-end bg-slate-950/55 backdrop-blur-sm sm:items-center sm:justify-center sm:p-4" onClick={()=>!loggingOut&&setAccountOpen(false)}><section onClick={e=>e.stopPropagation()} className="w-full rounded-t-[28px] bg-white p-4 pb-[max(1rem,env(safe-area-inset-bottom))] shadow-2xl sm:max-w-sm sm:rounded-[28px] sm:p-5"><div className="flex items-start justify-between gap-3"><div className="min-w-0"><p className="text-[10px] font-black uppercase tracking-[.14em] text-[#C79A3B]">Sesión actual</p><h2 className="mt-1 truncate text-lg font-black text-[#12224A]">{user?.firstName||'Usuario'} {user?.lastName||''}</h2><p className="mt-1 truncate text-xs text-slate-500">{user?.email||''}</p><p className="mt-1 text-[10px] font-black text-slate-400">{role||'SIN ROL'}</p></div><button disabled={loggingOut} onClick={()=>setAccountOpen(false)} className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-slate-100 text-slate-600 disabled:opacity-50" aria-label="Cerrar menú"><X className="h-4 w-4"/></button></div><div className="mt-4 grid gap-2"><button disabled={loggingOut} onClick={endSession} className="flex min-h-14 items-center gap-3 rounded-2xl border border-blue-100 bg-blue-50 px-4 text-left text-[#12224A] active:scale-[.99] disabled:opacity-50"><Repeat2 className="h-5 w-5 shrink-0"/><span><b className="block text-sm">Cambiar usuario</b><small className="text-[11px] text-slate-500">Cierra esta sesión y vuelve al acceso.</small></span></button><button disabled={loggingOut} onClick={endSession} className="flex min-h-14 items-center justify-center gap-2 rounded-2xl bg-red-50 px-4 text-sm font-black text-red-700 active:scale-[.99] disabled:opacity-50">{loggingOut?<Loader2 className="h-5 w-5 animate-spin"/>:<LogOut className="h-5 w-5"/>}{loggingOut?'CERRANDO…':'CERRAR SESIÓN'}</button></div></section></div>}</div>
}
