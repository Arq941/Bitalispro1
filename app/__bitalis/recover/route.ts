import {NextRequest,NextResponse} from 'next/server';

export const dynamic='force-dynamic';

export function GET(request:NextRequest){
  const rawReturn=request.nextUrl.searchParams.get('return')||'/';
  const safeReturn=rawReturn.startsWith('/')&&!rawReturn.startsWith('//')?rawReturn:'/';
  const target=new URL(safeReturn,request.url);
  target.searchParams.set('__bitalis_recover',Date.now().toString());

  const response=NextResponse.redirect(target,307);
  // Sólo se limpia la caché HTTP. Cookies, sesión, IndexedDB y cola offline
  // permanecen intactas para no perder altas capturadas sin conexión.
  response.headers.set('Clear-Site-Data','"cache"');
  response.headers.set('Cache-Control','no-store, max-age=0');
  return response;
}
