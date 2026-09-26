const C='drks-live-v9';
const A=['./','./index.html','./styles.css','./design-v4.css','./design-v5.css','./design-v6.css','./app.js','./manifest.json'];
self.addEventListener('install',e=>{self.skipWaiting();e.waitUntil(caches.open(C).then(c=>c.addAll(A).catch(()=>{})))});
self.addEventListener('activate',e=>e.waitUntil((async()=>{const keys=await caches.keys();await Promise.all(keys.filter(k=>k!==C).map(k=>caches.delete(k)));await self.clients.claim()})()));
self.addEventListener('fetch',e=>{
  if(e.request.method!=='GET'||e.request.url.includes('/api/'))return;
  const url=new URL(e.request.url);
  if(url.origin!==self.location.origin)return;
  e.respondWith((async()=>{
    try{
      const fresh=await fetch(e.request,{cache:'no-store'});
      if(fresh && fresh.ok){const cache=await caches.open(C);cache.put(e.request,fresh.clone()).catch(()=>{});}
      return fresh;
    }catch{
      return (await caches.match(e.request)) || Response.error();
    }
  })());
});
