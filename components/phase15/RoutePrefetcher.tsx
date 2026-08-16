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

export default function RoutePrefetcher(){
  const router=useRouter();
  const pathname=usePathname();
  const publicPath=pathname==='/'||pathname==='/login';
  useEffect(()=>{
    if(publicPath)return;
    let cancelled=false;
    const prefetch=()=>{
      if(cancelled)return;
      try{
        const raw=localStorage.getItem('bitalis_auth_user');
        if(!raw)return;
        const user=JSON.parse(raw);
        const role=String(user?.role||'').toUpperCase();
        const routes=[...common,...(routesByRole[role]||[])];
        for(const route of new Set(routes))router.prefetch(route);
      }catch{}
    };
    const id=window.setTimeout(prefetch,450);
    window.addEventListener('bitalis:permissions-changed',prefetch);
    return()=>{cancelled=true;window.clearTimeout(id);window.removeEventListener('bitalis:permissions-changed',prefetch);};
  },[router,publicPath,pathname]);
  return null;
}
