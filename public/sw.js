const CACHE_PREFIX='bitalis-offline-';
const CACHE_NAME=`${CACHE_PREFIX}v1`;
const CORE=['/','/offline.html','/manifest.json','/bitalis-logo.svg','/bitalis-symbol.svg'];

self.addEventListener('install',event=>{
  event.waitUntil((async()=>{
    const cache=await caches.open(CACHE_NAME);
    await Promise.allSettled(CORE.map(async url=>{
      const response=await fetch(url,{cache:'reload'});
      if(response.ok)await cache.put(url,response);
    }));
    await self.skipWaiting();
  })());
});

self.addEventListener('activate',event=>{
  event.waitUntil((async()=>{
    const keys=await caches.keys();
    await Promise.all(keys.filter(key=>key.startsWith(CACHE_PREFIX)&&key!==CACHE_NAME).map(key=>caches.delete(key)));
    await self.clients.claim();
  })());
});

async function networkFirst(request){
  const cache=await caches.open(CACHE_NAME);
  try{
    const response=await fetch(request);
    if(response.ok)await cache.put(request,response.clone());
    return response;
  }catch(error){
    const exact=await cache.match(request);
    if(exact)return exact;
    if(request.mode==='navigate'){
      const url=new URL(request.url);
      const byPath=await cache.match(url.pathname);
      if(byPath)return byPath;
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

  // Nunca cachear autenticación ni datos financieros/API como respuesta HTTP.
  if(url.pathname.startsWith('/api/')||url.pathname==='/build-version.txt')return;

  if(request.mode==='navigate'){
    event.respondWith(networkFirst(request));
    return;
  }
  if(url.pathname.startsWith('/_next/static/')){
    event.respondWith(cacheFirst(request));
    return;
  }
  if(url.pathname.startsWith('/_next/')||url.searchParams.has('_rsc')){
    event.respondWith(networkFirst(request));
    return;
  }
  event.respondWith(staleWhileRevalidate(request));
});
