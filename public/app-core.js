"use strict";
const BUILD="13 (31.10.2026)";

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
function save(){clearTimeout(saveT);saveT=setTimeout(()=>{if(!db)return;try{const t=db.transaction("kv","readwrite");t.objectStore("kv").put(S,"state");t.onerror=()=>toast("Nie udało się zapisać danych w przeglądarce. Zrób kopię w Notatniku.");}catch(e){toast("Nie udało się zapisać danych w przeglądarce.");}},250);}

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
