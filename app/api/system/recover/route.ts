import {NextRequest} from 'next/server';

export const dynamic='force-dynamic';

export function GET(request:NextRequest){
  const rawReturn=request.nextUrl.searchParams.get('return')||'/';
  const safeReturn=rawReturn.startsWith('/')&&!rawReturn.startsWith('//')?rawReturn:'/';
  const target=new URL(safeReturn,'https://bitalis.invalid');
  target.searchParams.delete('__bitalis_build');
  target.searchParams.set('__bitalis_recover',Date.now().toString());
  const relativeLocation=`${target.pathname}${target.search}${target.hash}`;

  // Location debe permanecer relativa: Hostinger termina TLS en un proxy y
  // request.url puede contener la dirección interna http://0.0.0.0:3000.
  return new Response(null,{
    status:307,
    headers:{
      Location:relativeLocation,
      'Clear-Site-Data':'"cache"',
      'Cache-Control':'no-store, max-age=0, must-revalidate',
      Pragma:'no-cache',
      'X-Content-Type-Options':'nosniff',
    },
  });
}
