import { NextRequest, NextResponse } from 'next/server';
import { SalesService } from '@/src/sales/sales.service';
import { PrismaService } from '@/src/database/prisma.service';
import { AuditLogService } from '@/src/audit/audit-log.service';
import { getSalesUserContext } from '@/src/sales/sales-auth.helper';
import { PermissionService } from '@/src/server/auth/permission.service';

const prisma=PrismaService.getInstance();
function codeFromError(error:any){const m=String(error?.message||'');if(m.includes('UNAUTHORIZED'))return 401;if(m.includes('FORBIDDEN'))return 403;return 400;}
function parseDateOnly(value:unknown){const raw=String(value||'').trim();if(!/^\d{4}-\d{2}-\d{2}$/.test(raw))throw new Error('Captura una fecha válida.');const date=new Date(`${raw}T12:00:00.000Z`);if(Number.isNaN(date.getTime()))throw new Error('Captura una fecha válida.');return date;}

export async function GET(req:NextRequest,{params}:{params:Promise<{id:string}>}){
 try{const ctx=getSalesUserContext(req);await PermissionService.requirePermission(ctx.userId,'sales.view');const{id}=await params;const sale=await SalesService.getSaleById(id);if(!sale)return NextResponse.json({error:'Venta no encontrada'},{status:404});const credits=sale.credits||[];const schedules=credits.flatMap((c:any)=>c.schedules||[]);return NextResponse.json({saleId:id,creditsCount:credits.length,schedulesCount:schedules.length,schedules},{status:200});}
 catch(err:any){return NextResponse.json({error:err.message||'Error al obtener el calendario de pagos'},{status:codeFromError(err)});}
}

export async function PATCH(req:NextRequest,{params}:{params:Promise<{id:string}>}){
 try{
  const ctx=getSalesUserContext(req);if(ctx.role!=='ADMIN'&&ctx.role!=='SUPERVISORA')return NextResponse.json({error:'FORBIDDEN: Solo ADMIN o SUPERVISORA pueden modificar la primera fecha de cobro.'},{status:403});
  const{id}=await params;const body=await req.json();const firstPaymentDate=parseDateOnly(body?.firstPaymentDate);
  const sale=await prisma.sale.findUnique({where:{id},include:{credits:{include:{schedules:{orderBy:{installmentNumber:'asc'}}}}}});if(!sale)return NextResponse.json({error:'Venta no encontrada.'},{status:404});if(!sale.credits.length)return NextResponse.json({error:'La venta todavía no tiene crédito ni calendario.'},{status:409});
  const paymentCount=await prisma.payment.count({where:{credit:{saleId:id}}});const started=sale.credits.some(c=>c.schedules.some(s=>['PARTIAL','COMPLETED'].includes(String(s.status))));if(paymentCount>0||started)return NextResponse.json({error:'La cobranza de esta venta ya comenzó. La primera fecha no puede cambiarse porque alteraría historial de pagos.'},{status:409});
  const changes: Array<{creditId:string;scheduleId:string;previousDate:Date;newDate:Date}> = [];
  for(const credit of sale.credits){const first=credit.schedules[0];if(!first)continue;for(const schedule of credit.schedules){const offset=schedule.scheduledDate.getTime()-first.scheduledDate.getTime();changes.push({creditId:credit.id,scheduleId:schedule.id,previousDate:schedule.scheduledDate,newDate:new Date(firstPaymentDate.getTime()+offset)});}}
  await prisma.$transaction(async tx=>{for(const change of changes){await tx.paymentSchedule.update({where:{id:change.scheduleId},data:{scheduledDate:change.newDate,status:'PENDING'}});await tx.paymentReschedule.create({data:{creditId:change.creditId,paymentScheduleId:change.scheduleId,previousDate:change.previousDate,newDate:change.newDate,reason:'ADMIN_FIRST_PAYMENT_DATE_CHANGE',notes:`Primera fecha ajustada por ${ctx.role}`,createdBy:ctx.userId}});}});
  await AuditLogService.log({userId:ctx.userId,action:'FIRST_PAYMENT_DATE_CHANGED',entity:'Sale',entityId:id,oldValues:JSON.stringify({firstPaymentDate:sale.credits[0]?.schedules[0]?.scheduledDate}),newValues:JSON.stringify({firstPaymentDate}),notes:`Cambio autorizado para rol ${ctx.role}. Se desplazó el calendario completo conservando intervalos.`});
  const updated=await prisma.sale.findUnique({where:{id},include:{credits:{include:{schedules:{orderBy:{installmentNumber:'asc'}}}}}});return NextResponse.json({success:true,saleId:id,firstPaymentDate,credits:updated?.credits||[]});
 }catch(err:any){return NextResponse.json({error:err.message||'No se pudo modificar la fecha de cobro.'},{status:codeFromError(err)});}
}
