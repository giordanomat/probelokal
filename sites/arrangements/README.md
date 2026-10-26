# Landingpage arrangements.giordanomat.de (vorläufig, bis zum Shop in M5)

Eine einzige HTML-Datei ohne fremde Ressourcen: Schriften (Figtree, IBM Plex Mono) als base64 eingebettet, 3D-Aufstellung der Guugge mit three.js als Bundle inline, Fallback-Grafik ohne WebGL.

- `index.src.html` – Seite mit Platzhaltern `{{FIG400}}`, `{{FIG700}}`, `{{PLEX500}}`, `{{ORCH}}`, `{{FALLBACK}}`
- `scene/main.js` – 3D-Szene (Instrumente, Aufstellung, Kamera, Animation); `scene/entry.js` startet sie
- `fallback.svg.txt` – Aufstellung als SVG für Geräte ohne WebGL
- `build.py` – setzt alles zusammen und schreibt `../../src/lib/sites/arrangements.html`

Bauen: `npm ci && npm run build` (braucht Node und Python 3). Das Ergebnis wird mit eingecheckt, weil der Worker es direkt ausliefert.

Anmeldeformular: ruft `rpc/signup` auf (Funktion `public.signup`, Migration `supabase/migrations/20261025140000_signups.sql`). Ist `SUPABASE_URL` in `index.src.html` leer, öffnet es stattdessen nur eine vorbereitete Mail.

Änderungen immer in `index.src.html` oder `scene/` machen und neu bauen, nie direkt in `src/lib/sites/arrangements.html`. Stand 26.10.2026: ein Neubau ergibt Byte für Byte die ausgelieferte Datei.
