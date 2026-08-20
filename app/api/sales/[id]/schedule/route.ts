import { NextRequest, NextResponse } from 'next/server';
import { SalesService } from '@/src/sales/sales.service';
import { PrismaService } from '@/src/database/prisma.service';
import { AuditLogService } from '@/src/audit/audit-log.service';
import { getSalesUserContext } from '@/src/sales/sales-auth.helper';
import { PermissionService } from '@/src/server/auth/permission.service';
import { PaymentCalendarService } from '@/src/financial/payment-calendar.service';

const prisma=PrismaService.getInstance();
function codeFromError(error:any){const m=String(error?.message||'');if(m.includes('UNAUTHORIZED'))return 401;if(m.includes('FORBIDDEN'))return 403;return 400;}
function parseDateOnly(value:unknown){const raw=String(value||'').trim();if(!/^\d{4}-\d{2}-\d{2}$/.test(raw))throw new Error('Captura una fecha válida.');const date=new Date(`${raw}T12:00:00.000Z`);if(Number.isNaN(date.getTime()))throw new Error('Captura una fecha válida.');return date;}
const DAYS = ['DOMINGO','LUNES','MARTES','MIÉRCOLES','JUEVES','VIERNES','SÁBADO'];
const DAY_INDEX: Record<string,number> = {DOMINGO:0,LUNES:1,MARTES:2,MIERCOLES:3,MIÉRCOLES:3,JUEVES:4,VIERNES:5,SABADO:6,SÁBADO:6};
function alignToDay(date:Date,day?:unknown){const normalized=String(day||'').trim().toUpperCase();if(!normalized)return date;if(DAY_INDEX[normalized]===undefined)throw new Error('Selecciona un día de cobro válido.');const next=new Date(date);const delta=(DAY_INDEX[normalized]-next.getUTCDay()+7)%7;next.setUTCDate(next.getUTCDate()+delta);return next;}

export async function GET(req:NextRequest,{params}:{params:Promise<{id:string}>}){
 try{const ctx=getSalesUserContext(req);await PermissionService.requirePermission(ctx.userId,'sales.view');const{id}=await params;const sale=await SalesService.getSaleById(id);if(!sale)return NextResponse.json({error:'Venta no encontrada'},{status:404});const credits=sale.credits||[];const schedules=credits.flatMap((c:any)=>c.schedules||[]);return NextResponse.json({saleId:id,creditsCount:credits.length,schedulesCount:schedules.length,schedules},{status:200});}
 catch(err:any){return NextResponse.json({error:err.message||'Error al obtener el calendario de pagos'},{status:codeFromError(err)});}
}

export async function PATCH(req:NextRequest,{params}:{params:Promise<{id:string}>}){
 try{
  const ctx=getSalesUserContext(req);if(ctx.role!=='ADMIN'&&ctx.role!=='SUPERVISORA')return NextResponse.json({error:'FORBIDDEN: Solo ADMIN o SUPERVISORA pueden modificar la primera fecha de cobro.'},{status:403});
  const{id}=await params;const body=await req.json();
  const sale=await prisma.sale.findUnique({where:{id},include:{credits:{include:{schedules:{orderBy:{installmentNumber:'asc'}}}}}});if(!sale)return NextResponse.json({error:'Venta no encontrada.'},{status:404});if(!sale.credits.length)return NextResponse.json({error:'La venta todavía no tiene crédito ni calendario.'},{status:409});
  const paymentCount=await prisma.payment.count({where:{credit:{saleId:id}}});const started=paymentCount>0||sale.credits.some(c=>c.schedules.some(s=>['PARTIAL','COMPLETED'].includes(String(s.status))));
  const currentFirst=(started?sale.credits.flatMap(c=>c.schedules).find(s=>s.status==='PENDING'):sale.credits[0]?.schedules[0])?.scheduledDate;if(!currentFirst)throw new Error('El calendario no tiene cobros pendientes que puedan modificarse.');
  const requestedFirst=body?.firstPaymentDate?parseDateOnly(body.firstPaymentDate):new Date(currentFirst);
  const firstPaymentDate=alignToDay(requestedFirst,body?.collectionDay);
  const collectionDay=body?.collectionDay?DAYS[firstPaymentDate.getUTCDay()]:DAYS[firstPaymentDate.getUTCDay()];
  await prisma.$transaction(async tx=>{
   for(const credit of sale.credits){
    const frequency=credit.paymentFrequency;const stepDays=frequency==='BIWEEKLY'?14:frequency==='MONTHLY'?30:7;
    if(started){
     const pending=credit.schedules.filter(schedule=>schedule.status==='PENDING');
     for(let index=0;index<pending.length;index++){
      const schedule=pending[index],newDate=new Date(firstPaymentDate.getTime()+index*stepDays*86400000);
      await tx.paymentSchedule.update({where:{id:schedule.id},data:{scheduledDate:newDate,updatedAt:new Date()}});
      if(schedule.scheduledDate.getTime()!==newDate.getTime())await tx.paymentReschedule.create({data:{creditId:credit.id,paymentScheduleId:schedule.id,previousDate:schedule.scheduledDate,newDate,reason:'COLLECTION_DAY_CHANGE',notes:`Próximos cobros ajustados por ${ctx.role}`,createdBy:ctx.userId}});
     }
     continue;
    }
    const activeCount=Math.max(1,credit.schedules.filter(s=>s.status!=='CANCELLED').length);
    const calendar=PaymentCalendarService.buildWholeAmounts({balance:credit.saldoActual,requestedInstallments:activeCount,frequency});
    for(let index=0;index<Math.max(credit.schedules.length,calendar.amounts.length);index++){
     const schedule=credit.schedules[index],amount=calendar.amounts[index];
     const newDate=new Date(firstPaymentDate.getTime()+index*stepDays*86400000);
     if(schedule&&amount){
      await tx.paymentSchedule.update({where:{id:schedule.id},data:{installmentNumber:index+1,scheduledDate:newDate,suggestedAmount:amount,status:'PENDING',updatedAt:new Date()}});
      if(schedule.scheduledDate.getTime()!==newDate.getTime())await tx.paymentReschedule.create({data:{creditId:credit.id,paymentScheduleId:schedule.id,previousDate:schedule.scheduledDate,newDate,reason:'ADMIN_COLLECTION_DAY_CHANGE',notes:`Calendario ajustado por ${ctx.role}`,createdBy:ctx.userId}});
     }else if(schedule){await tx.paymentSchedule.update({where:{id:schedule.id},data:{status:'CANCELLED',updatedAt:new Date()}});}
     else if(amount){await tx.paymentSchedule.create({data:{creditId:credit.id,installmentNumber:index+1,scheduledDate:newDate,originalScheduledDate:newDate,suggestedAmount:amount,status:'PENDING'}});}
    }
    await tx.credit.update({where:{id:credit.id},data:{suggestedInstallment:calendar.regularAmount,updatedAt:new Date()}});
   }
   await tx.clientProfile.upsert({where:{clientId:sale.clientId},create:{clientId:sale.clientId,preferredCollectionDay:collectionDay},update:{preferredCollectionDay:collectionDay}});
  });
  await AuditLogService.log({userId:ctx.userId,action:'COLLECTION_CALENDAR_CHANGED',entity:'Sale',entityId:id,oldValues:JSON.stringify({firstPaymentDate:currentFirst}),newValues:JSON.stringify({firstPaymentDate,collectionDay,started}),notes:started?`Día de próximos cobros actualizado por ${ctx.role}; se conservó el historial.`:`Día y calendario actualizados por ${ctx.role}; cuotas normalizadas a centenas completas.`});
  const updated=await prisma.sale.findUnique({where:{id},include:{credits:{include:{schedules:{orderBy:{installmentNumber:'asc'}}}}}});return NextResponse.json({success:true,saleId:id,firstPaymentDate,collectionDay,credits:updated?.credits||[]});
 }catch(err:any){return NextResponse.json({error:err.message||'No se pudo modificar la fecha de cobro.'},{status:codeFromError(err)});}
}
