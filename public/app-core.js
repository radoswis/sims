"use strict";
const BUILD="14 (31.10.2026)";

/* ================= DANE ================= */
const AGES=["Niemowlę","Dziecko","Nastolatek","Młody dorosły","Dorosły","Senior"];
const ASP=["Rodzina","Pieniądze","Wiedza","Romans","Popularność","Przyjemność","Ser grillowany","Brak"];
const COLORS=["#3b6fd1","#d9577a","#e08a2b","#3f9f4b","#d4562b","#7553d1","#2fa395","#b450c9","#4b5d7a","#a3772c"];
const ST={todo:["Do zrobienia","st-todo"],prog:["W trakcie","st-prog"],done:["Zrobiona","st-done"]};
const DEF_TASKS=["Kontrola budżetu","Randki","Ciąża","Nastolatki na studia"];
const uid=()=>Math.random().toString(36).slice(2,9);
const esc=s=>String(s??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));

function newFamily(name,i){return{id:uid(),name,color:COLORS[i%COLORS.length],status:"todo",day:1,tasks:DEF_TASKS.map(t=>({id:uid(),t,done:false})),bud0:"",bud:"",notes:{}};}
function newSim(o){return Object.assign({id:uid(),first:"",last:"",fam:"",age:"Dorosły",asp:"Rodzina",photo:"",gender:"",parents:["",""],spouse:"",romances:[],ex:[],ptype:"",bio:"",dead:false,cause:"",grave:"",diedRound:""},o);}
const MAX_FAM=24,MIN_SLOTS=6;
function empty(){return{v:1,hood:"Miłowo",round:1,families:[],sims:[],rules:"",lots:[]};}

/* ================= ZAPIS (IndexedDB) ================= */
let S=null,db=null,saveT=0;
function openDB(){return new Promise(res=>{try{const r=indexedDB.open("sims-rotacja",1);r.onupgradeneeded=()=>r.result.createObjectStore("kv");r.onsuccess=()=>res(r.result);r.onerror=()=>res(null);}catch(e){res(null);}});}
function load(){return new Promise(res=>{if(!db)return res(null);try{const q=db.transaction("kv").objectStore("kv").get("state");q.onsuccess=()=>res(q.result||null);q.onerror=()=>res(null);}catch(e){res(null);}});}
function idbPut(k,v){return new Promise(res=>{if(!db)return res(false);try{const t=db.transaction("kv","readwrite");t.objectStore("kv").put(v,k);t.oncomplete=()=>res(true);t.onerror=()=>res(false);}catch(e){res(false);}});}
function idbGet(k){return new Promise(res=>{if(!db)return res(null);try{const q=db.transaction("kv").objectStore("kv").get(k);q.onsuccess=()=>res(q.result||null);q.onerror=()=>res(null);}catch(e){res(null);}});}
function save(){clearTimeout(saveT);saveT=setTimeout(async()=>{if(!(await idbPut("state",S)))toast("Nie udało się zapisać danych w przeglądarce.");SY.dirty=true;SY.gen++;idbPut("sync",{rev:SY.rev,dirty:true});schedulePush();},250);}

/* ================= SERWER (synchronizacja) ================= */
// Dane trzymane na serwerze (Cloudflare D1). Telefon ma kopię roboczą — działa bez internetu i wysyła zmiany, gdy sieć wróci.
const SY={rev:0,dirty:false,gen:0,busy:false};let pushT=0;
function schedulePush(ms){clearTimeout(pushT);pushT=setTimeout(push,ms??1500);}
function hasData(x){return !!x&&((x.families||[]).length>0||(x.sims||[]).length>0);}
async function takeServer(r,msg){if(hasData(S))await idbPut("state-backup",S);S=r.state;migrateS();SY.rev=r.rev;SY.dirty=false;await idbPut("state",S);await idbPut("sync",{rev:SY.rev,dirty:false});if(typeof render==="function")render();if(msg)toast(msg);}
async function push(){
  if(SY.busy){schedulePush(800);return;}if(!SY.dirty||!navigator.onLine)return;
  SY.busy=true;const gen=SY.gen;
  try{const r=await fetch("/api/state",{method:"PUT",headers:{"content-type":"application/json"},body:JSON.stringify({state:S,baseRev:SY.rev})});
    const d=await r.json().catch(()=>({}));
    if(r.ok){SY.rev=d.rev;if(SY.gen===gen)SY.dirty=false;await idbPut("sync",{rev:SY.rev,dirty:SY.dirty});}
    else if(r.status===409&&d.state){await takeServer(d,"Na serwerze były nowsze dane — wczytano je.");}
    else schedulePush(15000);
  }catch(e){schedulePush(15000);}finally{SY.busy=false;}
  if(SY.dirty&&SY.gen!==gen)schedulePush(500);
}
async function pull(){
  if(!navigator.onLine||SY.busy)return;
  try{const r=await fetch("/api/state",{cache:"no-store"});if(!r.ok)return;const d=await r.json();
    if(!d.state){if(hasData(S)){SY.dirty=true;SY.gen++;push();}return;}
    if(d.rev>SY.rev){
      // Pierwsza synchronizacja na urządzeniu, które ma już własne dane — nie nadpisuj bez pytania.
      if(SY.rev===0&&hasData(S)&&JSON.stringify(S)!==JSON.stringify(d.state)&&!confirm("Na serwerze są już inne dane.\n\nOK — wczytaj dane z serwera (dane z tego telefonu zostaną zachowane jako kopia).\nAnuluj — wyślij dane z tego telefonu na serwer.")){
        SY.rev=d.rev;SY.dirty=true;SY.gen++;push();return;}
      await takeServer(d,SY.rev?"Wczytano aktualne dane z serwera.":"");return;}
    if(SY.dirty)push();
  }catch(e){}
}
addEventListener("online",()=>{pull();});
document.addEventListener("visibilitychange",()=>{if(document.visibilityState==="visible")pull();else if(SY.dirty){clearTimeout(pushT);push();}});

/* ================= POMOCNICZE ================= */
const $=s=>document.querySelector(s);
const fam=id=>S.families.find(f=>f.id===id);
const sim=id=>S.sims.find(s=>s.id===id);
const full=s=>s?(s.first+" "+s.last).trim()||"Bez imienia":"";
const ini=n=>String(n||"?").split(/\s+/).filter(Boolean).map(w=>w[0]).join("").slice(0,2).toUpperCase()||"?";
function avStyle(photo,color){return photo?`--c:url('${photo}')`:`--c:${color}`;}
function simColor(s){const f=fam(s.fam);return f?f.color:"#8a96b0";}
function avatar(s,cls){return `<span class="av ${cls||""}" style="${avStyle(s.photo,simColor(s))}">${s.photo?"":esc(ini(s.first+" "+s.last))}</span>`;}
function famFace(f){const m=S.sims.find(s=>s.fam===f.id&&s.photo&&!s.dead);return m?{style:`--c:url('${m.photo}')`,txt:""}:{style:`--c:linear-gradient(135deg,${f.color}cc,${f.color})`,txt:esc(ini(f.name))};}
function simsLabel(n){return n===1?"1 Sim":(n%10>=2&&n%10<=4&&(n%100<10||n%100>=20)?n+" Simy":n+" Simów");}
let toastT=0;function toast(m){let t=$(".toast");if(!t){t=document.createElement("div");t.className="toast";t.setAttribute("role","status");document.body.append(t);}t.textContent=m;t.hidden=false;clearTimeout(toastT);toastT=setTimeout(()=>t.hidden=true,2600);}

/* ================= STAN WIDOKU ================= */
let view="home",curFam=null,sel=0,rotation=0,treeFam="all";
const app=$("#app");
function go(v){view=v;render();window.scrollTo(0,0);}

function render(){
  document.querySelectorAll("nav.tabs button").forEach(b=>b.setAttribute("aria-current",(b.dataset.v===(view==="family"?"home":view))?"page":"false"));
  ({home:renderHome,family:renderFamily,tree:renderTree,cemetery:renderCemetery,notes:renderNotes})[view]();
}
