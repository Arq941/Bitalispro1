import {NextRequest,NextResponse} from 'next/server';
import {PrismaService} from '@/src/database/prisma.service';
import {extractUserContext} from '@/src/sales/sales-auth.helper';
import {PermissionService} from '@/src/server/auth/permission.service';

export async function GET(req:NextRequest){
 try{
  const user=await extractUserContext(req);
  await PermissionService.requirePermission(user.userId,'inventory.view');
  const prisma=PrismaService.getInstance();
  const warehouseId=req.nextUrl.searchParams.get('warehouseId')||undefined;
  const productId=req.nextUrl.searchParams.get('productId')||undefined;
  const days=Math.min(Math.max(Number(req.nextUrl.searchParams.get('days')||90),1),365);
  const until=new Date(Date.now()+days*86400000);
  const lots=await prisma.inventoryLot.findMany({
   where:{...(warehouseId?{warehouseId}:{}),...(productId?{productId}:{}),status:'ACTIVE'},
   include:{product:{select:{id:true,sku:true,name:true}},warehouse:{select:{id:true,code:true,name:true}}},
   orderBy:[{expirationDate:'asc'},{receivedAt:'asc'}],
   take:1000,
  });
  const data=lots.map(lot=>({...lot,expired:!!lot.expirationDate&&lot.expirationDate<new Date(),expiringSoon:!!lot.expirationDate&&lot.expirationDate>=new Date()&&lot.expirationDate<=until}));
  return NextResponse.json({success:true,data,meta:{days,expired:data.filter(x=>x.expired).length,expiringSoon:data.filter(x=>x.expiringSoon).length}},{headers:{'Cache-Control':'no-store'}});
 }catch(error:any){
  const message=error?.message||'No pudimos cargar los lotes.';
  const status=message.startsWith('FORBIDDEN:')?403:message.includes('UNAUTHORIZED')?401:500;
  return NextResponse.json({success:false,error:message},{status});
 }
}

export async function POST(req:NextRequest){
 try{
  const user=await extractUserContext(req);
  await PermissionService.requirePermission(user.userId,'inventory.manage');
  const body=await req.json();
  const quantity=Number(body.quantity);
  const lotNumber=String(body.lotNumber||'').trim().toUpperCase();
  if(!body.warehouseId||!body.productId||!lotNumber||!Number.isInteger(quantity)||quantity<=0)
   return NextResponse.json({success:false,error:'Almacén, producto, lote y cantidad entera positiva son obligatorios.'},{status:400});
  const expirationDate=body.expirationDate?new Date(body.expirationDate):null;
  if(expirationDate&&Number.isNaN(expirationDate.getTime()))
   return NextResponse.json({success:false,error:'Fecha de caducidad inválida.'},{status:400});
  const prisma=PrismaService.getInstance();
  const result=await prisma.$transaction(async tx=>{
   const lot=await tx.inventoryLot.upsert({
    where:{warehouseId_productId_lotNumber:{warehouseId:body.warehouseId,productId:body.productId,lotNumber}},
    create:{warehouseId:body.warehouseId,productId:body.productId,lotNumber,expirationDate,quantityReceived:quantity,quantityAvailable:quantity,unitCost:body.unitCost||null,supplierName:String(body.supplierName||'').trim()||null,createdBy:user.userId},
    update:{quantityReceived:{increment:quantity},quantityAvailable:{increment:quantity},expirationDate:expirationDate||undefined,unitCost:body.unitCost||undefined,supplierName:String(body.supplierName||'').trim()||undefined,status:'ACTIVE'},
   });
   const previous=await tx.inventoryStock.findUnique({where:{warehouseId_productId:{warehouseId:body.warehouseId,productId:body.productId}}});
   const stock=await tx.inventoryStock.upsert({
    where:{warehouseId_productId:{warehouseId:body.warehouseId,productId:body.productId}},
    create:{warehouseId:body.warehouseId,productId:body.productId,quantityOnHand:quantity,quantityReserved:0,quantityAvailable:quantity},
    update:{quantityOnHand:{increment:quantity},quantityAvailable:{increment:quantity}},
   });
   await tx.kardexMovement.create({data:{warehouseId:body.warehouseId,productId:body.productId,type:'PURCHASE_IN',movementType:'PURCHASE_IN',quantity,previousQuantity:previous?.quantityOnHand||0,newQuantity:stock.quantityOnHand,referenceType:'INVENTORY_LOT',referenceId:lot.id,userId:user.userId,notes:`Entrada lote ${lotNumber}${expirationDate?` · caduca ${expirationDate.toISOString().slice(0,10)}`:''}`}});
   return {lot,stock};
  });
  return NextResponse.json({success:true,data:result},{status:201,headers:{'Cache-Control':'no-store'}});
 }catch(error:any){
  const message=error?.message||'No pudimos registrar el lote.';
  const status=message.startsWith('FORBIDDEN:')?403:message.includes('UNAUTHORIZED')?401:400;
  return NextResponse.json({success:false,error:message},{status});
 }
}
