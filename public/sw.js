const CACHE_PREFIX='bitalis-offline-';
const CACHE_NAME=`${CACHE_PREFIX}v5`;
const NAVIGATION_TIMEOUT_MS=3500;
const CORE=[
  '/','/dashboard','/route','/route/close','/collections','/portfolio','/clients','/clients/new','/products','/inventory','/cash','/notifications','/settings','/sync',
  '/offline.html','/manifest.json','/bitalis-logo.svg','/bitalis-symbol.svg'
];

self.addEventListener('install',event=>{
  event.waitUntil((async()=>{
    const cache=await caches.open(CACHE_NAME);
    await Promise.allSettled(CORE.map(async url=>{
      const response=await fetch(url,{cache:'reload',credentials:'same-origin'});
      if(response.ok)await cache.put(url,response);
    }));
    // La versión nueva queda en espera y se activa al cerrar la instancia actual.
    // Así nunca reemplaza el controlador durante Login o una captura offline.
  })());
});

self.addEventListener('activate',event=>{
  event.waitUntil((async()=>{
    const keys=await caches.keys();
    await Promise.all(keys.filter(key=>key.startsWith(CACHE_PREFIX)&&key!==CACHE_NAME).map(key=>caches.delete(key)));
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
    if(response.ok)await cache.put(request,response.clone());
    return response;
  }catch(error){
    const exact=await cache.match(request);
    if(exact)return exact;
    const url=new URL(request.url);
    const byPath=await cache.match(url.pathname);
    if(byPath)return byPath;
    if(request.mode==='navigate'){
      const offline=await cache.match('/offline.html');
      if(offline)return offline;
    }
    throw error;
  }
}

async function cacheFirst(request){
  const cache=await caches.open(CACHE_NAME);
  const cached=await cache.match(request);
  if(cached)return cached;
  const response=await fetch(request);
  if(response.ok)await cache.put(request,response.clone());
  return response;
}

async function staleWhileRevalidate(request){
  const cache=await caches.open(CACHE_NAME);
  const cached=await cache.match(request);
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
    // Do not wait indefinitely on unstable mobile links before falling back to the local shell.
    event.respondWith(networkFirst(request));
    return;
  }
  if(url.pathname.startsWith('/_next/static/')){
    // En línea se revalida el chunk saltando la caché HTTP. Si la conexión falla,
    // se conserva el chunk verificado de Cache Storage para operación offline.
    event.respondWith(networkFirst(request,{reload:true}));
    return;
  }
  if(url.pathname.startsWith('/_next/')||url.searchParams.has('_rsc')){
    event.respondWith(networkFirst(request));
    return;
  }
  event.respondWith(staleWhileRevalidate(request));
});
