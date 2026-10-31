"use strict";

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
    return `<button class="node ${s.dead?"dead":""} ${treeSel===s.id?"sel":""} ${treeCmp===s.id?"cmp":""}" style="left:${p.x-TW/2}px;top:${p.y}px;--ring:${ring}" data-act="treeSel" data-id="${s.id}" aria-label="${esc(full(s))}">${avatar(s)}<b>${esc(s.first||"?")}${s.dead?" †":""}</b><small>${esc(s.age)}</small></button>`;}).join("");
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
  <button class="btn" data-act="treeAdd" data-v="sibling">+ Rodzeństwo</button></div>${kinPanel(s)}</div>`;
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
