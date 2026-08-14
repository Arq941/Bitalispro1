import {NextRequest,NextResponse} from 'next/server';
import {AuditLogService} from '@/src/audit/audit-log.service';
import {ClientService} from '@/src/crm/client.service';
import {getClientUserContext} from '@/src/crm/auth-helper';
import {PrismaService} from '@/src/database/prisma.service';
import {PermissionService} from '@/src/server/auth/permission.service';

function errorStatus(error:unknown){
 const message=String((error as any)?.message||'');
 if(message.includes('UNAUTHORIZED'))return 401;
 if(message.includes('FORBIDDEN'))return 403;
 if(message.includes('no encontrado'))return 404;
 return 400;
}

export async function PATCH(req:NextRequest,{params}:{params:Promise<{id:string}>}){
 try{
  const{id}=await params;
  const user=getClientUserContext(req);
  await PermissionService.requirePermission(user.userId,'clients.edit');
  if(!(await ClientService.checkClientAccess(id,user)))throw new Error('FORBIDDEN: No tienes acceso para actualizar la ubicación de este cliente.');

  const body=await req.json();
  const latitude=Number(body?.latitude),longitude=Number(body?.longitude);
  const accuracy=body?.locationAccuracy==null||body?.locationAccuracy===''?null:Number(body.locationAccuracy);
  if(!Number.isFinite(latitude)||latitude < -90||latitude > 90)return NextResponse.json({success:false,error:'Latitud inválida. Debe estar entre -90 y 90.'},{status:400});
  if(!Number.isFinite(longitude)||longitude < -180||longitude > 180)return NextResponse.json({success:false,error:'Longitud inválida. Debe estar entre -180 y 180.'},{status:400});
  if(accuracy!==null&&(!Number.isFinite(accuracy)||accuracy<0))return NextResponse.json({success:false,error:'Precisión GPS inválida.'},{status:400});

  const prisma=PrismaService.getInstance();
  const previous=await prisma.client.findUnique({where:{id},select:{id:true,clientNumber:true,latitude:true,longitude:true,locationAccuracy:true}});
  if(!previous)throw new Error('Cliente no encontrado.');
  const capturedAt=new Date();
  const updated=await prisma.$transaction(async tx=>{
   const client=await tx.client.update({where:{id},data:{latitude,longitude,locationAccuracy:accuracy,locationCapturedAt:capturedAt}});
   await tx.clientTimeline.create({data:{clientId:id,eventType:'LOCATION_UPDATED',entityType:'Client',entityId:id,description:'Coordenadas del cliente actualizadas',userId:user.userId,latitude,longitude}});
   return client;
  });
  AuditLogService.log({userId:user.userId,action:'CLIENT_LOCATION_UPDATED',entity:'Client',entityId:id,oldValues:JSON.stringify({latitude:previous.latitude,longitude:previous.longitude,locationAccuracy:previous.locationAccuracy}),newValues:JSON.stringify({latitude,longitude,locationAccuracy:accuracy,locationCapturedAt:capturedAt})});
  return NextResponse.json({success:true,client:updated});
 }catch(error:any){
  return NextResponse.json({success:false,error:error?.message||'No pudimos actualizar la ubicación.'},{status:errorStatus(error)});
 }
}
