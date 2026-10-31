"use strict";
/* Kalkulator pokrewieństwa (jak w FamilyEcho): kim jest wybrany Sim (A) dla innego Sima (B). */
let treeCmp=null,kinQ="";

function kinAnc(id){const d=new Map([[id,0]]),q=[id];
  while(q.length){const c=q.shift(),s=sim(c);if(!s)continue;
    s.parents.forEach(p=>{if(p&&sim(p)&&!d.has(p)){d.set(p,d.get(c)+1);q.push(p);}});}
  return d;}
function kinBlood(a,b){const A=kinAnc(a),B=kinAnc(b);let best=null;
  A.forEach((da,id)=>{if(B.has(id)){const db=B.get(id),t=da+db;if(!best||t<best.t)best={id,da,db,t};}});
  if(!best)return null;
  const shared=[...A].filter(([id,d])=>d===best.da&&B.get(id)===best.db).length;
  best.half=best.da>0&&best.db>0&&shared<2;return best;}
const pra=n=>"pra".repeat(Math.max(0,n));
const pokolen=n=>n===1?"pokolenie":(n%10>=2&&n%10<=4&&(n%100<10||n%100>=20)?"pokolenia":"pokoleń");
function kinW(g){return (m,f)=>g==="K"?f:g==="M"?m:m+"/"+f;}
function kinWord(r,g,bg){const w=kinW(g),{da,db,half}=r;
  if(!da&&!db)return "ta sama osoba";
  if(db===0)return da===1?w("syn","córka"):pra(da-2)+w("wnuk","wnuczka");
  if(da===0)return db===1?w("ojciec","matka"):pra(db-2)+w("dziadek","babcia");
  if(da===1&&db===1)return half?w("przyrodni brat","przyrodnia siostra"):w("brat","siostra");
  if(da===1)return db===2?w("wujek","ciocia"):w("brat","siostra")+" "+pra(db-3)+"dziadka lub "+pra(db-3)+"babci";
  if(db===1){if(da===2)return bg==="K"?w("siostrzeniec","siostrzenica"):bg==="M"?w("bratanek","bratanica"):w("bratanek/siostrzeniec","bratanica/siostrzenica");
    return pra(da-3)+w("wnuk","wnuczka")+" rodzeństwa";}
  const deg=Math.min(da,db)-1,diff=da-db;
  let s=w("kuzyn","kuzynka")+(deg>1?" "+deg+". stopnia":"");
  if(diff)s+=` (${Math.abs(diff)} ${pokolen(Math.abs(diff))} ${diff>0?"niżej":"wyżej"})`;
  return s;}
function kinship(aId,bId){const a=sim(aId),b=sim(bId);if(!a||!b)return null;const w=kinW(a.gender);
  if(a.id===b.id)return{t:"ta sama osoba"};
  if(a.spouse===b.id)return{t:w("mąż","żona")};
  const r=kinBlood(a.id,b.id);if(r){let g2=b.gender;if(r.db===1&&r.da===2){const p=a.parents.map(sim).find(x=>x&&x.parents.includes(r.id));g2=p?p.gender:"";}return{t:kinWord(r,a.gender,g2),via:r.id};}
  const as=a.spouse&&sim(a.spouse);
  if(as){const q=kinBlood(as.id,b.id);if(q){
    if(q.db===0&&q.da===1)return{t:w("zięć","synowa")};
    if(q.da===0&&q.db===1)return{t:w("ojczym","macocha")};
    if(q.da===1&&q.db===1)return{t:w("szwagier","szwagierka")};
    return{t:w("mąż","żona")+" (współmałżonek to: "+kinWord(q,as.gender,b.gender)+")",via:q.id};}}
  const bs=b.spouse&&sim(b.spouse);
  if(bs){const q=kinBlood(a.id,bs.id);if(q){
    if(q.da===1&&q.db===0)return{t:w("pasierb","pasierbica")};
    if(q.da===0&&q.db===1)return{t:w("teść","teściowa")};
    if(q.da===1&&q.db===1)return{t:w("szwagier","szwagierka")};
    return{t:kinWord(q,a.gender,bs.gender)+" współmałżonka",via:q.id};}}
  return null;}

const norm=x=>String(x||"").toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g,"").replace(/ł/g,"l");
function kinPanel(s){
  return `<div class="kin"><label class="f" for="kinQ" style="flex:none">Sprawdź pokrewieństwo z innym Simem</label>
  <input type="text" id="kinQ" placeholder="Wpisz imię, np. Zdzich" autocomplete="off" value="${esc(kinQ)}">
  <div id="kinOut">${kinOut(s)}</div></div>`;}
function kinOut(a){
  if(treeCmp&&sim(treeCmp)){const b=sim(treeCmp),k=kinship(a.id,b.id),k2=kinship(b.id,a.id),v=k&&k.via&&k.via!==a.id&&k.via!==b.id?sim(k.via):null;
    return `<div class="kinRes"><div class="row" style="flex-wrap:nowrap">${avatar(b)}<div style="flex:1;min-width:0">
      <span class="muted small">${esc(a.first||"?")} względem: ${esc(full(b))}</span><br>
      <b class="kinBig">${k?esc(k.t):"brak pokrewieństwa"}</b></div>
      <button class="x" data-act="kinClear" aria-label="Wyczyść porównanie">×</button></div>
      ${k2?`<span class="small">Odwrotnie: ${esc(b.first||"?")} to dla ${esc(a.first||"?")} — <b>${esc(k2.t)}</b></span>`:""}
      ${v?`<span class="muted small">Wspólny przodek: ${esc(full(v))}</span>`:""}
      ${k?"":`<span class="muted small">Nie znalazłem połączenia przez rodziców ani małżeństwa. Uzupełnij rodziców w drzewie.</span>`}</div>`;}
  const q=norm(kinQ).trim();if(!q)return "";
  const hits=S.sims.filter(o=>o.id!==a.id&&!o.dead&&norm(full(o)).split(/\s+/).concat(norm(full(o))).some(p=>p.startsWith(q))).slice(0,6);
  return hits.length?`<div class="row">${hits.map(o=>`<button class="chip" data-act="kinPick" data-id="${o.id}">${avatar(o)}${esc(full(o))}</button>`).join("")}</div>`
    :`<span class="muted small">Brak Sima o takim imieniu.</span>`;}

Object.assign(A,{
  kinPick:el=>{treeCmp=el.dataset.id;kinQ="";render();},
  kinClear:()=>{treeCmp=null;kinQ="";render();const i=$("#kinQ");i&&i.focus({preventScroll:true});}
});
document.addEventListener("input",e=>{if(e.target.id!=="kinQ")return;kinQ=e.target.value;treeCmp=null;
  const s=sim(treeSel),o=$("#kinOut");if(s&&o)o.innerHTML=kinOut(s);
  document.querySelectorAll(".node.cmp").forEach(n=>n.classList.remove("cmp"));});
