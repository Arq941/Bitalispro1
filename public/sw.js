const BUILD_COMMIT='development';
const CACHE_PREFIX='bitalis-offline-';
const SAFE_BUILD_COMMIT=String(BUILD_COMMIT||'unknown').replace(/[^a-zA-Z0-9_-]/g,'').slice(0,20)||'unknown';
const CACHE_NAME=`${CACHE_PREFIX}${SAFE_BUILD_COMMIT}`;
const NAVIGATION_TIMEOUT_MS=3500;
const CORE=[
  '/offline.html','/manifest.json','/bitalis-logo.svg','/bitalis-symbol.svg'
];

self.addEventListener('install',event=>{
  event.waitUntil((async()=>{
    const cache=await caches.open(CACHE_NAME);
    await Promise.allSettled(CORE.map(async url=>{
      const response=await fetch(url,{cache:'reload',credentials:'same-origin'});
      if(response.ok)await cache.put(url,response);
    }));
    // La versión nueva queda en espera hasta cerrar la instancia actual.
    // Así no sustituye el controlador durante Login o una captura offline.
  })());
});

self.addEventListener('activate',event=>{
  event.waitUntil((async()=>{
    const keys=await caches.keys();
    await Promise.all(
      keys
        .filter(key=>key.startsWith(CACHE_PREFIX)&&key!==CACHE_NAME)
        .map(key=>caches.delete(key)),
    );
    await self.clients.claim();
  })());
});

async function fetchWithTimeout(request,timeoutMs){
  const controller=new AbortController();
  const timer=setTimeout(()=>controller.abort(),timeoutMs);
  try{return await fetch(request,{signal:controller.signal});}finally{clearTimeout(timer);}
}

async function networkFirst(request,options={}){
  const cache=await caches.open(CACHE_NAME);
  try{
    const response=options.reload
      ?await fetch(request,{cache:'reload',credentials:'same-origin'})
      :await fetchWithTimeout(request,request.mode==='navigate'?NAVIGATION_TIMEOUT_MS:8000);
    if(!response.ok)throw new Error(`HTTP_${response.status}`);
    if(options.cacheResponse!==false)await cache.put(request,response.clone());
    return response;
  }catch(error){
    // Coincidencia exacta: nunca mezclar documentos RSC, consultas o rutas de otro estado.
    const exact=await cache.match(request,{ignoreSearch:false});
    if(exact)return exact;
    if(request.mode==='navigate'){
      const offline=await cache.match('/offline.html');
      if(offline)return offline;
    }
    throw error;
  }
}

async function staleWhileRevalidate(request){
  const cache=await caches.open(CACHE_NAME);
  const cached=await cache.match(request,{ignoreSearch:false});
  const network=fetch(request).then(async response=>{
    if(response.ok)await cache.put(request,response.clone());
    return response;
  }).catch(()=>null);
  if(cached){void network;return cached;}
  const response=await network;
  if(response)return response;
  throw new Error('OFFLINE_CACHE_MISS');
}

self.addEventListener('fetch',event=>{
  const request=event.request;
  if(request.method!=='GET')return;
  const url=new URL(request.url);
  if(url.origin!==self.location.origin)return;

  // Autenticación, datos financieros y APIs se guardan en IndexedDB/cola, no en HTTP cache.
  if(url.pathname.startsWith('/api/')||url.pathname==='/build-version.txt')return;

  if(request.mode==='navigate'){
    // Nunca conservar HTML/RSC: un documento anterior puede apuntar a chunks
    // que ya no existen después de un despliegue. Offline usa el shell estable.
    event.respondWith(networkFirst(request,{cacheResponse:false}));
    return;
  }
  if(url.pathname.startsWith('/_next/static/')){
    // Revalidar siempre el chunk. El fallback sólo puede pertenecer a este commit.
    event.respondWith(networkFirst(request,{reload:true}));
    return;
  }
  if(url.pathname.startsWith('/_next/')||url.searchParams.has('_rsc')){
    event.respondWith(networkFirst(request,{cacheResponse:false}));
    return;
  }
  event.respondWith(staleWhileRevalidate(request));
});

self.addEventListener('notificationclick',event=>{
  event.notification.close();
  const rawHref=String(event.notification.data?.href||'/notifications');
  const href=rawHref.startsWith('/')&&!rawHref.startsWith('//')?rawHref:'/notifications';
  event.waitUntil((async()=>{
    const target=new URL(href,self.location.origin).href;
    const windows=await self.clients.matchAll({type:'window',includeUncontrolled:true});
    const current=windows.find(client=>new URL(client.url).origin===self.location.origin);
    if(current){await current.focus();if('navigate'in current)await current.navigate(target);return;}
    await self.clients.openWindow(target);
  })());
});
