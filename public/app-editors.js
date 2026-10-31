"use strict";

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
  if(rel)applyRel(e,rel);
  if(view==="tree"&&!old){if(!treeSel)treeSel=e.id;centerNext=true;}
  save();closeSheet();render();toast("Zapisano: "+full(e));
}

/* Dodawanie istniejącego Sima do rodziny */
function pickSimSheet(){const f=fam(curFam);if(!f)return;
  sheet(`<h2>Dodaj do: ${esc(f.name)}</h2><input type="search" id="pickQ" placeholder="Szukaj Sima…" autocomplete="off"><div class="row" id="pickL">${pickList("")}</div>
  <button type="button" class="btn" data-act="closeSheet">Zamknij</button>`);
  $("#pickQ").addEventListener("input",e=>{$("#pickL").innerHTML=pickList(e.target.value);});}
function pickList(q){const n=norm(q).trim(),l=S.sims.filter(s=>s.fam!==curFam&&!s.dead&&(!n||norm(full(s)).includes(n)));
  return l.length?l.map(s=>{const o=fam(s.fam);return `<button class="chip" data-act="pickSimDo" data-id="${s.id}">${avatar(s)}${esc(full(s))}${o?` <span class="muted small">(${esc(o.name)})</span>`:""}</button>`;}).join(""):`<span class="muted small">Brak Simów do dodania.</span>`;}
