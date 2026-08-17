'use client';

import {FormEvent,useState} from 'react';
import {usePathname} from 'next/navigation';
import {Bot,Loader2,Send,Sparkles,X} from 'lucide-react';
import {apiClient} from '@/lib/phase15/apiClient';
import {haptic} from '@/lib/ux/haptics';

type Message={role:'user'|'assistant';text:string;tools?:string[]};
const suggestions=['¿Qué clientes debo priorizar hoy?','¿Cómo va mi ruta de cobranza?','Busca un cliente por nombre o teléfono','Consulta stock de un producto'];

export default function GeminiCopilot(){
 const pathname=usePathname();
 const[open,setOpen]=useState(false),[input,setInput]=useState(''),[loading,setLoading]=useState(false),[messages,setMessages]=useState<Message[]>([]),[error,setError]=useState('');
 const ask=async(raw?:string)=>{
  const text=String(raw??input).trim();if(!text||loading)return;
  if(!navigator.onLine){setError('BITALIS IA necesita internet para consultar Gemini. El resto de la app puede seguir trabajando offline.');return;}
  haptic('tap');setError('');setMessages(current=>[...current,{role:'user',text}]);setInput('');setLoading(true);
  try{
   const json:any=await apiClient('/api/ai/copilot',{method:'POST',timeoutMs:40000,body:JSON.stringify({message:text})});
   if(!json?.success)throw new Error(json?.error||'No fue posible consultar BITALIS IA.');
   setMessages(current=>[...current,{role:'assistant',text:String(json.answer||'Sin respuesta.'),tools:Array.isArray(json.toolsUsed)?json.toolsUsed:[]}]);haptic('success');
  }catch(e:any){setError(e?.message||'No fue posible consultar BITALIS IA.');haptic('error');}
  finally{setLoading(false);}
 };
 const submit=(event:FormEvent)=>{event.preventDefault();void ask();};
 if(pathname==='/'||pathname==='/login')return null;
 return <>
  <button type="button" onClick={()=>{haptic('tap');setOpen(true);}} className="bitalis-floating-action bitalis-floating-action-right z-[80] bg-[var(--bitalis-primary)] text-white shadow-[0_12px_30px_rgba(6,43,36,.28)] ring-4 ring-white/90" aria-label="Abrir BITALIS IA"><Sparkles className="h-5 w-5 sm:h-6 sm:w-6"/></button>
  {open&&<div data-no-swipe className="fixed inset-0 z-[180] flex items-end bg-slate-950/55 backdrop-blur-sm sm:items-center sm:justify-center sm:p-4" onClick={()=>!loading&&setOpen(false)}>
   <section onClick={e=>e.stopPropagation()} className="bitalis-dialog-sheet w-full max-h-[92svh] overflow-hidden rounded-t-[30px] bg-white shadow-2xl sm:max-w-xl sm:rounded-[30px]">
    <header className="flex items-center justify-between gap-3 bg-[var(--bitalis-primary)] p-4 text-white"><div className="flex min-w-0 items-center gap-3"><span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-white/10"><Bot className="h-6 w-6"/></span><div className="min-w-0"><p className="truncate text-[10px] font-black uppercase tracking-[.14em] text-[var(--bitalis-mint)]">Gemini · datos reales</p><h2 className="text-lg font-black">BITALIS IA</h2></div></div><button disabled={loading} onClick={()=>setOpen(false)} className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-white/10 disabled:opacity-50" aria-label="Cerrar BITALIS IA"><X className="h-5 w-5"/></button></header>
    <div className="max-h-[58svh] overflow-y-auto overscroll-contain p-3 sm:p-4">
     {!messages.length&&<div className="rounded-3xl border border-emerald-100 bg-emerald-50/60 p-4"><p className="text-sm font-black text-[var(--bitalis-primary)]">Pregúntame sobre tu operación.</p><p className="mt-1 text-xs leading-5 text-slate-600">Puedo consultar cartera, clientes, ruta, caja y productos según tus permisos. Por seguridad esta versión es solo lectura.</p><div className="mt-3 grid gap-2">{suggestions.map(text=><button key={text} onClick={()=>void ask(text)} className="min-h-12 rounded-2xl bg-white px-3 text-left text-xs font-bold text-slate-700 shadow-sm">{text}</button>)}</div></div>}
     <div className="space-y-3">{messages.map((message,index)=><div key={index} className={message.role==='user'?'ml-8 break-words rounded-3xl rounded-br-lg bg-[var(--bitalis-primary)] p-3 text-sm text-white sm:ml-10':'mr-4 break-words rounded-3xl rounded-bl-lg border border-slate-200 bg-slate-50 p-3 text-sm leading-6 text-slate-700 sm:mr-6'}><p className="whitespace-pre-wrap">{message.text}</p>{message.role==='assistant'&&message.tools?.length?<p className="mt-2 text-[9px] font-black uppercase tracking-[.1em] text-emerald-700">Consultó: {message.tools.join(' · ')}</p>:null}</div>)}</div>
     {loading&&<div className="mt-3 mr-12 flex items-center gap-2 rounded-3xl border border-violet-100 bg-violet-50 p-3 text-sm font-bold text-violet-800 sm:mr-20"><Loader2 className="h-4 w-4 animate-spin"/>Gemini está consultando BITALIS…</div>}
     {error&&<div role="alert" className="mt-3 rounded-2xl border border-red-200 bg-red-50 p-3 text-xs font-bold text-red-700">{error}</div>}
    </div>
    <form onSubmit={submit} className="border-t border-slate-200 bg-white p-3 pb-[max(.75rem,env(safe-area-inset-bottom))] sm:p-4"><div className="flex min-w-0 gap-2"><textarea value={input} onChange={e=>setInput(e.target.value.slice(0,1200))} rows={2} placeholder="Ej. ¿Qué clientes tienen mayor prioridad hoy?" className="min-h-14 min-w-0 flex-1 resize-none rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-base outline-none focus:border-[var(--bitalis-action)]"/><button disabled={loading||!input.trim()} className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-[var(--bitalis-action)] text-white disabled:opacity-40" aria-label="Enviar a BITALIS IA">{loading?<Loader2 className="h-5 w-5 animate-spin"/>:<Send className="h-5 w-5"/>}</button></div><p className="mt-2 text-center text-[9px] font-bold text-slate-400">BITALIS IA no registra pagos ni modifica datos en esta etapa.</p></form>
   </section>
  </div>}
 </>;
}