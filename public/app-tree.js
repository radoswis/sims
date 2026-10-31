"use strict";
/* ================= DRZEWO W STYLU FAMILYECHO =================
   Widok częściowy wokół wybranej osoby: przodkowie nad nią, rodzeństwo obok,
   partnerzy w jednym rzędzie (obecny = gruba linia, były = cienka, romans = przerywana),
   potomkowie pod spodem. Kliknięcie osoby przenosi na nią środek drzewa.
   Dane: s.spouse (obecny), s.ex[] (byli), s.romances[], s.parents[matka,ojciec], s.ptype ("a" = adopcja), s.bio. */
const TO_DEF={par:3,chi:3,oth:1,lf:"K",dir:"down",mode:"part",rom:true,age:true,fam:false,asp:false,cause:false,photo:false,bw:1,ts:1,cM:"#d2e3f5",cK:"#f8d4d9",cO:"#ede6e2",home:""};
let TO=Object.assign({},TO_DEF);try{Object.assign(TO,JSON.parse(localStorage.getItem("treeOpt")||"{}"));}catch(e){}
function saveTO(){try{localStorage.setItem("treeOpt",JSON.stringify(TO));}catch(e){}}
let centerNext=true,treeSel=null,tz=1,tx=0,ty=0,treeFit=false,dragged=false,T=null,treeTab="os",treeMore=false,treeOpts=false,treeKin=false,anchorPt=null,animT=0,P=null;
const LC="#6f5e56",LG="#a8a1a0";
const older=a=>AGES[Math.min(AGES.length-1,AGES.indexOf(a)+1)]||"Dorosły",younger=a=>AGES[Math.max(0,AGES.indexOf(a)-2)]||"Dziecko";

/* ---------- dane i relacje ---------- */
function fixSim(s){if(!Array.isArray(s.parents))s.parents=["",""];while(s.parents.length<2)s.parents.push("");
  ["romances","ex"].forEach(k=>{if(!Array.isArray(s[k]))s[k]=[];});["ptype","bio","gender","spouse"].forEach(k=>{if(s[k]==null)s[k]="";});return s;}
function migrateS(){if(S&&Array.isArray(S.sims))S.sims.forEach(fixSim);}
const kidsOf=id=>S.sims.filter(c=>c.parents.includes(id));
function relT(a,b){if(!a||!b)return null;
  if(a.spouse===b.id||b.spouse===a.id)return"s";if(a.ex.includes(b.id)||b.ex.includes(a.id))return"e";
  if(a.romances.includes(b.id)||b.romances.includes(a.id))return"r";
  return S.sims.some(c=>c.parents.includes(a.id)&&c.parents.includes(b.id))?"c":null;}
function partnersOf(p,all){const o=[],add=id=>{const q=id&&id!==p.id&&sim(id);if(q&&!o.includes(q))o.push(q);};
  add(p.spouse);p.ex.forEach(add);S.sims.forEach(x=>{if(x.spouse===p.id||x.ex.includes(p.id))add(x.id);});
  kidsOf(p.id).forEach(c=>c.parents.forEach(add));
  if(all||TO.rom){p.romances.forEach(add);S.sims.forEach(x=>{if(x.romances.includes(p.id))add(x.id);});}
  return o;}
function setRel(a,b,t){const A=sim(a),B=sim(b);if(!A||!B||a===b)return;fixSim(A);fixSim(B);
  [[A,B],[B,A]].forEach(([x,y])=>{if(x.spouse===y.id)x.spouse="";x.ex=x.ex.filter(i=>i!==y.id);x.romances=x.romances.filter(i=>i!==y.id);});
  if(t==="s")[[A,B],[B,A]].forEach(([x,y])=>{const o=x.spouse&&sim(x.spouse);if(o){o.spouse="";if(!o.ex.includes(x.id))o.ex.push(x.id);if(!x.ex.includes(o.id))x.ex.push(o.id);}x.spouse=y.id;});
  if(t==="e"){A.ex.push(b);B.ex.push(a);}
  if(t==="r"){A.romances.push(b);B.romances.push(a);}}
function applyRel(e,r){const t=sim(r.of);if(!t)return;
  if(r.type==="mother")t.parents[0]=e.id;else if(r.type==="father")t.parents[1]=e.id;else setRel(t.id,e.id,r.type);
  if(r.next)setTimeout(()=>simSheet(newSim({fam:t.fam,last:t.last,gender:"M",age:e.age,spouse:e.id,_rel:{type:r.next,of:t.id}})),60);}
function ancSet(id){const r=new Set(),q=[id];while(q.length){const s=sim(q.pop());if(s)s.parents.forEach(p=>{if(p&&sim(p)&&!r.has(p)){r.add(p);q.push(p);}});}return r;}
function desSet(id){const r=new Set(),q=[id];while(q.length){kidsOf(q.pop()).forEach(k=>{if(!r.has(k.id)){r.add(k.id);q.push(k.id);}});}return r;}
function homeId(){if(TO.home&&sim(TO.home))return TO.home;const m=curFam&&S.sims.find(s=>s.fam===curFam&&!s.dead);return m?m.id:(S.sims[0]||{}).id;}

/* ---------- układ (jednostki: 1 = szerokość pola z odstępem) ---------- */
function shiftFree(M,B,dx,dy,dir){for(let i=0;i<400;i++){let need=0;
  for(const b of B.values()){const x=b.x+dx,y=b.y+dy;for(const m of M.values())if(m.y===y&&Math.abs(m.x-x)<.999){const d=dir>0?m.x+1-x:x-m.x+1;if(d>need)need=d;}}
  if(need<=0)return dx;dx+=dir*need;}return dx;}
function mergeB(M,B,dx,dy){B.forEach((b,id)=>{if(!M.has(id))M.set(id,{x:b.x+dx,y:b.y+dy});});}
const sideOf=p=>p.gender===(TO.lf==="K"?"M":"K")?-1:1;
function desc(id,h,used,hk,pref){
  const p=sim(id),B=new Map([[id,{x:0,y:0}]]);used.add(id);
  const ps=partnersOf(p).filter(q=>!used.has(q.id));
  if(pref){const i=ps.findIndex(q=>q.id===pref);if(i>0)ps.unshift(ps.splice(i,1)[0]);}
  ps.forEach(q=>used.add(q.id));const s=sideOf(p);
  const group=q=>{if(h<=0)return null;
    const ks=kidsOf(id).filter(c=>!used.has(c.id)&&(q?c.parents.includes(q.id):!c.parents.some(x=>x&&x!==id&&sim(x)))).sort((a,b)=>AGES.indexOf(b.age)-AGES.indexOf(a.age));
    if(!ks.length)return null;ks.forEach(c=>used.add(c.id));
    const G=new Map();let f=null,l=0;
    ks.forEach(c=>{used.delete(c.id);const d=desc(c.id,hk?hk(c.id):h-1,used,null);const dx=G.size?shiftFree(G,d,l+1,0,1):0;mergeB(G,d,dx,0);if(f===null)f=dx;l=dx;});
    return{G,c:(f+l)/2};};
  const pv={};pv[s]=0;pv[-s]=0;
  const hk2=q=>S.sims.some(c=>c.parents.includes(id)&&c.parents.includes(q.id)),anyK=ps.some(hk2);
  ps.forEach(q=>{const d=!anyK||hk2(q)?s:-s,prev=pv[d],g=group(q);let xq=prev+d;
    if(g){const want=(prev+xq)/2-g.c,dx=shiftFree(B,g.G,want,1,d);if(dx!==want)xq=2*(dx+g.c)-prev;mergeB(B,g.G,dx,1);}
    B.set(q.id,{x:xq,y:0});pv[d]=xq;});
  const g0=group(null);if(g0)mergeB(B,g0.G,ps.length?shiftFree(B,g0.G,-g0.c,1,-s):-g0.c,1);
  return B;}
function freeX(y,x,n,dir){for(let i=0;i<500;i++){const c=[...P.values()].filter(m=>m.y===y&&m.x>x-.999&&m.x<x+n-.001);if(!c.length)return x;
  x=dir>0?Math.max(...c.map(m=>m.x))+1:Math.min(...c.map(m=>m.x))-n;}return x;}
function placeAnc(id,h,dir,used,lvl){const s=sim(id),q=P.get(id);if(!s||!q||h<=0)return;
  const pr=s.parents.map(sim).filter(x=>x&&!used.has(x.id));if(!pr.length)return;
  if(pr.length===2&&pr[1].gender===TO.lf&&pr[0].gender!==TO.lf)pr.reverse();
  const y=q.y-1,x=freeX(y,q.x-(pr.length-1)/2,pr.length,dir);
  pr.forEach((p,i)=>{P.set(p.id,{x:x+i,y});used.add(p.id);});
  if(lvl===1&&TO.oth>0){let lx=q.x;
    S.sims.filter(c=>!used.has(c.id)&&pr.some(p=>c.parents.includes(p.id))).forEach(c=>{lx=freeX(q.y,lx+dir,1,dir);P.set(c.id,{x:lx,y:q.y});used.add(c.id);
      if(TO.oth>1){let cx=lx;kidsOf(c.id).filter(k=>!used.has(k.id)).forEach(k=>{cx=freeX(q.y+1,cx,1,dir);P.set(k.id,{x:cx,y:q.y+1});used.add(k.id);cx+=dir;});}});}
  pr.forEach(p=>placeAnc(p.id,h-1,dir,used,lvl+1));}
function buildLayout(fid){
  const used=new Set(),F=sim(fid),pa=F.parents.map(sim).filter(Boolean);
  if(pa.length&&TO.par>0){
    const anc=pa.find(x=>x.gender===TO.lf)||pa[0],other=pa.find(x=>x!==anc),out=sideOf(anc);
    P=desc(anc.id,1,used,c=>c===fid?TO.chi:TO.oth,other&&other.id);
    if(other&&P.has(other.id)){let lx=P.get(other.id).x;
      partnersOf(other).filter(q=>!used.has(q.id)).forEach(q=>{lx=freeX(0,lx+out,1,out);P.set(q.id,{x:lx,y:0});used.add(q.id);});}
    pa.forEach(x=>placeAnc(x.id,TO.par-1,x===anc?-out:out,used,1));
  }else P=desc(fid,TO.chi,used,null);
  if(TO.mode==="all"){let mx=Math.max(...[...P.values()].map(m=>m.x));
    S.sims.forEach(s=>{if(used.has(s.id))return;let r=s;
      for(let i=0;i<60;i++){const u=r.parents.map(sim).find(x=>x&&!used.has(x.id));if(!u)break;r=u;}
      const B=desc(r.id,99,used,null);mergeB(P,B,mx+2-Math.min(...[...B.values()].map(b=>b.x)),0);mx=Math.max(...[...P.values()].map(m=>m.x));});}
  return P;}

/* ---------- rysowanie ---------- */
function layoutTree(fid){
  buildLayout(fid);
  const n=(TO.age?1:0)+(TO.fam?1:0)+(TO.asp?1:0)+(TO.cause?1:0);
  const bw=Math.round(124*TO.bw*(TO.photo?1.2:1)),bh=Math.round((40+n*15)*TO.ts)+(TO.photo?6:0),UX=bw+26,UY=bh+62;
  const Q=[...P.values()],minX=Math.min(...Q.map(q=>q.x)),minY=Math.min(...Q.map(q=>q.y)),maxX=Math.max(...Q.map(q=>q.x)),maxY=Math.max(...Q.map(q=>q.y));
  const W=(maxX-minX)*UX+bw+60,H=(maxY-minY)*UY+bh+60,ids=[...P.keys()];
  const L=id=>{const q=P.get(id);return{l:30+(q.x-minX)*UX,t:30+(q.y-minY)*UY};};
  let svg="";const path=(d,c,w,da)=>svg+=`<path d="${d}" fill="none" stroke="${c}" stroke-width="${w}"${da?` stroke-dasharray="${da}"`:""}/>`;
  const pairY={},seen=new Set();
  ids.forEach(a=>{const A=sim(a);partnersOf(A,true).forEach(B=>{const b=B.id;if(!P.has(b)||seen.has(b+"|"+a))return;seen.add(a+"|"+b);
    const qa=P.get(a),qb=P.get(b);if(qa.y!==qb.y)return;const t=relT(A,B);if(!t||(t==="r"&&!TO.rom))return;
    const lo=Math.min(qa.x,qb.x),hi=Math.max(qa.x,qb.x),mid=ids.some(i=>{const q=P.get(i);return q.y===qa.y&&q.x>lo+.01&&q.x<hi-.01;});
    const y=L(a).t+bh/2+(mid?8:0);pairY[[a,b].sort().join("|")]=y;
    path(`M${L(a).l+bw/2} ${y}H${L(b).l+bw/2}`,LC,t==="s"?4:2,t==="r"?"6 5":"");});});
  const grp=new Map();
  ids.forEach(c=>{const dp=sim(c).parents.filter(x=>x&&P.has(x));if(!dp.length)return;
    const k=dp.length===2&&P.get(dp[0]).y===P.get(dp[1]).y?dp.slice().sort().join("|"):dp[0];if(!grp.has(k))grp.set(k,[]);grp.get(k).push(c);});
  const busN={};
  grp.forEach((cs,k)=>{const ps=k.split("|"),a=L(ps[0]);let ox,oy;
    if(ps.length===2){ox=(a.l+L(ps[1]).l)/2+bw/2;oy=pairY[k]??a.t+bh/2;}else{ox=a.l+bw/2;oy=a.t+bh;}
    const ct=Math.min(...cs.map(c=>L(c).t));busN[ct]=(busN[ct]||0)+1;const by=ct-26-(busN[ct]-1)*6;
    const xs=cs.map(c=>L(c).l+bw/2),ad=cs.every(c=>sim(c).ptype==="a");
    path(`M${ox} ${oy}V${by}M${Math.min(ox,...xs)} ${by}H${Math.max(ox,...xs)}`,ad?LG:LC,2);
    cs.forEach((c,i)=>path(`M${xs[i]} ${by}V${L(c).t}`,sim(c).ptype==="a"?LG:LC,2));});
  ids.forEach(id=>{const s=sim(id),p=L(id);
    if(s.parents.some(x=>x&&sim(x)&&!P.has(x)))path(`M${p.l+bw/2} ${p.t}v-16`,LC,1.5,"2 3");
    if(kidsOf(id).some(k=>!P.has(k.id)))path(`M${p.l+bw/2} ${p.t+bh}v16`,LC,1.5,"2 3");
    if(partnersOf(s).some(q=>!P.has(q.id)))path(`M${p.l} ${p.t+bh/2}h-14`,LC,1.5,"2 3");});
  const up=TO.dir==="up",pos={};
  const nodes=ids.map(id=>{const s=sim(id),p=L(id),top=up?H-p.t-bh:p.t,f=fam(s.fam);pos[id]={x:p.l+bw/2,y:top+bh/2};
    const bg=s.gender==="M"?TO.cM:s.gender==="K"?TO.cK:TO.cO,ex=[];
    if(TO.age)ex.push(s.age);if(TO.fam)ex.push(f?f.name:"—");if(TO.asp)ex.push(s.asp||"—");if(TO.cause)ex.push(s.dead?"† "+(s.cause||"zmarł"+(s.gender==="K"?"a":"")):"");
    return `<button class="fnode${s.dead?" dead":""}${id===treeSel?" sel":""}${id===treeCmp?" cmp":""}" style="left:${p.l}px;top:${top}px;width:${bw}px;height:${bh}px;background:${bg}" data-act="treeSel" data-id="${id}" aria-label="${esc(full(s))}">${TO.photo?avatar(s):""}<span><b>${esc(full(s))}</b>${ex.map(x=>`<small>${esc(x)||"&nbsp;"}</small>`).join("")}</span></button>`;}).join("");
  return{pos,W,H,bw,bh,nodes,svg:`<svg width="${W}" height="${H}" aria-hidden="true">${up?`<g transform="translate(0 ${H}) scale(1 -1)">${svg}</g>`:svg}</svg>`};}

/* ---------- ekran ---------- */
function renderTree(){
  migrateS();
  if(treeFam!=="all"){const m=S.sims.find(s=>s.fam===treeFam&&!s.dead)||S.sims.find(s=>s.fam===treeFam);if(m){treeSel=m.id;centerNext=true;}treeFam="all";}
  if(!treeSel||!sim(treeSel))treeSel=homeId();
  const head=`<div class="treeHead"><select id="treeFam" aria-label="Skocz do rodziny"><option value="all">Skocz do rodziny…</option>${S.families.map(f=>`<option value="${f.id}">${esc(f.name)}</option>`).join("")}</select>
  <button class="btn blue" data-act="newSim" data-fam="">+ Sim</button><button class="btn" data-act="feImport">Import z FamilyEcho</button></div>`;
  if(!S.sims.length){app.innerHTML=`<div class="wrap">${head}<div class="panel" style="align-items:center;text-align:center"><h2>Drzewo jest puste</h2><p class="muted" style="margin:0">Dodaj pierwszego Sima albo zaimportuj drzewo z FamilyEcho.</p><button class="btn primary" data-act="newSim" data-fam="">+ Dodaj pierwszego Sima</button></div></div>`;return;}
  const s=sim(treeSel);T=layoutTree(s.id);
  app.innerHTML=`<div class="wrap fewrap">${head}<div class="fe">${feSide(s)}<div class="feMain">
  <div class="vp" id="vp"><div class="inner" id="inner" style="width:${T.W}px;height:${T.H}px;--ts:${TO.ts}">${T.svg}${T.nodes}</div>
  <div class="zoom"><button class="btn" data-act="zoom" data-v="1.25" aria-label="Przybliż">+</button><button class="btn" data-act="zoom" data-v="0.8" aria-label="Oddal">−</button><button class="btn" data-act="fit" aria-label="Pokaż całe drzewo" style="font-size:14px">⤢</button></div></div>
  ${treeOpts?feOpts():""}${feBar()}</div></div></div>`;
  bindVp();
  const p=T.pos[s.id],vp=$("#vp");
  if(anchorPt&&p){tx=anchorPt.x-(p.x-T.bw/2)*tz;ty=anchorPt.y-(p.y-T.bh/2)*tz;applyT();const c=cXY(s.id);animTo(c.x,c.y);}
  else if(centerNext||treeFit){const c=cXY(s.id);tx=c.x;ty=c.y;applyT();}else applyT();
  anchorPt=null;centerNext=false;treeFit=false;}
function cXY(id){const vp=$("#vp"),p=T.pos[id];return{x:vp.clientWidth/2-p.x*tz,y:vp.clientHeight/2-p.y*tz};}
function animTo(nx,ny){cancelAnimationFrame(animT);const sx=tx,sy=ty,t0=performance.now();
  const st=t=>{const k=Math.min(1,(t-t0)/300),e=1-Math.pow(1-k,3);tx=sx+(nx-sx)*e;ty=sy+(ny-sy)*e;applyT();if(k<1)animT=requestAnimationFrame(st);};animT=requestAnimationFrame(st);}

function feSide(s){
  const f=fam(s.fam),kv=r=>`<dl class="feKV">${r.map(([k,v])=>`<dt>${k}:</dt><dd>${esc(v)}</dd>`).join("")}</dl>`;
  const tab=(k,t)=>`<button class="feTab${treeTab===k?" on":""}" data-act="feTab" data-v="${k}">${t}</button>`;
  const b=(v,t)=>`<button class="btn" data-act="feAdd" data-v="${v}">${t}</button>`;
  let body="";
  if(treeTab==="os")body=kv([["Imię i nazwisko",full(s)],["Płeć",{K:"Kobieta",M:"Mężczyzna"}[s.gender]||"—"],["Wiek",s.age],["Aspiracja",s.asp||"—"],["Rodzina",f?f.name:"—"],
    ["Stan",s.dead?"Nie żyje"+(s.diedRound?" (runda "+s.diedRound+")":""):"Żyje"],["Drzewo",ancSet(s.id).size+" przodków, "+desSet(s.id).size+" potomków"]]);
  if(treeTab==="pa"){const pl=partnersOf(s,true);body=pl.length?pl.map(q=>{const t=relT(s,q);
    return `<div class="feRow"><button class="link" data-act="treeSel" data-id="${q.id}">${esc(full(q))}${q.dead?" †":""}</button><select data-rel="${q.id}" aria-label="Związek z ${esc(full(q))}">
    ${[["s","Małżonek / partner"],["e","Były partner"],["r","Romans"]].concat(t==="c"?[["c","Wspólne dzieci"]]:[]).concat([["x","Usuń związek"]]).map(([v,l])=>`<option value="${v}"${t===v?" selected":""}>${l}</option>`).join("")}</select></div>`;}).join(""):`<span class="muted small">Brak partnerów.</span>`;}
  if(treeTab==="bio")body=`${s.dead?kv([["Przyczyna śmierci",s.cause||"—"],["Grób / urna",s.grave||"—"]]):""}<label class="f">Notatki o Simie<textarea id="simBio" rows="5" placeholder="Historia, cechy, ważne wydarzenia…">${esc(s.bio)}</textarea></label>`;
  const hasM=s.parents[0]&&sim(s.parents[0]),hasF=s.parents[1]&&sim(s.parents[1]);
  return `<aside class="panel feSide"><h2>${esc(full(s))}${s.dead?" †":""}</h2>
  ${s.photo?`<div style="display:flex;justify-content:center">${avatar(s,"feAv")}</div>`:""}
  <button class="btn" data-act="feKin">${treeKin?"Ukryj pokrewieństwo":"Pokaż pokrewieństwo do "+esc(s.first||"Sima")}</button>${treeKin?kinPanel(s):""}
  <div class="feTabs">${tab("os","Osobiste")}${tab("pa","Partnerzy")}${tab("bio","Biografia")}</div>${body}
  <button class="btn blue" data-act="openSim" data-id="${s.id}">Edytuj dane: ${esc(s.first||"Sim")}</button>
  <div class="feActs"><span class="muted small">Dodaj krewnych ${esc(s.first||"Sima")}:</span>
  ${!hasM&&!hasF?b("parents","Dodaj nowych rodziców"):(!hasM?b("mother","Dodaj matkę"):"")+(!hasF?b("father","Dodaj ojca"):"")}
  ${b("partner","Dodaj partnera / byłego")}${b("sibling","Dodaj brata / siostrę")}${b("child","Dodaj dziecko")}
  <button class="btn ghost" data-act="feMore">${treeMore?"Mniej akcji":"Więcej akcji…"}</button>
  ${treeMore?b("setpar","Ustaw rodziców (z drzewa)")+`<button class="btn" data-act="feSetHome">Ustaw jako osobę startową</button>`:""}</div></aside>`;}

function feBar(){return `<div class="febar">
  <button class="btn" data-act="feOpt">⚙ ${treeOpts?"Ukryj opcje":"Opcje"}</button><button class="btn" data-act="fePrint">Drukuj</button><button class="btn" data-act="export">Pobierz kopię</button>
  <span class="feZoom"><button class="btn icon" data-act="zoom" data-v="0.8" aria-label="Oddal">−</button><input type="range" id="feZoom" min=".3" max="2.5" step=".05" value="${tz}" aria-label="Powiększenie"><button class="btn icon" data-act="zoom" data-v="1.25" aria-label="Przybliż">+</button></span>
  <button class="btn" data-act="feHome">Do startu</button>
  <span class="feFind"><input type="search" id="feFind" placeholder="Szukaj: ${simsLabel(S.sims.length)}" autocomplete="off" aria-label="Szukaj Sima"><span class="feFindL" id="feFindL"></span></span></div>`;}

function feOpts(){
  const cb=(k,l)=>`<label class="check" style="flex:none"><input type="checkbox" data-to="${k}"${TO[k]?" checked":""}><span>${l}</span></label>`;
  const sel=(k,l,o)=>`<label class="f">${l}<select data-to="${k}">${o.map(([v,t])=>`<option value="${v}"${String(TO[k])===String(v)?" selected":""}>${t}</option>`).join("")}</select></label>`;
  const g=[0,1,2,3,4,5,6,8,10].map(i=>[i,i?i+" pok.":"brak"]);
  const col=(k,l)=>`<label class="f">${l}<input type="color" data-to="${k}" value="${TO[k]}"></label>`,rng=(k,l)=>`<label class="f">${l}<input type="range" min=".6" max="1.8" step=".05" data-to="${k}" value="${TO[k]}"></label>`;
  return `<div class="panel feOpts"><div class="feCols">
  <div><b class="small">Pokaż w polach</b>${cb("age","Wiek")}${cb("fam","Rodzina")}${cb("asp","Aspiracja")}${cb("cause","Przyczyna śmierci")}${cb("photo","Zdjęcie")}${cb("rom","Romanse (linia przerywana)")}</div>
  <div>${sel("mode","Widok drzewa",[["part","Częściowy"],["all","Całe otoczenie"]])}${sel("dir","Kierunek",[["down","W dół"],["up","W górę"]])}${sel("lf","Lewy partner",[["K","Kobieta"],["M","Mężczyzna"]])}</div>
  <div>${sel("par","Rodzice",g.slice(1))}${sel("chi","Dzieci",g)}${sel("oth","Inni krewni",[[0,"brak"],[1,"ciocie i wujkowie"],[2,"+ kuzyni"]])}</div>
  <div>${col("cM","Pole: mężczyzna")}${col("cK","Pole: kobieta")}${col("cO","Pole: inna płeć")}${rng("bw","Szerokość pola")}${rng("ts","Rozmiar tekstu")}</div></div>
  <div class="row between"><button class="btn" data-act="feReset">Przywróć domyślne</button><button class="btn" data-act="feImport">Import z FamilyEcho…</button></div></div>`;}

/* ---------- dodawanie krewnych ---------- */
function treeAdd(v){feAdd(v);}
function feAdd(v){const s=sim(treeSel);if(!s)return;const base={fam:s.fam,last:s.last};
  if(v==="parents")return simSheet(newSim({...base,gender:"K",age:older(s.age),_rel:{type:"mother",of:s.id,next:"father"}}));
  if(v==="mother"||v==="father"){const o=sim(s.parents[v==="mother"?1:0]);return simSheet(newSim({...base,gender:v==="mother"?"K":"M",age:older(s.age),spouse:o&&!o.spouse?o.id:"",_rel:{type:v,of:s.id}}));}
  if(v==="sibling"){if(!s.parents.some(p=>p&&sim(p)))return toast("Najpierw dodaj rodziców: "+(s.first||"Sim"));return simSheet(newSim({...base,age:s.age,parents:s.parents.slice(),ptype:s.ptype}));}
  relSheet(v);}
function relSheet(k){const s=sim(treeSel),others=S.sims.filter(o=>o.id!==s.id);
  const opt=(list,v,none)=>(none?`<option value="">${none}</option>`:"")+list.filter(o=>!o.dead||o.id===v).map(o=>`<option value="${o.id}"${v===o.id?" selected":""}>${esc(full(o))}</option>`).join("");
  let h="",t="";
  if(k==="partner"){t="Partner dla: "+full(s);h=`<label class="f">Rodzaj związku<select id="rT"><option value="s">Małżonek / obecny partner</option><option value="e">Były partner</option><option value="r">Romans</option></select></label>
    <label class="f">Osoba<select id="rWho">${opt(others.filter(o=>{const r=relT(s,o);return !r||r==="c";}),"","+ nowy Sim")}</select></label>`;}
  if(k==="child"){t="Dziecko dla: "+full(s);const an=ancSet(s.id);h=`<label class="f">Drugi rodzic<select id="rP2">${opt(partnersOf(s,true),s.spouse,"— brak / nieznany —")}</select></label>
    <label class="f">Typ<select id="rT"><option value="">Biologiczne</option><option value="a">Adoptowane</option></select></label>
    <label class="f">Dziecko<select id="rWho">${opt(others.filter(o=>!an.has(o.id)),"","+ nowy Sim")}</select></label>`;}
  if(k==="setpar"){t="Rodzice: "+full(s);const ds=desSet(s.id),ok=others.filter(o=>!ds.has(o.id));h=`<div class="row"><label class="f">Matka / rodzic 1<select id="rM">${opt(ok,s.parents[0],"— brak —")}</select></label>
    <label class="f">Ojciec / rodzic 2<select id="rF">${opt(ok,s.parents[1],"— brak —")}</select></label></div>
    <label class="f">Typ<select id="rT"><option value="">Biologiczni</option><option value="a"${s.ptype==="a"?" selected":""}>Adopcyjni</option></select></label>`;}
  sheet(`<h2>${esc(t)}</h2><form data-form="fe" data-k="${k}" style="display:flex;flex-direction:column;gap:12px">${h}
  <div class="row between"><button type="button" class="btn" data-act="closeSheet">Anuluj</button><button class="btn primary">Dalej</button></div></form>`);}
function orderPar(a,b){const A=sim(a),B=sim(b);if(!B)return A.gender==="M"?["",a]:[a,""];return A.gender==="M"||B.gender==="K"?[b,a]:[a,b];}
document.addEventListener("submit",e=>{if(e.target.dataset.form!=="fe")return;const k=e.target.dataset.k,s=sim(treeSel),V={};if(!s)return;
  ["rT","rWho","rP2","rM","rF"].forEach(i=>{const x=$("#"+i);V[i]=x?x.value:"";});const v=i=>V[i];closeSheet();const done=()=>{save();render();};
  if(k==="partner"){const w=v("rWho"),t=v("rT");if(w){setRel(s.id,w,t);done();}else simSheet(newSim({fam:s.fam,gender:s.gender==="K"?"M":s.gender==="M"?"K":"",age:s.age,_rel:{type:t,of:s.id}}));}
  if(k==="child"){const w=v("rWho"),t=v("rT"),par=orderPar(s.id,v("rP2"));if(w){const c=sim(w);c.parents=par;c.ptype=t;done();}else simSheet(newSim({fam:s.fam,last:s.last,age:younger(s.age),parents:par,ptype:t}));}
  if(k==="setpar"){s.parents=[v("rM"),v("rF")];s.ptype=v("rT");done();}});

/* ---------- import z FamilyEcho (FamilyScript z pliku HTML lub TXT) ---------- */
function importSheet(){sheet(`<h2>Import z FamilyEcho</h2><p class="muted small" style="margin:0">Na FamilyEcho: Download → „Read-only HTML” albo „FamilyScript”. Potem wskaż pobrany plik.</p>
  <label class="check" style="flex:none"><input type="checkbox" id="feMerge" checked><span>Połącz z Simami o tym samym imieniu i nazwisku</span></label>
  <label class="btn blue" for="feFile" style="display:inline-flex;align-items:center;justify-content:center">Wybierz plik…</label><input type="file" id="feFile" accept=".html,.htm,.txt" hidden>
  <button type="button" class="btn" data-act="closeSheet">Anuluj</button>`);}
function parseFE(txt){let sc=txt;
  if(/<input|<html/i.test(txt)){const i=new DOMParser().parseFromString(txt,"text/html").getElementById("newscript");if(!i)throw 0;sc=i.getAttribute("value")||"";}
  const Pp={},R={};
  sc.replace(/\r\n?/g,"\n").split("\n").forEach(line=>{const e=line.split("\t");if(e.length<2||!e[0])return;const t=e[0][0],id=e[0].slice(1),o=t==="i"?(Pp[id]=Pp[id]||{}):t==="p"?(R[id]=R[id]||{}):null;if(!o)return;
    e.slice(1).forEach(f=>{if(f)o[f[0]]=f.slice(1).replace(/\\t/g,"\t").replace(/\\n/g,"\n").replace(/\\\\/g,"\\");});});
  if(!Object.keys(Pp).length)throw 0;return{Pp,R};}
function importFE(txt,merge){const {Pp,R}=parseFE(txt),map={},idx={},cl=l=>norm(l).replace(/\(.*?\)/g," ").trim(),key=(f,l)=>norm(f).trim()+"|"+cl(l);let add=0,upd=0;
  if(merge)S.sims.forEach(s=>{[cl(s.last)].concat(cl(s.last).split(/[\s-]+/)).forEach(l=>{const k=key(s.first,l);if(!idx[k])idx[k]=s;});});
  Object.entries(Pp).forEach(([id,o])=>{if("x" in o)return;const first=o.p||"",last=o.l||o.q||"",g=o.g==="m"?"M":o.g==="f"?"K":"";
    let s=merge&&(idx[key(first,last)]||(o.q&&idx[key(first,o.q)]));
    if(s){upd++;fixSim(s);if(!s.gender)s.gender=g;if(!s.bio&&o.o)s.bio=o.o;}
    else{const f=S.families.find(x=>norm(x.name)===norm((first+" "+last).trim()));s=newSim({first,last,gender:g,fam:f?f.id:"",asp:"Brak",dead:o.z==="1",cause:o.Z||"",bio:o.o||""});S.sims.push(s);add++;}
    map[id]=s.id;});
  Object.entries(Pp).forEach(([id,o])=>{const s=sim(map[id]);if(!s)return;const m=map[o.m]||"",f=map[o.f]||"";
    if(!s.parents[0]&&!s.parents[1]&&(m||f)){s.parents=[m,f];if(o.V&&o.V!=="b")s.ptype="a";}
    const sp=map[o.s],q=sp&&sim(sp);if(q&&!s.spouse&&!s.ex.includes(sp)&&(!q.spouse||q.spouse===s.id)){s.spouse=sp;q.spouse=s.id;}});
  Object.entries(R).forEach(([k,o])=>{const [a,b]=k.split(" ").map(x=>map[x]);if(!a||!b)return;
    if(o.e==="1"||/^[dsa]$/.test(o.g||""))setRel(a,b,"e");else if(o.g==="m"&&!sim(a).spouse&&!sim(b).spouse)setRel(a,b,"s");});
  save();return{add,upd};}

/* ---------- przesuwanie i powiększanie ---------- */
function applyT(){const i=$("#inner");if(i)i.style.transform=`translate(${tx}px,${ty}px) scale(${tz})`;const z=$("#feZoom");if(z&&document.activeElement!==z)z.value=tz;}
function fitTree(){const vp=$("#vp");if(!vp||!T)return;const w=vp.clientWidth,h=vp.clientHeight;tz=Math.min(1.1,Math.max(.3,Math.min(w/T.W,h/T.H)));tx=(w-T.W*tz)/2;ty=Math.max(0,(h-T.H*tz)/2);}
function zoomAt(f,cx,cy){const nz=Math.min(2.5,Math.max(.3,tz*f));tx=cx-(cx-tx)*nz/tz;ty=cy-(cy-ty)*nz/tz;tz=nz;applyT();}
function bindVp(){
  const vp=$("#vp");const pts=new Map();let st=null;
  vp.addEventListener("pointerdown",e=>{pts.set(e.pointerId,{x:e.clientX,y:e.clientY});dragged=false;cancelAnimationFrame(animT);
    if(pts.size===1)st={x:e.clientX,y:e.clientY,tx,ty};
    if(pts.size===2){const [a,b]=[...pts.values()];st={pinch:Math.hypot(a.x-b.x,a.y-b.y),z:tz,tx,ty};}});
  const move=e=>{if(!pts.has(e.pointerId)||!document.body.contains(vp))return;pts.set(e.pointerId,{x:e.clientX,y:e.clientY});const r=vp.getBoundingClientRect();
    if(pts.size===1&&st&&!st.pinch){const dx=e.clientX-st.x,dy=e.clientY-st.y;if(Math.abs(dx)+Math.abs(dy)>6){dragged=true;vp.classList.add("drag");}if(dragged){tx=st.tx+dx;ty=st.ty+dy;applyT();}}
    else if(pts.size===2&&st&&st.pinch){dragged=true;const [a,b]=[...pts.values()];const d=Math.hypot(a.x-b.x,a.y-b.y),cx=(a.x+b.x)/2-r.left,cy=(a.y+b.y)/2-r.top;
      const nz=Math.min(2.5,Math.max(.3,st.z*d/st.pinch));const qx=(cx-st.tx)/st.z,qy=(cy-st.ty)/st.z;tz=nz;tx=cx-qx*nz;ty=cy-qy*nz;applyT();}};
  const up=e=>{pts.delete(e.pointerId);vp.classList.remove("drag");if(pts.size<2&&st&&st.pinch){const v=[...pts.values()][0];st=v?{x:v.x,y:v.y,tx,ty}:null;}if(!pts.size)st=null;};
  vp.addEventListener("pointermove",move);vp.addEventListener("pointerup",up);vp.addEventListener("pointercancel",up);vp.addEventListener("pointerleave",up);
  vp.addEventListener("wheel",e=>{e.preventDefault();const r=vp.getBoundingClientRect();zoomAt(e.deltaY<0?1.12:.89,e.clientX-r.left,e.clientY-r.top);},{passive:false});}

/* ---------- akcje i zdarzenia ---------- */
Object.assign(A,{
  treeSel:el=>{if(dragged){dragged=false;return;}const id=el.dataset.id;if(!id||!sim(id))return;
    const vp=$("#vp");if(vp&&el.classList.contains("fnode")){const r=el.getBoundingClientRect(),v=vp.getBoundingClientRect();anchorPt={id,x:r.left-v.left,y:r.top-v.top};}
    treeSel=id;treeCmp=null;kinQ="";centerNext=true;render();},
  feTab:el=>{treeTab=el.dataset.v;render();},
  feMore:()=>{treeMore=!treeMore;render();},
  feKin:()=>{treeKin=!treeKin;treeCmp=null;kinQ="";render();},
  feOpt:()=>{treeOpts=!treeOpts;render();},
  feReset:()=>{TO=Object.assign({},TO_DEF,{home:TO.home});saveTO();centerNext=true;render();},
  feAdd:el=>feAdd(el.dataset.v),
  feHome:()=>{const h=homeId();if(h){treeSel=h;centerNext=true;render();}},
  feSetHome:()=>{TO.home=treeSel;saveTO();toast("Ustawiono osobę startową");},
  fePrint:()=>{fitTree();applyT();setTimeout(()=>window.print(),80);},
  feImport:()=>importSheet()
});
document.addEventListener("input",e=>{const t=e.target;
  if(t.id==="feFind"){const q=norm(t.value).trim(),l=$("#feFindL");if(!l)return;
    l.innerHTML=q?S.sims.filter(s=>!s.dead&&norm(full(s)).includes(q)).slice(0,30).map(s=>`<button data-act="treeSel" data-id="${s.id}">${esc(full(s))}${s.dead?" †":""}</button>`).join("")||`<span class="muted small" style="padding:8px 12px">Brak wyników</span>`:"";}
  if(t.id==="simBio"){const s=sim(treeSel);if(s){s.bio=t.value;save();}}
  if(t.id==="feZoom"){const vp=$("#vp");if(vp)zoomAt(+t.value/tz,vp.clientWidth/2,vp.clientHeight/2);}});
document.addEventListener("change",e=>{const t=e.target;
  if(t.dataset.to){const k=t.dataset.to;TO[k]=t.type==="checkbox"?t.checked:["par","chi","oth","bw","ts"].includes(k)?+t.value:t.value;saveTO();centerNext=true;render();}
  if(t.dataset.rel){setRel(treeSel,t.dataset.rel,/^[ser]$/.test(t.value)?t.value:null);save();render();}
  if(t.id==="feFile"){const file=t.files[0];if(!file)return;const merge=$("#feMerge").checked,r=new FileReader();
    r.onload=()=>{try{const x=importFE(String(r.result),merge);closeSheet();centerNext=true;if(view!=="tree")go("tree");else render();toast(`Zaimportowano: ${x.add} nowych, ${x.upd} połączonych`);}catch(err){toast("Nie rozpoznano pliku FamilyEcho.");}};r.readAsText(file);}});
addEventListener("resize",()=>{if(view==="tree"&&T&&treeSel&&T.pos[treeSel]&&$("#vp")){const c=cXY(treeSel);tx=c.x;ty=c.y;applyT();}});
