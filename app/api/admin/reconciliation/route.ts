import {NextRequest,NextResponse} from 'next/server';
import {PrismaService} from '@/src/database/prisma.service';
import {extractUserContext} from '@/src/sales/sales-auth.helper';
import {PermissionService} from '@/src/server/auth/permission.service';

type Severity='CRITICAL'|'HIGH'|'MEDIUM'|'LOW';
type Finding={code:string;severity:Severity;area:string;title:string;count:number;detail:string;path:string;sample?:unknown[]};

const sample=<T,>(rows:T[],take=8)=>rows.slice(0,take);
const serial=(value:unknown)=>JSON.parse(JSON.stringify(value,(_,item)=>typeof item==='bigint'?Number(item):item));

export async function GET(req:NextRequest){
 try{
  const context=await extractUserContext(req);
  await PermissionService.requirePermission(context.userId,'audit.view');
  const prisma=PrismaService.getInstance();
  const now=new Date();
  const yesterday=new Date(now.getTime()-24*60*60*1000);

  const [stocks,credits,sales,openCash,promises,syncOperations,conflicts,clients]=await Promise.all([
   prisma.inventoryStock.findMany({include:{product:{select:{id:true,sku:true,name:true,minStock:true,reorderPoint:true}},warehouse:{select:{id:true,code:true,name:true}}}}),
   prisma.credit.findMany({where:{status:{in:['ACTIVE','SETTLED']}},include:{schedules:{select:{id:true,status:true,scheduledDate:true,suggestedAmount:true}},payments:{select:{id:true,amount:true,verificationStatus:true}}},take:1000}),
   prisma.sale.findMany({where:{status:{in:['APPROVED','COMPLETED']}},include:{items:{select:{id:true}},credits:{select:{id:true,status:true}},reservations:{select:{id:true,status:true}}},take:1000}),
   prisma.cashSession.findMany({where:{status:{in:['OPEN','OPERATING','COUNTING','RECONCILIATION']},openedAt:{lt:yesterday}},select:{id:true,userId:true,status:true,openedAt:true,expectedCash:true,currentCash:true},take:100}),
   prisma.paymentPromise.findMany({where:{status:'PENDING',promisedDate:{lt:now}},select:{id:true,clientId:true,creditId:true,promisedAmount:true,promisedDate:true},take:200}),
   prisma.syncOperation.findMany({where:{status:{in:['FAILED','CONFLICT','REJECTED']}},select:{id:true,operationType:true,status:true,errorCode:true,errorMessage:true,updatedAt:true},orderBy:{updatedAt:'desc'},take:200}),
   prisma.syncConflict.findMany({where:{resolvedAt:null},select:{id:true,conflictType:true,severity:true,description:true,detectedAt:true},orderBy:{detectedAt:'desc'},take:200}),
   prisma.client.findMany({select:{id:true,clientNumber:true,firstName:true,lastName:true,phone:true,latitude:true,longitude:true,addresses:{where:{isPrimary:true},select:{id:true}},media:{select:{id:true,mediaType:true,status:true}}},take:2000}),
  ]);

  const findings:Finding[]=[];
  const stockMath=stocks.filter(x=>x.quantityAvailable!==x.quantityOnHand-x.quantityReserved||x.quantityOnHand<0||x.quantityReserved<0||x.quantityAvailable<0);
  const lowStock=stocks.filter(x=>x.quantityAvailable<=Math.max(x.product.reorderPoint,x.product.minStock));
  const activeWithoutBalance=credits.filter(x=>x.status==='ACTIVE'&&Number(x.saldoActual)<=0);
  const settledWithBalance=credits.filter(x=>x.status==='SETTLED'&&Number(x.saldoActual)>0);
  const activeWithoutSchedule=credits.filter(x=>x.status==='ACTIVE'&&!x.schedules.some(s=>['PENDING','PARTIAL','OVERDUE','RESCHEDULED'].includes(s.status)));
  const approvedWithoutItems=sales.filter(x=>x.items.length===0);
  const creditWithoutCredit=sales.filter(x=>x.saleType==='CREDIT'&&x.credits.length===0);
  const deliveryMissing=sales.filter(x=>x.items.length>0&&!x.reservations.some(r=>r.status==='CONVERTED_TO_DELIVERY'));
  const incompleteClients=clients.filter(x=>x.latitude==null||x.longitude==null||x.addresses.length===0||x.media.length===0);
  const phones=new Map<string,typeof clients>();
  for(const client of clients){const key=String(client.phone||'').replace(/\D/g,'');if(key.length<8)continue;phones.set(key,[...(phones.get(key)||[]),client]);}
  const duplicatePhones=Array.from(phones.entries()).filter(([,rows])=>rows.length>1).map(([phone,rows])=>({phone,clients:rows.map(x=>({id:x.id,clientNumber:x.clientNumber,name:`${x.firstName} ${x.lastName}`}))}));

  const add=(condition:boolean,value:Finding)=>{if(condition)findings.push(value)};
  add(stockMath.length>0,{code:'INVENTORY_MATH',severity:'CRITICAL',area:'Inventario',title:'Existencias incoherentes',count:stockMath.length,detail:'Disponible debe ser existencia física menos reservado; también se detectan cantidades negativas.',path:'/inventory',sample:sample(stockMath.map(x=>({product:x.product.name,warehouse:x.warehouse.name,onHand:x.quantityOnHand,reserved:x.quantityReserved,available:x.quantityAvailable})))});
  add(activeWithoutBalance.length>0,{code:'ACTIVE_ZERO_BALANCE',severity:'CRITICAL',area:'Cartera',title:'Créditos activos sin saldo',count:activeWithoutBalance.length,detail:'Deben liquidarse mediante el flujo financiero auditado.',path:'/portfolio',sample:sample(activeWithoutBalance.map(x=>({id:x.id,balance:x.saldoActual})))});
  add(settledWithBalance.length>0,{code:'SETTLED_WITH_BALANCE',severity:'CRITICAL',area:'Cartera',title:'Créditos liquidados con saldo',count:settledWithBalance.length,detail:'El estado y el saldo no coinciden.',path:'/portfolio',sample:sample(settledWithBalance.map(x=>({id:x.id,balance:x.saldoActual})))});
  add(approvedWithoutItems.length>0,{code:'SALE_WITHOUT_ITEMS',severity:'CRITICAL',area:'Ventas',title:'Ventas aprobadas sin productos',count:approvedWithoutItems.length,detail:'Una venta aprobada siempre debe conservar sus partidas.',path:'/sales',sample:sample(approvedWithoutItems.map(x=>({id:x.id,folio:x.saleNumber})))});
  add(creditWithoutCredit.length>0,{code:'SALE_WITHOUT_CREDIT',severity:'CRITICAL',area:'Ventas',title:'Ventas a crédito sin crédito asociado',count:creditWithoutCredit.length,detail:'La cartera no puede calcularse sin el crédito generado por la venta.',path:'/sales',sample:sample(creditWithoutCredit.map(x=>({id:x.id,folio:x.saleNumber})))});
  add(deliveryMissing.length>0,{code:'DELIVERY_NOT_RECONCILED',severity:'HIGH',area:'Inventario',title:'Ventas sin entrega conciliada',count:deliveryMissing.length,detail:'Revisa que la reserva se haya convertido en salida de Kardex.',path:'/inventory',sample:sample(deliveryMissing.map(x=>({id:x.id,folio:x.saleNumber})))});
  add(activeWithoutSchedule.length>0,{code:'CREDIT_WITHOUT_SCHEDULE',severity:'HIGH',area:'Cartera',title:'Créditos activos sin cuota pendiente',count:activeWithoutSchedule.length,detail:'Requieren calendario vigente o liquidación.',path:'/portfolio',sample:sample(activeWithoutSchedule.map(x=>({id:x.id,balance:x.saldoActual})))});
  add(openCash.length>0,{code:'STALE_CASH_SESSION',severity:'HIGH',area:'Caja',title:'Cajas abiertas por más de 24 horas',count:openCash.length,detail:'Deben revisarse y cerrarse con arqueo, no eliminarse.',path:'/cash',sample:sample(openCash)});
  add(promises.length>0,{code:'BROKEN_PROMISES',severity:'HIGH',area:'Cobranza',title:'Promesas de pago vencidas',count:promises.length,detail:'Requieren seguimiento y nueva acción de cobranza.',path:'/portfolio',sample:sample(promises)});
  add(syncOperations.length>0,{code:'SYNC_ATTENTION',severity:'HIGH',area:'Sincronización',title:'Operaciones offline requieren atención',count:syncOperations.length,detail:'Los rechazos y conflictos permanecen hasta conciliación individual.',path:'/sync',sample:sample(syncOperations)});
  add(conflicts.length>0,{code:'UNRESOLVED_CONFLICTS',severity:'HIGH',area:'Sincronización',title:'Conflictos sin resolver',count:conflicts.length,detail:'No deben forzarse ni descartarse en lote.',path:'/sync',sample:sample(conflicts)});
  add(duplicatePhones.length>0,{code:'POSSIBLE_DUPLICATE_CLIENT',severity:'MEDIUM',area:'Clientes',title:'Posibles clientes duplicados',count:duplicatePhones.length,detail:'Coinciden por teléfono; deben revisarse antes de fusionar o bloquear.',path:'/clients',sample:sample(duplicatePhones)});
  add(incompleteClients.length>0,{code:'INCOMPLETE_CLIENT_FILE',severity:'MEDIUM',area:'Clientes',title:'Expedientes operativos incompletos',count:incompleteClients.length,detail:'Falta ubicación, domicilio principal o evidencia fotográfica.',path:'/clients',sample:sample(incompleteClients.map(x=>({id:x.id,clientNumber:x.clientNumber,name:`${x.firstName} ${x.lastName}`,gps:x.latitude!=null&&x.longitude!=null,address:x.addresses.length>0,media:x.media.length})))});
  add(lowStock.length>0,{code:'LOW_STOCK',severity:'LOW',area:'Inventario',title:'Productos en punto de reorden',count:lowStock.length,detail:'Genera una sugerencia de compra antes de agotar existencia.',path:'/inventory',sample:sample(lowStock.map(x=>({product:x.product.name,sku:x.product.sku,warehouse:x.warehouse.name,available:x.quantityAvailable,reorderPoint:Math.max(x.product.reorderPoint,x.product.minStock)})))});

  const order:Record<Severity,number>={CRITICAL:4,HIGH:3,MEDIUM:2,LOW:1};
  findings.sort((a,b)=>order[b.severity]-order[a.severity]||b.count-a.count);
  return NextResponse.json(serial({success:true,generatedAt:now.toISOString(),summary:{critical:findings.filter(x=>x.severity==='CRITICAL').reduce((n,x)=>n+x.count,0),high:findings.filter(x=>x.severity==='HIGH').reduce((n,x)=>n+x.count,0),medium:findings.filter(x=>x.severity==='MEDIUM').reduce((n,x)=>n+x.count,0),low:findings.filter(x=>x.severity==='LOW').reduce((n,x)=>n+x.count,0),healthy:findings.length===0},findings}),{headers:{'Cache-Control':'no-store'}});
 }catch(error:any){
  const message=error?.message||'No pudimos conciliar la operación.';
  const status=message.startsWith('FORBIDDEN:')?403:message.includes('UNAUTHORIZED')?401:500;
  return NextResponse.json({success:false,error:status===403?'Solo ADMIN puede consultar la conciliación.':status===401?'Tu sesión expiró.':'No pudimos conciliar la operación.'},{status,headers:{'Cache-Control':'no-store'}});
 }
}
