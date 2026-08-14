'use client';

import {ShieldAlert,LogOut,Activity} from 'lucide-react';
import {useRouter} from 'next/navigation';

export default function AccessUnavailablePage(){
  const router=useRouter();
  const signOut=()=>{
    try{
      localStorage.removeItem('bitalis_access_token');
      localStorage.removeItem('bitalis_refresh_token');
      localStorage.removeItem('bitalis_auth_user');
      sessionStorage.removeItem('bitalis_effective_permissions');
    }catch{}
    window.location.replace('/');
  };

  return <main className="mx-auto flex min-h-[70svh] w-full max-w-lg items-center px-4 py-8">
    <section className="w-full rounded-[28px] border border-[var(--bitalis-border)] bg-white p-6 text-center shadow-[0_16px_42px_rgba(6,43,36,.08)]">
      <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-3xl bg-amber-50 text-amber-700"><ShieldAlert className="h-8 w-8"/></div>
      <p className="mt-5 text-[10px] font-black uppercase tracking-[.14em] text-[var(--bitalis-action)]">Sesión autenticada</p>
      <h1 className="mt-2 text-xl font-black text-[var(--bitalis-primary)]">No hay módulos habilitados para esta cuenta</h1>
      <p className="mt-2 text-sm leading-6 text-slate-500">La sesión es válida, pero los permisos efectivos no incluyen una pantalla de entrada disponible. BITALIS no te enviará de vuelta al Login en bucle.</p>
      <div className="mt-6 grid gap-2">
        <button onClick={()=>router.push('/diagnostics-transition')} className="flex min-h-14 items-center justify-center gap-2 rounded-2xl bg-emerald-50 px-4 text-sm font-black text-[var(--bitalis-primary)]"><Activity className="h-5 w-5"/>VER DIAGNÓSTICO</button>
        <button onClick={signOut} className="flex min-h-14 items-center justify-center gap-2 rounded-2xl bg-red-50 px-4 text-sm font-black text-red-700"><LogOut className="h-5 w-5"/>CERRAR SESIÓN</button>
      </div>
    </section>
  </main>;
}
