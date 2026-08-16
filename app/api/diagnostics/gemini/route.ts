import {NextRequest,NextResponse} from 'next/server';
import {GoogleGenAI,ThinkingLevel} from '@google/genai';
import {getClientUserContext} from '@/src/crm/auth-helper';

const MODEL='gemini-3.6-flash';

function safeError(error:unknown){
 const raw=String((error as any)?.message||error||'Error desconocido');
 return raw.replace(/AIza[0-9A-Za-z_-]{20,}/g,'[REDACTED]').slice(0,320);
}

export async function GET(req:NextRequest){
 try{
  getClientUserContext(req);
 }catch{
  return NextResponse.json({success:false,error:'UNAUTHORIZED'},{status:401,headers:{'Cache-Control':'no-store'}});
 }

 const apiKey=process.env.GEMINI_API_KEY?.trim();
 if(!apiKey){
  return NextResponse.json({success:true,configured:false,api:'NOT_CONFIGURED',model:MODEL,latencyMs:null,error:'GEMINI_API_KEY no está configurada en el servidor.'},{headers:{'Cache-Control':'no-store'}});
 }

 const started=Date.now();
 try{
  const ai=new GoogleGenAI({apiKey});
  const response=await ai.models.generateContent({
   model:MODEL,
   contents:'Responde únicamente con OK.',
   config:{
    maxOutputTokens:64,
    thinkingConfig:{thinkingLevel:ThinkingLevel.MINIMAL},
   },
  });
  const text=String(response.text||'').trim();
  const finishReason=String(response.candidates?.[0]?.finishReason||'');
  return NextResponse.json({
   success:true,
   configured:true,
   api:text?'OK':'ERROR',
   model:MODEL,
   latencyMs:Date.now()-started,
   response:text.slice(0,32)||null,
   finishReason:finishReason||null,
   error:text?null:`Gemini respondió sin texto${finishReason?` (finishReason=${finishReason})`:''}.`,
  },{headers:{'Cache-Control':'no-store'}});
 }catch(error){
  return NextResponse.json({
   success:true,
   configured:true,
   api:'ERROR',
   model:MODEL,
   latencyMs:Date.now()-started,
   error:safeError(error),
  },{headers:{'Cache-Control':'no-store'}});
 }
}
