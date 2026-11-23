// Test aplikacji w przeglądarce: prawdziwy src/worker.js na atrapie D1 (node:sqlite) + pliki z public/ z nagłówkami z public/_headers.
// Uruchomienie: node --no-warnings tests/smoke.mjs   (wymaga Playwright z Chromium)
import http from "node:http";
import fs from "node:fs";
import path from "node:path";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";
import { DatabaseSync } from "node:sqlite";
import worker from "../src/worker.js";

const require = createRequire(import.meta.url);
const { chromium } = require("playwright");
const ROOT = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const PUB = path.join(ROOT, "public");

/* ---------- atrapa D1 ---------- */
function fakeD1() {
  const db = new DatabaseSync(":memory:");
  db.exec(fs.readFileSync(path.join(ROOT, "migrations/0001_init.sql"), "utf8"));
  const stmt = (sql, args = []) => ({
    bind: (...a) => stmt(sql, a),
    first: async () => db.prepare(sql).get(...args) ?? null,
    all: async () => ({ results: db.prepare(sql).all(...args) }),
    run: async () => db.prepare(sql).run(...args),
    _exec: () => { const p = db.prepare(sql); return /^\s*select/i.test(sql) ? p.all(...args) : p.run(...args); },
  });
  return {
    raw: db,
    prepare: sql => stmt(sql),
    batch: async list => { db.exec("BEGIN"); try { const r = list.map(s => s._exec()); db.exec("COMMIT"); return r; } catch (e) { db.exec("ROLLBACK"); throw e; } },
  };
}

/* ---------- serwer ---------- */
const headers = {};
fs.readFileSync(path.join(PUB, "_headers"), "utf8").split("\n").forEach(l => { const m = l.match(/^\s+([\w-]+):\s*(.+)$/); if (m) headers[m[1]] = m[2]; });
const TYPES = { ".js": "text/javascript", ".css": "text/css", ".html": "text/html", ".json": "application/json", ".png": "image/png", ".svg": "image/svg+xml", ".webmanifest": "application/manifest+json" };
let D1 = fakeD1();
const env = { get DB() { return D1; } };
// Symulacja wdrożenia i słabej sieci: dopisek do pliku ("nowa wersja") i opóźnienie odpowiedzi.
const OVR = {}; // ścieżka → { append?: string, delay?: ms }
const server = http.createServer(async (q, r) => {
  const url = "http://localhost" + q.url;
  if (q.url.startsWith("/api/")) {
    const chunks = []; for await (const c of q) chunks.push(c);
    const res = await worker.fetch(new Request(url, { method: q.method, headers: q.headers, body: chunks.length ? Buffer.concat(chunks) : undefined }), env);
    r.writeHead(res.status, Object.fromEntries(res.headers)); return r.end(Buffer.from(await res.arrayBuffer()));
  }
  let p = q.url.split("?")[0]; if (p === "/") p = "/index.html";
  const f = path.join(PUB, path.normalize(p));
  const o = OVR[p] || {};
  fs.readFile(f, (e, d) => {
    if (e || !f.startsWith(PUB) || p === "/_headers") { r.writeHead(404); return r.end(); }
    if (o.append) d = Buffer.concat([d, Buffer.from(o.append)]);
    setTimeout(() => { r.writeHead(200, { "content-type": TYPES[path.extname(f)] || "application/octet-stream", ...headers }); r.end(d); }, o.delay || 0);
  });
});
await new Promise(res => server.listen(0, res));
const U = "http://localhost:" + server.address().port;

/* ---------- pomocnicze ---------- */
let failed = 0;
const ok = (cond, msg) => { console.log((cond ? "  ✓ " : "  ✗ ") + msg); if (!cond) failed++; };
const api = (method, body) => fetch(U + "/api/state", { method, headers: { "content-type": "application/json" }, body: body && JSON.stringify(body) }).then(async r => ({ status: r.status, body: await r.json() }));
const setServer = state => { D1 = fakeD1(); return api("PUT", { state, baseRev: 0 }); };
const browser = await chromium.launch();
async function page(opts = {}) {
  const ctx = await browser.newContext({ viewport: { width: 393, height: 851 }, serviceWorkers: opts.sw ? "allow" : "block" });
  const p = await ctx.newPage(); p.errors = []; p.dialogs = [];
  p.on("pageerror", e => p.errors.push(e.message));
  p.on("console", m => { if (m.type() === "error") p.errors.push(m.text()); });
  p.on("dialog", d => { p.dialogs.push(d.message()); opts.dialog === "dismiss" ? d.dismiss() : d.accept(); });
  // Czcionki Google są poza testem (brak sieci w CI) — odpowiadamy pustym CSS.
  await p.route(/fonts\.(googleapis|gstatic)\.com/, r => r.fulfill({ status: 200, contentType: "text/css", body: "" }));
  await p.goto(U); await p.waitForTimeout(700);
  return p;
}
const fam = (name, extra = {}) => ({ id: "f" + name, name, color: "#3b6fd1", status: "todo", day: 1, tasks: [], notes: {}, births: {}, colleges: {}, college: null, ...extra });
const simO = (id, extra = {}) => ({ id, first: id, last: "", fam: "", age: "Dorosły", parents: ["", ""], ex: [], spouse: "", ...extra });

try {
  console.log("API (worker.js)");
  {
    D1 = fakeD1();
    let r = await api("GET"); ok(r.status === 200 && r.body.rev === 0 && r.body.state === null, "pusty stan");
    r = await api("PUT", { state: { a: 1 }, baseRev: 0 }); ok(r.status === 200 && r.body.rev === 1, "pierwszy zapis → rev 1");
    r = await api("PUT", { state: { a: 2 }, baseRev: 0 }); ok(r.status === 409 && r.body.state.a === 1, "nieaktualny baseRev → 409 z danymi serwera");
    r = await api("PUT", { state: [1], baseRev: 1 }); ok(r.status === 400, "tablica zamiast obiektu → 400");
    r = await api("PUT", { state: { a: 2 }, baseRev: 1 }); ok(r.status === 200 && r.body.rev === 2, "drugi zapis → rev 2");
    const snaps = D1.raw.prepare("SELECT key, rev FROM meta WHERE key LIKE 'snap-%'").all(); ok(snaps.length === 1 && snaps[0].rev === 1, "kopia dnia z poprzedniego stanu (rev 1)");
    r = await api("PUT", { state: { a: 2 }, baseRev: 2 }); ok(r.status === 200 && D1.raw.prepare("SELECT count(*) n FROM meta WHERE key LIKE 'snap-%'").get().n === 1, "jedna kopia na dzień");
    // Strażnik transakcji: zapis z rev ustalonym przed cudzym zapisem musi się wycofać w całości.
    const { default: w } = await import("../src/worker.js");
    const orig = D1.prepare.bind(D1); let once = true;
    D1.prepare = sql => { if (once && /SELECT rev FROM meta WHERE key='current'/.test(sql)) { once = false; D1.raw.exec("UPDATE meta SET rev=rev+1 WHERE key='current'"); } return orig(sql); };
    const res = await w.fetch(new Request(U + "/api/state", { method: "PUT", body: JSON.stringify({ state: { a: 3 }, baseRev: 3 }) }), env);
    D1.prepare = orig;
    ok(res.status === 409, "równoczesny zapis → 409 (strażnik w batchu)");
    r = await api("GET"); ok(r.body.state.a === 2, "dane po odrzuconym zapisie bez zmian");
    r = await api("POST", {}); ok(r.status === 405, "nieobsługiwana metoda → 405");
  }

  console.log("Ekrany (pusty stan)");
  {
    D1 = fakeD1(); const p = await page();
    for (const v of ["home", "compare", "tree", "cemetery", "notes", "home"]) { await p.click(`nav button[data-v=${v}]`); await p.waitForTimeout(150); }
    ok(p.errors.length === 0, "wszystkie zakładki bez błędów i naruszeń CSP" + (p.errors.length ? ": " + p.errors.join(" | ") : ""));
    await p.context().close();
  }

  console.log("Studia (S) i narodziny (N)");
  {
    D1 = fakeD1(); const p = await page();
    await p.click("[data-act=addFamily]"); await p.fill("#fName", "Testowi"); await p.click("form[data-form=family] .btn.primary");
    await p.click("[data-act=play]"); await p.click('[data-act=setDay][data-v="2"]');
    await p.click('label.check:has-text("Studia") input');
    await p.click('label.check:has-text("Narodziny") input');
    await p.click('[data-act=setDay][data-v="3"]');
    await p.evaluate(() => { const f = S.families[0]; f.tasks.push({ id: "b2", t: "Narodziny bliźniąt", done: false }); render(); });
    await p.click('[data-id="b2"]');
    const days = () => p.evaluate(() => { const f = S.families[0]; return [1, 2, 3].map(r => `${r}:N${getFamilyBirthDays(f, r).join(",")}/S${getFamilyCollegeDays(f, r).join(",")}`).join(" "); });
    ok(await days() === "1:N2,3/S2 2:N/S 3:N/S", "runda 1: N w dniach 2 i 3, S w dniu 2 → " + await days());
    await p.click('[data-id="b2"]');
    ok((await days()).startsWith("1:N2/S2"), "odznaczenie drugich narodzin usuwa tylko ich dzień");
    for (let i = 0; i < 3; i++) await p.evaluate(() => { S.families.forEach(f => f.status = "done"); A.endRound(); });
    ok(await days() === "1:N2/S2 2:N/S 3:N/S", "po 3 rundach S zostaje w rundzie 1 i nie dubluje się w rundzie 2 → " + await days());
    ok(await p.evaluate(() => S.families[0].college === null), "studia zakończone po 2 dniach gry");
    await p.click("nav button[data-v=compare]");
    ok(await p.locator(".cmpSqBtn").count() === 10, "porównanie pokazuje 10 rund");
    await p.locator(".cmpSqBtn").first().click(); await p.waitForTimeout(100);
    ok(await p.locator("#roundSheet").count() === 1, "okno rundy otwarte");
    await p.mouse.click(5, 5); ok(await p.locator("#roundSheet").count() === 0, "kliknięcie w tło zamyka okno rundy");
    ok(p.errors.length === 0, "bez błędów" + (p.errors.length ? ": " + p.errors.join(" | ") : ""));
    await p.context().close();
  }

  console.log("Złośliwe i niepełne dane");
  {
    await setServer({ round: "1<img src=x onerror=window.__x=1>", families: [fam("A", { color: '#fff;"><img src=x onerror=window.__x=2>', status: "zzz", notes: undefined, tasks: undefined })],
      sims: [simO("s1", { fam: "fA", photo: "x');}\"><img src=x onerror=window.__x=3>", age: "<b>x</b>" })] });
    const p = await page();
    for (const v of ["home", "compare", "tree", "cemetery", "notes"]) { await p.click(`nav button[data-v=${v}]`); await p.waitForTimeout(150); }
    await p.evaluate(() => { curFam = S.families[0].id; go("family"); });
    ok(await p.evaluate(() => window.__x) === undefined, "brak wykonania wstrzykniętego kodu");
    ok(await p.evaluate(() => S.round === 1 && S.families[0].status === "todo" && S.sims[0].photo === "" && S.families[0].tasks.length >= 4), "dane oczyszczone (runda, status, zdjęcie, zadania)");
    ok(p.errors.filter(e => !/Failed to load resource/.test(e)).length === 0, "ekrany nie wywracają się na niepełnych danych" + (p.errors.length ? ": " + p.errors.join(" | ") : ""));
    await p.context().close();
  }

  console.log("Synchronizacja i kopie");
  for (const choice of ["accept", "dismiss"]) {
    await setServer({ hood: "Serwer", families: [fam("Wspólna")], sims: [] });
    const p = await page({ dialog: choice });
    await p.context().setOffline(true);
    await p.evaluate(() => { S.families.push(newFamily("Offline", 1)); save(); }); await p.waitForTimeout(600);
    await api("PUT", { state: { hood: "Inny telefon", families: [fam("Z drugiego")], sims: [] }, baseRev: 1 });
    await p.context().setOffline(false); await p.evaluate(() => pull()); await p.waitForTimeout(1500);
    ok(p.dialogs.length === 1, `${choice}: jedno pytanie o konflikt zamiast cichego nadpisania (pytań: ${p.dialogs.length}: ${p.dialogs.map(d=>d.slice(0,50)).join(" || ")})`);
    const names = await p.evaluate(() => S.families.map(f => f.name).join(","));
    const srv = (await api("GET")).body.state.families.map(f => f.name).join(",");
    const bk = await p.evaluate(async () => ((await idbGet("backups")) || []).map(b => b.state.families.map(f => f.name).join(",")));
    if (choice === "accept") {
      ok(names === "Z drugiego", "OK → dane z serwera na telefonie");
      ok(bk.includes("Wspólna,Offline"), "zmiany z telefonu zachowane w kopii");
      await p.click("nav button[data-v=notes]"); await p.waitForTimeout(200);
      const btn = p.locator('[data-act=restoreBackup][data-i="0"]'); await btn.click(); await btn.click(); await p.waitForTimeout(2200);
      ok(await p.evaluate(() => S.families.map(f => f.name).join(",")) === "Wspólna,Offline", "przywrócenie kopii z Notatnika");
      ok((await api("GET")).body.state.families.map(f => f.name).join(",") === "Wspólna,Offline", "przywrócona kopia trafia na serwer");
    } else {
      ok(names === "Wspólna,Offline" && srv === "Wspólna,Offline", "Anuluj → dane z telefonu wysłane na serwer");
      ok(bk.includes("Z drugiego"), "wersja z serwera zachowana w kopii");
    }
    await p.context().close();
  }

  console.log("Synchronizacja — przypadki z przeglądu kodu");
  {
    // Formularz otwarty podczas wczytania nowszych danych zostaje, a zapis nie kasuje pól zmienionych na serwerze.
    await setServer({ families: [], sims: [simO("a", { bio: "stara" })] });
    const p = await page();
    await p.evaluate(() => simSheet(sim("a"))); await p.fill("#sFirst", "Wpisane");
    await api("PUT", { state: { families: [], sims: [simO("a", { bio: "z serwera" }), simO("b")] }, baseRev: 1 });
    await p.evaluate(() => pull()); await p.waitForTimeout(500);
    ok(await p.locator("#sFirst").count() === 1 && await p.inputValue("#sFirst") === "Wpisane", "formularz Sima nie znika przy synchronizacji");
    await p.click("form[data-form=sim] .btn.primary"); await p.waitForTimeout(300);
    ok(await p.evaluate(() => sim("a").first === "Wpisane" && sim("a").bio === "z serwera" && !!sim("b")), "zapis formularza zachowuje dane z serwera");
    ok(await p.evaluate(async () => ((await idbGet("backups")) || []).length) === 0, "zwykłe wczytanie z serwera nie tworzy kopii");
    // Wyczyszczenie offline + zapis z innego urządzenia → pytanie, nie ciche cofnięcie.
    await p.waitForTimeout(1800); await p.context().setOffline(true);
    await p.evaluate(() => { S = { v: 1, hood: "", round: 1, families: [], sims: [], rules: "", lots: [] }; save(); }); await p.waitForTimeout(500);
    const rev = (await api("GET")).body.rev;
    await api("PUT", { state: { families: [fam("Inne")], sims: [] }, baseRev: rev });
    await p.context().setOffline(false); await p.evaluate(() => pull()); await p.waitForTimeout(800);
    ok(p.dialogs.length === 1, "wyczyszczenie offline: pytanie o konflikt zamiast cichego cofnięcia");
    await p.context().close();
  }
  {
    // Pusta nazwa otoczenia zostaje pusta.
    await setServer({ hood: "", families: [], sims: [] });
    const p = await page();
    ok(await p.evaluate(() => S.hood) === "", "pusta nazwa otoczenia nie wraca jako „Miłowo”");
    await p.context().close();
  }

  console.log("Studia trwające z poprzedniej rundy");
  {
    await setServer({ round: 2, families: [fam("A", { college: { active: true, startRound: 1, startDay: 2, days: 2 }, colleges: { 1: [2] }, tasks: [{ id: "c", t: "Studia", done: false }] })], sims: [] });
    const p = await page();
    await p.evaluate(() => { curFam = "fA"; go("family"); });
    await p.click('[data-id="c"]'); await p.click('[data-id="c"]'); await p.waitForTimeout(100);
    ok(await p.evaluate(() => JSON.stringify(S.families[0].college)) === JSON.stringify({ active: true, startRound: 1, startDay: 2, days: 2 }), "zaznaczenie i odznaczenie Studia nie kasuje trwających studiów");
    ok(await p.evaluate(() => getFamilyCollegeDays(S.families[0], 2).length === 0 && getFamilyCollegeDays(S.families[0], 1).join() === "2"), "historia S bez zmian");
    await p.context().close();
  }

  console.log("Service Worker — spójna wersja plików");
  {
    D1 = fakeD1(); const p = await page({ sw: true });
    await p.evaluate(async () => { await navigator.serviceWorker.register("/sw.js"); await navigator.serviceWorker.ready; });
    await p.reload(); await p.waitForTimeout(500);
    ok(await p.evaluate(() => !!navigator.serviceWorker.controller), "Service Worker kontroluje stronę");
    // „Wdrożenie” nowej wersji dwóch plików + słaba sieć dla dokumentu: strona musi wziąć WSZYSTKO ze starego cache.
    OVR["/app-core.js"] = { append: "\nwindow.__core='new';" }; OVR["/app-tree.js"] = { append: "\nwindow.__tree='new';" };
    OVR["/index.html"] = { delay: 5000 };
    await p.reload({ waitUntil: "load" }); await p.waitForTimeout(500);
    const v1 = await p.evaluate(() => [window.__core, window.__tree, typeof S]);
    ok(v1[0] === undefined && v1[1] === undefined && v1[2] === "object", "słaba sieć: cała strona ze starego cache, bez mieszania wersji → " + v1.join(","));
    delete OVR["/index.html"]; await p.waitForTimeout(5000);
    await p.reload(); await p.waitForTimeout(500);
    const v2 = await p.evaluate(() => [window.__core, window.__tree]);
    ok(v2[0] === "new" && v2[1] === "new", "dobra sieć: cała strona w nowej wersji → " + v2.join(","));
    await p.context().setOffline(true); await p.reload(); await p.waitForTimeout(500);
    const v3 = await p.evaluate(() => [window.__core, window.__tree, !!document.querySelector(".ball")]);
    ok(v3[0] === v3[1] && v3[2], "offline: działa i wersja spójna → " + v3.join(","));
    for (const k of Object.keys(OVR)) delete OVR[k];
    ok(p.errors.filter(e => !/Failed to load resource|ERR_INTERNET_DISCONNECTED/.test(e)).length === 0, "bez błędów" + (p.errors.length ? ": " + p.errors.join(" | ") : ""));
    await p.context().close();
  }

  console.log("Relacje");
  {
    await setServer({ families: [], sims: [simO("a", { spouse: "b", gender: "M" }), simO("b", { spouse: "a", gender: "K" }), simO("c", { gender: "K" })] });
    const p = await page();
    await p.evaluate(() => simSheet(sim("a"))); await p.selectOption("#sSpouse", "c"); await p.click("form[data-form=sim] .btn.primary"); await p.waitForTimeout(300);
    const r = await p.evaluate(() => ({ a: sim("a").spouse, c: sim("c").spouse, b: sim("b").spouse, aex: sim("a").ex, bex: sim("b").ex }));
    ok(r.a === "c" && r.c === "a" && r.b === "" && r.aex.includes("b") && r.bex.includes("a"), "zmiana małżonka w formularzu: poprzedni trafia do byłych");
    await p.evaluate(() => { sim("b").spouse = "c"; sim("c").spouse = ""; sim("a").spouse = ""; simSheet(sim("c")); });
    await p.click("form[data-form=sim] .btn.primary"); await p.waitForTimeout(300);
    ok(await p.evaluate(() => sim("b").spouse) === "", "zapis z pustym małżonkiem czyści jednostronne powiązanie");
    await p.context().close();
  }
} finally {
  await browser.close(); server.close();
}
console.log(failed ? `\n${failed} test(y) nie przeszły` : "\nWszystkie testy przeszły");
process.exit(failed ? 1 : 0);
