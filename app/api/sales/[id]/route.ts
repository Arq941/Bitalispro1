import { NextRequest, NextResponse } from 'next/server';
import { SalesService } from '@/src/sales/sales.service';
import { PrismaService } from '@/src/database/prisma.service';
import { AuditLogService } from '@/src/audit/audit-log.service';
import { InventoryService } from '@/src/inventory/inventory.service';
import { getSalesUserContext } from '@/src/sales/sales-auth.helper';
import { PermissionService } from '@/src/server/auth/permission.service';

const prisma=PrismaService.getInstance();
function codeFromError(error:any){const m=String(error?.message||'');if(m.includes('UNAUTHORIZED'))return 401;if(m.includes('FORBIDDEN'))return 403;return 400;}

export async function GET(req:NextRequest,{params}:{params:Promise<{id:string}>}){
 try{const ctx=getSalesUserContext(req);await PermissionService.requirePermission(ctx.userId,'sales.view');const{id}=await params;const sale=await SalesService.getSaleById(id);if(!sale)return NextResponse.json({error:'Venta no encontrada'},{status:404});return NextResponse.json(sale,{status:200});}
 catch(err:any){return NextResponse.json({error:err.message||'Error al obtener la venta'},{status:codeFromError(err)});}
}

export async function PATCH(req:NextRequest,{params}:{params:Promise<{id:string}>}){
 try{
  const ctx=getSalesUserContext(req);await PermissionService.requirePermission(ctx.userId,'sales.view');
  if(!['ADMIN','SUPERVISORA'].includes(ctx.role))return NextResponse.json({error:'FORBIDDEN: Solo ADMIN o SUPERVISORA puede reasignar una venta.'},{status:403});
  const{id}=await params,body=await req.json(),clientId=String(body?.clientId||'').trim();
  if(!clientId)return NextResponse.json({error:'Selecciona el cliente correcto.'},{status:400});
  const[sale,target]=await Promise.all([prisma.sale.findUnique({where:{id},include:{credits:true}}),prisma.client.findUnique({where:{id:clientId},select:{id:true,clientNumber:true,firstName:true,lastName:true}})]);
  if(!sale)return NextResponse.json({error:'Venta no encontrada.'},{status:404});
  if(!target)return NextResponse.json({error:'Cliente no encontrado.'},{status:404});
  if(sale.clientId===clientId)return NextResponse.json(await SalesService.getSaleById(id));
  await prisma.$transaction(async tx=>{await tx.sale.update({where:{id},data:{clientId}});await tx.credit.updateMany({where:{saleId:id},data:{clientId}})});
  await AuditLogService.log({userId:ctx.userId,action:'SALE_CLIENT_REASSIGNED',entity:'Sale',entityId:id,oldValues:JSON.stringify({clientId:sale.clientId}),newValues:JSON.stringify({clientId,targetClientNumber:target.clientNumber}),notes:`Venta y ${sale.credits.length} crédito(s) relacionados al cliente correcto por ${ctx.role}.`});
  return NextResponse.json(await SalesService.getSaleById(id));
 }catch(err:any){return NextResponse.json({error:err.message||'No se pudo actualizar la venta.'},{status:codeFromError(err)});}
}

export async function DELETE(req:NextRequest,{params}:{params:Promise<{id:string}>}){
 try{
  const ctx=getSalesUserContext(req);if(ctx.role!=='ADMIN')return NextResponse.json({error:'FORBIDDEN: Solo ADMIN puede eliminar ventas.'},{status:403});const{id}=await params;
  const sale=await prisma.sale.findUnique({where:{id},include:{downPayment:true,companyContribution:true,credits:true,items:true}});if(!sale)return NextResponse.json({error:'Venta no encontrada.'},{status:404});
  const[paymentCount,settlementCount,promiseCount,visitCount]=await Promise.all([
    prisma.payment.count({where:{credit:{saleId:id}}}),
    prisma.settlement.count({where:{credit:{saleId:id}}}),
    prisma.paymentPromise.count({where:{credit:{saleId:id}}}),
    prisma.collectionVisit.count({where:{credit:{saleId:id}}}),
  ]);
  if(paymentCount>0||settlementCount>0||promiseCount>0||visitCount>0)return NextResponse.json({error:'Esta venta ya tiene actividad de cobranza, liquidación o promesas registradas y no puede eliminarse. Cancélala para conservar el historial.'},{status:409});
  if(sale.downPayment)return NextResponse.json({error:'Esta venta tiene un enganche registrado y no puede eliminarse sin borrar un movimiento financiero. Cancélala para conservar caja y auditoría.'},{status:409});
  const reservations=await prisma.inventoryReservation.findMany({where:{saleId:id}});if(reservations.some(r=>String(r.status)==='CONVERTED_TO_DELIVERY'))return NextResponse.json({error:'La venta ya convirtió inventario a entrega y no puede eliminarse. Cancélala o registra la devolución correspondiente.'},{status:409});
  for(const reservation of reservations)if(String(reservation.status)==='ACTIVE')await InventoryService.releaseReservation(reservation.id,ctx.userId,`Eliminación administrativa de venta ${sale.saleNumber}`);
  const snapshot={saleNumber:sale.saleNumber,clientId:sale.clientId,sellerId:sale.sellerId,status:sale.status,saleType:sale.saleType,totalAmount:String(sale.totalAmount),credits:sale.credits.length,items:sale.items.length};
  await prisma.$transaction(async tx=>{
   await tx.commission.deleteMany({where:{saleId:id}});
   await tx.paymentReschedule.deleteMany({where:{credit:{saleId:id}}});
   await tx.paymentSchedule.deleteMany({where:{credit:{saleId:id}}});
   await tx.credit.deleteMany({where:{saleId:id}});
   await tx.authorizationRequest.deleteMany({where:{saleId:id}});
   await tx.downPaymentException.deleteMany({where:{saleId:id}});
   await tx.companyContribution.deleteMany({where:{saleId:id}});
   await tx.inventoryReservation.deleteMany({where:{saleId:id}});
   await tx.saleItem.deleteMany({where:{saleId:id}});
   await tx.sale.delete({where:{id}});
  });
  await AuditLogService.log({userId:ctx.userId,action:'SALE_DELETED_BY_ADMIN',entity:'Sale',entityId:id,oldValues:JSON.stringify(snapshot),notes:'Eliminación administrativa sin cobros, enganche, liquidaciones ni actividad de cobranza.'});return NextResponse.json({success:true,id,saleNumber:sale.saleNumber});
 }catch(err:any){return NextResponse.json({error:err.message||'No se pudo eliminar la venta.'},{status:codeFromError(err)});}
}
