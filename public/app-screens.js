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
    if(f){const fc=famFace(f);const st=f.status==="prog"?"transparent":f.status==="done"?"rgba(44,133,71,.55)":"transparent";
      html+=`<div class="slot" style="--a:${i*step}deg"><div class="counter"><button class="ball ${f.status==="done"?"done":""}" style="--st:${st}" data-act="pick" data-i="${i}" aria-pressed="${i===sel}" aria-label="Rodzina ${esc(f.name)}, ${ST[f.status][0]}${f.status==="prog"?", dzień "+(f.day||1)+" z 4":""}">
      ${f.status==="prog"?`<span class="ring" style="--p:${Math.min(4,Math.max(1,f.day||1))*25}%" aria-hidden="true"></span>`:""}${f.status==="done"?`<span class="tick" aria-hidden="true">✓</span>`:""}<span class="face" style="${fc.style}">${fc.txt}</span><span class="bname">${esc(f.name)}</span></button></div></div>`;}
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
  const ph=innerWidth<=440,availH=innerHeight-(ph?220:200), availW=Math.min(innerWidth-(ph?24:32),760);
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
  app.innerHTML=`<div class="wrap">
  <div class="row between"><button class="btn" data-act="go" data-v="home">← Rozgrywka</button><button class="btn" data-act="editFamily">Edytuj</button></div>
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
    <div class="row between"><h2>Domownicy</h2><span class="row"><button class="btn ghost" data-act="pickSim">+ Z listy</button><button class="btn ghost" data-act="newSim" data-fam="${f.id}">+ Nowy Sim</button></span></div>
    <div class="row">${members.length?members.map(s=>`<button class="chip" data-act="openSim" data-id="${s.id}">${avatar(s)}${esc(s.first||"Bez imienia")}</button>`).join(""):`<span class="muted small">Brak Simów. Dodaj domowników, by budować drzewo.</span>`}</div>
  </div>
  <button class="btn primary" data-act="finishFamily" style="min-height:52px">Zakończ turę rodziny</button>
  </div>`;
}
