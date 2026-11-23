// Po zmianie zasobów zwiększ wersję C (i BUILD w app-core.js).
// Zasada: cache aplikacji jest zawsze kompletnym, spójnym zestawem plików jednej wersji — aktualizowany tylko w całości
// (install / refreshAll przez addAll, które zapisuje wszystko albo nic). Pojedyncze odpowiedzi z sieci nie trafiają do cache.
// Każda otwarta strona bierze WSZYSTKIE pliki z jednego źródła: jeśli dokument przyszedł z sieci — skrypty też z sieci,
// jeśli (przy słabym zasięgu) z cache — skrypty też z cache. Dzięki temu nigdy nie miesza się starego i nowego kodu.
const C="rotacja-v25",F=["/","/index.html","/styles.css","/app-core.js","/app-screens.js","/app-compare.js","/app-records.js","/app-editors.js","/app-actions.js","/app-kinship.js","/app-tree.js","/manifest.webmanifest","/icon.svg","/icon-192.png","/icon-512.png"];
const FONT_HOSTS=["fonts.googleapis.com","fonts.gstatic.com"],FONTS="rotacja-fonts",NET_TIMEOUT=3500,REFRESH_EVERY=6*3600e3,STAMP="/__sw-refreshed";
const fresh=u=>new Request(u,{cache:"no-cache"});
self.addEventListener("install",e=>{
  e.waitUntil(caches.open(C).then(c=>c.addAll(F.map(fresh)).then(()=>c.put(STAMP,new Response(String(Date.now()))))));
  self.skipWaiting();});
self.addEventListener("activate",e=>{e.waitUntil(caches.keys().then(k=>Promise.all(k.filter(x=>x!==C&&x!==FONTS).map(x=>caches.delete(x)))));self.clients.claim();});

// Źródło plików dla każdej strony (clientId → "net" | "cache").
const mode=new Map();
// Odświeżenie całego zestawu w tle (co najwyżej raz na REFRESH_EVERY), po udanym wczytaniu dokumentu z sieci.
async function refreshAll(){
  const c=await caches.open(C),s=await c.match(STAMP),last=s?+(await s.text()):0;
  if(Date.now()-last<REFRESH_EVERY)return;
  await c.addAll(F.map(fresh));
  await c.put(STAMP,new Response(String(Date.now())));
}
const fromCache=req=>caches.match(req,{ignoreSearch:true});

self.addEventListener("fetch",e=>{
  const req=e.request;if(req.method!=="GET")return;const u=new URL(req.url);
  if(u.origin===location.origin){
    if(u.pathname.startsWith("/api/"))return;
    if(req.mode==="navigate"){
      // Dokument: sieć z limitem czasu; po przekroczeniu — kopia z cache, a cała strona przechodzi na cache.
      // Odświeżenie cache w tle musi być zgłoszone (waitUntil) od razu, synchronicznie — kończy je kick().
      let kick;e.waitUntil(new Promise(r=>kick=r));
      e.respondWith(new Promise(res=>{let done=false;
        const finish=(r,m)=>{if(done||!r)return false;done=true;if(e.resultingClientId)mode.set(e.resultingClientId,m);res(r);return true;};
        // final=false (limit czasu): bez kopii w cache czekamy dalej na sieć; final=true (brak sieci): błąd.
        const useCache=final=>fromCache("/").then(r=>{if(!finish(r,"cache")&&final)finish(Response.error(),"cache");});
        const t=setTimeout(()=>useCache(false),NET_TIMEOUT);
        // Odświeżamy cache tylko, gdy ta strona wzięła dokument z sieci (strona na cache nie może dostać podmienionych plików).
        fetch(req,{cache:"no-cache"}).then(r=>{clearTimeout(t);const net=finish(r,"net");kick(net&&r.ok?refreshAll().catch(()=>{}):null);})
          .catch(()=>{clearTimeout(t);kick();useCache(true);});}));
      return;}
    // Pozostałe pliki: według źródła dokumentu tej strony.
    const m=mode.get(e.clientId)||"net";
    e.respondWith(m==="cache"
      ?fromCache(req).then(r=>r||fetch(req))
      :fetch(req,{cache:"no-cache"}).catch(()=>fromCache(req).then(r=>r||Response.error())));
    return;}
  if(FONT_HOSTS.includes(u.hostname)){
    // Czcionki: osobny cache jako zapas offline; brak sieci i cache = zwykły błąd (nie HTML zamiast CSS).
    e.respondWith(fetch(req).then(r=>{if(r.ok||r.type==="opaque"){const c=r.clone();caches.open(FONTS).then(x=>x.put(req,c)).catch(()=>{});}return r;})
      .catch(()=>caches.match(req).then(r=>r||Response.error())));}
});
