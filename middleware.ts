import { NextRequest, NextResponse } from 'next/server';

type Claims={sub?:string;sessionId?:string;permissionVersion?:number;role?:string;exp?:number};

const PUBLIC_API=[
  '/api/auth/login',
  '/api/auth/refresh',
  '/api/auth/set-password',
  '/api/health',
  '/api/health/live',
  '/api/health/ready',
  '/api/system/version',
];

const SUPERVISION_PREFIXES=[
  '/api/admin/',
  '/api/cash/supervisor/',
  '/api/cash-variances/',
  '/api/offline/conflicts',
  '/api/offline/retry/',
  '/api/commissions/rules',
  '/api/commissions/targets',
  '/api/commissions/penalties',
  '/api/commissions/reversals',
];

const ADMIN_ONLY_PREFIXES=['/api/admin/','/api/audit','/api/inventory','/api/product-orders'];

function base64UrlBytes(value:string){
  const normalized=value.replace(/-/g,'+').replace(/_/g,'/');
  const padded=normalized.padEnd(Math.ceil(normalized.length/4)*4,'=');
  return Uint8Array.from(atob(padded),char=>char.charCodeAt(0));
}

function parseClaims(segment:string):Claims|null{
  try{return JSON.parse(new TextDecoder().decode(base64UrlBytes(segment))) as Claims;}catch{return null;}
}

async function verifyJwt(token:string,secret:string):Promise<Claims|null>{
  const parts=token.split('.');
  if(parts.length!==3)return null;
  const header=parseClaims(parts[0]) as any;
  const claims=parseClaims(parts[1]);
  if(!header||header.alg!=='HS256'||header.typ!=='JWT'||!claims)return null;
  const key=await crypto.subtle.importKey('raw',new TextEncoder().encode(secret),{name:'HMAC',hash:'SHA-256'},false,['verify']);
  const valid=await crypto.subtle.verify('HMAC',key,base64UrlBytes(parts[2]),new TextEncoder().encode(`${parts[0]}.${parts[1]}`));
  if(!valid||!claims.sub||!claims.sessionId||!claims.role||typeof claims.permissionVersion!=='number')return null;
  if(!claims.exp||claims.exp<=Math.floor(Date.now()/1000))return null;
  return claims;
}

function jsonError(message:string,status:number){
  return NextResponse.json({success:false,error:message},{status});
}

export async function middleware(req:NextRequest){
  const path=req.nextUrl.pathname;

  // La recuperación de entrega necesita invalidar también la caché HTTP del
  // navegador. `Clear-Site-Data: \"cache\"` no borra cookies, sesión, IndexedDB
  // ni la cola offline; únicamente obliga a descargar nuevamente los assets.
  if(!path.startsWith('/api/')&&req.nextUrl.searchParams.has('__bitalis_recover')){
    const response=NextResponse.next();
    response.headers.set('Clear-Site-Data','\"cache\"');
    response.headers.set('Cache-Control','no-store, max-age=0');
    return response;
  }
  const declaredLength=Number(req.headers.get('content-length')||'0');
  const maxBytes=path==='/api/clients/intake'||path.includes('/media')||path.includes('/images')?25*1024*1024:2*1024*1024;
  if(Number.isFinite(declaredLength)&&declaredLength>maxBytes)return jsonError('La solicitud excede el tamaño permitido.',413);
  if(PUBLIC_API.some(item=>path===item||path.startsWith(`${item}/`)))return NextResponse.next();

  const secret=process.env.JWT_SECRET?.trim();
  if(!secret||secret.length<32)return jsonError('Servicio no disponible por configuración de seguridad.',503);
  const authorization=req.headers.get('authorization');
  if(!authorization?.toLowerCase().startsWith('bearer '))return jsonError('Autenticación requerida.',401);
  const claims=await verifyJwt(authorization.slice(7).trim(),secret);
  if(!claims)return jsonError('Sesión inválida o expirada.',401);

  const role=String(claims.role).toUpperCase();
  if(ADMIN_ONLY_PREFIXES.some(prefix=>path.startsWith(prefix))&&role!=='ADMIN')return jsonError('Acceso exclusivo de administración.',403);
  if(SUPERVISION_PREFIXES.some(prefix=>path.startsWith(prefix))&&!['ADMIN','SUPERVISORA'].includes(role))return jsonError('Se requiere autorización de supervisión.',403);

  const headers=new Headers(req.headers);
  headers.set('x-authenticated-user-id',String(claims.sub));
  headers.set('x-authenticated-role',role);
  headers.set('x-authenticated-session-id',String(claims.sessionId));
  const response=NextResponse.next({request:{headers}});
  response.headers.set('Cache-Control','no-store');
  response.headers.set('X-Content-Type-Options','nosniff');
  return response;
}

export const config={matcher:['/api/:path*','/((?!_next/static|_next/image|favicon.ico).*)']};
