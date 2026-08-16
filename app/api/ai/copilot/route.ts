import {GoogleGenAI,Type} from '@google/genai';
import {NextRequest,NextResponse} from 'next/server';
import {getClientUserContext} from '@/src/crm/auth-helper';

const MODEL='gemini-3.6-flash';
const MAX_TEXT=1200;

const tools=[{
  functionDeclarations:[
    {name:'get_collection_portfolio',description:'Consulta la cartera de cobranza visible para el usuario autenticado. Úsala para responder sobre clientes pendientes, saldos, riesgos y próximos cobros.',parameters:{type:Type.OBJECT,properties:{}}},
    {name:'find_client',description:'Busca clientes dentro de la cartera visible del usuario por nombre, teléfono, número de cliente o número de venta.',parameters:{type:Type.OBJECT,properties:{query:{type:Type.STRING,description:'Texto de búsqueda del cliente'}},required:['query']}},
    {name:'get_route_summary',description:'Obtiene un resumen de la ruta y progreso de cobranza del día para el usuario autenticado.',parameters:{type:Type.OBJECT,properties:{}}},
    {name:'find_product',description:'Busca productos del catálogo por nombre, SKU, marca o descripción y devuelve precio y existencia disponible cuando estén presentes.',parameters:{type:Type.OBJECT,properties:{query:{type:Type.STRING,description:'Producto, SKU o marca a buscar'}},required:['query']}},
    {name:'get_cash_status',description:'Consulta el estado actual de caja del usuario autenticado, cuando su rol y permisos lo permiten.',parameters:{type:Type.OBJECT,properties:{}}},
  ],
}];

const clean=(value:unknown,max=MAX_TEXT)=>String(value??'').trim().replace(/\s+/g,' ').slice(0,max);
const num=(value:unknown)=>{const n=Number(value);return Number.isFinite(n)?n:null;};

function authHeaders(req:NextRequest){
  const authorization=req.headers.get('authorization');
  return authorization?{Authorization:authorization,'Cache-Control':'no-store'}:{'Cache-Control':'no-store'};
}

async function internalJson(req:NextRequest,path:string){
  const response=await fetch(new URL(path,req.url),{headers:authHeaders(req),cache:'no-store'});
  const json=await response.json().catch(()=>({}));
  if(!response.ok)return {error:clean((json as any)?.error||(json as any)?.message||`HTTP ${response.status}`,240),status:response.status};
  return json;
}

function compactPortfolio(json:any){
  const rows=Array.isArray(json?.data)?json.data:[];
  return rows.slice(0,60).map((c:any)=>({
    creditId:clean(c?.id,80),saleNumber:clean(c?.saleNumber,80),clientId:clean(c?.clientId,80),clientNumber:clean(c?.client?.clientNumber,80),
    clientName:clean([c?.client?.firstName,c?.client?.lastName,c?.client?.secondLastName].filter(Boolean).join(' '),180),phone:clean(c?.client?.phone,40),
    risk:clean(c?.client?.riskLevel||c?.riskLevel,40),balance:num(c?.saldoActual),suggestedInstallment:num(c?.suggestedInstallment),frequency:clean(c?.paymentFrequency,40),nextVisit:clean(c?.proximaVisita,80),status:clean(c?.status,40),
  }));
}

async function executeTool(req:NextRequest,userId:string,name:string,args:any){
  if(name==='get_collection_portfolio'){
    const json=await internalJson(req,'/api/collections/portfolio');
    if((json as any)?.error)return json;
    const rows=compactPortfolio(json);
    return {count:rows.length,clients:rows};
  }
  if(name==='find_client'){
    const json=await internalJson(req,'/api/collections/portfolio');
    if((json as any)?.error)return json;
    const q=clean(args?.query,120).toLowerCase();
    const matches=compactPortfolio(json).filter((row:any)=>`${row.clientName} ${row.clientNumber} ${row.phone} ${row.saleNumber}`.toLowerCase().includes(q)).slice(0,12);
    return {query:q,count:matches.length,matches};
  }
  if(name==='get_route_summary'){
    const [portfolio,progress]=await Promise.all([internalJson(req,'/api/collections/portfolio'),internalJson(req,`/api/collections/route-progress?date=${new Intl.DateTimeFormat('en-CA',{timeZone:'America/Mexico_City'}).format(new Date())}`)]);
    const rows=(portfolio as any)?.error?[]:compactPortfolio(portfolio);
    const pendingBalance=rows.reduce((sum:number,row:any)=>sum+(row.balance||0),0);
    return {portfolioCount:rows.length,pendingBalance,progress:(progress as any)?.data||progress,topRisk:rows.filter((row:any)=>/CRIT|ALTO|HIGH/i.test(row.risk)).slice(0,10)};
  }
  if(name==='find_product'){
    const json=await internalJson(req,'/api/products');
    if((json as any)?.error)return json;
    const q=clean(args?.query,120).toLowerCase();
    const products=Array.isArray((json as any)?.products)?(json as any).products:[];
    const matches=products.filter((p:any)=>`${p?.sku||''} ${p?.name||''} ${p?.brand||''} ${p?.description||''}`.toLowerCase().includes(q)).slice(0,12).map((p:any)=>{
      const prices=Array.isArray(p?.prices)?p.prices:[];const stocks=Array.isArray(p?.stocks)?p.stocks:[];
      const price=prices.find((x:any)=>x?.isActive!==false&&(x?.priceType==='LIST'||x?.priceType==='LIST_PRICE'));
      const available=stocks.reduce((sum:number,x:any)=>sum+Number(x?.quantityAvailable??(Number(x?.quantityOnHand||0)-Number(x?.quantityReserved||0))),0);
      return {id:clean(p?.id,80),sku:clean(p?.sku,80),name:clean(p?.name,180),brand:clean(p?.brand,100),status:clean(p?.status,40),price:num(price?.amount??price?.price),available:Number.isFinite(available)?available:null};
    });
    return {query:q,count:matches.length,matches};
  }
  if(name==='get_cash_status')return internalJson(req,`/api/cash-sessions/current?userId=${encodeURIComponent(userId)}`);
  return {error:'Herramienta no disponible.'};
}

export async function POST(req:NextRequest){
  try{
    const user=getClientUserContext(req);
    const apiKey=process.env.GEMINI_API_KEY?.trim();
    if(!apiKey)return NextResponse.json({success:false,error:'Gemini no está configurado.'},{status:503});
    const body=await req.json().catch(()=>({}));
    const question=clean(body?.message,MAX_TEXT);
    if(!question)return NextResponse.json({success:false,error:'Escribe una pregunta para BITALIS IA.'},{status:400});

    const ai=new GoogleGenAI({apiKey});
    const system=`Eres BITALIS IA, copiloto operativo de un ERP/CRM de ventas y cobranza en ruta. Responde en español mexicano, claro y breve. Usa herramientas cuando la pregunta dependa de datos reales. Solo tienes herramientas de lectura: nunca afirmes que registraste, modificaste, autorizaste, cobraste o eliminaste algo. No inventes clientes, saldos, inventario ni resultados. Respeta el alcance y permisos del usuario autenticado. Para prioridades de cobranza, explica criterios usando riesgo, saldo, próxima visita y progreso disponible; no reemplaces reglas financieras ni autorizaciones del sistema. Si faltan datos, dilo. Usuario actual: role=${clean((user as any)?.role,40)||'desconocido'} userId=${clean(user.userId,80)}.`;
    const first=await ai.models.generateContent({model:MODEL,contents:[{role:'user',parts:[{text:`${system}\n\nPregunta: ${question}`}]}],config:{tools}} as any);
    const calls=Array.isArray((first as any)?.functionCalls)?(first as any).functionCalls:[];
    if(!calls.length)return NextResponse.json({success:true,answer:clean((first as any)?.text||'No encontré datos suficientes para responder.',1800),model:MODEL,toolsUsed:[]});

    const results=[] as Array<{name:string;id?:string;result:any}>;
    for(const call of calls.slice(0,5))results.push({name:String(call?.name||''),id:call?.id,result:await executeTool(req,user.userId,String(call?.name||''),call?.args||{})});
    const modelContent=(first as any)?.candidates?.[0]?.content;
    const functionParts=results.map(item=>({functionResponse:{name:item.name,id:item.id,response:{result:item.result}}}));
    const second=await ai.models.generateContent({model:MODEL,contents:[{role:'user',parts:[{text:`${system}\n\nPregunta: ${question}`}]},...(modelContent?[modelContent]:[]),{role:'user',parts:functionParts}],config:{tools}} as any);
    return NextResponse.json({success:true,answer:clean((second as any)?.text||'Consulté BITALIS, pero no pude construir una respuesta útil.',2200),model:MODEL,toolsUsed:results.map(x=>x.name)});
  }catch(error:any){
    const message=String(error?.message||'No pudimos consultar BITALIS IA.');
    const status=message.includes('UNAUTHORIZED')?401:message.includes('FORBIDDEN')?403:500;
    console.error('Gemini copilot error:',message);
    return NextResponse.json({success:false,error:clean(message,320)},{status});
  }
}
