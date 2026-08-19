import fs from 'fs';
import {NextRequest,NextResponse} from 'next/server';
import {ClientService} from '@/src/crm/client.service';
import {getClientUserContext} from '@/src/crm/auth-helper';
import {PrismaService} from '@/src/database/prisma.service';
import {MediaStorageService} from '@/src/crm/media-storage.service';

const ALLOWED=['FACADE_PHOTO','CLIENT_PHOTO','CONTRACT_PHOTO'];
const MAX_FILE=6*1024*1024;
function removeFile(storageKey?:string|null){if(!storageKey)return;try{const p=MediaStorageService.resolveStoragePath(storageKey);if(fs.existsSync(p))fs.unlinkSync(p);}catch{}}

export async function GET(req:NextRequest,{params}:{params:Promise<{id:string}>}){
 try{const {id}=await params;const user=getClientUserContext(req);if(user.role==='VENDEDORA')return NextResponse.json({success:false,error:'FORBIDDEN: El rol de vendedora no puede visualizar imágenes.'},{status:403});const prisma=PrismaService.getInstance();const media=await prisma.clientMedia.findMany({where:{clientId:id},orderBy:{createdAt:'desc'}});return NextResponse.json({success:true,media});}catch(err:any){const message=String(err?.message||'No pudimos cargar las imágenes.');return NextResponse.json({success:false,error:message},{status:message.includes('UNAUTHORIZED')?401:message.includes('FORBIDDEN')?403:500});}
}

export async function POST(req:NextRequest,{params}:{params:Promise<{id:string}>}){
 try{
  const {id}=await params;const user=getClientUserContext(req);if(!['ADMIN','SUPERVISORA'].includes(user.role))return NextResponse.json({success:false,error:'Solo supervisión puede modificar evidencias.'},{status:403});if(!await ClientService.checkClientAccess(id,user))return NextResponse.json({success:false,error:'Sin acceso a este cliente.'},{status:403});
  const type=req.headers.get('content-type')||'';
  if(type.includes('multipart/form-data')){
   const form=await req.formData();const mediaType=String(form.get('mediaType')||'').toUpperCase();const file=form.get('file');if(!ALLOWED.includes(mediaType))return NextResponse.json({error:'Tipo de evidencia inválido.'},{status:400});if(!(file instanceof File)||!file.size||!file.type.startsWith('image/'))return NextResponse.json({error:'Selecciona una fotografía válida.'},{status:400});if(file.size>MAX_FILE)return NextResponse.json({error:'La fotografía debe pesar menos de 6 MB.'},{status:400});
   const buffer=Buffer.from(await file.arrayBuffer());const media=await ClientService.uploadMedia(id,{mediaType,fileContent:buffer,mimeType:file.type,fileSize:file.size},user);const prisma=PrismaService.getInstance();const older=await prisma.clientMedia.findMany({where:{clientId:id,mediaType,id:{not:media.id}}});for(const item of older){removeFile(item.storageKey);await prisma.clientMedia.delete({where:{id:item.id}}).catch(()=>null);}return NextResponse.json({success:true,media},{status:201});
  }
  const body=await req.json();const media=await ClientService.uploadMedia(id,body,user);return NextResponse.json({success:true,media},{status:201});
 }catch(err:any){const forbidden=err.message?.includes('FORBIDDEN');return NextResponse.json({success:false,error:err.message},{status:forbidden?403:400});}
}

export async function DELETE(req:NextRequest,{params}:{params:Promise<{id:string}>}){
 try{const {id}=await params;const user=getClientUserContext(req);if(!['ADMIN','SUPERVISORA'].includes(user.role))return NextResponse.json({success:false,error:'Solo supervisión puede eliminar evidencias.'},{status:403});if(!await ClientService.checkClientAccess(id,user))return NextResponse.json({success:false,error:'Sin acceso a este cliente.'},{status:403});const mediaId=req.nextUrl.searchParams.get('mediaId');if(!mediaId)return NextResponse.json({error:'Falta mediaId.'},{status:400});const prisma=PrismaService.getInstance();const media=await prisma.clientMedia.findFirst({where:{id:mediaId,clientId:id}});if(!media)return NextResponse.json({error:'Evidencia no encontrada.'},{status:404});removeFile(media.storageKey);await prisma.clientMedia.delete({where:{id:media.id}});await prisma.clientTimeline.create({data:{clientId:id,eventType:'PHOTO_REMOVED',entityType:'ClientMedia',entityId:media.id,description:`Evidencia eliminada (${media.mediaType})`,userId:user.userId}}).catch(()=>null);return NextResponse.json({success:true});}catch(err:any){return NextResponse.json({success:false,error:err.message||'No pudimos eliminar la evidencia.'},{status:400});}
}
