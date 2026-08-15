import { NextRequest, NextResponse } from 'next/server';
import { PrismaService } from '@/src/database/prisma.service';
import { AuditLogService } from '@/src/audit/audit-log.service';
import { getSalesUserContext } from '@/src/sales/sales-auth.helper';
import { PermissionService } from '@/src/server/auth/permission.service';

const prisma=PrismaService.getInstance();
const statuses=['ACTIVE','INACTIVE','DISCONTINUED'] as const;
const priceTypes=['LIST','LIST_PRICE','MINIMUM_AUTHORIZED','CREDIT','CASH'] as const;

function statusFromError(error:unknown,fallback=400){
  const message=String((error as any)?.message||'');
  if(message.includes('UNAUTHORIZED'))return 401;
  if(message.includes('FORBIDDEN'))return 403;
  if(message.includes('P2002')||message.includes('Ya existe'))return 409;
  return fallback;
}

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const ctx=getSalesUserContext(req);
    await PermissionService.requirePermission(ctx.userId,'inventory.view');
    const { id } = await params;
    const product = await prisma.product.findUnique({where:{id},include:{category:true,images:true,prices:true,stocks:true}});
    if (!product) return NextResponse.json({ success: false, error: 'Producto no encontrado.' }, { status: 404 });
    return NextResponse.json({ success: true, product });
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message }, { status: statusFromError(err,500) });
  }
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const ctx=getSalesUserContext(req);
    await PermissionService.requirePermission(ctx.userId,'inventory.manage');
    const { id } = await params;
    const current=await prisma.product.findUnique({where:{id},include:{prices:true}});
    if(!current)return NextResponse.json({success:false,error:'Producto no encontrado.'},{status:404});
    const body=await req.json();
    const sku=body.sku===undefined?current.sku:String(body.sku).trim();
    const name=body.name===undefined?current.name:String(body.name).trim();
    if(!sku||!name)throw new Error('SKU y nombre son obligatorios.');
    const status=body.status===undefined?current.status:String(body.status).toUpperCase();
    if(!statuses.includes(status as any))throw new Error('Estado de producto inválido.');
    const costPrice=body.costPrice===undefined?Number(current.costPrice):Number(body.costPrice);
    if(!Number.isFinite(costPrice)||costPrice<0)throw new Error('Costo inválido.');
    const ints={
      minStock:body.minStock===undefined?current.minStock:Number(body.minStock),
      reorderPoint:body.reorderPoint===undefined?current.reorderPoint:Number(body.reorderPoint),
      maxStock:body.maxStock===undefined?current.maxStock:Number(body.maxStock),
    };
    if(Object.values(ints).some(v=>!Number.isInteger(v)||v<0))throw new Error('Mínimo, reorden y máximo deben ser números enteros no negativos.');
    if(ints.maxStock<ints.minStock)throw new Error('El stock máximo no puede ser menor al mínimo.');
    const prices=Array.isArray(body.prices)?body.prices:[];
    for(const p of prices){
      if(!priceTypes.includes(String(p?.priceType) as any))throw new Error('Tipo de precio inválido.');
      const amount=Number(p?.amount);
      if(!Number.isFinite(amount)||amount<0)throw new Error('Precio inválido.');
    }
    const updated=await prisma.$transaction(async tx=>{
      const product=await tx.product.update({where:{id},data:{
        sku,
        barcode:body.barcode===undefined?current.barcode:(String(body.barcode||'').trim()||null),
        name,
        description:body.description===undefined?current.description:(String(body.description||'').trim()||null),
        brand:body.brand===undefined?current.brand:(String(body.brand||'').trim()||null),
        categoryId:body.categoryId===undefined?current.categoryId:(String(body.categoryId||'').trim()||null),
        cost:costPrice,
        costPrice,
        status:status as any,
        ...ints,
      }});
      for(const p of prices){
        const amount=Number(p.amount);
        await tx.productPrice.upsert({
          where:{productId_priceType:{productId:id,priceType:String(p.priceType) as any}},
          create:{productId:id,priceType:String(p.priceType) as any,price:amount,amount,isActive:true,createdBy:ctx.userId},
          update:{price:amount,amount,isActive:true,updatedAt:new Date()},
        });
      }
      return product;
    });
    await AuditLogService.log({userId:ctx.userId,action:'PRODUCT_UPDATED',entity:'Product',entityId:id,oldValues:JSON.stringify({sku:current.sku,name:current.name,status:current.status,costPrice:String(current.costPrice)}),newValues:JSON.stringify({sku:updated.sku,name:updated.name,status:updated.status,costPrice:String(updated.costPrice)})});
    const product=await prisma.product.findUnique({where:{id},include:{category:true,images:true,prices:true,stocks:true}});
    return NextResponse.json({success:true,product});
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message }, { status: statusFromError(err,400) });
  }
}

export async function DELETE(req:NextRequest,{params}:{params:Promise<{id:string}>}){
  try{
    const ctx=getSalesUserContext(req);
    await PermissionService.requirePermission(ctx.userId,'inventory.manage');
    const{id}=await params;
    const product=await prisma.product.findUnique({where:{id},include:{stocks:true},select:{id:true,sku:true,name:true,status:true,stocks:true,_count:{select:{saleItems:true,orderItems:true,kardexMovements:true,reservations:true,priceHistories:true,authorizationRequests:true}}}} as any);
    if(!product)return NextResponse.json({success:false,error:'Producto no encontrado.'},{status:404});
    const count=(product as any)._count||{};
    const linked=Number(count.saleItems||0)+Number(count.orderItems||0)+Number(count.kardexMovements||0)+Number(count.reservations||0)+Number(count.priceHistories||0)+Number(count.authorizationRequests||0);
    const stockRows=Array.isArray((product as any).stocks)?(product as any).stocks:[];
    const hasStock=stockRows.some((s:any)=>Number(s.quantityOnHand||0)!==0||Number(s.quantityReserved||0)!==0);
    if(linked>0||hasStock){
      return NextResponse.json({success:false,error:'Este producto ya tiene historial de ventas, inventario, pedidos o precios y no puede eliminarse. Puedes editarlo y marcarlo como DESCONTINUADO para conservar el historial.'},{status:409});
    }
    await prisma.$transaction(async tx=>{
      await tx.inventoryStock.deleteMany({where:{productId:id}});
      await tx.productPrice.deleteMany({where:{productId:id}});
      await tx.productImage.deleteMany({where:{productId:id}});
      await tx.product.delete({where:{id}});
    });
    await AuditLogService.log({userId:ctx.userId,action:'PRODUCT_DELETED',entity:'Product',entityId:id,oldValues:JSON.stringify({sku:(product as any).sku,name:(product as any).name,status:(product as any).status})});
    return NextResponse.json({success:true,id});
  }catch(err:any){
    return NextResponse.json({success:false,error:err.message||'No se pudo eliminar el producto.'},{status:statusFromError(err,400)});
  }
}
