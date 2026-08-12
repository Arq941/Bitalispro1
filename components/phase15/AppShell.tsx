'use client';

import {ReactNode,useEffect,useMemo,useRef,useState} from 'react';
import {usePathname,useRouter} from 'next/navigation';
import {Bell,Boxes,ClipboardCheck,Home,MapPinned,Menu,PackageSearch,ReceiptText,Route,Settings,ShieldCheck,ShoppingCart,Users,WalletCards} from 'lucide-react';
import BitalisLogo from '@/components/BitalisLogo';
import {haptic} from '@/lib/ux/haptics';

type User={id:string;role:string;firstName?:string;lastName?:string;email?:string};
const collector=[{href:'/dashboard',label:'Inicio',icon:Home},{href:'/route',label:'Ruta',icon:Route},{href:'/collections',label:'Cobrar',icon:WalletCards},{href:'/clients',label:'Clientes',icon:Users},{href:'/notifications',label:'Más',icon:Menu}];
const seller=[{href:'/dashboard',label:'Inicio',icon:Home},{href:'/sales/new',label:'Venta',icon:ShoppingCart},{href:'/clients',label:'Clientes',icon:Users},{href:'/products',label:'Productos',icon:PackageSearch},{href:'/notifications',label:'Más',icon:Menu}];
const supervisor=[{href:'/dashboard',label:'Inicio',icon:Home},{href:'/authorizations',label:'Autorizar',icon:ShieldCheck},{href:'/route',label:'Ruta',icon:MapPinned},{href:'/renewals',label:'Renovar',icon:ClipboardCheck},{href:'/control-center',label:'Más',icon:Menu}];
const admin=[{href:'/dashboard',label:'Inicio',icon:Home},{href:'/control-center',label:'Control',icon:Boxes},{href:'/cash',label:'Caja',icon:ReceiptText},{href:'/inventory',label:'Inventario',icon:ClipboardCheck},{href:'/settings',label:'Más',icon:Settings}];
const menus:Record<string,{href:string;label:string;icon:any}[]>={COBRADOR:collector,VENDEDORA:seller,VENDEDOR:seller,SUPERVISORA:supervisor,SUPERVISOR:supervisor,ADMIN:admin};

export default function AppShell({children,title}:{children:ReactNode;title?:string}){
 const router=useRouter(),pathname=usePathname();
 const[user,setUser]=useState<User|null>(null);
 const touchStart=useRef<{x:number;y:number}|null>(null);
 useEffect(()=>{try{const raw=localStorage.getItem('bitalis_auth_user');if(raw)setUser(JSON.parse(raw));}catch{}},[]);
 const role=(user?.role||'ADMIN').toUpperCase();
 const nav=useMemo(()=>menus[role]||menus.ADMIN,[role]);
 const go=(href:string)=>{haptic('tap');router.push(href);};
 const onTouchStart=(e:React.TouchEvent)=>{const t=e.touches[0];touchStart.current={x:t.clientX,y:t.clientY};};
 const onTouchEnd=(e:React.TouchEvent)=>{if(!touchStart.current)return;const t=e.changedTouches[0],dx=t.clientX-touchStart.current.x,dy=t.clientY-touchStart.current.y;touchStart.current=null;if(Math.abs(dx)<80||Math.abs(dx)<Math.abs(dy)*1.25)return;const index=nav.findIndex(n=>n.href==='/dashboard'?pathname===n.href:pathname.startsWith(n.href));if(index<0)return;const next=dx<0?Math.min(nav.length-1,index+1):Math.max(0,index-1);if(next!==index){haptic('tap');router.push(nav[next].href);}};
 return <div className="min-h-screen bg-[#F3F4F6] text-[#2B2B2B] pb-24" onTouchStart={onTouchStart} onTouchEnd={onTouchEnd}><header className="sticky top-0 z-40 border-b border-slate-200/80 bg-white/95 backdrop-blur"><div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-3"><div className="flex min-w-0 items-center gap-3"><BitalisLogo size="md" variant="light"/><div className="hidden min-w-0 sm:block"><p className="text-[10px] font-black uppercase tracking-[.14em] text-[#C79A3B]">{role}</p><h1 className="truncate text-sm font-black text-[#12224A]">{title||'BITALIS'}</h1></div></div><button onClick={()=>go('/notifications')} className="relative flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl border border-slate-200 bg-white text-[#12224A] active:scale-95" aria-label="Notificaciones"><Bell className="h-5 w-5"/></button></div></header><main>{children}</main><nav className="fixed inset-x-0 bottom-0 z-50 border-t border-slate-200 bg-white/98 px-2 pb-[max(.5rem,env(safe-area-inset-bottom))] pt-2 shadow-[0_-12px_30px_rgba(18,34,74,.08)]"><div className="mx-auto grid max-w-xl grid-cols-5 gap-1">{nav.map(({href,label,icon:Icon})=>{const active=href==='/dashboard'?pathname===href:pathname.startsWith(href);return <button key={href} onClick={()=>go(href)} className={`flex min-h-14 min-w-0 flex-col items-center justify-center gap-1 rounded-xl px-1 text-[9px] font-black transition active:scale-95 focus:outline-none focus:ring-2 focus:ring-[#FF6A00] sm:text-[10px] ${active?'bg-[#12224A] text-white':'text-slate-500 hover:bg-slate-100'}`}><Icon className="h-5 w-5 shrink-0"/><span className="max-w-full truncate">{label}</span></button>})}</div></nav></div>
}
