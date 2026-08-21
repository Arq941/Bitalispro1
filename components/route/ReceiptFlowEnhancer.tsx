'use client';

import {useEffect} from 'react';
import {useRouter} from 'next/navigation';

export default function ReceiptFlowEnhancer(){
  const router=useRouter();

  useEffect(()=>{
    const enhance=()=>{
      const nodes=Array.from(document.querySelectorAll('div')) as HTMLDivElement[];
      const receipt=nodes.find(node=>{
        const text=node.innerText||'';
        return text.includes('Comprobante de pago')&&text.includes('Nuevo saldo')&&text.includes('Imprimir');
      });
      if(!receipt||receipt.querySelector('[data-bitalis-next-client]'))return;

      const continueButton=Array.from(receipt.querySelectorAll('button')).find(b=>(b.innerText||'').trim()==='Continuar') as HTMLButtonElement|undefined;
      if(!continueButton)return;

      continueButton.className='rounded-xl border border-slate-300 px-3 py-3 text-xs font-black text-slate-700';
      continueButton.textContent='Cerrar';

      const nextButton=document.createElement('button');
      nextButton.type='button';
      nextButton.setAttribute('data-bitalis-next-client','true');
      nextButton.className='col-span-2 mt-1 min-h-14 rounded-xl bg-[#11A65A] px-4 py-3 text-sm font-black text-[#062B24]';
      nextButton.textContent='SIGUIENTE CLIENTE →';
      nextButton.onclick=()=>{
        continueButton.click();
        window.setTimeout(()=>router.push('/route/navigate'),120);
      };

      continueButton.parentElement?.appendChild(nextButton);
    };

    enhance();
    const observer=new MutationObserver(enhance);
    observer.observe(document.body,{subtree:true,childList:true});
    return()=>observer.disconnect();
  },[router]);

  return null;
}
