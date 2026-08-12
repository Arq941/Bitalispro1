'use client';

import {Camera,CalendarClock,Navigation,WalletCards,XCircle} from 'lucide-react';
import {useRouter} from 'next/navigation';

function clickButton(label:string){
 const buttons=Array.from(document.querySelectorAll('button')) as HTMLButtonElement[];
 const target=buttons.find(b=>(b.innerText||'').trim().toLowerCase().includes(label.toLowerCase()));
 if(target){target.click();target.scrollIntoView({behavior:'smooth',block:'center'});return true;}
 return false;
}

export default function RouteQuickActions(){
 const router=useRouter();
 const openPhotos=()=>{
  const buttons=Array.from(document.querySelectorAll('button')) as HTMLButtonElement[];
  const target=buttons.find(b=>(b.innerText||'').toUpperCase().includes('FOTOS')||(b.getAttribute('aria-label')||'').toLowerCase().includes('foto'));
  if(target)target.click();
 };
 const focusReschedule=()=>{
  const input=document.querySelector('input[type="date"]') as HTMLInputElement|null;
  if(input){input.scrollIntoView({behavior:'smooth',block:'center'});window.setTimeout(()=>input.focus(),300);}
 };
 return <div className="fixed inset-x-0 bottom-[78px] z-[78] px-3 print:hidden sm:hidden"><div className="mx-auto grid max-w-lg grid-cols-5 gap-1.5 rounded-[22px] border border-white/10 bg-slate-950/95 p-2 shadow-2xl shadow-black/40 backdrop-blur-xl">
  <button type="button" onClick={()=>clickButton('Registrar abono')} className="flex min-h-14 flex-col items-center justify-center gap-1 rounded-2xl bg-emerald-500 text-[9px] font-black text-slate-950"><WalletCards className="h-4 w-4"/>COBRAR</button>
  <button type="button" onClick={()=>clickButton('No pagó')} className="flex min-h-14 flex-col items-center justify-center gap-1 rounded-2xl border border-orange-400/20 bg-orange-500/10 text-[9px] font-black text-orange-200"><XCircle className="h-4 w-4"/>NO PAGÓ</button>
  <button type="button" onClick={focusReschedule} className="flex min-h-14 flex-col items-center justify-center gap-1 rounded-2xl border border-blue-400/20 bg-blue-500/10 text-[9px] font-black text-blue-200"><CalendarClock className="h-4 w-4"/>REAGENDAR</button>
  <button type="button" onClick={openPhotos} className="flex min-h-14 flex-col items-center justify-center gap-1 rounded-2xl border border-[#FF6A00]/30 bg-[#FF6A00]/10 text-[9px] font-black text-orange-200"><Camera className="h-4 w-4"/>FOTOS</button>
  <button type="button" onClick={()=>router.push('/route/navigate')} className="flex min-h-14 flex-col items-center justify-center gap-1 rounded-2xl border border-white/10 bg-white text-[9px] font-black text-slate-950"><Navigation className="h-4 w-4"/>NAVEGAR</button>
 </div></div>;
}
