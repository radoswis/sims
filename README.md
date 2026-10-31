# Rotacja Sims

PWA do rotacyjnej rozgrywki w The Sims 2. Aplikacja jest statyczna i wdrażana przez Cloudflare Workers Static Assets.

## Mapa kodu

- `public/index.html` — szkielet dokumentu i punkty podłączenia zasobów.
- `public/styles.css` — cały CSS aplikacji.
- `public/app-core.js` — model danych, IndexedDB, helpery i stan widoku.
- `public/app-screens.js` — karuzela rodzin, karta rodziny i drzewo genealogiczne.
- `public/app-records.js` — cmentarz i notatnik.
- `public/app-editors.js` — arkusze/formularze edycji rodziny i Sima.
- `public/app-actions.js` — akcje użytkownika, zdarzenia i start aplikacji.
- `public/sw.js` — Service Worker i cache offline; po zmianie zasobów zwiększ wersję cache.
- `public/manifest.webmanifest` — konfiguracja PWA.
- `wrangler.jsonc` — konfiguracja wdrożenia; katalog publikowany to `public/`.

## Dane

Dane użytkownika są przechowywane lokalnie w przeglądarce w IndexedDB (`sims-rotacja`). Aplikacja nie ma backendu ani synchronizacji między urządzeniami. Przed większymi zmianami logiki danych należy zachować kompatybilność formatu eksportu/importu JSON.

## Zasady pracy nad kodem

1. Kod produkcyjny edytuj w `public/`; pliki poza tym katalogiem nie są publikowane przez obecny `wrangler.jsonc`.
2. Zmiany stylów rób w `public/styles.css`, nie w HTML.
3. Logikę zmieniaj w najmniejszym właściwym pliku modułu; nie przenoś funkcji między modułami bez sprawdzenia zależności.
4. Skrypty są klasycznymi skryptami ładowanymi przez `defer` w kolejności z `index.html`; współdzielą globalny zakres leksykalny. Nie dodawaj modułów ES ani powielonych nazw `const/let/class` bez zaplanowanej migracji.
5. Nie zmieniaj nazw pól danych ani klucza IndexedDB bez migracji i testu importu/eksportu.
6. Po zmianie zasobów aktualizuj listę precache i wersję cache w `public/sw.js`, aby aplikacja działała offline.
7. Przed scaleniem sprawdź: start aplikacji, dodawanie/edycję/usuwanie rodziny i Sima, relacje rodzinne, przesuwanie/zoom drzewa, notatnik, eksport/import i działanie offline.
