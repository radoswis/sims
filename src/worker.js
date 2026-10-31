// API danych: jeden stan aplikacji w D1, dzielony na części (limit wiersza D1).
// Kopie: raz dziennie snapshot "snap-RRRR-MM-DD", trzymane 30 dni; dodatkowo D1 Time Travel.
const CHUNK = 900000, KEEP_DAYS = 30;
const json = (o, s = 200) => new Response(JSON.stringify(o), { status: s, headers: { "content-type": "application/json", "cache-control": "no-store" } });

async function read(db, key) {
  const m = await db.prepare("SELECT rev, updated FROM meta WHERE key=?").bind(key).first();
  if (!m) return null;
  const { results } = await db.prepare("SELECT data FROM chunks WHERE key=? ORDER BY part").bind(key).all();
  return { rev: m.rev, updated: m.updated, state: JSON.parse(results.map(r => r.data).join("")) };
}

async function write(db, key, text, rev, now) {
  const st = [db.prepare("DELETE FROM chunks WHERE key=?").bind(key)];
  let parts = 0;
  for (let i = 0; i < text.length; i += CHUNK) st.push(db.prepare("INSERT INTO chunks(key,part,data) VALUES(?,?,?)").bind(key, parts++, text.slice(i, i + CHUNK)));
  st.push(db.prepare("INSERT INTO meta(key,rev,parts,updated) VALUES(?,?,?,?) ON CONFLICT(key) DO UPDATE SET rev=excluded.rev, parts=excluded.parts, updated=excluded.updated").bind(key, rev, parts, now));
  await db.batch(st);
}

async function snapshot(db, now) {
  const key = "snap-" + now.slice(0, 10);
  if (await db.prepare("SELECT 1 FROM meta WHERE key=?").bind(key).first()) return;
  const cur = await db.prepare("SELECT rev, parts, updated FROM meta WHERE key='current'").first();
  if (!cur) return;
  const old = "snap-" + new Date(Date.now() - KEEP_DAYS * 864e5).toISOString().slice(0, 10);
  await db.batch([
    db.prepare("INSERT INTO chunks(key,part,data) SELECT ?, part, data FROM chunks WHERE key='current'").bind(key),
    db.prepare("INSERT INTO meta(key,rev,parts,updated) VALUES(?,?,?,?)").bind(key, cur.rev, cur.parts, cur.updated),
    db.prepare("DELETE FROM chunks WHERE key LIKE 'snap-%' AND key < ?").bind(old),
    db.prepare("DELETE FROM meta WHERE key LIKE 'snap-%' AND key < ?").bind(old),
  ]);
}

export default {
  async fetch(req, env) {
    const url = new URL(req.url);
    if (url.pathname !== "/api/state") return env.ASSETS.fetch(req);
    const db = env.DB;
    try {
      if (req.method === "GET") return json((await read(db, "current")) || { rev: 0, state: null });
      if (req.method === "PUT") {
        const body = await req.json();
        if (!body || typeof body.state !== "object" || body.state === null) return json({ error: "Brak danych" }, 400);
        const m = await db.prepare("SELECT rev FROM meta WHERE key='current'").first();
        const rev = m ? m.rev : 0;
        if (!body.force && body.baseRev !== rev) return json({ conflict: true, ...(await read(db, "current")) }, 409);
        const now = new Date().toISOString();
        await snapshot(db, now);
        await write(db, "current", JSON.stringify(body.state), rev + 1, now);
        return json({ rev: rev + 1, updated: now });
      }
      return json({ error: "Metoda niedozwolona" }, 405);
    } catch (e) {
      return json({ error: String(e && e.message || e) }, 500);
    }
  },
};
