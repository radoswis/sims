"use strict";
const BUILD="24 (23.11.2026)";

/* ================= DANE ================= */
const AGES=["Niemowlę","Dziecko","Nastolatek","Młody dorosły","Dorosły","Senior"];
const ASP=["Rodzina","Pieniądze","Wiedza","Romans","Popularność","Przyjemność","Ser grillowany","Brak"];
const COLORS=["#3b6fd1","#d9577a","#e08a2b","#3f9f4b","#d4562b","#7553d1","#2fa395","#b450c9","#4b5d7a","#a3772c"];
const ST={todo:["Do zrobienia","st-todo"],prog:["W trakcie","st-prog"],done:["Zrobiona","st-done"]};
const DEF_TASKS=["Kontrola budżetu","Randki","Narodziny","Studia"];
const uid=()=>Math.random().toString(36).slice(2,9);
const esc=s=>String(s??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));

const isBirthTask=t=>/narodzin|urodzen|ciąża|ciaza|poród|porod/i.test(t&&t.t||"");
const isCollegeTask=t=>/studia|studiów|studiow|studenc/i.test(t&&t.t||"");

function getFamilyBirthDays(f,round){
  const r=round||(S?S.round:1),days=new Set();
  if(f&&f.births&&Array.isArray(f.births[r]))f.births[r].forEach(d=>days.add(+d));
  if(f&&+r===+(S?S.round:1)&&Array.isArray(f.tasks))f.tasks.forEach(t=>{if(isBirthTask(t)&&t.done)days.add(+(t.day||f.day||1));});
  return[...days].sort((a,b)=>a-b);
}

function getFamilyCollegeDays(f,round){
  const r=round||(S?S.round:1),days=new Set();
  if(f&&f.colleges&&Array.isArray(f.colleges[r]))f.colleges[r].forEach(d=>days.add(+d));
  if(f&&f.college&&f.college.active&&+f.college.startRound===+r)days.add(+f.college.startDay||1);
  return[...days].sort((a,b)=>a-b);
}

function getFamilyCollege(f){
  if(!f||!f.college||!f.college.active)return null;
  const c=f.college;
  const startDay=+(c.startDay||1);
  const startRound=+(c.startRound||(S?S.round:1));
  let days=+(c.days||(f.day>startDay||(S&&S.round>startRound)?2:1));
  if(days<1)days=1;if(days>2)days=2;
  return{active:true,startDay,startRound,days,years:days*2,done:days>=2};
}

function newFamily(name,i){return{id:uid(),name,color:COLORS[i%COLORS.length],status:"todo",day:1,tasks:DEF_TASKS.map(t=>({id:uid(),t,done:false})),bud0:"",bud:"",notes:{},births:{},colleges:{},college:null};}
// Dodaje/usuwa dzień w historii zdarzeń rodziny (births / colleges) dla danej rundy.
function markDay(f,key,round,day,on){f[key]=f[key]||{};const a=f[key][round]=f[key][round]||[];const i=a.indexOf(day);
  if(on&&i<0){a.push(day);a.sort((x,y)=>x-y);}if(!on&&i>=0)a.splice(i,1);if(!a.length)delete f[key][round];}
// Start studiów w bieżącej rundzie. Trwające studia z wcześniejszej rundy są odkładane (collegePrev),
// żeby cofnięcie startu (odznaczenie) przywróciło je zamiast skasować.
function startCollege(f,round,day){
  if(f.college&&f.college.active&&+f.college.startRound<+round)f.collegePrev=f.college;
  f.college={active:true,startRound:round,startDay:day,days:1};}
function undoCollegeStart(f){f.college=f.collegePrev||null;f.collegePrev=null;}
function newSim(o){return Object.assign({id:uid(),first:"",last:"",fam:"",age:"Dorosły",asp:"Rodzina",photo:"",gender:"",parents:["",""],spouse:"",romances:[],ex:[],ptype:"",bio:"",dead:false,cause:"",grave:"",diedRound:""},o);}
const MAX_FAM=24,MIN_SLOTS=6;
function empty(){return{v:1,hood:"Miłowo",round:1,families:[],sims:[],rules:"",lots:[]};}

/* ================= CZYSZCZENIE DANYCH =================
   Dane przychodzą z serwera, z pliku kopii i z importu — przed użyciem wymuszamy typy i formaty,
   żeby nic z danych nie trafiło do HTML jako kod (zdjęcia, kolory, identyfikatory, liczby). */
const PHOTO_RE=/^data:image\/(jpeg|png|webp|gif);base64,[A-Za-z0-9+/=]+$/,COLOR_RE=/^#[0-9a-fA-F]{6}$/;
const cid=x=>String(x??"").replace(/[^A-Za-z0-9_-]/g,"").slice(0,64);
const cstr=x=>x==null?"":typeof x==="string"?x:typeof x==="number"||typeof x==="boolean"?String(x):"";
const cint=(x,lo,hi,d)=>{const n=Math.round(+x);return Number.isFinite(n)?Math.min(hi,Math.max(lo,n)):d;};
const isObj=x=>!!x&&typeof x==="object"&&!Array.isArray(x);
function cDays(o){const r={};if(isObj(o))Object.keys(o).forEach(k=>{const rk=cint(k,1,1e6,0);if(!rk||!Array.isArray(o[k]))return;
  const a=[...new Set(o[k].map(d=>cint(d,1,4,0)).filter(Boolean))].sort((x,y)=>x-y);if(a.length)r[rk]=a;});return r;}
function sanitizeS(x){
  if(!isObj(x))x={};
  const o={v:1,hood:typeof x.hood==="string"?x.hood:"Miłowo",round:cint(x.round,1,1e6,1),rules:cstr(x.rules),lots:Array.isArray(x.lots)?x.lots:[],
    families:[],sims:[]};
  const fids=new Set();
  (Array.isArray(x.families)?x.families:[]).filter(isObj).forEach((f,i)=>{let id=cid(f.id)||uid();while(fids.has(id))id=uid();fids.add(id);
    const tasks=(Array.isArray(f.tasks)?f.tasks:DEF_TASKS.map(t=>({t}))).filter(isObj).map(t=>{const n={id:cid(t.id)||uid(),t:cstr(t.t),done:t.done===true};if(t.day!=null&&t.day!=="")n.day=cint(t.day,1,4,1);return n;});
    const notes={};if(isObj(f.notes))Object.keys(f.notes).forEach(k=>{if(/^\d+-[1-4]$/.test(k))notes[k]=cstr(f.notes[k]);});
    const cCol=c=>isObj(c)&&c.active?{active:true,startRound:cint(c.startRound,1,1e6,o.round),startDay:cint(c.startDay,1,4,1),days:cint(c.days,1,2,1)}:null;
    const c=cCol(f.college),cp=c?cCol(f.collegePrev):null;
    o.families.push({id,name:cstr(f.name)||"Rodzina",color:COLOR_RE.test(f.color)?f.color:COLORS[i%COLORS.length],status:ST[f.status]&&Object.hasOwn(ST,f.status)?f.status:"todo",
      day:cint(f.day,1,4,1),tasks,bud0:cstr(f.bud0),bud:cstr(f.bud),notes,births:cDays(f.births),colleges:cDays(f.colleges),college:c,collegePrev:cp});});
  const sids=new Set();
  (Array.isArray(x.sims)?x.sims:[]).filter(isObj).forEach(s=>{let id=cid(s.id)||uid();while(sids.has(id))id=uid();sids.add(id);
    const dead=isDeadSim(s),par=Array.isArray(s.parents)?s.parents:[];
    o.sims.push({id,first:cstr(s.first),last:cstr(s.last),fam:cid(s.fam),age:AGES.includes(s.age)?s.age:"Dorosły",asp:cstr(s.asp),
      photo:PHOTO_RE.test(s.photo||"")?s.photo:"",gender:s.gender==="K"||s.gender==="M"?s.gender:"",parents:[cid(par[0]),cid(par[1])],
      spouse:cid(s.spouse),romances:[],ex:[...new Set((Array.isArray(s.ex)?s.ex:[]).map(cid).filter(Boolean))],ptype:s.ptype==="a"?"a":"",bio:cstr(s.bio),
      dead,cause:dead?cstr(s.cause):"",grave:dead?cstr(s.grave):"",diedRound:dead&&s.diedRound!==""&&s.diedRound!=null?String(cint(s.diedRound,1,1e6,1)):""});});
  // Odwołania do nieistniejących rodzin/Simów są czyszczone.
  o.sims.forEach(s=>{if(s.fam&&!fids.has(s.fam))s.fam="";s.parents=s.parents.map(p=>p&&sids.has(p)&&p!==s.id?p:"");
    if(!sids.has(s.spouse)||s.spouse===s.id)s.spouse="";s.ex=s.ex.filter(e=>sids.has(e)&&e!==s.id);});
  // Ustawienia dodatkowe (inne pola) z nowszych wersji nie są gubione.
  Object.keys(x).forEach(k=>{if(!(k in o)&&k!=="sample")o[k]=x[k];});
  return o;}

/* ================= ZAPIS (IndexedDB) ================= */
let S=null,db=null,saveT=0;
function openDB(){return new Promise(res=>{try{const r=indexedDB.open("sims-rotacja",1);r.onupgradeneeded=()=>r.result.createObjectStore("kv");r.onsuccess=()=>res(r.result);r.onerror=()=>res(null);}catch(e){res(null);}});}
function load(){return new Promise(res=>{if(!db)return res(null);try{const q=db.transaction("kv").objectStore("kv").get("state");q.onsuccess=()=>res(q.result||null);q.onerror=()=>res(null);}catch(e){res(null);}});}
function idbPut(k,v){return new Promise(res=>{if(!db)return res(false);try{const t=db.transaction("kv","readwrite");t.objectStore("kv").put(v,k);t.oncomplete=()=>res(true);t.onerror=()=>res(false);}catch(e){res(false);}});}
function idbGet(k){return new Promise(res=>{if(!db)return res(null);try{const q=db.transaction("kv").objectStore("kv").get(k);q.onsuccess=()=>res(q.result||null);q.onerror=()=>res(null);}catch(e){res(null);}});}
// save(ms) — ms: opóźnienie wysyłki na serwer (dłuższe przy pisaniu tekstu, żeby nie wysyłać całego stanu co chwilę).
function save(ms){clearTimeout(saveT);saveT=setTimeout(async()=>{if(!(await idbPut("state",S)))toast("Nie udało się zapisać danych w przeglądarce.");SY.dirty=true;SY.gen++;idbPut("sync",{rev:SY.rev,dirty:true});schedulePush(ms);},250);}

/* ================= SERWER (synchronizacja) ================= */
// Dane trzymane na serwerze (Cloudflare D1). Telefon ma kopię roboczą — działa bez internetu i wysyła zmiany, gdy sieć wróci.
const SY={rev:0,dirty:false,gen:0,busy:false,last:""};let pushT=0;
const MAX_BACKUPS=8;
function schedulePush(ms){clearTimeout(pushT);pushT=setTimeout(push,ms??1500);}
function hasData(x){return !!x&&((x.families||[]).length>0||(x.sims||[]).length>0);}
// Kopie lokalne: przed każdym nadpisaniem danych na telefonie (serwer, import, czyszczenie) — do przywrócenia w Notatniku.
async function addBackup(state,why){if(!hasData(state))return;const l=(await idbGet("backups"))||[];
  l.unshift({at:new Date().toISOString(),why,round:state.round,n:(state.families||[]).length,state:JSON.parse(JSON.stringify(state))});
  await idbPut("backups",l.slice(0,MAX_BACKUPS));}
// Kopia tylko gdy telefon ma coś, czego nie ma na serwerze (niewysłane zmiany albo pierwsza synchronizacja) —
// zwykłe wczytanie nowszych danych nie wypycha z listy ważnych kopii (np. „przed wyczyszczeniem”).
// Otwarte formularze zostają (zapis szuka rekordów po id); znikają tylko te, których rekord usunięto.
async function takeServer(r,msg){if(SY.dirty||SY.rev===0)await addBackup(S,"przed wczytaniem z serwera");S=r.state;migrateS();SY.rev=r.rev;SY.dirty=false;SY.last=JSON.stringify(S);
  await idbPut("state",S);await idbPut("sync",{rev:SY.rev,dirty:false});if(typeof closeStaleSheets==="function")closeStaleSheets();if(typeof render==="function")render();if(msg)toast(msg);}
// Serwer ma inną wersję niż telefon, a telefon ma własne niewysłane zmiany — decyduje użytkownik, nic nie znika po cichu.
let asking=false;
async function resolveConflict(d){
  if(asking||d.rev<=SY.rev)return; // ta wersja serwera została już rozstrzygnięta (np. dwa równoległe pull)
  const local=JSON.stringify(S);
  if(JSON.stringify(d.state)===local){SY.rev=d.rev;SY.dirty=false;SY.last=local;await idbPut("sync",{rev:SY.rev,dirty:false});return;}
  asking=true;
  try{
    const takeSrv=confirm("Na serwerze są inne, nowsze dane (np. z innego urządzenia), a ten telefon ma niewysłane zmiany.\n\nOK — wczytaj dane z serwera (zmiany z telefonu zostaną zachowane jako kopia w Notatniku).\nAnuluj — wyślij dane z tego telefonu na serwer (wersja z serwera zostanie zachowana jako kopia).");
    if(takeSrv){await takeServer(d,"Wczytano dane z serwera. Zmiany z telefonu są w kopiach w Notatniku.");return;}
    await addBackup(d.state,"wersja z serwera przed nadpisaniem");
    SY.last="";SY.rev=d.rev;SY.dirty=true;SY.gen++;await idbPut("sync",{rev:SY.rev,dirty:true});
  }finally{asking=false;} // do końca rozstrzygania kolejne pull/push nie pytają drugi raz
  push();}
async function push(opts){
  if(SY.busy){schedulePush(800);return;}if(!SY.dirty||!navigator.onLine)return;
  const cur=JSON.stringify(S);
  if(cur===SY.last){SY.dirty=false;idbPut("sync",{rev:SY.rev,dirty:false});return;} // nic się nie zmieniło od ostatniej wysyłki
  const body=JSON.stringify({state:S,baseRev:SY.rev});
  SY.busy=true;const gen=SY.gen;let conflict=null;
  try{const bg=opts&&opts.bg;
    // Przy chowaniu aplikacji: keepalive (działa tylko do ~64 KB, większe dane wyślą się po powrocie).
    const r=await fetch("/api/state",{method:"PUT",headers:{"content-type":"application/json"},body,keepalive:!!bg&&new Blob([body]).size<60000});
    const d=await r.json().catch(()=>({}));
    if(r.ok){SY.rev=d.rev;SY.last=cur;if(SY.gen===gen)SY.dirty=false;await idbPut("sync",{rev:SY.rev,dirty:SY.dirty});}
    else if(r.status===409&&d.state)conflict=d;
    else schedulePush(15000);
  }catch(e){schedulePush(15000);}finally{SY.busy=false;}
  // Konflikt rozstrzygamy tylko przy widocznej aplikacji; w tle zmiany czekają (dirty) do następnego pull().
  if(conflict){if(document.visibilityState==="visible")await resolveConflict(conflict);return;}
  if(SY.dirty&&SY.gen!==gen)schedulePush(500);
}
async function pull(){
  if(!navigator.onLine||SY.busy||asking)return;
  try{const r=await fetch("/api/state",{cache:"no-store"});if(!r.ok)return;const d=await r.json();
    if(!d.state){if(hasData(S)){SY.dirty=true;SY.gen++;push();}return;}
    if(d.rev>SY.rev){
      // Telefon ma niewysłane zmiany albo to pierwsza synchronizacja z własnymi danymi — zapytaj.
      // (także pusty stan po „Wyczyść wszystko” jest niewysłaną zmianą i nie może zostać po cichu cofnięty).
      if(SY.dirty||(SY.rev===0&&hasData(S)))return resolveConflict(d);
      await takeServer(d,SY.rev?"Wczytano aktualne dane z serwera.":"");return;}
    if(SY.dirty)push();
  }catch(e){}
}
addEventListener("online",()=>{pull();});
document.addEventListener("visibilitychange",()=>{if(document.visibilityState==="visible")pull();else if(SY.dirty){clearTimeout(pushT);push({bg:true});}});

/* ================= POMOCNICZE ================= */
const $=s=>document.querySelector(s);
const fam=id=>S.families.find(f=>f.id===id);
const sim=id=>S.sims.find(s=>s.id===id);
// Jednoznaczne rozpoznawanie zmarłych, także w starszych rekordach bez pola dead.
const isDeadSim=s=>{if(!s)return false;const v=s.dead;if(v===true||v===1||v==="1"||v==="true"||v==="yes"||v==="dead")return true;return !!(String(s.cause||"").trim()||String(s.grave||"").trim());};
const full=s=>s?(s.first+" "+s.last).trim()||"Bez imienia":"";
const ini=n=>String(n||"?").split(/\s+/).filter(Boolean).map(w=>w[0]).join("").slice(0,2).toUpperCase()||"?";
// Do atrybutu style trafiają tylko sprawdzone formaty (zdjęcie data:image, kolor #rrggbb).
const safePhoto=p=>PHOTO_RE.test(p||"")?p:"",safeColor=c=>COLOR_RE.test(c||"")?c:"#8a96b0";
function avStyle(photo,color){return safePhoto(photo)?`--c:url('${photo}')`:`--c:${safeColor(color)}`;}
function simColor(s){const f=fam(s.fam);return f?safeColor(f.color):"#8a96b0";}
function avatar(s,cls){return `<span class="av ${cls||""}" style="${avStyle(s.photo,simColor(s))}">${s.photo?"":esc(ini(s.first+" "+s.last))}</span>`;}
function famFace(f){const m=S.sims.find(s=>s.fam===f.id&&safePhoto(s.photo)&&!isDeadSim(s));const c=safeColor(f.color);return m?{style:`--c:url('${m.photo}')`,txt:""}:{style:`--c:linear-gradient(135deg,${c}cc,${c})`,txt:esc(ini(f.name))};}
function simsLabel(n){return n===1?"1 Sim":(n%10>=2&&n%10<=4&&(n%100<10||n%100>=20)?n+" Simy":n+" Simów");}
let toastT=0;function toast(m){let t=$(".toast");if(!t){t=document.createElement("div");t.className="toast";t.setAttribute("role","status");document.body.append(t);}t.textContent=m;t.hidden=false;clearTimeout(toastT);toastT=setTimeout(()=>t.hidden=true,2600);}

/* ================= STAN WIDOKU ================= */
let view="home",curFam=null,sel=0,rotation=0,treeFam="all";
const app=$("#app");
function go(v){view=v;render();window.scrollTo(0,0);}
function render(){
  document.querySelectorAll("nav.tabs button").forEach(b=>b.setAttribute("aria-current",(b.dataset.v===(view==="family"?"home":view))?"page":"false"));
  ({home:renderHome,family:renderFamily,compare:renderCompare,tree:renderTree,cemetery:renderCemetery,notes:renderNotes})[view]();
}
