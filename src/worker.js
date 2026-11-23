// API danych: jeden stan aplikacji w D1, dzielony na części (limit wiersza D1).
// Kopie: raz dziennie snapshot "snap-RRRR-MM-DD", trzymane 30 dni; dodatkowo D1 Time Travel.
// Schemat tabel: migrations/0001_init.sql.
const CHUNK = 900000, KEEP_DAYS = 30, MAX_BODY = 50 * 1024 * 1024;
const json = (o, s = 200) => new Response(JSON.stringify(o), {
  status: s,
  headers: { "content-type": "application/json", "cache-control": "no-store", "x-content-type-options": "nosniff" },
});
// Strażnik w batchu: gdy rev w bazie zmienił się od odczytu, json('rev-conflict:…') rzuca „malformed JSON”
// i cały batch (transakcja) się wycofuje. Gdy rev się zgadza, zapytanie nie zwraca wierszy i nic nie robi.
const GUARD = "SELECT json('rev-conflict:' || rev) FROM meta WHERE key='current' AND rev<>?";

async function read(db, key) {
  const m = await db.prepare("SELECT rev, updated FROM meta WHERE key=?").bind(key).first();
  if (!m) return null;
  const { results } = await db.prepare("SELECT data FROM chunks WHERE key=? ORDER BY part").bind(key).all();
  return { rev: m.rev, updated: m.updated, state: JSON.parse(results.map(r => r.data).join("")) };
}

function writeStatements(db, key, text, baseRev, rev, now) {
  const st = [db.prepare(GUARD).bind(baseRev), db.prepare("DELETE FROM chunks WHERE key=?").bind(key)];
  let parts = 0;
  for (let i = 0; i < text.length; i += CHUNK) st.push(db.prepare("INSERT INTO chunks(key,part,data) VALUES(?,?,?)").bind(key, parts++, text.slice(i, i + CHUNK)));
  st.push(db.prepare("INSERT INTO meta(key,rev,parts,updated) VALUES(?,?,?,?) ON CONFLICT(key) DO UPDATE SET rev=excluded.rev, parts=excluded.parts, updated=excluded.updated").bind(key, rev, parts, now));
  return st;
}

// Kopia dnia powstaje z poprzedniego stanu "current", w tym samym batchu co zapis (nie dubluje się przy równoczesnych zapisach).
function snapshotStatements(db, now) {
  const key = "snap-" + now.slice(0, 10);
  const old = "snap-" + new Date(Date.now() - KEEP_DAYS * 864e5).toISOString().slice(0, 10);
  return [
    db.prepare("INSERT INTO chunks(key,part,data) SELECT ?, part, data FROM chunks WHERE key='current' AND NOT EXISTS (SELECT 1 FROM meta WHERE key=?)").bind(key, key),
    db.prepare("INSERT OR IGNORE INTO meta(key,rev,parts,updated) SELECT ?, rev, parts, updated FROM meta WHERE key='current'").bind(key),
    db.prepare("DELETE FROM chunks WHERE key LIKE 'snap-%' AND key < ?").bind(old),
    db.prepare("DELETE FROM meta WHERE key LIKE 'snap-%' AND key < ?").bind(old),
  ];
}

export default {
  async fetch(req, env) {
    const url = new URL(req.url);
    if (url.pathname !== "/api/state") return json({ error: "Nie znaleziono" }, 404);
    const db = env.DB;
    try {
      if (req.method === "GET") return json((await read(db, "current")) || { rev: 0, state: null });
      if (req.method === "PUT") {
        if (+(req.headers.get("content-length") || 0) > MAX_BODY) return json({ error: "Za duże dane" }, 413);
        const body = await req.json().catch(() => null);
        if (!body || typeof body.state !== "object" || body.state === null || Array.isArray(body.state)) return json({ error: "Brak danych" }, 400);
        const m = await db.prepare("SELECT rev FROM meta WHERE key='current'").first();
        const rev = m ? m.rev : 0;
        if (!body.force && body.baseRev !== rev) return json({ conflict: true, ...(await read(db, "current")) }, 409);
        const now = new Date().toISOString();
        try {
          await db.batch([...snapshotStatements(db, now), ...writeStatements(db, "current", JSON.stringify(body.state), rev, rev + 1, now)]);
        } catch (e) {
          if (/rev-conflict|malformed JSON/i.test(String(e && e.message))) return json({ conflict: true, ...(await read(db, "current")) }, 409);
          throw e;
        }
        return json({ rev: rev + 1, updated: now });
      }
      return json({ error: "Metoda niedozwolona" }, 405);
    } catch (e) {
      console.error("api/state", e);
      return json({ error: "Błąd serwera" }, 500);
    }
  },
};
