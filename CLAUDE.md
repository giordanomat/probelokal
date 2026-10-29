# giordanomat PROBELOKAL – Projektgedächtnis für Claude Code

Übe-Dienst für Guuggenmusigen und Hobby-Brass: Ein gekauftes Arrangement wird pro Stimme geübt (Notenbahn mit Griffspur, Mitspielen zur Band, Mithören per Mikrofon, Etappenprüfungen) und gemeinsam als Guugge geplant (Gesamtplan der Leitung, eigener Plan pro Person, Hinweise der Leitung, freiwillige Rangliste). Teil der Marke giordanomat ARRANGEMENTS (Shop) – Inhaber: Matthias Giordano.

Zuerst lesen, in dieser Reihenfolge:
1. `docs/01-produkt.md` – was gebaut wird und welche Entscheidungen feststehen
2. `docs/02-architektur.md` – Technik, Hosting, Audio, Sicherheit
3. `docs/03-datenmodell.md` und `supabase/migrations/0001_grundmodell.sql` (Entwurf)
4. `docs/04-erkenntnisse-prototyp.md` – gemessene Werte, Fallstricke
5. `docs/05-roadmap.md` – Meilensteine mit Abnahmekriterien; dort steht, was als Nächstes dran ist
6. `docs/06-produktionsstrecke.md` – wie aus MusicXML und Einzelspuren ein übbarer Titel wird

`prototype/v7/` ist der Klick-Prototyp aus claude.ai (eine HTML-Datei). Er ist Referenz für Verhalten, Texte und Algorithmen, kein Code zum Weiterbauen. Algorithmen daraus portieren und mit Tests absichern.

## Arbeitsregeln

- **Nichts Ungeprüftes behaupten.** Was nicht gemessen oder getestet ist, im Code-Kommentar, im Commit oder in der Antwort als ungeprüft benennen und sagen, wie es zu prüfen wäre. Unangenehme Punkte zuerst nennen.
- **Ordnung:** Eine Sache an genau einem Ort. Wenn sich eine Entscheidung ändert, das betroffene Dokument in `docs/` im selben Commit nachziehen.
- **Sprache:** Bezeichner im Code englisch. Kommentare und Dokumentation deutsch. Oberflächentexte deutsch in **Schweizer Rechtschreibung** (ss statt ß), per Du, kurz und freundlich. Anführungszeichen immer als Guillemets »…«.
- **Begriffe:** »Leitung« = musikalische Leitung der Guugge (Mensch). »giordanomat-Dirigent« = KI-Übebegleiter von giordanomat. Nie verwechseln. »Probelokal« nicht »Übungsraum«.
- **Datenschutz-Grundsatz »keine Vollüberwachung«:** Die Leitung sieht von Mitgliedern nur Register-Durchschnitte und »hat diese Woche geübt«, nie Einzelwerte. Einzelwerte erscheinen nur in der Rangliste und nur für Personen, die selbst mitmachen (Standard: aus). Das gilt für Oberfläche, API und Datenbankregeln.
- **Keine Audiodateien ins Repository.** MP3/WAV liegen im Storage (siehe `docs/06-produktionsstrecke.md`). `.gitignore` deckt das ab.
- **Tests vor Funktionen:** Reine Logik (Notenparser, Bewertung, Planerzeugung, Quiz, Punkte) mit Vitest; Abläufe mit Playwright inkl. synthetischer Audio-Tests wie im Prototyp.

## Gestaltung (giordanomat ARRANGEMENTS / PROBELOKAL)

- Zeichen: drei versetzte runde Balken Gelb `#F5C242`, Rot `#E0473C`, Blau `#6EACDA` auf schwarzer Scheibe `#141619`.
- Schriften: Figtree (Text, »giordanomat« klein und fett), IBM Plex Mono (Bereichsname in Versalien, Spationierung 0.42em, Labels).
- Farben: Tinte `#141619`, Papier `#F2EFE9`, Akzent Text auf hell `#8A6008`, Grün für »getroffen« `#2E9E63` (dunkel `#3DB874`).
- **Darstellung dunkel ist Standard**, pro Gerät auf hell umschaltbar.
- Bahn: Töne als abgerundete Balken (wie die Balken im Zeichen), aktueller Ton blau, Bewertung grün/gelb/rot, verpasst = nur Umriss.

## Befehle

Stand M0 (SvelteKit 3, Svelte 5, Vite 8, Cloudflare Workers mit statischen Assets). Node 22 (`.nvmrc`, gilt auch für den Cloudflare-Build).

- `npm ci` – Abhängigkeiten aus dem Lockfile (immer so, nicht `npm install`)
- Pakete hinzufügen: `npx -y npm@11 install <paket>` – npm 10.9 bricht bei `npm install` mit »Cannot read properties of null (reading 'edgesOut')« ab. npm 11 fragt nach Freigabe für Install-Skripte (`allowScripts` in `package.json`).
- `npm run dev` – Entwicklung auf http://localhost:5173
- `npm run lint` – Prettier und ESLint; `npm run format` formatiert
- `npm run check` – Typprüfung (erzeugt vorher `worker-configuration.d.ts` mit `wrangler types`; die Datei ist nicht eingecheckt)
- `npm run test:unit -- --run` – Vitest (`src/**/*.spec.ts`); braucht `python3`: ein Test prüft, dass `src/lib/titles/bad-touch.notes.json` der Ausgabe von `tools/extract_notes.py` entspricht
- `npm run notes` – Noten-JSON von Bad Touch aus `prototype/v7/badtouch.xml` neu erzeugen (nach jeder Änderung an der MusicXML)
- `npm run test:e2e` – Playwright (`e2e/`), baut und startet die lokale Worker-Vorschau (`wrangler dev`) auf Port 4173. Playwright ist auf die hier vorinstallierte Version gepinnt; in CI installiert der Ablauf Chromium selbst. Chromium bekommt ein künstliches Mikrofon (WAV aus `e2e/global-setup.ts`, Flags in `playwright.config.ts`). Anfragen an Supabase beantwortet in den Abläufen `e2e/fake-supabase.ts` (Auth nachgebaut, Datenbank-Funktionen in PGlite mit allen Migrationen, Realtime für Hinweise); kein Test berührt das echte Projekt.
- `npm run build` – Build für Cloudflare nach `.svelte-kit/cloudflare` (Worker `_worker.js` + Assets)
- `npm run icons` – App-Symbole aus dem Zeichen neu erzeugen (`tools/make_icons.mjs`)
- Deploy: automatisch durch Cloudflare Workers Builds bei jedem Push auf `main` (Build `npm run build`, Deploy `npx wrangler deploy`). Kein Deploy aus CI. Prüfen ohne Hochladen: `npx wrangler deploy --dry-run`.
- Supabase-Migrationen: neue Datei `supabase/migrations/<JJJJMMTThhmmss>_<name>.sql`, nie eine angewendete ändern. Regeln testen in `supabase/tests/rls.spec.ts` (PGlite, läuft mit `npm run test:unit`). Anwenden nur über den Ablauf »Supabase-Migrationen« in GitHub Actions (von Hand gestartet, Schritte in `docs/03-datenmodell.md` »Anwenden«), nicht über den Claude-Connector.

SvelteKit-3-Eigenheiten: Alias `#lib/…` statt `$lib`, immer mit Dateiendung (`#lib/music/timing.ts`, sonst findet TypeScript das Modul nicht); Umgebungsvariablen in `src/env.ts` definieren und über `$app/env/public` lesen; Service Worker in `src/service-worker/` mit eigenem `tsconfig.json`.

## Werkzeuge in `tools/`

- `extract_notes.py` – MusicXML → Noten-JSON pro Stimme (Takt/Schlag, Dauer, Tonhöhe notiert, Griff aus Liedtext)
- `measure_offset.py` – Versatz Einzelspuren ↔ Tutti per Kreuzkorrelation
- `make_mixes.sh` – Minus-One-Mischungen pro Stimme und Gesamtmischung
- `detect_eval.py` – prüft die Tonerkennung gegen die erwarteten Noten (Qualitätsprüfung pro Titel)
- `rangeserver.js` – kleiner Server mit HTTP-Range für lokale Audio-Tests
- `make_icons.mjs` – App-Symbole (Home-Bildschirm, Favicon) aus dem giordanomat-Zeichen
