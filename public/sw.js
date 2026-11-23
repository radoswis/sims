// Po zmianie zasobów zwiększ wersję C (i BUILD w app-core.js).
const C="rotacja-v23",F=["/","/index.html","/styles.css","/app-core.js","/app-screens.js","/app-compare.js","/app-records.js","/app-editors.js","/app-actions.js","/app-kinship.js","/app-tree.js","/manifest.webmanifest","/icon.svg","/icon-192.png","/icon-512.png"];
const FONT_HOSTS=["fonts.googleapis.com","fonts.gstatic.com"],NET_TIMEOUT=3500;
self.addEventListener("install",e=>{e.waitUntil(caches.open(C).then(c=>c.addAll(F)));self.skipWaiting();});
self.addEventListener("activate",e=>{e.waitUntil(caches.keys().then(k=>Promise.all(k.filter(x=>x!==C).map(x=>caches.delete(x)))));self.clients.claim();});
const put=(req,res)=>caches.open(C).then(c=>c.put(req,res)).catch(()=>{});
self.addEventListener("fetch",e=>{
  if(e.request.method!=="GET")return;const u=new URL(e.request.url);
  if(u.origin===location.origin){
    if(u.pathname.startsWith("/api/"))return;
    // Najpierw sieć (świeże pliki), ale przy słabym zasięgu po NET_TIMEOUT oddaj kopię z cache; sieć dalej odświeża cache w tle.
    const net=fetch(u.href,{cache:"no-cache"}).then(r=>{if(r.ok)put(e.request,r.clone());return r;});
    e.waitUntil(net.catch(()=>{}));
    e.respondWith(new Promise(res=>{let done=false;const fin=r=>{if(!done&&r){done=true;res(r);}};
      const fallback=()=>caches.match(e.request).then(r=>r||(e.request.mode==="navigate"?caches.match("/"):null));
      const t=setTimeout(()=>fallback().then(fin),NET_TIMEOUT);
      net.then(r=>{clearTimeout(t);fin(r);}).catch(()=>{clearTimeout(t);fallback().then(r=>fin(r||Response.error()));});}));
    return;}
  if(FONT_HOSTS.includes(u.hostname)){
    // Czcionki: cache jako zapas offline; brak sieci i cache = zwykły błąd (nie HTML zamiast CSS).
    e.respondWith(fetch(e.request).then(r=>{if(r.ok||r.type==="opaque")put(e.request,r.clone());return r;})
      .catch(()=>caches.match(e.request).then(r=>r||Response.error())));}
});
