'use client';

import {MouseEvent as ReactMouseEvent,ReactNode,TouchEvent,createContext,useCallback,useContext,useEffect,useLayoutEffect,useMemo,useRef,useState} from 'react';
import {usePathname,useRouter} from 'next/navigation';
import {Bell,Boxes,ClipboardCheck,Coins,Home,Loader2,LogOut,ReceiptText,Repeat2,Route,Settings,ShieldCheck,ShoppingCart,UserPlus,Users,WalletCards,X} from 'lucide-react';
import BitalisLogo from '@/components/BitalisLogo';
import {getAuthenticatedLandingRoute} from '@/lib/auth/landingRoute';
import {apiClient} from '@/lib/phase15/apiClient';
import {traceAuthTransition} from '@/lib/ux/authTransitionTrace';
import {haptic} from '@/lib/ux/haptics';

type User={id:string;role:string;firstName?:string;lastName?:string;email?:string};
type NavItem={href:string;label:string;icon:any;permission:string};
type ShellContextValue={setTitle:(title:string)=>void;primeAuthenticatedSession:(user:User,permissionCodes:string[]|null)=>void;permissions:Set<string>|null;user:User|null};
type SwipeStart={x:number;y:number;lastX:number;lastY:number;at:number}|null;
const ShellContext=createContext<ShellContextValue|null>(null);

const collector:NavItem[]=[{href:'/dashboard',label:'Inicio',icon:Home,permission:'dashboard.view'},{href:'/route',label:'Ruta',icon:Route,permission:'route.view'},{href:'/collections',label:'Cobrar',icon:WalletCards,permission:'collections.view'},{href:'/portfolio',label:'Cartera',icon:Users,permission:'collections.view'},{href:'/cash',label:'Caja',icon:ReceiptText,permission:'cash.view'}];
const seller:NavItem[]=[{href:'/dashboard',label:'Inicio',icon:Home,permission:'dashboard.view'},{href:'/clients/new',label:'Alta',icon:UserPlus,permission:'clients.create'},{href:'/sales/new',label:'Venta',icon:ShoppingCart,permission:'sales.create'},{href:'/clients',label:'Clientes',icon:Users,permission:'clients.view'},{href:'/commissions',label:'Comisión',icon:Coins,permission:'commissions.view'}];
const supervisor:NavItem[]=[{href:'/dashboard',label:'Inicio',icon:Home,permission:'dashboard.view'},{href:'/portfolio',label:'Cartera',icon:WalletCards,permission:'collections.view'},{href:'/authorizations',label:'Autorizar',icon:ShieldCheck,permission:'sales.approve'},{href:'/renewals',label:'Renovar',icon:ClipboardCheck,permission:'renewals.view'},{href:'/control-center',label:'Control',icon:Boxes,permission:'reports.view'}];
const admin:NavItem[]=[{href:'/dashboard',label:'Inicio',icon:Home,permission:'dashboard.view'},{href:'/portfolio',label:'Cartera',icon:WalletCards,permission:'collections.view'},{href:'/control-center',label:'Control',icon:Boxes,permission:'reports.view'},{href:'/inventory',label:'Stock',icon:ClipboardCheck,permission:'inventory.view'},{href:'/settings',label:'Config.',icon:Settings,permission:'settings.manage'}];
const menus:Record<string,NavItem[]>={COBRADOR:collector,VENDEDORA:seller,VENDEDOR:seller,SUPERVISORA:supervisor,SUPERVISOR:supervisor,ADMIN:admin};
const authKeys=['bitalis_access_token','bitalis_refresh_token','bitalis_auth_user'];
const permissionCacheKey='bitalis_effective_permissions';
const routePermissions:[string,string][]=[['/settings/users','users.manage'],['/settings','settings.manage'],['/supervision/down-payments','sales.view'],['/clients/new','clients.create'],['/clients','clients.view'],['/sales/new','sales.create'],['/sales','sales.view'],['/products','inventory.view'],['/portfolio','collections.view'],['/collections','collections.view'],['/route','route.view'],['/cash','cash.view'],['/inventory','inventory.view'],['/renewals','renewals.view'],['/commissions','commissions.view'],['/reports','reports.view'],['/audit','audit.view'],['/authorizations','sales.approve'],['/control-center','reports.view'],['/dashboard','dashboard.view']];
const routeTitles:[string,string][]=[['/settings/users','Usuarios'],['/settings','Configuración'],['/supervision/down-payments','Enganches'],['/clients/new','Alta rápida'],['/clients','Clientes'],['/sales/new','Nueva venta'],['/sales','Ventas'],['/products','Productos'],['/portfolio','Cartera'],['/collections','Cobranza'],['/route','Ruta'],['/cash','Caja'],['/inventory','Stock'],['/renewals','Renovaciones'],['/commissions','Comisiones'],['/reports','Reportes'],['/audit','Auditoría'],['/authorizations','Autorizaciones'],['/control-center','Control'],['/notifications','Notificaciones'],['/dashboard','Inicio']];
const requiredPermission=(pathname:string)=>routePermissions.find(([prefix])=>pathname===prefix||pathname.startsWith(`${prefix}/`))?.[1];
const titleForPath=(pathname:string)=>routeTitles.find(([prefix])=>pathname===prefix||pathname.startsWith(`${prefix}/`))?.[1]||'BITALIS';
const isPublicPath=(pathname:string)=>pathname==='/'||pathname==='/login';
const samePermissions=(current:Set<string>|null,codes:string[])=>current!==null&&current.size===codes.length&&codes.every(code=>current.has(code));
const blocksShellSwipe=(target:EventTarget|null)=>target instanceof Element&&!!target.closest('input,textarea,select,[contenteditable="true"],[data-no-swipe],.overflow-x-auto,.overflow-auto,.mapboxgl-map,.mapboxgl-canvas,.leaflet-container');

export function usePrimeAuthenticatedShellSession(){
 return useContext(ShellContext)?.primeAuthenticatedSession;
}

export function useShellPermissions(){
 return useContext(ShellContext)?.permissions??null;
}

export function useShellSessionUser(){
 return useContext(ShellContext)?.user??null;
}

export default function AppShell({children,title}:{children:ReactNode;title?:string}){
 const parent=useContext(ShellContext);
 if(parent)return <NestedShell title={title}>{children}</NestedShell>;
 return <PersistentShell initialTitle={title}>{children}</PersistentShell>;
}

function NestedShell({children,title}:{children:ReactNode;title?:string}){
 const parent=useContext(ShellContext);
 useLayoutEffect(()=>{if(parent&&title)parent.setTitle(title);},[parent,title]);
 return <>{children}</>;
}

function PersistentShell({children,initialTitle}:{children:ReactNode;initialTitle?:string}){
 const router=useRouter(),pathname=usePathname();
 const publicPath=isPublicPath(pathname);
 const shellRef=useRef<HTMLDivElement|null>(null),swipeStart=useRef<SwipeStart>(null),swipeConsumedUntil=useRef(0),lastNavIndex=useRef(0);
 const[user,setUser]=useState<User|null>(null),[accountOpen,setAccountOpen]=useState(false),[loggingOut,setLoggingOut]=useState(false),[permissions,setPermissions]=useState<Set<string>|null>(null),[hydrated,setHydrated]=useState(false),[shellTitle,setShellTitle]=useState(initialTitle||titleForPath(pathname)),[unreadCount,setUnreadCount]=useState(0);

 const primeAuthenticatedSession=useCallback((nextUser:User,permissionCodes:string[]|null)=>{
  setUser(nextUser);
  setPermissions(permissionCodes===null?null:new Set(permissionCodes.map(String)));
  setHydrated(true);
 },[]);

 useLayoutEffect(()=>{setShellTitle(titleForPath(pathname));},[pathname]);
 useLayoutEffect(()=>{
  if(publicPath){setHydrated(true);return;}
  try{
   const raw=localStorage.getItem('bitalis_auth_user');
   setUser(raw?JSON.parse(raw):null);
   const cached=sessionStorage.getItem(permissionCacheKey);
   if(cached){const parsed=JSON.parse(cached);if(Array.isArray(parsed))setPermissions(prev=>samePermissions(prev,parsed.map(String))?prev:new Set(parsed.map(String)));}
  }catch{setUser(null);}
  setHydrated(true);
 },[publicPath]);

 useEffect(()=>{
  if(publicPath||!hydrated||user)return;
  router.replace('/');
 },[publicPath,hydrated,user,router]);

 useEffect(()=>{
  if(!hydrated||publicPath||!user)return;
  const refreshPermissions=async()=>{
   try{
    const json:any=await apiClient('/api/auth/permissions',{timeoutMs:12000});
    const codes=Array.isArray(json?.permissionCodes)?json.permissionCodes.map(String):[];
    setPermissions(prev=>samePermissions(prev,codes)?prev:new Set(codes));
    sessionStorage.setItem(permissionCacheKey,JSON.stringify(codes));
   }catch(error:any){
    if(error?.status===401||error?.code==='SESSION_EXPIRED'){sessionStorage.removeItem(permissionCacheKey);return;}
   }
  };
  void refreshPermissions();
  const onFocus=()=>{void refreshPermissions();};
  const onChanged=()=>{void refreshPermissions();};
  window.addEventListener('focus',onFocus);
  window.addEventListener('bitalis:permissions-changed',onChanged);
  return()=>{window.removeEventListener('focus',onFocus);window.removeEventListener('bitalis:permissions-changed',onChanged);};
 },[hydrated,publicPath,user]);

 const role=(user?.role||'').toUpperCase();
 const nav=useMemo(()=>{const base=menus[role]||[];if(!permissions)return[];return base.filter(item=>permissions.has(item.permission));},[role,permissions]);
 const activeNavIndex=useMemo(()=>nav.findIndex(item=>item.href==='/dashboard'?pathname===item.href:pathname===item.href||pathname.startsWith(`${item.href}/`)),[nav,pathname]);
 useEffect(()=>{if(activeNavIndex>=0)lastNavIndex.current=activeNavIndex;},[activeNavIndex]);
 const needed=requiredPermission(pathname);const denied=!publicPath&&user!==null&&permissions!==null&&!!needed&&!permissions.has(needed);
 const deniedFallback=useMemo(()=>permissions?getAuthenticatedLandingRoute(Array.from(permissions)):'/access-unavailable',[permissions]);
 useEffect(()=>{if(!denied)return;if(pathname!==deniedFallback)router.replace(deniedFallback);},[denied,deniedFallback,pathname,router]);
 const go=(href:string)=>{if(href===pathname)return;haptic('tap');router.push(href);};
 const privateReady=!publicPath&&hydrated&&user!==null;

 useEffect(()=>{
  if(!privateReady)return;
  let alive=true;
  const refreshUnread=async()=>{
   try{
    const json:any=await apiClient('/api/notifications/unread',{timeoutMs:8000});
    const raw=Array.isArray(json?.data)?json.data.length:Array.isArray(json?.notifications)?json.notifications.length:Number(json?.count??json?.unread??0);
    const count=Number.isFinite(raw)?Math.max(0,Number(raw)):0;
    if(alive)setUnreadCount(count);
   }catch{}
  };
  void refreshUnread();
  const onFocus=()=>{void refreshUnread();};
  const onChanged=()=>{void refreshUnread();};
  const onVisibility=()=>{if(document.visibilityState==='visible')void refreshUnread();};
  window.addEventListener('focus',onFocus);
  window.addEventListener('bitalis:notifications-changed',onChanged);
  document.addEventListener('visibilitychange',onVisibility);
  return()=>{alive=false;window.removeEventListener('focus',onFocus);window.removeEventListener('bitalis:notifications-changed',onChanged);document.removeEventListener('visibilitychange',onVisibility);};
 },[privateReady,user?.id]);

 const finishSwipe=useCallback((x:number,y:number)=>{
  const start=swipeStart.current;swipeStart.current=null;
  if(!start||!privateReady||accountOpen||nav.length<2)return;
  const dx=x-start.x,dy=y-start.y,duration=performance.now()-start.at;
  if(duration>1100||Math.abs(dx)<52||Math.abs(dx)<=Math.abs(dy)*1.15)return;
  const currentIndex=activeNavIndex>=0?activeNavIndex:lastNavIndex.current;
  const nextIndex=dx<0?currentIndex+1:currentIndex-1;
  if(nextIndex<0||nextIndex>=nav.length)return;
  swipeConsumedUntil.current=performance.now()+450;
  go(nav[nextIndex].href);
 },[accountOpen,activeNavIndex,nav,privateReady]);

 const onSwipeStart=(event:TouchEvent<HTMLDivElement>)=>{
  if(!privateReady||accountOpen||nav.length<2||event.touches.length!==1||blocksShellSwipe(event.target)){swipeStart.current=null;return;}
  const touch=event.touches[0];
  swipeStart.current={x:touch.clientX,y:touch.clientY,lastX:touch.clientX,lastY:touch.clientY,at:performance.now()};
 };
 const onSwipeEnd=(event:TouchEvent<HTMLDivElement>)=>{
  if(event.changedTouches.length!==1){swipeStart.current=null;return;}
  const touch=event.changedTouches[0];
  finishSwipe(touch.clientX,touch.clientY);
 };
 const onSwipeCancel=()=>{
  const start=swipeStart.current;
  if(!start)return;
  finishSwipe(start.lastX,start.lastY);
 };
 const onClickCapture=(event:ReactMouseEvent<HTMLDivElement>)=>{
  if(performance.now()>=swipeConsumedUntil.current)return;
  event.preventDefault();
  event.stopPropagation();
 };

 useEffect(()=>{
  const node=shellRef.current;
  if(!node)return;
  const onTouchMove=(event:globalThis.TouchEvent)=>{
   const start=swipeStart.current;
   if(!start||!privateReady||accountOpen||event.touches.length!==1)return;
   const touch=event.touches[0];
   start.lastX=touch.clientX;start.lastY=touch.clientY;
   const dx=touch.clientX-start.x,dy=touch.clientY-start.y;
   if(Math.abs(dx)>12&&Math.abs(dx)>Math.abs(dy)*1.1&&event.cancelable)event.preventDefault();
  };
  node.addEventListener('touchmove',onTouchMove,{passive:false});
  return()=>node.removeEventListener('touchmove',onTouchMove);
 },[accountOpen,privateReady]);

 const initials=`${user?.firstName?.[0]||''}${user?.lastName?.[0]||''}`.toUpperCase()||'U';
 const endSession=async()=>{
  if(loggingOut)return;
  setLoggingOut(true);
  haptic('tap');
  const token=localStorage.getItem('bitalis_access_token');
  const controller=new AbortController();
  const timer=window.setTimeout(()=>controller.abort(),1500);
  try{
   if(token)await fetch('/api/auth/logout',{method:'POST',headers:{Authorization:`Bearer ${token}`,'Cache-Control':'no-store'},cache:'no-store',signal:controller.signal,keepalive:true});
  }catch{}finally{
   window.clearTimeout(timer);
   traceAuthTransition('logout-atomic-redirect');
   authKeys.forEach(key=>localStorage.removeItem(key));
   sessionStorage.removeItem(permissionCacheKey);
   window.location.replace('/');
  }
 };
 const contextValue=useMemo<ShellContextValue>(()=>({setTitle:setShellTitle,primeAuthenticatedSession,permissions,user}),[primeAuthenticatedSession,permissions,user]);
 const content=publicPath?children:!hydrated||user===null||permissions===null?<AppLoading/>:denied?<div className="mx-auto max-w-md p-6 text-center"><div className="mx-auto flex h-16 w-16 items-center justify-center rounded-3xl bg-emerald-50"><ShieldCheck className="h-8 w-8 text-[var(--bitalis-action)]"/></div><h2 className="mt-3 font-black text-[var(--bitalis-primary)]">Acceso no disponible</h2><p className="mt-1 text-sm text-slate-500">Este módulo no está habilitado para tu usuario.</p></div>:children;

 return <ShellContext.Provider value={contextValue}><div ref={shellRef} className={`bitalis-app-shell min-h-[100svh] text-[var(--bitalis-text)] ${privateReady?'pb-24':''}`} data-shell-mode={publicPath?'public':'private'} onClickCapture={onClickCapture} onTouchStart={onSwipeStart} onTouchEnd={onSwipeEnd} onTouchCancel={onSwipeCancel}>
  <header className={privateReady?'bitalis-safe-top sticky top-0 z-40 border-b border-[var(--bitalis-border)] bg-white/96 shadow-[0_6px_22px_rgba(6,43,36,.06)] backdrop-blur-xl':'hidden'}><div className="mx-auto flex max-w-7xl items-center justify-between px-3 py-2.5 sm:px-4 sm:py-3"><div className="flex min-w-0 items-center gap-2.5 sm:gap-3"><BitalisLogo size="md" variant="light"/><div className="min-w-0"><p className="text-[8px] font-black uppercase tracking-[.12em] text-[var(--bitalis-action-dark)] sm:text-[10px] sm:tracking-[.14em]">{role||'BITALIS'}</p><h1 className="max-w-[125px] truncate text-xs font-black text-[var(--bitalis-primary)] min-[390px]:max-w-[160px] sm:max-w-none sm:text-sm">{shellTitle}</h1></div></div><div className="flex items-center gap-1.5"><button onClick={()=>go('/notifications')} className="relative flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl border border-[var(--bitalis-border)] bg-white text-[var(--bitalis-primary)] shadow-sm sm:h-11 sm:w-11" aria-label={unreadCount?`Notificaciones, ${unreadCount} pendientes`:'Notificaciones'}><Bell className="h-5 w-5"/>{unreadCount>0&&<span className="absolute -right-1 -top-1 flex min-h-5 min-w-5 items-center justify-center rounded-full bg-red-600 px-1 text-[9px] font-black leading-none text-white shadow-sm ring-2 ring-white">{unreadCount>99?'99+':unreadCount}</span>}</button><button onClick={()=>{haptic('tap');setAccountOpen(true);}} className="flex h-10 min-w-10 shrink-0 items-center justify-center rounded-2xl bg-[var(--bitalis-primary)] px-2 text-[10px] font-black text-white shadow-sm sm:h-11 sm:min-w-11" aria-label="Cuenta y sesión">{initials}</button></div></div></header>
  <main className="min-h-0">{content}</main>
  <nav className={privateReady&&nav.length>0?'bitalis-safe-bottom fixed inset-x-0 bottom-0 z-50 border-t border-[var(--bitalis-border)] bg-white/98 px-2 pt-2 shadow-[0_-12px_30px_rgba(6,43,36,.10)] backdrop-blur-xl':'hidden'} aria-label="Navegación principal"><div className={`mx-auto grid max-w-xl gap-1 ${nav.length===1?'grid-cols-1':nav.length===2?'grid-cols-2':nav.length===3?'grid-cols-3':nav.length===4?'grid-cols-4':'grid-cols-5'}`}>{nav.map(({href,label,icon:Icon})=>{const active=href==='/dashboard'?pathname===href:pathname.startsWith(href);return <button key={href} onClick={()=>go(href)} aria-current={active?'page':undefined} className={`flex min-h-14 min-w-0 flex-col items-center justify-center gap-1 rounded-2xl px-1 text-[9px] font-black focus:outline-none focus:ring-2 focus:ring-[var(--bitalis-action)] sm:text-[10px] ${active?'bg-[var(--bitalis-primary)] text-white shadow-md shadow-emerald-950/10':'text-slate-500'}`}><Icon className="h-5 w-5 shrink-0"/><span className="max-w-full truncate">{label}</span></button>})}</div></nav>
  {privateReady&&accountOpen&&<div data-no-swipe className="fixed inset-0 z-[140] flex items-end bg-slate-950/55 backdrop-blur-sm sm:items-center sm:justify-center sm:p-4" onClick={()=>!loggingOut&&setAccountOpen(false)}><section onClick={e=>e.stopPropagation()} className="bitalis-bottom-sheet w-full p-4 pb-[max(1rem,env(safe-area-inset-bottom))] sm:max-w-sm sm:rounded-[28px] sm:p-5"><div className="flex items-start justify-between gap-3"><div className="min-w-0"><p className="text-[10px] font-black uppercase tracking-[.14em] text-[var(--bitalis-action)]">Sesión actual</p><h2 className="mt-1 truncate text-lg font-black text-[var(--bitalis-primary)]">{user?.firstName||'Usuario'} {user?.lastName||''}</h2><p className="mt-1 truncate text-xs text-slate-500">{user?.email||''}</p><p className="mt-1 text-[10px] font-black text-slate-400">{role||'SIN ROL'}</p></div><button disabled={loggingOut} onClick={()=>setAccountOpen(false)} className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-slate-100 text-slate-600 disabled:opacity-50" aria-label="Cerrar menú"><X className="h-4 w-4"/></button></div><div className="mt-4 grid gap-2"><button disabled={loggingOut} onClick={endSession} className="flex min-h-14 items-center gap-3 rounded-2xl border border-emerald-100 bg-emerald-50 px-4 text-left text-[var(--bitalis-primary)] disabled:opacity-50"><Repeat2 className="h-5 w-5 shrink-0"/><span><b className="block text-sm">Cambiar usuario</b><small className="text-[11px] text-slate-500">Cierra esta sesión y vuelve al acceso.</small></span></button><button disabled={loggingOut} onClick={endSession} className="flex min-h-14 items-center justify-center gap-2 rounded-2xl bg-red-50 px-4 text-sm font-black text-red-700 disabled:opacity-50">{loggingOut?<Loader2 className="h-5 w-5 animate-spin"/>:<LogOut className="h-5 w-5"/>}{loggingOut?'CERRANDO…':'CERRAR SESIÓN'}</button></div></section></div>}
 </div></ShellContext.Provider>;
}

function AppLoading(){return <div className="mx-auto max-w-xl px-3 py-5"><div className="bitalis-android-surface p-4"><div className="flex items-center gap-3"><div className="bitalis-loading-shimmer h-12 w-12 rounded-2xl"/><div className="flex-1"><div className="bitalis-loading-shimmer h-3 w-28 rounded-full"/><div className="bitalis-loading-shimmer mt-2 h-2.5 w-44 max-w-full rounded-full"/></div></div><div className="mt-5 grid grid-cols-2 gap-3"><div className="bitalis-loading-shimmer h-24 rounded-3xl"/><div className="bitalis-loading-shimmer h-24 rounded-3xl"/><div className="bitalis-loading-shimmer h-24 rounded-3xl"/><div className="bitalis-loading-shimmer h-24 rounded-3xl"/></div></div></div>}
