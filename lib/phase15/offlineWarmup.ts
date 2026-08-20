'use client';

import {apiClient} from '@/lib/phase15/apiClient';

export async function prepareOfflineData(permissionCodes:string[]){
  if(typeof navigator==='undefined'||!navigator.onLine)return{downloaded:0};
  const permissions=new Set(permissionCodes),paths:string[]=[];
  if(permissions.has('collections.view'))paths.push('/api/collections/portfolio?scope=all');
  if(permissions.has('clients.view'))paths.push('/api/clients?limit=200');
  if(permissions.has('inventory.view'))paths.push('/api/products','/api/inventory');
  if(permissions.has('route.view'))paths.push('/api/collections/route-plan');
  let downloaded=0;
  await Promise.allSettled(paths.map(async path=>{await apiClient(path,{timeoutMs:30000});downloaded++;}));
  localStorage.setItem('bitalis_offline_ready',JSON.stringify({userId:JSON.parse(localStorage.getItem('bitalis_auth_user')||'{}')?.id||'',at:new Date().toISOString(),downloaded}));
  window.dispatchEvent(new CustomEvent('bitalis:offline-ready',{detail:{downloaded}}));
  return{downloaded};
}
