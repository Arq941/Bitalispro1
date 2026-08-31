import {NextRequest} from 'next/server';
import {CashService} from '@/src/cash/cash.service';
import {getTrustedRequestContext, type TrustedRequestContext} from '@/src/server/auth/request-context';

export function httpStatusForCashError(message:string){
  if(message.includes('UNAUTHORIZED'))return 401;
  if(message.includes('FORBIDDEN'))return 403;
  if(message.includes('no encontrada')||message.includes('not found'))return 404;
  return 400;
}

export async function requireCashSessionAccess(req:NextRequest,sessionId:string){
  const context=getTrustedRequestContext(req);
  const session=await CashService.getSessionById(sessionId);
  if(!session)throw new Error('Sesión de caja no encontrada.');
  const privileged=context.role==='ADMIN'||context.role==='SUPERVISORA';
  if(!privileged&&(context.role!=='COBRADOR'||session.collectorId!==context.userId)){
    throw new Error('FORBIDDEN: No tienes permiso sobre esta sesión de caja.');
  }
  return {context,session};
}

export function requireCollectorOrSupervisor(req:NextRequest,collectorId:string):TrustedRequestContext{
  const context=getTrustedRequestContext(req);
  const privileged=context.role==='ADMIN'||context.role==='SUPERVISORA';
  if(!privileged&&(context.role!=='COBRADOR'||context.userId!==collectorId)){
    throw new Error('FORBIDDEN: No tienes permiso sobre la caja de este cobrador.');
  }
  return context;
}
