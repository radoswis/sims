# Rotacja Sims

PWA do rotacyjnej rozgrywki w The Sims 2. Aplikacja jest statyczna i wdrażana przez Cloudflare Workers Static Assets.

## Mapa kodu

- `public/index.html` — szkielet dokumentu i punkty podłączenia zasobów.
- `public/styles.css` — cały CSS aplikacji.
- `public/app.js` — logika aplikacji (stan, widoki, drzewo rodzinne, formularze i akcje).
- `public/sw.js` — Service Worker i cache offline; po zmianie zasobów zwiększ wersję cache.
- `public/manifest.webmanifest` — konfiguracja PWA.
- `wrangler.jsonc` — konfiguracja wdrożenia; katalog publikowany to `public/`.

## Dane

Dane użytkownika są przechowywane lokalnie w przeglądarce w IndexedDB (`sims-rotacja`). Aplikacja nie ma backendu ani synchronizacji między urządzeniami. Przed większymi zmianami logiki danych należy zachować kompatybilność formatu eksportu/importu JSON.

## Zasady pracy nad kodem

1. Kod produkcyjny edytuj w `public/`; pliki poza tym katalogiem nie są publikowane przez obecny `wrangler.jsonc`.
2. Zmiany stylów rób w `public/styles.css`, nie w HTML.
3. Zmiany logiki rób w `public/app.js`, nie w HTML.
4. Nie zmieniaj nazw pól danych ani klucza IndexedDB bez migracji i testu importu/eksportu.
5. Po zmianie zasobów aktualizuj wersję cache w `public/sw.js`, aby urządzenia nie trzymały starej wersji.
6. Przed scaleniem sprawdź: start aplikacji, dodawanie/edycję/usuwanie rodziny i Sima, relacje rodzinne, przesuwanie/zoom drzewa, notatnik, eksport/import i działanie offline.
