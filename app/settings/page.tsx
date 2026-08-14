'use client';

import {useEffect,useState} from 'react';
import {useRouter} from 'next/navigation';
import {Activity,Bell,CloudUpload,KeyRound,LockKeyhole,Settings,ShieldCheck,Smartphone,Users} from 'lucide-react';
import AppShell from '@/components/phase15/AppShell';

export default function SettingsPage(){
 const router=useRouter();const[user,setUser]=useState<any>(null),[installable,setInstallable]=useState(false);
 useEffect(()=>{try{const raw=localStorage.getItem('bitalis_auth_user');if(raw)setUser(JSON.parse(raw));}catch{}setInstallable(!window.matchMedia('(display-mode: standalone)').matches);},[]);
 const isAdmin=String(user?.role||'').toUpperCase()==='ADMIN';
 return <AppShell title="Configuración"><div className="mx-auto max-w-5xl px-3 py-3 sm:px-4 sm:py-5"><section className="rounded-[24px] bg-[var(--bitalis-primary)] p-4 text-white sm:p-5"><div className="flex items-center gap-2 text-[10px] font-black uppercase tracking-[.14em] text-[var(--bitalis-mint)]"><Settings className="h-4 w-4"/>Ajustes</div><h1 className="mt-2 text-xl font-black sm:text-2xl">Configuración</h1><p className="mt-1 text-sm text-emerald-50/75">Cuenta, seguridad, diagnóstico y preferencias de la aplicación.</p></section><div className="mt-3 grid grid-cols-2 gap-2 sm:mt-5 sm:gap-3">
  {isAdmin&&<button onClick={()=>router.push('/settings/users')} className="col-span-2 rounded-2xl border border-emerald-100 bg-emerald-50 p-4 text-left shadow-sm sm:rounded-3xl sm:p-5"><Users className="h-5 w-5 text-[var(--bitalis-primary)]"/><h2 className="mt-2 font-black text-[var(--bitalis-primary)]">Usuarios y permisos</h2><p className="mt-1 text-xs leading-5 text-slate-600 sm:text-sm">Crea cuentas reales, asigna roles, activa o bloquea accesos y restablece contraseñas.</p></button>}
  {isAdmin&&<button onClick={()=>router.push('/diagnostics-transition')} className="col-span-2 rounded-2xl border border-violet-200 bg-violet-50 p-4 text-left shadow-sm sm:rounded-3xl sm:p-5"><div className="flex items-start justify-between gap-3"><div><Activity className="h-5 w-5 text-violet-700"/><h2 className="mt-2 font-black text-[var(--bitalis-primary)]">Diagnóstico BITALIS</h2><p className="mt-1 text-xs leading-5 text-slate-600 sm:text-sm">Abre la traza interna, identifica el build desplegado y copia el diagnóstico cuando ocurra un error de sesión, navegación o pantalla.</p></div><span className="rounded-full bg-white px-2 py-1 text-[9px] font-black text-violet-700">SOPORTE</span></div></button>}
  <Card I={ShieldCheck} title="Cuenta" text={`${user?.email||'Usuario'} · ${user?.role||'Rol no disponible'}`}/>
  <button onClick={()=>router.push('/settings/password')} className="min-w-0 rounded-2xl border border-amber-200 bg-amber-50 p-4 text-left shadow-sm sm:rounded-3xl sm:p-5"><KeyRound className="h-5 w-5 text-amber-700"/><h2 className="mt-2 font-black text-[var(--bitalis-primary)]">Cambiar contraseña</h2><p className="mt-1 text-xs leading-5 text-slate-600 sm:text-sm">Cambia la contraseña temporal por una personal.</p></button>
  <Card I={LockKeyhole} title="Seguridad" text="Las acciones sensibles se validan según tu usuario y permisos."/>
  <Card I={Smartphone} title="Aplicación" text={installable?'Puedes instalar BITALIS desde un navegador compatible.':'BITALIS se está ejecutando como aplicación instalada.'}/>
  <button onClick={()=>router.push('/sync')} className="rounded-2xl border border-emerald-100 bg-emerald-50 p-4 text-left shadow-sm sm:rounded-3xl sm:p-5"><CloudUpload className="h-5 w-5 text-[var(--bitalis-action)]"/><h2 className="mt-2 font-black text-[var(--bitalis-primary)]">Sincronización</h2><p className="mt-1 text-xs leading-5 text-slate-600 sm:text-sm">Revisa operaciones pendientes y vuelve a enviarlas cuando sea necesario.</p></button>
  <Card I={Bell} title="Notificaciones" text="Consulta las alertas y avisos importantes de tu operación."/>
 </div></div></AppShell>;
}
function Card({I,title,text}:{I:any;title:string;text:string}){return <article className="min-w-0 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:rounded-3xl sm:p-5"><I className="h-5 w-5 text-[var(--bitalis-action)]"/><h2 className="mt-2 font-black text-[var(--bitalis-primary)]">{title}</h2><p className="mt-1 text-xs leading-5 text-slate-500 sm:text-sm">{text}</p></article>}
