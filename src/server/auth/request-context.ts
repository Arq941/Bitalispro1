import { NextRequest } from 'next/server';

export type TrustedRequestContext={userId:string;role:'ADMIN'|'SUPERVISORA'|'VENDEDORA'|'COBRADOR';sessionId:string};

export function getTrustedRequestContext(req:NextRequest):TrustedRequestContext{
  const userId=req.headers.get('x-authenticated-user-id')?.trim();
  const role=req.headers.get('x-authenticated-role')?.trim() as TrustedRequestContext['role']|undefined;
  const sessionId=req.headers.get('x-authenticated-session-id')?.trim();
  if(!userId||!sessionId||!role||!['ADMIN','SUPERVISORA','VENDEDORA','COBRADOR'].includes(role))throw new Error('UNAUTHORIZED: Contexto autenticado requerido.');
  return {userId,role,sessionId};
}

export function requireTrustedRole(req:NextRequest,roles:TrustedRequestContext['role'][]){
  const context=getTrustedRequestContext(req);
  if(!roles.includes(context.role))throw new Error('FORBIDDEN: Rol insuficiente.');
  return context;
}
