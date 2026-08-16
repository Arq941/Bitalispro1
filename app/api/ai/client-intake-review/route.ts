import {GoogleGenAI,Type} from '@google/genai';
import {NextRequest,NextResponse} from 'next/server';
import {getClientUserContext} from '@/src/crm/auth-helper';
import {PermissionService} from '@/src/server/auth/permission.service';

const MODEL='gemini-3.6-flash';

type ReviewInput={name?:string;phone?:string;gpsAccuracy?:number|null;facadeReady?:boolean;clientPhotoReady?:boolean;contractReady?:boolean;notes?:string};
type ReviewData={status:'READY'|'REVIEW';summary:string;checks:Array<{label:string;ok:boolean;message:string}>;nextAction:string};

const clean=(value:unknown,max=500)=>String(value??'').trim().replace(/\s+/g,' ').slice(0,max);

export async function POST(req:NextRequest){
 try{
  const user=getClientUserContext(req);
  await PermissionService.requirePermission(user.userId,'clients.create');
  const apiKey=process.env.GEMINI_API_KEY?.trim();
  if(!apiKey)return NextResponse.json({success:false,error:'Gemini no está configurado.'},{status:503});

  const body=(await req.json()) as ReviewInput;
  const payload={
   name:clean(body.name,140),
   phone:clean(body.phone,30),
   gpsAccuracy:Number.isFinite(Number(body.gpsAccuracy))?Number(body.gpsAccuracy):null,
   facadeReady:Boolean(body.facadeReady),
   clientPhotoReady:Boolean(body.clientPhotoReady),
   contractReady:Boolean(body.contractReady),
   notes:clean(body.notes,800),
  };

  const ai=new GoogleGenAI({apiKey});
  const response=await ai.models.generateContent({
   model:MODEL,
   contents:[{text:`Eres el asistente de calidad de captura de BITALIS. Revisa únicamente los datos estructurados proporcionados para una alta de cliente en campo. NO leas imágenes, NO hagas OCR, NO inventes datos, NO decidas crédito, riesgo, autorización, saldo ni condiciones financieras. Tu función es señalar faltantes, inconsistencias obvias y una siguiente acción concreta. La validación oficial siempre la hace BITALIS.\n\nDatos: ${JSON.stringify(payload)}`}],
   config:{
    responseMimeType:'application/json',
    responseSchema:{type:Type.OBJECT,properties:{
     status:{type:Type.STRING,enum:['READY','REVIEW']},
     summary:{type:Type.STRING},
     checks:{type:Type.ARRAY,items:{type:Type.OBJECT,properties:{label:{type:Type.STRING},ok:{type:Type.BOOLEAN},message:{type:Type.STRING}},required:['label','ok','message']}},
     nextAction:{type:Type.STRING},
    },required:['status','summary','checks','nextAction']},
   },
  });
  const raw=JSON.parse(response.text||'{}') as ReviewData;
  const data:ReviewData={
   status:raw.status==='READY'?'READY':'REVIEW',
   summary:clean(raw.summary,320)||'Revisa la captura antes de guardar.',
   checks:Array.isArray(raw.checks)?raw.checks.slice(0,8).map(item=>({label:clean(item?.label,80)||'Revisión',ok:Boolean(item?.ok),message:clean(item?.message,180)||'Sin detalle.'})):[],
   nextAction:clean(raw.nextAction,240)||'Completa los datos faltantes y vuelve a revisar.',
  };
  return NextResponse.json({success:true,data,model:MODEL});
 }catch(error:any){
  const message=String(error?.message||'No pudimos revisar el alta con Gemini.');
  const status=message.includes('UNAUTHORIZED')?401:message.includes('FORBIDDEN')?403:500;
  console.error('Gemini intake review error:',message);
  return NextResponse.json({success:false,error:message},{status});
 }
}
