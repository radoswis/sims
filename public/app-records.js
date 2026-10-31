"use strict";

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
