import {NextRequest,NextResponse} from 'next/server';
import {ClientService} from '@/src/crm/client.service';
import {getClientUserContext} from '@/src/crm/auth-helper';
import {PermissionService} from '@/src/server/auth/permission.service';

const MAX_FILE=6*1024*1024;
const TYPES=[['facade','FACADE_PHOTO'],['clientPhoto','CLIENT_PHOTO'],['contract','CONTRACT_PHOTO']] as const;
const clean=(value:FormDataEntryValue|null)=>String(value||'').trim();
function splitName(name:string){const parts=name.trim().replace(/\s+/g,' ').split(' ').filter(Boolean);return parts.length===1?{firstName:parts[0],lastName:'PENDIENTE'}:{firstName:parts[0],lastName:parts.slice(1).join(' ')}}

export async function POST(req:NextRequest){
 try{
  const user=getClientUserContext(req);
  if(user.role!=='VENDEDORA')return NextResponse.json({success:false,error:'El alta rápida está disponible únicamente para vendedoras.'},{status:403});
  await PermissionService.requirePermission(user.userId,'clients.create');
  const intakeUser={...user,intakeOnly:true as const};
  const form=await req.formData(),fullName=clean(form.get('name')),phone=clean(form.get('phone'));
  if(!fullName)return NextResponse.json({success:false,error:'El nombre completo es obligatorio.'},{status:400});

  const files=new Map<string,File>();
  for(const[field]of TYPES){const value=form.get(field);if(!(value instanceof File)||value.size<=0)return NextResponse.json({success:false,error:'Las tres fotografías son obligatorias: fachada, cliente y contrato.'},{status:400});if(!value.type.startsWith('image/'))return NextResponse.json({success:false,error:'Las tres evidencias deben ser fotografías.'},{status:400});if(value.size>MAX_FILE)return NextResponse.json({success:false,error:'Cada fotografía debe pesar menos de 6 MB.'},{status:400});files.set(field,value)}

  const latitude=Number(form.get('latitude')),longitude=Number(form.get('longitude')),accuracy=Number(form.get('locationAccuracy'));
  if(!Number.isFinite(latitude)||!Number.isFinite(longitude))return NextResponse.json({success:false,error:'Captura las coordenadas del domicilio.'},{status:400});
  const address=clean(form.get('address'))||'PENDIENTE DE VALIDAR',neighborhood=clean(form.get('neighborhood'))||'PENDIENTE DE VALIDAR';
  const client=await ClientService.createClient({...splitName(fullName),phone,customerType:'PENDING_SUPERVISOR',assignedSellerId:user.userId,latitude,longitude,locationAccuracy:Number.isFinite(accuracy)?accuracy:undefined,idempotencyKey:clean(form.get('idempotencyKey'))||`field-client-${Date.now()}`},intakeUser);
  await ClientService.addAddress(client.id,{street:address,exteriorNumber:'S/N',neighborhood,postalCode:clean(form.get('postalCode'))||'00000',city:clean(form.get('city'))||clean(form.get('municipality'))||neighborhood,municipality:clean(form.get('municipality'))||null,state:clean(form.get('state'))||'MEXICO',references:'Alta rápida enviada a supervisión',latitude,longitude,accuracy:Number.isFinite(accuracy)?accuracy:undefined,isPrimary:true},intakeUser);
  for(const[field,mediaType]of TYPES){const file=files.get(field)!;await ClientService.uploadMedia(client.id,{mediaType,fileContent:Buffer.from(await file.arrayBuffer()),mimeType:file.type||'image/jpeg',fileSize:file.size,latitude,longitude},intakeUser)}

  // Respuesta deliberadamente ciega: no regresa expediente, folio, coordenadas ni imágenes.
  return NextResponse.json({success:true,pendingSupervisor:true},{status:201});
 }catch(error:any){const message=String(error?.message||'No pudimos enviar el alta.');return NextResponse.json({success:false,error:message},{status:message.includes('UNAUTHORIZED')?401:message.includes('FORBIDDEN')?403:400})}
}
