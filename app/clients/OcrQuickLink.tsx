'use client';

import {Sparkles} from 'lucide-react';
import {useRouter} from 'next/navigation';
import {useShellPermissions} from '@/components/phase15/AppShell';
import {haptic} from '@/lib/ux/haptics';

export default function OcrQuickLink(){
  const router=useRouter();
  const permissions=useShellPermissions();
  if(permissions?.has('clients.create')!==true)return null;

  return <div className="mx-auto max-w-6xl px-3 pt-3 sm:px-4">
    <button
      type="button"
      onClick={()=>{haptic('tap');router.push('/clients/new');}}
      className="flex min-h-14 w-full items-center justify-center gap-2 rounded-2xl border-2 border-violet-300 bg-violet-50 px-4 text-sm font-black text-violet-800 shadow-sm transition active:scale-[.98]"
      aria-label="Abrir alta rápida con OCR de contrato"
    >
      <Sparkles className="h-5 w-5"/>
      ESCANEAR CONTRATO CON OCR
    </button>
    <p className="mt-1.5 text-center text-[10px] font-bold text-slate-500">Abre la captura completa con Gemini para leer nombre, teléfono, folio, importes y datos visibles del contrato.</p>
  </div>;
}
