# Rotacja Sims

PWA do rotacyjnej rozgrywki w The Sims 2. Aplikacja jest statyczna i wdrażana przez Cloudflare Workers Static Assets.

## Mapa kodu

- `public/index.html` — szkielet dokumentu i punkty podłączenia zasobów.
- `public/styles.css` — cały CSS aplikacji.
- `public/app-core.js` — model danych, IndexedDB, helpery i stan widoku.
- `public/app-screens.js` — karuzela rodzin i karta rodziny.
- `public/app-compare.js` — Porównanie rund (tabela po 10 rund, kwadraty dni, znaczniki N i S, okno szczegółów rundy).
- `public/app-kinship.js` — kalkulator pokrewieństwa w panelu drzewa.
- `public/app-tree.js` — drzewo genealogiczne w stylu FamilyEcho (układ, panel osoby, opcje, import FamilyScript/HTML z FamilyEcho).
- `public/app-records.js` — cmentarz i notatnik.
- `public/app-editors.js` — arkusze/formularze edycji rodziny i Sima.
- `public/app-actions.js` — akcje użytkownika, zdarzenia i start aplikacji.
- `public/sw.js` — Service Worker i cache offline; po zmianie zasobów zwiększ wersję cache. Cache jest aktualizowany tylko w całości (nigdy pojedyncze pliki), a każda strona bierze wszystkie pliki z jednego źródła: z sieci albo — przy słabym zasięgu (limit 3,5 s) lub offline — z cache. Dzięki temu nie miesza się kodu dwóch wersji.
- `public/manifest.webmanifest` — konfiguracja PWA.
- `public/_headers` — nagłówki bezpieczeństwa (CSP: tylko własne skrypty, bez skryptów inline) dla plików statycznych.
- `src/worker.js` — API danych `/api/state` (D1).
- `migrations/0001_init.sql` — schemat bazy D1 (`meta`, `chunks`).
- `tests/smoke.mjs` — test aplikacji w przeglądarce z atrapą API.
- `wrangler.jsonc` — konfiguracja wdrożenia; katalog publikowany to `public/`.

## Wdrażanie

Automatycznie przez GitHub Actions (`.github/workflows/deploy.yml`): przy każdym pull requeście uruchamiają się testy, a po scaleniu do `main` — testy i, jeśli przejdą, `wrangler deploy`. Wymaga sekretów repozytorium `CLOUDFLARE_API_TOKEN` i `CLOUDFLARE_ACCOUNT_ID`. Ręcznie: zakładka Actions → „Testy i wdrożenie” → Run workflow (na `main`) albo `npx wrangler deploy`.

## Dane

Dane są trzymane na serwerze: Worker `src/worker.js` (`GET/PUT /api/state`) zapisuje cały stan w Cloudflare D1 `sims-dane` (dzielony na części ~900 KB). Raz dziennie powstaje kopia `snap-RRRR-MM-DD` (trzymane 30 dni), dodatkowo działa D1 Time Travel. Przeglądarka trzyma kopię roboczą w IndexedDB (`sims-rotacja`), działa offline i wysyła zmiany po powrocie sieci; zapis na serwerze jest atomowy i odrzucany (409), gdy `rev` zmienił się w międzyczasie. Gdy serwer ma nowsze dane, a telefon niewysłane zmiany, aplikacja pyta, którą wersję zachować — nic nie jest nadpisywane po cichu. Przed każdym nadpisaniem danych na telefonie (wczytanie z serwera, import, czyszczenie, przywrócenie) powstaje kopia w IndexedDB `backups` (8 ostatnich), do pobrania lub przywrócenia w Notatniku.

Wszystkie dane (z serwera, z pliku kopii, z importu) przechodzą przez `sanitizeS()` w `app-core.js` (wywoływane w `migrateS()`): wymuszone typy, kolory `#rrggbb`, zdjęcia tylko `data:image/...;base64`, identyfikatory alfanumeryczne. Nowe pola danych dopisz także tam.

Historia zdarzeń rodziny: `births[runda]` i `colleges[runda]` to listy dni (1–4) z narodzinami i pójściem na studia; `college` to trwający tok studiów (`startRound`, `startDay`, `days` 1–2).

**Uwaga:** API nie ma jeszcze autoryzacji — każdy, kto zna adres, może odczytać i nadpisać dane. Docelowo: Cloudflare Access albo token. Przed większymi zmianami logiki danych należy zachować kompatybilność formatu eksportu/importu JSON.

## Relacje w danych Sima

`parents` [matka, ojciec], `ptype` ("a" = adopcja), `spouse` (obecny partner), `ex` (byli partnerzy, dwustronnie), `bio`.

## Zasady pracy nad kodem

1. Kod produkcyjny edytuj w `public/`; pliki poza tym katalogiem nie są publikowane przez obecny `wrangler.jsonc`.
2. Zmiany stylów rób w `public/styles.css`, nie w HTML.
3. Logikę zmieniaj w najmniejszym właściwym pliku modułu; nie przenoś funkcji między modułami bez sprawdzenia zależności.
4. Skrypty są klasycznymi skryptami ładowanymi przez `defer` w kolejności z `index.html`; współdzielą globalny zakres leksykalny. Nie dodawaj modułów ES ani powielonych nazw `const/let/class` bez zaplanowanej migracji.
5. Nie zmieniaj nazw pól danych ani klucza IndexedDB bez migracji i testu importu/eksportu.
6. Po zmianie zasobów aktualizuj listę precache i wersję cache w `public/sw.js`, aby aplikacja działała offline.
7. Uruchom `node --no-warnings tests/smoke.mjs` (wymaga Playwright i Chromium). Przed scaleniem sprawdź też ręcznie: start aplikacji, dodawanie/edycję/usuwanie rodziny i Sima, relacje rodzinne, przesuwanie/zoom drzewa, notatnik, eksport/import i działanie offline.
