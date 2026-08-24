import {NextRequest,NextResponse}from'next/server';
import{OfflineSyncService,SyncOperationPayload}from'@/src/offline/offline-sync.service';
import{extractUserContext}from'@/src/sales/sales-auth.helper';

const MAX_BATCH=25;
const ALLOWED=new Set(['PAYMENT','DOWN_PAYMENT','VISIT','NON_PAYMENT_REASON','RESCHEDULE','PAYMENT_PROMISE','EXPENSE','GPS_TRACE','CLIENT','SALE','PRICE_OVERRIDE','DISCOUNT_OVERRIDE','TWO_PRODUCT_SALE','FORCE_CREDIT','CASH_ADJUSTMENT']);
const UUID=/^[0-9a-z][0-9a-z._:-]{15,199}$/i;
function validate(deviceId:unknown,operations:unknown[]):string|null{
 if(typeof deviceId!=='string'||deviceId.length<3||deviceId.length>120)return'Dispositivo inválido';
 if(operations.length<1||operations.length>MAX_BATCH)return'El lote debe contener entre 1 y '+MAX_BATCH+' operaciones';
 const seen=new Set<string>();
 for(const raw of operations){
  const op=raw as Partial<SyncOperationPayload>;
  if(typeof op.idempotencyKey!=='string'||!UUID.test(op.idempotencyKey))return'Clave de idempotencia inválida';
  if(seen.has(op.idempotencyKey))return'El lote contiene claves de idempotencia repetidas';
  seen.add(op.idempotencyKey);
  if(typeof op.operationType!=='string'||!ALLOWED.has(op.operationType))return'Tipo de operación inválido';
  if(op.deviceId&&op.deviceId!==deviceId)return'La operación pertenece a otro dispositivo';
  const captured=Date.parse(String(op.clientCapturedAt||''));if(!Number.isFinite(captured))return'Fecha de captura inválida';
  if(op.payload===null||typeof op.payload!=='object'||Array.isArray(op.payload))return'Contenido de operación inválido';
 }
 return null;
}
export async function POST(req:NextRequest){
 try{
  const user=await extractUserContext(req);const body=await req.json();
  const operations=Array.isArray(body?.operations)?body.operations:body?.idempotencyKey?[body]:[];
  const error=validate(body?.deviceId,operations);if(error)return NextResponse.json({success:false,error},{status:400});
  // Identity is taken only from the verified session. Client supplied userId is ignored.
  const sanitized=operations.map((op:any)=>({...op,userId:undefined,deviceId:body.deviceId}));
  const results=await OfflineSyncService.processSyncBatch(body.deviceId,user.userId,sanitized);
  const count=(status:string)=>results.filter(r=>r.status===status).length;
  return NextResponse.json({success:count('FAILED')===0,processedCount:results.length,syncedCount:count('SYNCED'),
   duplicateCount:count('DUPLICATE'),conflictCount:count('CONFLICT'),rejectedCount:count('REJECTED'),failedCount:count('FAILED'),results});
 }catch(error:any){
  const message=String(error?.message||'');const status=message.includes('UNAUTHORIZED')?401:message.startsWith('FORBIDDEN:')?403:500;
  return NextResponse.json({success:false,error:status===500?'No se pudo sincronizar el lote':message},{status});
 }
}
