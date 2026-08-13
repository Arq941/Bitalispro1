'use client';

import {useEffect,useState} from 'react';
import {useRouter} from 'next/navigation';
import {Bell,CloudUpload,Database,KeyRound,LockKeyhole,Settings,ShieldCheck,Smartphone,Users} from 'lucide-react';
import AppShell from '@/components/phase15/AppShell';

export default function SettingsPage(){
 const router=useRouter();
 const[user,setUser]=useState<any>(null),[installable,setInstallable]=useState(false);
 useEffect(()=>{try{const raw=localStorage.getItem('bitalis_auth_user');if(raw)setUser(JSON.parse(raw));}catch{}const standalone=window.matchMedia('(display-mode: standalone)').matches;setInstallable(!standalone);},[]);
 const isAdmin=String(user?.role||'').toUpperCase()==='ADMIN';
 return <AppShell title="Más"><div className="mx-auto max-w-5xl px-3 py-3 sm:px-4 sm:py-5">
  <section className="rounded-[24px] bg-[#12224A] p-4 text-white shadow-lg shadow-slate-900/10 sm:p-6">
   <div className="flex items-center gap-2 text-[10px] font-black uppercase tracking-[.14em] text-[#C79A3B]"><Settings className="h-4 w-4"/>Administración</div>
   <h1 className="mt-2 text-xl font-black sm:text-2xl">Más opciones</h1>
   <p className="mt-1 text-sm text-slate-300">Seguridad, sesión, sincronización y preferencias de BITALIS.</p>
  </section>
  <div className="mt-3 grid grid-cols-2 gap-2 sm:mt-5 sm:grid-cols-2 sm:gap-3">
   {isAdmin&&<ActionCard I={Users} title="Usuarios" text="Roles y permisos" onClick={()=>router.push('/settings/users')}/>} 
   <InfoCard I={ShieldCheck} title="Sesión" text={user?.email||'Usuario'}/>
   <InfoCard I={Database} title="Backend" text="Servidor activo"/>
   <InfoCard I={LockKeyhole} title="Seguridad" text="Validación por permisos"/>
   <InfoCard I={Smartphone} title="Aplicación" text={installable?'Disponible para instalar':'Ejecutándose instalada'}/>
   <ActionCard I={CloudUpload} title="Sincronización" text="Pendientes y reintentos" onClick={()=>router.push('/sync')}/>
   <InfoCard I={Bell} title="Notificaciones" text="Centro de alertas"/>
   <InfoCard I={KeyRound} title="Credenciales" text="Protegidas"/>
  </div>
 </div></AppShell>;
}

function ActionCard({I,title,text,onClick}:{I:any;title:string;text:string;onClick:()=>void}){return <button onClick={onClick} className="min-h-[108px] rounded-2xl border border-slate-200 bg-white p-3 text-left shadow-sm active:scale-[.98] sm:min-h-32 sm:rounded-3xl sm:p-5"><I className="h-5 w-5 text-[#FF6A00]"/><h2 className="mt-3 text-sm font-black text-[#12224A] sm:text-base">{title}</h2><p className="mt-1 text-[11px] leading-4 text-slate-500 sm:text-sm">{text}</p></button>}
function InfoCard({I,title,text}:{I:any;title:string;text:string}){return <article className="min-h-[108px] rounded-2xl border border-slate-200 bg-white p-3 shadow-sm sm:min-h-32 sm:rounded-3xl sm:p-5"><I className="h-5 w-5 text-[#C79A3B]"/><h2 className="mt-3 text-sm font-black text-[#12224A] sm:text-base">{title}</h2><p className="mt-1 break-words text-[11px] leading-4 text-slate-500 sm:text-sm">{text}</p></article>}
