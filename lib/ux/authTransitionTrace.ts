export type AuthTransitionDetails=Record<string,string|number|boolean|null|undefined>;

export type AuthTransitionEvent={
  at:number;
  t:number;
  doc:string;
  event:string;
  path:string;
  visibility:string;
  innerWidth:number;
  innerHeight:number;
  viewportWidth:number|null;
  viewportHeight:number|null;
  viewportOffsetTop:number|null;
  navType:string|null;
  details:AuthTransitionDetails;
};

const TRACE_KEY='bitalis:auth-transition-trace:v1';
const MAX_EVENTS=120;
let documentId:string|undefined;

function getDocumentId(){
  if(documentId)return documentId;
  try{documentId=crypto.randomUUID();}catch{documentId=`doc-${Date.now()}-${Math.random().toString(36).slice(2,8)}`;}
  return documentId;
}

function navigationType(){
  try{
    const entry=performance.getEntriesByType('navigation')[0] as PerformanceNavigationTiming|undefined;
    return entry?.type||null;
  }catch{return null;}
}

function readStored():AuthTransitionEvent[]{
  if(typeof window==='undefined')return[];
  try{
    const raw=sessionStorage.getItem(TRACE_KEY);
    const parsed=raw?JSON.parse(raw):[];
    return Array.isArray(parsed)?parsed:[];
  }catch{return[];}
}

export function traceAuthTransition(event:string,details:AuthTransitionDetails={}){
  if(typeof window==='undefined')return;
  try{
    const vv=window.visualViewport;
    const row:AuthTransitionEvent={
      at:Date.now(),
      t:Math.round(performance.now()),
      doc:getDocumentId(),
      event,
      path:location.pathname,
      visibility:document.visibilityState,
      innerWidth:window.innerWidth,
      innerHeight:window.innerHeight,
      viewportWidth:vv?Math.round(vv.width):null,
      viewportHeight:vv?Math.round(vv.height):null,
      viewportOffsetTop:vv?Math.round(vv.offsetTop):null,
      navType:navigationType(),
      details,
    };
    const rows=readStored();
    rows.push(row);
    sessionStorage.setItem(TRACE_KEY,JSON.stringify(rows.slice(-MAX_EVENTS)));
  }catch{}
}

export function resetAuthTransitionTrace(){
  if(typeof window==='undefined')return;
  try{sessionStorage.removeItem(TRACE_KEY);}catch{}
  traceAuthTransition('trace-reset');
}

export function readAuthTransitionTrace(){return readStored();}

export function formatAuthTransitionTrace(){
  const rows=readStored();
  const docs=[...new Set(rows.map(row=>row.doc))];
  return [
    `BITALIS AUTH TRANSITION TRACE`,
    `documents=${docs.length}`,
    `events=${rows.length}`,
    ...rows.map(row=>{
      const detail=Object.entries(row.details).filter(([,value])=>value!==undefined).map(([key,value])=>`${key}=${String(value)}`).join(' ');
      return `${new Date(row.at).toISOString()} +${row.t}ms doc=${row.doc.slice(0,8)} nav=${row.navType||'-'} path=${row.path} vis=${row.visibility} win=${row.innerWidth}x${row.innerHeight} vv=${row.viewportWidth??'-'}x${row.viewportHeight??'-'}@${row.viewportOffsetTop??'-'} event=${row.event}${detail?` ${detail}`:''}`;
    }),
  ].join('\n');
}
