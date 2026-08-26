import { NextRequest, NextResponse } from 'next/server';
import { PrismaService } from '@/src/database/prisma.service';
import { AuditLogService } from '@/src/audit/audit-log.service';
import { extractUserContext } from '@/src/sales/sales-auth.helper';
import { PermissionService } from '@/src/server/auth/permission.service';
import { inlineAndroidProductImages, isBitalisAndroidRequest } from '@/lib/products/android-product-images';

const prisma=PrismaService.getInstance();
const priceTypes=['LIST','LIST_PRICE','MINIMUM_AUTHORIZED','CREDIT','CASH'] as const;
function statusFromError(error:unknown,fallback:number){const message=String((error as any)?.message||'');if(message.includes('UNAUTHORIZED'))return 401;if(message.includes('FORBIDDEN'))return 403;if(message.includes('P2002'))return 409;return fallback;}

export async function GET(req:NextRequest){
 try{
  const ctx=await extractUserContext(req);
  await PermissionService.requirePermission(ctx.userId,'inventory.view');
  const products=await prisma.product.findMany({include:{category:true,images:true,prices:true,stocks:true},orderBy:{name:'asc'}});
  const responseProducts=isBitalisAndroidRequest(req)?inlineAndroidProductImages(products):products;
  return NextResponse.json({success:true,products:responseProducts},{headers:{'Cache-Control':'no-store','Vary':'User-Agent'}});
 }
 catch(err:any){return NextResponse.json({success:false,error:err.message},{status:statusFromError(err,500)});}
}

export async function POST(req:NextRequest){
 try{
  const ctx=await extractUserContext(req);await PermissionService.requirePermission(ctx.userId,'inventory.manage');const body=await req.json();
  const sku=String(body?.sku||'').trim(),name=String(body?.name||'').trim();if(!sku||!name)throw new Error('SKU y nombre son obligatorios.');
  const costPrice=Number(body?.costPrice||0);if(!Number.isFinite(costPrice)||costPrice<0)throw new Error('Costo inválido.');
  const minStock=Number(body?.minStock||0),reorderPoint=Number(body?.reorderPoint||0),maxStock=Number(body?.maxStock??100);if([minStock,reorderPoint,maxStock].some(v=>!Number.isInteger(v)||v<0))throw new Error('Mínimo, reorden y máximo deben ser enteros no negativos.');if(maxStock<minStock)throw new Error('El stock máximo no puede ser menor al mínimo.');
  const prices=Array.isArray(body?.prices)?body.prices:[];for(const p of prices){if(!priceTypes.includes(String(p?.priceType) as any))throw new Error('Tipo de precio inválido.');const amount=Number(p?.amount);if(!Number.isFinite(amount)||amount<0)throw new Error('Precio inválido.');}
  const product=await prisma.product.create({data:{sku,barcode:String(body?.barcode||'').trim()||null,name,description:String(body?.description||'').trim()||null,brand:String(body?.brand||'').trim()||null,cost:costPrice,costPrice,minStock,reorderPoint,maxStock,status:'ACTIVE',prices:{create:prices.map((p:any)=>({priceType:String(p.priceType) as any,price:Number(p.amount),amount:Number(p.amount),isActive:true,createdBy:ctx.userId}))}},include:{category:true,images:true,prices:true,stocks:true}});
  await AuditLogService.log({userId:ctx.userId,action:'PRODUCT_CREATED',entity:'Product',entityId:product.id,newValues:JSON.stringify({sku:product.sku,name:product.name,costPrice:String(product.costPrice)})});return NextResponse.json({success:true,product},{status:201});
 }catch(err:any){return NextResponse.json({success:false,error:err.message||'No se pudo crear el producto.'},{status:statusFromError(err,400)});}
}
