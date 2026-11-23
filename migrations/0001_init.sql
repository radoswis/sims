-- Schemat bazy D1 "sims-dane" (zgodny z produkcją).
-- Utworzenie nowej bazy: npx wrangler d1 migrations apply sims-dane --remote
CREATE TABLE IF NOT EXISTS meta (key TEXT PRIMARY KEY, rev INTEGER NOT NULL, parts INTEGER NOT NULL, updated TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS chunks (key TEXT NOT NULL, part INTEGER NOT NULL, data TEXT NOT NULL, PRIMARY KEY (key, part));
