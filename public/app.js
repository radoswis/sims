(function(){
"use strict";
/* ================= DANE ================= */
const AGES=["Niemowlę","Dziecko","Nastolatek","Młody dorosły","Dorosły","Senior"];
const ASP=["Rodzina","Pieniądze","Wiedza","Romans","Popularność","Przyjemność","Ser grillowany","Brak"];
const COLORS=["#3b6fd1","#d9577a","#e08a2b","#3f9f4b","#d4562b","#7553d1","#2fa395","#b450c9","#4b5d7a","#a3772c"];
const ST={todo:["Do zrobienia","st-todo"],prog:["W trakcie","st-prog"],done:["Zrobiona","st-done"]};
const DEF_TASKS=["Kontrola budżetu","Randki","Ciąża","Nastolatki na studia"];
const uid=()=>Math.random().toString(36).slice(2,9);
const esc=s=>String(s??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));

function newFamily(name,i){return{id:uid(),name,color:COLORS[i%COLORS.length],status:"todo",day:1,tasks:DEF_TASKS.map(t=>({id:uid(),t,done:false})),bud0:"",bud:"",notes:{}};}
function newSim(o){return Object.assign({id:uid(),first:"",last:"",fam:"",age:"Dorosły",asp:"Rodzina",photo:"",gender:"",parents:["",""],spouse:"",romances:[],dead:false,cause:"",grave:"",diedRound:""},o);}
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

/* ================= EKRAN: KARUZELA ================= */
function slotCount(){const n=S.families.length;return Math.min(MAX_FAM,Math.max(MIN_SLOTS,n+1));}
function renderHome(){
  const fs=S.families,n=fs.length,done=fs.filter(f=>f.status==="done").length,N=slotCount(),step=360/N;
  if(sel>=n)sel=0;
  app.innerHTML=`<div class="wrap" style="flex:1">
  <div class="panel" style="gap:8px">
    <div class="top"><div><div class="muted small">Otoczenie ${esc(S.hood)}</div><h1>Runda ${S.round}</h1></div>
    <button class="btn ${done===n&&n?"primary":""}" data-act="endRound" ${done===n&&n?"":"disabled"}>Zakończ rundę</button></div>
    <div class="prog" role="progressbar" aria-valuemin="0" aria-valuemax="${n}" aria-valuenow="${done}" aria-label="Postęp rundy"><i style="width:${n?done/n*100:0}%"></i></div>
    <div class="row between small"><span class="muted">${done} z ${n} domów zrobione</span><span class="muted">${n} / ${MAX_FAM} rodzin</span></div>
  </div>
  <div class="stageWrap"><div class="stage noanim" id="stage"><div class="wheel" id="wheel"></div><div class="pin" aria-hidden="true"></div>
    <div class="center" aria-live="polite" id="center"></div></div></div>
  </div>`;
  let html="";
  for(let i=0;i<N;i++){
    const f=fs[i];
    if(f){const fc=famFace(f);const st=f.status==="prog"?"#e0a640":f.status==="done"?"rgba(44,133,71,.55)":"transparent";
      html+=`<div class="slot" style="--a:${i*step}deg"><div class="counter"><button class="ball ${f.status==="done"?"done":""}" style="--st:${st}" data-act="pick" data-i="${i}" aria-pressed="${i===sel}" aria-label="Rodzina ${esc(f.name)}, ${ST[f.status][0]}">
      ${f.status==="done"?`<span class="tick" aria-hidden="true">✓</span>`:""}<span class="face" style="${fc.style}">${fc.txt}</span><span class="bname">${esc(f.name)}</span></button></div></div>`;}
    else html+=`<div class="slot" style="--a:${i*step}deg"><div class="counter"><button class="ball empty" data-act="addFamily" aria-label="Dodaj rodzinę"><span class="plus" aria-hidden="true">+</span></button></div></div>`;
  }
  $("#wheel").innerHTML=html;
  sizeStage();
  rotation=n?-sel*step+Math.round((rotation+sel*step)/360)*360:0;
  $("#stage").style.setProperty("--rot",rotation+"deg");
  requestAnimationFrame(()=>requestAnimationFrame(()=>{const s=$("#stage");s&&s.classList.remove("noanim");}));
  fillCenter();
}
function sizeStage(){
  const st=$("#stage");if(!st)return;const n=slotCount();
  const availH=innerHeight-200, availW=Math.min(innerWidth-32,760);
  const box=Math.max(240,Math.min(availW,availH,680));
  let ball=Math.min(box*0.22,130);
  let r=(box-ball)/2;
  const maxBall=2*Math.PI*r/n*0.9; if(ball>maxBall){ball=Math.max(30,maxBall);r=(box-ball)/2;}
  st.style.setProperty("--r",r+"px");st.style.setProperty("--ball",ball+"px");
  st.classList.toggle("tiny",ball<62);
}
function fillCenter(){
  const f=S.families[sel];if(!f){$("#center").innerHTML=`<h2>Witaj w otoczeniu</h2><span class="muted small">Dotknij kuli z plusem, by dodać pierwszą rodzinę. Zmieścisz ich ${MAX_FAM}.</span><button class="btn primary" data-act="addFamily">+ Dodaj rodzinę</button>`;return;}const cnt=S.sims.filter(s=>s.fam===f.id&&!s.dead).length;
  $("#center").innerHTML=`<span class="pill ${ST[f.status][1]}">${ST[f.status][0]}</span><h2>${esc(f.name)}</h2>
  <span class="muted small">${simsLabel(cnt)} · dzień ${f.day} z 4</span>
  <button class="btn primary" data-act="play">${f.status==="done"?"Otwórz kartę":"Graj tą rodziną"}</button>`;
}
function pick(i){
  const step=360/slotCount();
  const cur=i*step+rotation; let d=((0-cur)%360+540)%360-180; if(d===-180)d=180; // najkrótsza droga
  rotation+=d;sel=i;
  $("#stage").style.setProperty("--rot",rotation+"deg");
  document.querySelectorAll(".ball").forEach((b,k)=>b.setAttribute("aria-pressed",k===i));
  fillCenter();
}

/* ================= EKRAN: KARTA RODZINY ================= */
function renderFamily(){
  const f=fam(curFam);if(!f)return go("home");
  const key=S.round+"-"+f.day;
  const prev=[1,2,3,4].filter(d=>d!==f.day&&(f.notes[S.round+"-"+d]||"").trim());
  const members=S.sims.filter(s=>s.fam===f.id&&!s.dead);
  const diff=(parseFloat(f.bud)||0)-(parseFloat(f.bud0)||0);
  app.innerHTML=`<div class="wrap">
  <div class="row between"><button class="btn" data-act="go" data-v="home">← Rodziny</button><button class="btn" data-act="editFamily">Edytuj</button></div>
  <div class="panel">
    <div class="row between"><div><div class="muted small">Runda ${S.round}</div><h1>${esc(f.name)}</h1></div><span class="pill ${ST[f.status][1]}">${ST[f.status][0]}</span></div>
    <div class="seg" role="group" aria-label="Status">${Object.keys(ST).map(k=>`<button data-act="setStatus" data-v="${k}" aria-pressed="${f.status===k}">${ST[k][0]}</button>`).join("")}</div>
    <div><div class="muted small" style="margin-bottom:6px">Dzień tury</div>
    <div class="seg" role="group" aria-label="Dzień tury">${[1,2,3,4].map(d=>`<button data-act="setDay" data-v="${d}" aria-pressed="${f.day===d}">Dzień ${d}</button>`).join("")}</div></div>
  </div>
  <div class="panel">
    <h2>Notatki z dnia ${f.day}</h2>
    <textarea id="note" rows="4" placeholder="Wydarzenia, urodziny, awanse…" data-bind="note">${esc(f.notes[key]||"")}</textarea>
    ${prev.length?`<div class="list">${prev.map(d=>`<div class="item small"><b style="white-space:nowrap">Dzień ${d}</b><span class="grow">${esc(f.notes[S.round+"-"+d])}</span></div>`).join("")}</div>`:""}
  </div>
  <div class="panel">
    <h2>Zadania w tej turze</h2>
    <div class="list">${f.tasks.map(t=>`<div class="item" style="padding:2px 4px 2px 12px"><label class="check ${t.done?"done":""}"><input type="checkbox" data-act="toggleTask" data-id="${t.id}" ${t.done?"checked":""}><span>${esc(t.t)}</span></label><button class="x" data-act="delTask" data-id="${t.id}" aria-label="Usuń zadanie ${esc(t.t)}">×</button></div>`).join("")}</div>
    <form class="row" data-form="task"><input type="text" id="newTask" placeholder="Nowe zadanie, np. awans Jana" style="flex:1;min-width:0"><button class="btn">Dodaj</button></form>
  </div>
  <div class="panel">
    <h2>Budżet</h2>
    <div class="row"><label class="f">Na start tury (§)<input type="number" inputmode="numeric" id="bud0" data-bind="bud0" value="${esc(f.bud0)}"></label>
    <label class="f">Teraz (§)<input type="number" inputmode="numeric" id="bud" data-bind="bud" value="${esc(f.bud)}"></label></div>
    <div class="small" id="diff" style="font-weight:800;color:${diff<0?"var(--danger)":"var(--ok)"}">${f.bud0!==""&&f.bud!==""?(diff>=0?"+ ":"− ")+"§ "+Math.abs(diff).toLocaleString("pl-PL")+" w tej turze":""}</div>
  </div>
  <div class="panel">
    <div class="row between"><h2>Domownicy</h2><button class="btn ghost" data-act="newSim" data-fam="${f.id}">+ Sim</button></div>
    <div class="row">${members.length?members.map(s=>`<button class="chip" data-act="openSim" data-id="${s.id}">${avatar(s)}${esc(s.first||"Bez imienia")}</button>`).join(""):`<span class="muted small">Brak Simów. Dodaj domowników, by budować drzewo.</span>`}</div>
  </div>
  <button class="btn primary" data-act="finishFamily" style="min-height:52px">Zakończ turę rodziny</button>
  </div>`;
}

/* ================= EKRAN: DRZEWO ================= */
const TW=104,TH=150,AV=56;
let centerNext=false,treeSel=null,tz=1,tx=0,ty=0,treeFit=true,dragged=false,T=null;
function treeData(){
  const all=S.sims,inF=s=>s.fam===treeFam;
  const list=treeFam==="all"?all.slice():all.filter(s=>inF(s)||all.some(o=>inF(o)&&(o.spouse===s.id||o.parents.includes(s.id)||s.parents.includes(o.id))));
  const ids=new Set(list.map(s=>s.id)),par=s=>s.parents.filter(p=>p&&ids.has(p));
  const partners={},addP=(a,b)=>{if(!a||!b||a===b)return;(partners[a]=partners[a]||new Set()).add(b);(partners[b]=partners[b]||new Set()).add(a);};
  list.forEach(s=>{if(s.spouse&&ids.has(s.spouse))addP(s.id,s.spouse);const p=par(s);if(p.length===2)addP(p[0],p[1]);});
  const gen={};list.forEach(s=>gen[s.id]=0);
  for(let it=0;it<list.length*3+3;it++){let ch=false;
    list.forEach(s=>{const p=par(s);if(p.length){const g=Math.max(...p.map(x=>gen[x]))+1;if(g>gen[s.id]&&g<40){gen[s.id]=g;ch=true;}}
      (partners[s.id]||[]).forEach(o=>{if(gen[o]<gen[s.id]){gen[o]=gen[s.id];ch=true;}});});
    if(!ch)break;}
  const pos={},G=list.length?Math.max(...Object.values(gen)):0;
  for(let k=0;k<=G;k++){
    const row=list.filter(s=>gen[s.id]===k),used=new Set(),units=[];
    const key=s=>{const p=par(s).filter(x=>pos[x]);return p.length?p.reduce((m,x)=>m+pos[x].x,0)/p.length:null;};
    row.forEach(s=>{if(used.has(s.id))return;used.add(s.id);let u=[s];
      const cand=[...(partners[s.id]||[])].map(sim).filter(o=>o&&gen[o.id]===k&&!used.has(o.id));
      const pt=cand.find(o=>o.id===s.spouse)||cand[0];if(pt){used.add(pt.id);u.push(pt);}
      const ks=u.map(key);if(ks[0]==null&&ks[1]!=null)u=[u[1],u[0]];
      units.push({m:u,k:key(u[0]),f:(fam(s.fam)||{name:"~"}).name});});
    units.sort((a,b)=>(a.k??1e9)-(b.k??1e9)||a.f.localeCompare(b.f));
    let cur=null,i=0;
    while(i<units.length){let j=i,w=0;const k0=units[i].k;
      while(j<units.length&&units[j].k===k0){w+=units[j].m.length*TW+(j>i?28:0);j++;}
      let L=k0!=null?k0-w/2:(cur??0);if(cur!=null&&L<cur)L=cur;
      let x=L;for(let q=i;q<j;q++){units[q].m.forEach(s=>{pos[s.id]={x:x+TW/2,y:k*TH};x+=TW;});x+=28;}
      cur=x;i=j;}
  }
  const xs=Object.values(pos).map(p=>p.x),minX=xs.length?Math.min(...xs):0;
  Object.values(pos).forEach(p=>{p.x+=-minX+TW/2+20;p.y+=24;});
  const W=(xs.length?Math.max(...xs)-minX:0)+TW+40,H=(G+1)*TH+40;
  return{list,pos,par,W,H};
}
function renderTree(){
  if(treeSel&&!sim(treeSel))treeSel=null;
  T=treeData();const {list,pos,par,W,H}=T,cy=id=>pos[id].y+8+AV/2;
  let lines="";const drawn=new Set();
  list.forEach(s=>{
    if(s.spouse&&pos[s.spouse]&&!drawn.has(s.spouse)){lines+=`<line x1="${pos[s.id].x}" y1="${cy(s.id)}" x2="${pos[s.spouse].x}" y2="${cy(s.spouse)}" stroke="#6f7c9c" stroke-width="3"/>`;}
    s.romances.forEach(r=>{if(pos[r]&&!drawn.has(r)){const a=pos[s.id],b=pos[r];lines+=`<path d="M${a.x} ${cy(s.id)} Q${(a.x+b.x)/2} ${Math.min(a.y,b.y)-10} ${b.x} ${cy(r)}" fill="none" stroke="#b4426a" stroke-width="2.5" stroke-dasharray="7 6"/>`;}});
    drawn.add(s.id);
    const p=par(s);if(p.length){const c=pos[s.id];let ax,ay;
      if(p.length===2){ax=(pos[p[0]].x+pos[p[1]].x)/2;ay=(cy(p[0])+cy(p[1]))/2;}else{ax=pos[p[0]].x;ay=cy(p[0])+AV/2+2;}
      const bus=c.y-18;lines+=`<path d="M${ax} ${ay} V${bus} H${c.x} V${c.y+8}" fill="none" stroke="#6f7c9c" stroke-width="2.5"/>`;}
  });
  const nodes=list.map(s=>{const p=pos[s.id];const ring=s.gender==="K"?"#f2a7c0":s.gender==="M"?"#8fb8f2":"#fff";
    return `<button class="node ${s.dead?"dead":""} ${treeSel===s.id?"sel":""}" style="left:${p.x-TW/2}px;top:${p.y}px;--ring:${ring}" data-act="treeSel" data-id="${s.id}" aria-label="${esc(full(s))}">${avatar(s)}<b>${esc(s.first||"?")}${s.dead?" †":""}</b><small>${esc(s.age)}</small></button>`;}).join("");
  const sel=treeSel&&sim(treeSel);
  app.innerHTML=`<div class="wrap">
  <div class="treeHead"><select id="treeFam" aria-label="Pokaż rodzinę"><option value="all">Całe otoczenie</option>${S.families.map(f=>`<option value="${f.id}" ${treeFam===f.id?"selected":""}>${esc(f.name)}</option>`).join("")}</select>
  <button class="btn blue" data-act="newSim" data-fam="${treeFam==="all"?"":treeFam}">+ Sim</button></div>
  ${list.length?`<div class="vp" id="vp"><div class="inner" id="inner" style="width:${W}px;height:${H}px"><svg width="${W}" height="${H}" aria-hidden="true">${lines}</svg>${nodes}</div>
    <div class="zoom"><button class="btn" data-act="zoom" data-v="1.25" aria-label="Przybliż">+</button><button class="btn" data-act="zoom" data-v="0.8" aria-label="Oddal">−</button><button class="btn" data-act="fit" aria-label="Pokaż całe drzewo" style="font-size:14px">⤢</button></div></div>
  ${sel?selBar(sel):`<div class="panel" style="padding:12px 16px"><span class="muted small">Dotknij osoby, by dodać jej rodziców, partnera, dzieci lub rodzeństwo. Przesuwaj palcem, przybliżaj dwoma palcami.</span>
    <div class="legend"><span>── małżeństwo i rodzice</span><span style="color:var(--rom)">- - romans</span><span>† zmarły</span></div></div>`}`
  :`<div class="panel" style="align-items:center;text-align:center"><h2>Drzewo jest puste</h2><p class="muted" style="margin:0">Dodaj pierwszego Sima. Potem dotknij go, by dopisać rodziców, partnera i dzieci.</p><button class="btn primary" data-act="newSim" data-fam="${treeFam==="all"?"":treeFam}">+ Dodaj pierwszego Sima</button></div>`}
  </div>`;
  if(!list.length)return;
  if(treeFit)fitTree();else if(treeSel&&pos[treeSel]&&centerNext){centerOn(treeSel);centerNext=false;}
  applyT();bindVp();
}
function selBar(s){
  const f=fam(s.fam),hasM=s.parents[0]&&sim(s.parents[0]),hasF=s.parents[1]&&sim(s.parents[1]);
  return `<div class="panel selbar" style="padding:12px 16px">
  <div class="row" style="flex-wrap:nowrap">${avatar(s)}<div style="flex:1;min-width:0"><b>${esc(full(s))}${s.dead?" †":""}</b><br><span class="muted small">${esc(s.age)}${f?" · "+esc(f.name):""}</span></div>
  <button class="btn" data-act="openSim" data-id="${s.id}">Edytuj</button><button class="x" data-act="treeSel" data-id="" aria-label="Zamknij">×</button></div>
  <div class="acts">${hasM?"":`<button class="btn" data-act="treeAdd" data-v="mother">+ Matka</button>`}${hasF?"":`<button class="btn" data-act="treeAdd" data-v="father">+ Ojciec</button>`}
  ${s.spouse&&sim(s.spouse)?"":`<button class="btn" data-act="treeAdd" data-v="partner">+ Partner</button>`}
  <button class="btn" data-act="treeAdd" data-v="son">+ Syn</button><button class="btn" data-act="treeAdd" data-v="daughter">+ Córka</button>
  <button class="btn" data-act="treeAdd" data-v="sibling">+ Rodzeństwo</button></div></div>`;
}
function applyT(){const i=$("#inner");if(i)i.style.transform=`translate(${tx}px,${ty}px) scale(${tz})`;}
function fitTree(){const vp=$("#vp");if(!vp||!T)return;const w=vp.clientWidth,h=vp.clientHeight;tz=Math.min(1.1,Math.max(.3,Math.min(w/T.W,h/T.H)));tx=(w-T.W*tz)/2;ty=Math.max(0,(h-T.H*tz)/2);treeFit=false;}
function centerOn(id){const vp=$("#vp"),p=T.pos[id];if(!vp||!p)return;tx=vp.clientWidth/2-p.x*tz;ty=vp.clientHeight/2-(p.y+50)*tz;}
function zoomAt(f,cx,cy){const nz=Math.min(2.5,Math.max(.3,tz*f));tx=cx-(cx-tx)*nz/tz;ty=cy-(cy-ty)*nz/tz;tz=nz;applyT();}
function bindVp(){
  const vp=$("#vp");const pts=new Map();let st=null;
  vp.addEventListener("pointerdown",e=>{pts.set(e.pointerId,{x:e.clientX,y:e.clientY});dragged=false;
    if(pts.size===1)st={x:e.clientX,y:e.clientY,tx,ty};
    if(pts.size===2){const [a,b]=[...pts.values()];st={pinch:Math.hypot(a.x-b.x,a.y-b.y),z:tz,tx,ty};}});
  const move=e=>{if(!pts.has(e.pointerId)||!document.body.contains(vp))return;pts.set(e.pointerId,{x:e.clientX,y:e.clientY});const r=vp.getBoundingClientRect();
    if(pts.size===1&&st&&!st.pinch){const dx=e.clientX-st.x,dy=e.clientY-st.y;if(Math.abs(dx)+Math.abs(dy)>6){dragged=true;vp.classList.add("drag");}if(dragged){tx=st.tx+dx;ty=st.ty+dy;applyT();}}
    else if(pts.size===2&&st&&st.pinch){dragged=true;const [a,b]=[...pts.values()];const d=Math.hypot(a.x-b.x,a.y-b.y),cx=(a.x+b.x)/2-r.left,cy=(a.y+b.y)/2-r.top;
      const nz=Math.min(2.5,Math.max(.3,st.z*d/st.pinch));const qx=(cx-st.tx)/st.z,qy=(cy-st.ty)/st.z;tz=nz;tx=cx-qx*nz;ty=cy-qy*nz;applyT();}};
  const up=e=>{pts.delete(e.pointerId);vp.classList.remove("drag");if(pts.size<2&&st&&st.pinch){const v=[...pts.values()][0];st=v?{x:v.x,y:v.y,tx,ty}:null;}if(!pts.size)st=null;};
  vp.addEventListener("pointermove",move);vp.addEventListener("pointerup",up);vp.addEventListener("pointercancel",up);vp.addEventListener("pointerleave",up);
  vp.addEventListener("wheel",e=>{e.preventDefault();const r=vp.getBoundingClientRect();zoomAt(e.deltaY<0?1.12:.89,e.clientX-r.left,e.clientY-r.top);},{passive:false});
}
const older=a=>AGES[Math.min(AGES.length-1,AGES.indexOf(a)+1)]||"Dorosły",younger=a=>AGES[Math.max(0,AGES.indexOf(a)-2)]||"Dziecko";
function treeAdd(rel){
  const s=sim(treeSel);if(!s)return;const base={fam:s.fam,last:s.last};let o;
  if(rel==="mother")o=newSim({...base,gender:"K",age:older(s.age),_rel:{type:"mother",of:s.id}});
  else if(rel==="father")o=newSim({...base,gender:"M",age:older(s.age),_rel:{type:"father",of:s.id}});
  else if(rel==="partner")o=newSim({fam:s.fam,last:"",gender:s.gender==="K"?"M":s.gender==="M"?"K":"",age:s.age,spouse:s.id});
  else if(rel==="sibling")o=newSim({...base,age:s.age,parents:s.parents.slice()});
  else{const sp=s.spouse||"";o=newSim({...base,gender:rel==="son"?"M":"K",age:younger(s.age),parents:s.gender==="M"?[sp,s.id]:[s.id,sp]});}
  simSheet(o);
}

/* ================= EKRAN: CMENTARZ ================= */
function renderCemetery(){
  const dead=S.sims.filter(s=>s.dead).sort((a,b)=>(+b.diedRound||0)-(+a.diedRound||0));
  app.innerHTML=`<div class="wrap"><div class="panel">
  <div class="row between"><div><h1>Cmentarz</h1><span class="muted small">${dead.length} ${dead.length===1?"zmarły Sim":"zmarłych Simów"}</span></div><button class="btn blue" data-act="newDead">+ Dodaj zmarłego</button></div>
  <div class="list">${dead.length?dead.map(s=>`<button class="item" data-act="openSim" data-id="${s.id}" style="border:0;text-align:left;cursor:pointer;width:100%">
    <span style="filter:grayscale(1)">${avatar(s)}</span><span class="grow"><b>${esc(full(s))} †</b><br><span class="muted small">${esc(s.cause||"Przyczyna nieznana")}${fam(s.fam)?" · "+esc(fam(s.fam).name):""}</span><br><span class="small">${esc(s.grave||"Brak informacji o grobie")}</span></span>
    <span class="muted small" style="white-space:nowrap">${s.diedRound?"Runda "+esc(s.diedRound):""}</span></button>`).join(""):`<p class="muted" style="margin:0">Nikt jeszcze nie zmarł. Gdy Sim umrze, zaznacz to w jego karcie albo dodaj go tutaj.</p>`}</div>
  </div></div>`;
}

/* ================= EKRAN: NOTATNIK ================= */
function renderNotes(){
  app.innerHTML=`<div class="wrap">
  <div class="panel"><h1>Notatnik</h1>
    <label class="f">Nazwa otoczenia<input type="text" id="hood" data-bind="hood" value="${esc(S.hood)}"></label>
    <label class="f">Zasady otoczenia<textarea id="rules" rows="6" data-bind="rules">${esc(S.rules)}</textarea></label>
  </div>
  <div class="panel"><h2>Wspólne parcele biznesowe</h2>
    <div class="list">${S.lots.map(l=>`<div class="item"><span class="grow"><b>${esc(l.name)}</b><br><span class="muted small">${esc(l.owner||"Bez właściciela")}${l.level?" · poziom "+esc(l.level):""}</span></span><button class="x" data-act="delLot" data-id="${l.id}" aria-label="Usuń parcelę ${esc(l.name)}">×</button></div>`).join("")||`<span class="muted small">Brak parcel.</span>`}</div>
    <form class="row" data-form="lot"><label class="f">Nazwa<input type="text" id="lotName" required></label><label class="f">Właściciel<input type="text" id="lotOwner"></label><label class="f" style="flex:0 1 90px">Poziom<input type="number" id="lotLvl" min="0" max="10"></label><button class="btn" style="align-self:flex-end">Dodaj</button></form>
  </div>
  <div class="panel"><h2>Kopia danych</h2>
    <p class="muted small" style="margin:0">Dane są tylko w tej przeglądarce. Zrób kopię przed czyszczeniem przeglądarki lub zmianą telefonu.</p>
    <div class="row"><button class="btn" data-act="export">Pobierz kopię</button><label class="btn" for="importFile" style="cursor:pointer">Wczytaj kopię</label><input type="file" id="importFile" accept="application/json,.json" hidden></div>
    <div class="row"><button class="btn danger" data-act="clearAll" data-confirm="0">Wyczyść wszystko</button></div>
  </div></div>`;
}

/* ================= ARKUSZE ================= */
function sheet(html){closeSheet();const bg=document.createElement("div");bg.className="sheetBg";bg.innerHTML=`<div class="sheet" role="dialog" aria-modal="true">${html}</div>`;
  bg.addEventListener("click",e=>{if(e.target===bg)closeSheet();});document.body.append(bg);const h=bg.querySelector(".sheet");h.tabIndex=-1;h.focus({preventScroll:true});return bg;}
function closeSheet(){document.querySelectorAll(".sheetBg").forEach(x=>x.remove());}

function familySheet(f){
  sheet(`<h2>${f?"Edytuj rodzinę":"Nowa rodzina"}</h2>
  <form data-form="family" data-id="${f?f.id:""}" style="display:flex;flex-direction:column;gap:12px">
  <label class="f">Nazwisko rodziny<input type="text" id="fName" required value="${esc(f?f.name:"")}" placeholder="np. Kowalscy"></label>
  <div class="f">Kolor<div class="row">${COLORS.map((c,i)=>`<label style="cursor:pointer"><input type="radio" name="fColor" value="${c}" ${(f?f.color:COLORS[S.families.length%COLORS.length])===c?"checked":""} style="position:absolute;opacity:0"><span class="av" style="--c:${c};width:36px;height:36px"></span></label>`).join("")}</div></div>
  <div class="row between"><button type="button" class="btn" data-act="closeSheet">Anuluj</button><button class="btn primary">Zapisz</button></div>
  ${f?`<button type="button" class="btn danger" data-act="delFamily" data-confirm="0">Usuń rodzinę</button>`:""}
  </form>`);
  document.querySelectorAll('input[name=fColor]').forEach(r=>{const mark=()=>document.querySelectorAll('input[name=fColor]').forEach(x=>x.nextElementSibling.style.outline=x.checked?"3px solid #16244a":"none");r.addEventListener("change",mark);mark();});
}

let editing=null;
function simSheet(s){
  editing=JSON.parse(JSON.stringify(s));
  const others=S.sims.filter(o=>o.id!==s.id);
  const opts=(v)=>`<option value="">— brak —</option>`+others.map(o=>`<option value="${o.id}" ${v===o.id?"selected":""}>${esc(full(o))}</option>`).join("");
  const isNew=!sim(s.id);
  sheet(`<form data-form="sim" style="display:flex;flex-direction:column;gap:12px">
  <div class="row"><label class="photo" for="simPhoto" id="photoBtn" style="${avStyle(s.photo,simColor(s))}" aria-label="Zmień zdjęcie">${s.photo?"":esc(ini(s.first+" "+s.last))}</label>
  <input type="file" id="simPhoto" accept="image/*" hidden>
  <div style="min-width:0;flex:1"><h2>${isNew?"Nowy Sim":esc(full(s))}</h2><span class="muted small">Dotknij koła, by dodać zdjęcie</span>${s.photo?`<br><button type="button" class="btn ghost" data-act="rmPhoto" style="min-height:36px;margin-top:6px">Usuń zdjęcie</button>`:""}</div></div>
  <div class="row"><label class="f">Imię<input type="text" id="sFirst" required value="${esc(s.first)}"></label><label class="f">Nazwisko<input type="text" id="sLast" value="${esc(s.last)}"></label></div>
  <div class="row"><label class="f">Rodzina<select id="sFam"><option value="">— bez rodziny —</option>${S.families.map(f=>`<option value="${f.id}" ${s.fam===f.id?"selected":""}>${esc(f.name)}</option>`).join("")}</select></label>
  <label class="f">Wiek<select id="sAge">${AGES.map(a=>`<option ${s.age===a?"selected":""}>${a}</option>`).join("")}</select></label></div>
  <div class="row"><label class="f">Płeć<select id="sGender"><option value="">—</option><option value="K" ${s.gender==="K"?"selected":""}>Kobieta</option><option value="M" ${s.gender==="M"?"selected":""}>Mężczyzna</option></select></label>
  <label class="f">Aspiracja<select id="sAsp">${ASP.map(a=>`<option ${s.asp===a?"selected":""}>${a}</option>`).join("")}</select></label></div>
  <h2 style="margin-top:4px">Relacje</h2>
  <div class="row"><label class="f">Matka / rodzic 1<select id="sP1">${opts(s.parents[0])}</select></label><label class="f">Ojciec / rodzic 2<select id="sP2">${opts(s.parents[1])}</select></label></div>
  <label class="f">Małżonek<select id="sSpouse">${opts(s.spouse)}</select></label>
  <div class="f">Romanse<div class="row" id="roms">${romChips()}</div>
  <select id="sRomAdd" aria-label="Dodaj romans"><option value="">+ dodaj romans</option>${others.map(o=>`<option value="${o.id}">${esc(full(o))}</option>`).join("")}</select></div>
  <label class="check" style="flex:none"><input type="checkbox" id="sDead" ${s.dead?"checked":""}><span>Sim nie żyje</span></label>
  <div id="deadBox" class="row" ${s.dead?"":"hidden"}><label class="f">Przyczyna<input type="text" id="sCause" value="${esc(s.cause)}" placeholder="np. starość, pożar"></label>
  <label class="f" style="flex:0 1 110px">W rundzie<input type="number" id="sRound" value="${esc(s.diedRound||(isNew?S.round:""))}"></label>
  <label class="f" style="flex-basis:100%">Grób / urna<input type="text" id="sGrave" value="${esc(s.grave)}" placeholder="np. grób na parceli Park"></label></div>
  <div class="row between"><button type="button" class="btn" data-act="closeSheet">Anuluj</button><button class="btn primary">Zapisz</button></div>
  ${isNew?"":`<button type="button" class="btn danger" data-act="delSim" data-confirm="0">Usuń Sima</button>`}
  </form>`);
  $("#sDead").addEventListener("change",e=>{$("#deadBox").hidden=!e.target.checked;});
  $("#sRomAdd").addEventListener("change",e=>{const v=e.target.value;if(v&&!editing.romances.includes(v))editing.romances.push(v);e.target.value="";$("#roms").innerHTML=romChips();});
  $("#simPhoto").addEventListener("change",e=>{const file=e.target.files[0];if(file)resizePhoto(file).then(d=>{editing.photo=d;const b=$("#photoBtn");b.style.setProperty("--c",`url('${d}')`);b.textContent="";}).catch(()=>toast("Nie udało się wczytać zdjęcia. Spróbuj pliku JPG lub PNG."));});
}
function romChips(){return editing.romances.map(id=>sim(id)).filter(Boolean).map(o=>`<button type="button" class="chip" data-act="rmRom" data-id="${o.id}" aria-label="Usuń romans z ${esc(full(o))}">${avatar(o)}${esc(o.first)} ×</button>`).join("")||`<span class="muted small">Brak</span>`;}
function resizePhoto(file){return new Promise((res,rej)=>{const r=new FileReader();r.onload=()=>{const img=new Image();img.onload=()=>{const c=document.createElement("canvas"),z=256;c.width=c.height=z;const m=Math.min(img.width,img.height);c.getContext("2d").drawImage(img,(img.width-m)/2,(img.height-m)/2,m,m,0,0,z,z);res(c.toDataURL("image/jpeg",.82));};img.onerror=rej;img.src=r.result;};r.onerror=rej;r.readAsDataURL(file);});}

function saveSim(){
  const e=editing;
  e.first=$("#sFirst").value.trim();e.last=$("#sLast").value.trim();e.fam=$("#sFam").value;e.age=$("#sAge").value;e.asp=$("#sAsp").value;e.gender=$("#sGender").value;const rel=e._rel;delete e._rel;
  e.parents=[$("#sP1").value,$("#sP2").value];e.dead=$("#sDead").checked;e.cause=$("#sCause").value.trim();e.grave=$("#sGrave").value.trim();e.diedRound=$("#sRound").value;
  const newSpouse=$("#sSpouse").value;
  const old=sim(e.id);
  // relacje dwustronne
  S.sims.forEach(o=>{if(o.id===e.id)return;
    if(o.spouse===e.id&&o.id!==newSpouse)o.spouse="";
    const had=o.romances.includes(e.id),want=e.romances.includes(o.id);
    if(want&&!had)o.romances.push(e.id); if(!want&&had)o.romances=o.romances.filter(x=>x!==e.id);});
  e.spouse=newSpouse;
  if(newSpouse){const sp=sim(newSpouse);if(sp.spouse&&sp.spouse!==e.id){const ex=sim(sp.spouse);if(ex)ex.spouse="";}sp.spouse=e.id;}
  if(old)Object.assign(old,e);else S.sims.push(e);
  if(rel){const t=sim(rel.of);if(t){if(rel.type==="mother")t.parents[0]=e.id;else t.parents[1]=e.id;}}
  if(view==="tree"&&!old){if(!treeSel)treeSel=e.id;centerNext=true;}
  save();closeSheet();render();toast("Zapisano: "+full(e));
}

/* ================= AKCJE ================= */
const A={
  go:el=>go(el.dataset.v),
  pick:el=>pick(+el.dataset.i),
  play:()=>{const f=S.families[sel];if(f.status==="todo"){f.status="prog";save();}curFam=f.id;go("family");},
  endRound:()=>{S.round++;S.families.forEach(f=>{f.status="todo";f.day=1;f.tasks.forEach(t=>t.done=false);f.bud0=f.bud;});save();sel=0;render();toast("Zaczyna się runda "+S.round);},
  addFamily:()=>{if(S.families.length>=MAX_FAM)return toast("Osiągnięto limit "+MAX_FAM+" rodzin.");familySheet(null);},
  editFamily:()=>familySheet(fam(curFam)),
  setStatus:el=>{fam(curFam).status=el.dataset.v;save();render();},
  setDay:el=>{const f=fam(curFam);f.day=+el.dataset.v;if(f.status==="todo")f.status="prog";save();render();},
  toggleTask:el=>{const t=fam(curFam).tasks.find(t=>t.id===el.dataset.id);t.done=el.checked;el.closest(".check").classList.toggle("done",t.done);save();},
  delTask:el=>{const f=fam(curFam);f.tasks=f.tasks.filter(t=>t.id!==el.dataset.id);save();render();},
  finishFamily:()=>{const f=fam(curFam);f.status="done";f.day=4;save();
    const n=S.families.length,i=S.families.indexOf(f);let next=i;for(let k=1;k<=n;k++){const j=(i+k)%n;if(S.families[j].status!=="done"){next=j;break;}}
    view="home";render();
    const left=S.families.filter(x=>x.status!=="done").length;
    if(next!==i)setTimeout(()=>pick(next),350);
    toast(left?`${f.name} gotowi. Następni: ${S.families[next].name}`:"Wszystkie domy zrobione. Możesz zakończyć rundę.");},
  newSim:el=>simSheet(newSim({fam:el.dataset.fam||"",last:el.dataset.fam?guessLast(fam(el.dataset.fam)):""})),
  newDead:()=>simSheet(newSim({dead:true})),
  openSim:el=>simSheet(sim(el.dataset.id)),
  rmRom:el=>{editing.romances=editing.romances.filter(x=>x!==el.dataset.id);$("#roms").innerHTML=romChips();},
  rmPhoto:()=>{editing.photo="";const b=$("#photoBtn");b.style.setProperty("--c",simColor(editing));b.textContent=ini(editing.first+" "+editing.last);},
  closeSheet:()=>closeSheet(),
  treeSel:el=>{if(dragged){dragged=false;return;}treeSel=el.dataset.id||null;render();},
  treeAdd:el=>treeAdd(el.dataset.v),
  zoom:el=>{const vp=$("#vp");zoomAt(+el.dataset.v,vp.clientWidth/2,vp.clientHeight/2);},
  fit:()=>{fitTree();applyT();},
  delSim:el=>confirmTap(el,"Na pewno usunąć?",()=>{const id=editing.id;S.sims=S.sims.filter(s=>s.id!==id);S.sims.forEach(o=>{if(o.spouse===id)o.spouse="";o.romances=o.romances.filter(x=>x!==id);o.parents=o.parents.map(p=>p===id?"":p);});save();closeSheet();render();toast("Usunięto Sima");}),
  delFamily:el=>confirmTap(el,"Na pewno? Simowie zostaną bez rodziny",()=>{const id=curFam;S.families=S.families.filter(f=>f.id!==id);S.sims.forEach(s=>{if(s.fam===id)s.fam="";});save();closeSheet();sel=0;go("home");toast("Usunięto rodzinę");}),
  delLot:el=>{S.lots=S.lots.filter(l=>l.id!==el.dataset.id);save();render();},
  export:()=>{try{const b=new Blob([JSON.stringify(S)],{type:"application/json"});const a=document.createElement("a");a.href=URL.createObjectURL(b);a.download="rotacja-"+(S.hood||"otoczenie")+"-runda"+S.round+".json";document.body.append(a);a.click();a.remove();toast("Kopia pobrana");}catch(e){toast("Nie udało się pobrać kopii.");}},
  clearAll:el=>confirmTap(el,"Na pewno? Tego nie da się cofnąć",()=>{S={v:1,hood:S.hood||"Miłowo",round:1,families:[],sims:[],rules:"",lots:[]};save();sel=0;go("home");toast("Wyczyszczono dane");})
};
function guessLast(f){const m=S.sims.find(s=>s.fam===f.id&&s.last);return m?m.last:"";}
function confirmTap(el,msg,fn){if(el.dataset.confirm==="1")return fn();el.dataset.confirm="1";const o=el.textContent;el.textContent=msg;setTimeout(()=>{if(el.isConnected){el.dataset.confirm="0";el.textContent=o;}},3500);}

document.addEventListener("click",e=>{const el=e.target.closest("[data-act]");if(!el)return;if(el.tagName==="INPUT"&&el.type==="checkbox"){A[el.dataset.act](el);return;}e.preventDefault();A[el.dataset.act]&&A[el.dataset.act](el);});
document.addEventListener("input",e=>{const b=e.target.dataset.bind;if(!b)return;const v=e.target.value;
  if(b==="note"){const f=fam(curFam);f.notes[S.round+"-"+f.day]=v;}
  else if(b==="bud0"||b==="bud"){const f=fam(curFam);f[b]=v;const d=(parseFloat(f.bud)||0)-(parseFloat(f.bud0)||0),el=$("#diff");el.style.color=d<0?"var(--danger)":"var(--ok)";el.textContent=f.bud0!==""&&f.bud!==""?(d>=0?"+ ":"− ")+"§ "+Math.abs(d).toLocaleString("pl-PL")+" w tej turze":"";}
  else if(b==="hood"||b==="rules")S[b]=v;
    save();});
document.addEventListener("change",e=>{if(e.target.id==="treeFam"){treeFam=e.target.value;treeFit=true;render();}
  if(e.target.id==="importFile"){const file=e.target.files[0];if(!file)return;const r=new FileReader();r.onload=()=>{try{const d=JSON.parse(r.result);if(!d||!Array.isArray(d.families)||!Array.isArray(d.sims))throw 0;S=d;S.lots=S.lots||[];save();sel=0;go("home");toast("Wczytano kopię: runda "+S.round);}catch(x){toast("To nie jest plik kopii z tej aplikacji.");}};r.readAsText(file);}});
document.addEventListener("submit",e=>{e.preventDefault();const t=e.target.dataset.form;
  if(t==="task"){const i=$("#newTask"),v=i.value.trim();if(!v)return;fam(curFam).tasks.push({id:uid(),t:v,done:false});save();render();$("#newTask").focus();}
  if(t==="lot"){const n=$("#lotName").value.trim();if(!n)return;S.lots.push({id:uid(),name:n,owner:$("#lotOwner").value.trim(),level:$("#lotLvl").value});save();render();}
  if(t==="family"){const name=$("#fName").value.trim();if(!name)return;const color=(document.querySelector('input[name=fColor]:checked')||{}).value||COLORS[0];const id=e.target.dataset.id;
    if(id){const f=fam(id);f.name=name;f.color=color;}else{if(S.families.length>=MAX_FAM){closeSheet();return toast("Osiągnięto limit "+MAX_FAM+" rodzin.");}const f=newFamily(name,S.families.length);f.color=color;S.families.push(f);sel=S.families.length-1;}
    save();closeSheet();render();toast("Zapisano rodzinę "+name);}
  if(t==="sim"){if(!$("#sFirst").value.trim()){$("#sFirst").focus();return;}saveSim();}
});
document.addEventListener("keydown",e=>{if(e.key==="Escape")closeSheet();if(view!=="home"||document.querySelector(".sheetBg")||/INPUT|TEXTAREA|SELECT/.test(e.target.tagName))return;const n=S.families.length;if(!n)return;
  if(e.key==="ArrowRight")pick((sel+1)%n);if(e.key==="ArrowLeft")pick((sel-1+n)%n);});
let rz=0;addEventListener("resize",()=>{clearTimeout(rz);rz=setTimeout(()=>{if(view==="home")sizeStage();if(view==="tree"){applyT();}},120);});

/* ================= START ================= */
openDB().then(d=>{db=d;return load();}).then(d=>{S=d&&Array.isArray(d.families)&&!d.sample?d:empty();save();
  const firstTodo=S.families.findIndex(f=>f.status!=="done");sel=firstTodo<0?0:firstTodo;render();});
try{if("serviceWorker" in navigator&&location.protocol==="https:"&&!/claude/.test(location.hostname))navigator.serviceWorker.register("/sw.js").catch(()=>{});}catch(e){}
})();
