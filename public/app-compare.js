"use strict";

/* ================= EKRAN: PORÓWNANIE RUND ================= */
let compareRangeStart = 1;

function getCompareRounds() {
  const start = compareRangeStart;
  const rounds = [];
  for (let r = start; r < start + 10; r++) rounds.push(r);
  return rounds;
}

function renderCompare() {
  const rounds = getCompareRounds();
  const fs = S.families;

  app.innerHTML = `<div class="wrap" style="max-width:1200px">
    <div class="panel" style="gap:10px">
      <div class="row between" style="flex-wrap:wrap;gap:8px">
        <div>
          <div class="muted small">Analiza pokoleń i narodzin</div>
          <h1 style="margin:0">Porównanie rund</h1>
        </div>
        <div class="seg" role="group" aria-label="Zakres rund">
          <button data-act="setCompareRange" data-v="1" aria-pressed="${compareRangeStart === 1}">Rundy 1–10</button>
          <button data-act="setCompareRange" data-v="11" aria-pressed="${compareRangeStart === 11}">Rundy 11–20</button>
          <button data-act="setCompareRange" data-v="21" aria-pressed="${compareRangeStart === 21}">Rundy 21–30</button>
        </div>
      </div>
      
      <div class="row" style="gap:12px;flex-wrap:wrap;align-items:center;padding:8px 12px;background:rgba(255,255,255,.7);border-radius:12px;font-size:13px">
        <span style="font-weight:800;color:var(--ink)">Legenda kwadratu rundy:</span>
        <span class="row" style="gap:4px;align-items:center"><span style="display:inline-block;width:14px;height:14px;border:2px solid #e0a640;border-radius:2px"></span> 4 boki = 4 dni tury (zgodnie z ruchem wskazówek zegara: 1=góra, 2=prawo, 3=dół, 4=lewo)</span>
        <span class="row" style="gap:4px;align-items:center"><span style="display:inline-flex;align-items:center;justify-content:center;width:16px;height:16px;border-radius:50%;background:#f43f5e;color:#fff;font-weight:900;font-size:10px">N</span> Narodziny</span>
        <span class="row" style="gap:4px;align-items:center"><span style="display:inline-flex;align-items:center;justify-content:center;width:16px;height:16px;border-radius:50%;background:#0284c7;color:#fff;font-weight:900;font-size:10px">S</span> Pójście na studia</span>
        <span class="muted small" style="margin-left:auto">Dotknij kwadratu, by zobaczyć lub dodać narodziny i notatki.</span>
      </div>
    </div>

    <div class="cmpWrap">
      <table class="cmpTable">
        <thead>
          <tr>
            <th class="cmpColFam" style="border-top-left-radius:14px">Rodzina</th>
            ${rounds.map(r => `<th class="cmpThRound ${r === S.round ? "current-round" : ""}">${r === S.round ? "★ " : ""}Runda ${r}</th>`).join("")}
          </tr>
        </thead>
        <tbody>
          ${fs.map(f => {
            const fc = famFace(f);
            return `<tr>
              <td class="cmpColFam">
                <button class="cmpFamBtn" data-act="openFamFromCompare" data-id="${f.id}">
                  <span class="av" style="width:28px;height:28px;font-size:11px;${fc.style}">${fc.txt}</span>
                  <span class="cmpFamName">${esc(f.name)}</span>
                </button>
              </td>
              ${rounds.map(r => `<td>${renderRoundSquare(f, r)}</td>`).join("")}
            </tr>`;
          }).join("")}
        </tbody>
      </table>
    </div>
  </div>`;
}

function renderRoundSquare(f, round) {
  const bDays = getFamilyBirthDays(f, round);
  const sDays = getFamilyCollegeDays(f, round);
  const isCur = round === S.round;
  const isPast = round < S.round;
  const playedDays = isPast ? 4 : (isCur ? (f.status === "done" ? 4 : (f.day || 1)) : 0);

  // Kolory 4 boków (zgodnie ze wskazówkami: 1=góra, 2=prawo, 3=dół, 4=lewo)
  const d1Color = playedDays >= 1 ? "#e0a640" : "#d8e2ee";
  const d2Color = playedDays >= 2 ? "#e0a640" : "#d8e2ee";
  const d3Color = playedDays >= 3 ? "#e0a640" : "#d8e2ee";
  const d4Color = playedDays >= 4 ? "#e0a640" : "#d8e2ee";

  // Badges SVG
  const badgesSvg = [];
  // Dzień 1: Góra (x: 23, y: 7)
  renderDayBadges(1, 23, 7, bDays.includes(1), sDays.includes(1), badgesSvg);
  // Dzień 2: Prawo (x: 39, y: 23)
  renderDayBadges(2, 39, 23, bDays.includes(2), sDays.includes(2), badgesSvg);
  // Dzień 3: Dół (x: 23, y: 39)
  renderDayBadges(3, 23, 39, bDays.includes(3), sDays.includes(3), badgesSvg);
  // Dzień 4: Lewo (x: 7, y: 23)
  renderDayBadges(4, 7, 23, bDays.includes(4), sDays.includes(4), badgesSvg);

  const titleParts = [`${f.name} — Runda ${round}`];
  if (bDays.length) titleParts.push(`Narodziny: dzień ${bDays.join(", ")}`);
  if (sDays.length) titleParts.push(`Studia: dzień ${sDays.join(", ")}`);

  return `<button class="cmpSqBtn ${isCur ? "is-current" : ""}" data-act="openRoundModal" data-fam="${f.id}" data-round="${round}" title="${esc(titleParts.join(" | "))}">
    <svg viewBox="0 0 46 46" class="cmpSqSvg" aria-hidden="true">
      <rect x="7" y="7" width="32" height="32" rx="4" fill="${isCur ? "rgba(255,249,235,.9)" : "rgba(255,255,255,.95)"}" stroke="rgba(22,36,74,.1)" stroke-width="1"/>
      <line x1="7" y1="7" x2="39" y2="7" stroke="${d1Color}" stroke-width="${playedDays >= 1 ? 3.5 : 2}" stroke-linecap="round"/>
      <line x1="39" y1="7" x2="39" y2="39" stroke="${d2Color}" stroke-width="${playedDays >= 2 ? 3.5 : 2}" stroke-linecap="round"/>
      <line x1="39" y1="39" x2="7" y2="39" stroke="${d3Color}" stroke-width="${playedDays >= 3 ? 3.5 : 2}" stroke-linecap="round"/>
      <line x1="7" y1="39" x2="7" y2="7" stroke="${d4Color}" stroke-width="${playedDays >= 4 ? 3.5 : 2}" stroke-linecap="round"/>
      <text x="23" y="27" text-anchor="middle" font-size="11" font-weight="800" fill="rgba(22,36,74,.32)">${round}</text>
      ${badgesSvg.join("")}
    </svg>
  </button>`;
}

function renderDayBadges(day, x, y, hasN, hasS, out) {
  if (hasN && hasS) {
    const isHoriz = day === 1 || day === 3;
    const x1 = isHoriz ? x - 5.5 : x;
    const y1 = isHoriz ? y : y - 5.5;
    const x2 = isHoriz ? x + 5.5 : x;
    const y2 = isHoriz ? y : y + 5.5;
    out.push(`<circle cx="${x1}" cy="${y1}" r="5.5" fill="#f43f5e" stroke="#fff" stroke-width="1.2"/>
      <text x="${x1}" y="${y1 + 2.5}" text-anchor="middle" font-size="6.5" font-weight="900" fill="#fff">N</text>`);
    out.push(`<circle cx="${x2}" cy="${y2}" r="5.5" fill="#0284c7" stroke="#fff" stroke-width="1.2"/>
      <text x="${x2}" y="${y2 + 2.5}" text-anchor="middle" font-size="6.5" font-weight="900" fill="#fff">S</text>`);
  } else if (hasN) {
    out.push(`<circle cx="${x}" cy="${y}" r="6" fill="#f43f5e" stroke="#fff" stroke-width="1.2"/>
      <text x="${x}" y="${y + 3}" text-anchor="middle" font-size="7.5" font-weight="900" fill="#fff">N</text>`);
  } else if (hasS) {
    out.push(`<circle cx="${x}" cy="${y}" r="6" fill="#0284c7" stroke="#fff" stroke-width="1.2"/>
      <text x="${x}" y="${y + 3}" text-anchor="middle" font-size="7.5" font-weight="900" fill="#fff">S</text>`);
  }
}

/* ================= MODAL SZCZEGÓŁÓW RUNDY ================= */
function openRoundModal(famId, round) {
  const f = fam(famId);
  if (!f) return;
  const bDays = getFamilyBirthDays(f, round);
  const sDays = getFamilyCollegeDays(f, round);
  const diffRounds = S.round - round;

  // Dzieci z tej rodziny
  const kids = S.sims.filter(s => s.fam === f.id && (s.age === "Niemowlę" || s.age === "Dziecko" || s.age === "Nastolatek"));

  const overlay = document.createElement("div");
  overlay.className = "sheetBg";
  overlay.id = "roundSheet";

  overlay.innerHTML = `<div class="sheet" style="max-width:540px">
    <div class="row between">
      <div class="row" style="gap:10px;align-items:center">
        <span class="av" style="width:40px;height:40px;font-size:15px;${famFace(f).style}">${famFace(f).txt}</span>
        <div>
          <b style="font-size:18px">${esc(f.name)}</b>
          <div class="muted small">Runda ${round} ${round === S.round ? "· (Runda bieżąca)" : (round < S.round ? "· (Zakończona)" : "· (Przyszła)")}</div>
        </div>
      </div>
      <button class="x" data-act="closeRoundModal">×</button>
    </div>

    <div class="panel" style="background:#fff;gap:8px">
      <div class="row between">
        <b>Dni w tej rundzie (1–4)</b>
        <span class="muted small">Kliknij, by dodać / usunąć zdarzenie</span>
      </div>
      ${[1, 2, 3, 4].map(d => {
        const hasN = bDays.includes(d);
        const hasS = sDays.includes(d);
        const note = f.notes[round + "-" + d] || "";
        return `<div class="item" style="flex-direction:column;align-items:stretch;gap:6px;padding:8px 10px;background:#f8fafc;border-radius:12px;border:1px solid #e2e8f0">
          <div class="row between" style="align-items:center">
            <b style="color:var(--ink)">Dzień ${d}</b>
            <div class="row" style="gap:6px">
              <button class="btn small ${hasN ? "danger" : "ghost"}" data-act="toggleRoundN" data-fam="${f.id}" data-round="${round}" data-day="${d}" style="font-size:12px;padding:4px 10px;min-height:30px">
                👶 ${hasN ? "Narodziny (N) ✓" : "+ Narodziny (N)"}
              </button>
              <button class="btn small ${hasS ? "blue" : "ghost"}" data-act="toggleRoundS" data-fam="${f.id}" data-round="${round}" data-day="${d}" style="font-size:12px;padding:4px 10px;min-height:30px">
                🎓 ${hasS ? "Studia (S) ✓" : "+ Studia (S)"}
              </button>
            </div>
          </div>
          ${note ? `<div class="small muted" style="background:#fff;padding:6px 10px;border-radius:8px;border:1px solid #f1f5f9"><b>Notatka:</b> ${esc(note)}</div>` : ""}
        </div>`;
      }).join("")}
    </div>

    ${bDays.length ? `<div class="panel" style="background:rgba(255,241,242,.7);border:1px solid rgba(244,63,94,.25);gap:6px">
      <div style="font-weight:800;color:#be123c">👶 Narodziny w tej rundzie:</div>
      <div class="small" style="color:#881337">
        W rundzie ${round} urodziło się dziecko w dniu: <b>${bDays.join(", ")}</b>.<br>
        Od tej rundy minęło: <b>${diffRounds} ${diffRounds === 1 ? "runda" : (diffRounds >= 2 && diffRounds <= 4 ? "rundy" : "rund")}</b> 
        (${diffRounds * 4} dni rozgrywki).
      </div>
      ${kids.length ? `<div class="small" style="margin-top:4px">Dzieci w rodzinie: ${kids.map(k => `<b>${esc(full(k))}</b> (${k.age})`).join(", ")}</div>` : ""}
    </div>` : ""}

    <button class="btn primary" data-act="closeRoundModal" style="min-height:44px">Gotowe</button>
  </div>`;

  document.body.append(overlay);
}

function closeRoundModal() {
  const el = document.getElementById("roundSheet");
  if (el) el.remove();
}
