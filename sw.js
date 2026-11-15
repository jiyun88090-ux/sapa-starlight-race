const CACHE='starlight-install-v1';
const base=new URL('./',self.location.href);
self.addEventListener('install',event=>{event.waitUntil(caches.open(CACHE).then(cache=>cache.addAll(['./index.html','./manifest.webmanifest','./pwa.js','./pwa.css','./assets/icons/icon-192.png','./assets/icons/icon-512.png'])));});
self.addEventListener('activate',event=>{event.waitUntil((async()=>{for(const key of await caches.keys())if(key.startsWith('starlight-install-')&&key!==CACHE)await caches.delete(key);await self.clients.claim();})());});
self.addEventListener('fetch',event=>{
 const request=event.request,url=new URL(request.url);
 if(request.method!=='GET'||url.origin!==base.origin||!url.pathname.startsWith(base.pathname)||url.searchParams.has('qa'))return;
 // Only public app files are cached. Authentication and registrations go directly to Firebase.
 event.respondWith((async()=>{
  const cache=await caches.open(CACHE);
  try{const response=await fetch(request);if(response.ok)event.waitUntil(cache.put(request,response.clone()).catch(()=>{}));return response;}
  catch{const cached=await cache.match(request);if(cached)return cached;return new Response('인터넷 연결을 확인한 뒤 다시 열어주세요.',{status:503,headers:{'Content-Type':'text/plain; charset=utf-8'}});}
 })());
});
