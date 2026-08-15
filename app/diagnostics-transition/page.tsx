'use client';

import {useEffect,useMemo,useState} from 'react';
import {useRouter} from 'next/navigation';
import {BITALIS_BUILD_AT,BITALIS_BUILD_COMMIT} from '@/lib/generated/buildInfo';
import {readAuthTransitionTrace} from '@/lib/ux/authTransitionTrace';

type TraceEvent=ReturnType<typeof readAuthTransitionTrace>[number];
const lastClientErrorKey='bitalis:last-client-error';
const lastBuildMismatchKey='bitalis:last-build-mismatch';

function latestActivityCluster(rows:TraceEvent[]){
  if(rows.length<2)return rows;
  let start=0;
  for(let i=1;i<rows.length;i++){
    const gap=new Date(rows[i].at).getTime()-new Date(rows[i-1].at).getTime();
    if(gap>60000)start=i;
  }
  return rows.slice(start);
}

function withoutDiagnosticsDocument(rows:TraceEvent[]){
  const diagnosticDocs=new Set(rows.filter(row=>row.path==='/diagnostics-transition').map(row=>row.doc));
  const operational=rows.filter(row=>!diagnosticDocs.has(row.doc));
  return operational.length?operational:rows;
}

function analyze(rows:TraceEvent[]){
  if(!rows.length)return 'Aún no hay una reproducción registrada. Usa BITALIS normalmente y abre DIAG inmediatamente después de que ocurra el problema.';
  const scope=withoutDiagnosticsDocument(latestActivityCluster(rows));
  const docs=new Set(scope.map(row=>row.doc));
  const clientError=scope.some(row=>row.event==='client-global-error');
  const buildMismatch=scope.some(row=>row.event==='build-version-mismatch');
  const logout=scope.some(row=>row.event==='logout-atomic-redirect');
  const expired=scope.some(row=>row.event==='session-expired-event'||row.event==='pwa-session-expired-location-assign'||row.event==='pwa-session-expired-location-replace');
  const permission401=scope.some(row=>row.event==='auth-permissions-fetch-end'&&Number(row.details?.status)===401);
  const permissions200=scope.some(row=>row.event==='auth-permissions-fetch-end'&&Number(row.details?.status)===200);
  const unload=scope.some(row=>row.event==='beforeunload'||row.event==='pagehide');
  const dashboard=scope.some(row=>row.path==='/dashboard'||String(row.details?.to||'').includes('/dashboard'));
  const accessUnavailable=scope.some(row=>row.path==='/access-unavailable'||String(row.details?.to||'').includes('/access-unavailable'));
  const toDashboard=scope.filter(row=>row.event==='history-replace-state'&&String(row.details?.to||'')==='/dashboard').length;
  const toLogin=scope.filter(row=>row.event==='history-replace-state'&&String(row.details?.to||'')==='/').length;
  const loginAttempt=scope.some(row=>row.event==='auth-login-fetch-start');
  const enteredWithCurrentFlow=scope.some(row=>row.event==='auth-enter-router-replace');
  const restoredEntry=scope.some(row=>row.event==='auth-enter-router-replace'&&row.details?.source==='restore');
  if(buildMismatch)return 'HALLAZGO: el JavaScript que estaba ejecutando el dispositivo pertenecía a otro build. BITALIS detectó el desfase y activó recuperación de caché.';
  if(clientError&&logout)return 'HALLAZGO: ocurrió una excepción JavaScript durante o inmediatamente después del cierre de sesión. La referencia del error quedó guardada en este dispositivo.';
  if(clientError)return 'HALLAZGO: BITALIS capturó una excepción JavaScript del cliente. Revisa la referencia de error y los eventos inmediatamente anteriores.';
  if(expired||permission401)return 'HALLAZGO: hubo expiración de sesión o un 401 de permisos. BITALIS intentó renovar la sesión antes de volver al acceso.';
  if(loginAttempt&&permissions200&&unload&&!enteredWithCurrentFlow)return 'HALLAZGO: Login y permisos respondieron 200, pero el documento se descargó sin registrar el flujo de entrada del build actual. Esto es compatible con JavaScript obsoleto/caché de una versión anterior.';
  if(toDashboard>=2&&toLogin>=2)return `HALLAZGO: existe un bucle SPA Login ↔ Dashboard dentro del mismo documento (${toDashboard} entradas a Dashboard, ${toLogin} regresos a Login).`;
  if(accessUnavailable)return 'HALLAZGO: la sesión autenticó correctamente, pero los permisos efectivos no ofrecieron una ruta privada navegable y BITALIS envió a /access-unavailable.';
  if(docs.size>1||unload){
    if(logout)return `HALLAZGO: el cambio de documento corresponde al cierre de sesión atómico (${docs.size} documentos operativos).`;
    if(restoredEntry||!loginAttempt)return `HALLAZGO: la reapertura/restauración de sesión produjo una navegación de documento (${docs.size} documentos operativos). El foco es el arranque frío, no el Login manual.`;
    return `HALLAZGO: hubo cambio de documento durante Login (${docs.size} documentos operativos).`;
  }
  if(dashboard)return 'HALLAZGO: la entrada a Dashboard ocurrió dentro del mismo documento y sin expiración ni rebote de ruta registrados.';
  return 'La traza existe, pero no contiene todavía una transición concluyente.';
}

function format(rows:TraceEvent[]){
  return rows.map(row=>{
    const detail=Object.entries(row.details||{}).filter(([,value])=>value!==undefined).map(([key,value])=>`${key}=${String(value)}`).join(' ');
    return `${new Date(row.at).toISOString()} +${row.t}ms doc=${String(row.doc||'').slice(0,8)} nav=${row.navType||'-'} path=${row.path} vis=${row.visibility} win=${row.innerWidth}x${row.innerHeight} vv=${row.viewportWidth??'-'}x${row.viewportHeight??'-'}@${row.viewportOffsetTop??'-'} event=${row.event}${detail?` ${detail}`:''}`;
  }).join('\n');
}

export default function DiagnosticsTransitionPage(){
  const router=useRouter();
  const[rows,setRows]=useState<TraceEvent[]>([]);
  const[build,setBuild]=useState('Cargando /build-version.txt…');
  const[lastClientError,setLastClientError]=useState('Sin excepción de cliente registrada.');
  const[lastBuildMismatch,setLastBuildMismatch]=useState('Sin desfase de build registrado.');
  const[copied,setCopied]=useState(false);

  const refresh=()=>{
    setRows(readAuthTransitionTrace());
    try{
      setLastClientError(localStorage.getItem(lastClientErrorKey)||'Sin excepción de cliente registrada.');
      setLastBuildMismatch(localStorage.getItem(lastBuildMismatchKey)||'Sin desfase de build registrado.');
    }catch{}
  };
  useEffect(()=>{
    refresh();
    fetch(`/build-version.txt?ts=${Date.now()}`,{cache:'no-store',headers:{'Cache-Control':'no-store'}}).then(response=>response.text()).then(setBuild).catch(()=>setBuild('No se pudo leer /build-version.txt'));
  },[]);

  const finding=useMemo(()=>analyze(rows),[rows]);
  const trace=useMemo(()=>format(rows),[rows]);
  const docs=useMemo(()=>new Set(rows.map(row=>row.doc)).size,[rows]);
  const operationalDocs=useMemo(()=>new Set(withoutDiagnosticsDocument(rows).map(row=>row.doc)).size,[rows]);
  const copy=async()=>{
    const text=`BITALIS DIAGNOSTICO\nCLIENT_BUILD_COMMIT=${BITALIS_BUILD_COMMIT}\nCLIENT_BUILD_AT=${BITALIS_BUILD_AT}\n${build}\n${finding}\nULTIMO_DESFASE_BUILD=${lastBuildMismatch}\nULTIMO_ERROR_CLIENTE=${lastClientError}\nEVENTS=${rows.length}\nDOCUMENTS=${docs}\nOPERATIONAL_DOCUMENTS=${operationalDocs}\n\n${trace}`;
    try{await navigator.clipboard.writeText(text);setCopied(true);}catch{window.prompt('Copia este diagnóstico:',text);}
  };

  return <main className="min-h-[100svh] bg-slate-50 px-3 py-5 text-[var(--bitalis-primary)]">
    <div className="mx-auto max-w-3xl space-y-3">
      <section className="rounded-[28px] border border-emerald-100 bg-white p-4 shadow-[0_10px_30px_rgba(6,43,36,.08)]">
        <div className="inline-flex rounded-full bg-emerald-50 px-3 py-1.5 text-[10px] font-black uppercase tracking-[.12em] text-emerald-700">BITALIS · MISMA PWA</div>
        <h1 className="mt-3 text-xl font-black">Diagnóstico de aplicación</h1>
        <p className="mt-1 text-xs leading-5 text-slate-500">Este visor lee el mismo almacenamiento de la app. No muestra contraseñas, tokens, correos ni datos de clientes.</p>
        <div className="mt-3 rounded-2xl bg-emerald-50 p-3 text-sm font-black text-[var(--bitalis-primary)]">{finding}</div>
        <div className="mt-3 grid grid-cols-2 gap-2">
          <button onClick={copy} className="min-h-12 rounded-2xl bg-[var(--bitalis-action)] px-3 text-xs font-black text-white">{copied?'COPIADO ✓':'COPIAR DIAGNÓSTICO'}</button>
          <button onClick={refresh} className="min-h-12 rounded-2xl bg-slate-100 px-3 text-xs font-black">ACTUALIZAR</button>
          <button onClick={()=>router.replace('/')} className="col-span-2 min-h-12 rounded-2xl border border-emerald-100 bg-white px-3 text-xs font-black">VOLVER A BITALIS</button>
        </div>
      </section>
      <section className="rounded-[28px] border border-slate-200 bg-white p-4"><h2 className="text-sm font-black">Build JavaScript en ejecución</h2><pre className="mt-2 whitespace-pre-wrap break-words rounded-2xl bg-slate-950 p-3 text-[10px] leading-5 text-emerald-100">commit={BITALIS_BUILD_COMMIT}{'\n'}built_at={BITALIS_BUILD_AT}</pre></section>
      <section className="rounded-[28px] border border-slate-200 bg-white p-4"><h2 className="text-sm font-black">Build servido</h2><pre className="mt-2 whitespace-pre-wrap break-words rounded-2xl bg-slate-950 p-3 text-[10px] leading-5 text-emerald-100">{build}</pre></section>
      <section className="rounded-[28px] border border-slate-200 bg-white p-4"><h2 className="text-sm font-black">Último desfase de build</h2><pre className="mt-2 whitespace-pre-wrap break-words rounded-2xl bg-slate-950 p-3 text-[10px] leading-5 text-emerald-100">{lastBuildMismatch}</pre></section>
      <section className="rounded-[28px] border border-slate-200 bg-white p-4"><h2 className="text-sm font-black">Última excepción de cliente</h2><pre className="mt-2 whitespace-pre-wrap break-words rounded-2xl bg-slate-950 p-3 text-[10px] leading-5 text-emerald-100">{lastClientError}</pre></section>
      <section className="rounded-[28px] border border-slate-200 bg-white p-4"><h2 className="text-sm font-black">Traza</h2><p className="mt-1 text-[10px] text-slate-500">Eventos: {rows.length} · Documentos totales: {docs} · Operativos: {operationalDocs}</p><pre className="mt-2 max-h-[52vh] overflow-auto whitespace-pre-wrap break-words rounded-2xl bg-slate-950 p-3 text-[9px] leading-4 text-emerald-100">{trace||'Sin eventos todavía.'}</pre></section>
    </div>
  </main>;
}
