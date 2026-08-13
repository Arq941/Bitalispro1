'use client';

import {useEffect,useState} from 'react';

export default function AdminBuildIndicator(){
  const[build,setBuild]=useState('');
  const[isAdmin,setIsAdmin]=useState(false);

  useEffect(()=>{
    try{
      const raw=localStorage.getItem('bitalis_auth_user');
      if(raw){
        const user=JSON.parse(raw);
        setIsAdmin(String(user?.role||'').toUpperCase()==='ADMIN');
      }
    }catch{}

    fetch('/build-version.txt',{cache:'no-store'})
      .then(res=>res.ok?res.text():'')
      .then(text=>{
        const match=text.match(/^commit=(.+)$/m);
        if(match?.[1]) setBuild(match[1].trim().slice(0,8));
      })
      .catch(()=>{});
  },[]);

  if(!isAdmin||!build)return null;
  return <div className="fixed bottom-[88px] right-3 z-[120] rounded-full border border-slate-300 bg-white/95 px-2.5 py-1 text-[10px] font-black text-slate-600 shadow-sm backdrop-blur">Build {build}</div>;
}
