'use client';

import {useEffect} from 'react';
import {usePathname,useRouter} from 'next/navigation';

const common=['/dashboard','/notifications'];
const routesByRole:Record<string,string[]>={
  ADMIN:['/control-center','/cash','/inventory','/settings','/settings/users','/clients','/sales','/authorizations','/reports','/commissions'],
  SUPERVISORA:['/clients/new','/authorizations','/renewals','/control-center','/supervision/down-payments','/route','/cash','/reports','/sales/new'],
  SUPERVISOR:['/clients/new','/authorizations','/renewals','/control-center','/supervision/down-payments','/route','/cash','/reports','/sales/new'],
  VENDEDORA:['/clients/new','/sales/new','/clients','/products','/renewals','/commissions'],
  VENDEDOR:['/clients/new','/sales/new','/clients','/products','/renewals','/commissions'],
  COBRADOR:['/route','/collections','/clients','/cash','/commissions','/route/map','/route/navigate'],
};

type NetworkInformation={
  effectiveType?:string;
  saveData?:boolean;
};

export default function RoutePrefetcher(){
  const router=useRouter();
  const pathname=usePathname();
  const publicPath=pathname==='/'||pathname==='/login';

  useEffect(()=>{
    if(publicPath)return;
    let cancelled=false;

    const canPrefetch=()=>{
      if(!navigator.onLine||document.visibilityState!=='visible')return false;
      const connection=(navigator as Navigator&{connection?:NetworkInformation}).connection;
      if(connection?.saveData)return false;
      return connection?.effectiveType!=='slow-2g'&&connection?.effectiveType!=='2g';
    };

    const prefetch=()=>{
      if(cancelled||!canPrefetch())return;
      try{
        const raw=localStorage.getItem('bitalis_auth_user');
        if(!raw)return;
        const user=JSON.parse(raw);
        const role=String(user?.role||'').toUpperCase();
        // Sólo anticipar las siguientes acciones más probables. El resto carga bajo demanda.
        const routes=[...common,...(routesByRole[role]||[]).slice(0,3)];
        for(const route of new Set(routes))router.prefetch(route);
      }catch{}
    };

    // Esperar a que la pantalla actual y sus datos críticos hayan terminado.
    const id=window.setTimeout(prefetch,2500);
    window.addEventListener('bitalis:permissions-changed',prefetch);
    window.addEventListener('online',prefetch);
    return()=>{
      cancelled=true;
      window.clearTimeout(id);
      window.removeEventListener('bitalis:permissions-changed',prefetch);
      window.removeEventListener('online',prefetch);
    };
  },[router,publicPath,pathname]);

  return null;
}
