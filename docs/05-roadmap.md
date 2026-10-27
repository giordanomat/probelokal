# 05 · Roadmap

Jeder Meilenstein endet mit einer Abnahme durch Matthias. Was »fertig« heisst, steht bei den Abnahmekriterien. Reihenfolge nicht ändern, ohne dieses Dokument nachzuziehen.

## M0 · Aufsetzen  ✓ abgenommen 25.10.2026

- SvelteKit-Projekt (TypeScript, ESLint, Prettier), Vitest, Playwright, GitHub Actions (Typprüfung, Lint, Tests bei jedem Push).
- Cloudflare-Projekt mit Vorschau pro Branch; `probelokal.giordanomat.de` als Custom Domain (DNS-Zone liegt bei Cloudflare, nicht bei IONOS – geprüft 25.10.2026).
- Supabase-Projekt in Zürich anlegen (noch ohne Daten), Umgebungsvariablen dokumentiert in `.env.example`.
- Befehle in `CLAUDE.md` eintragen.

**Stand 25.10.2026:** Gerüst läuft als Cloudflare-Worker unter https://probelokal.giordanomat.workers.dev (Deploy automatisch bei Push auf `main`). Live geprüft in Chromium (Handy-Grösse): Kopf, Dunkel/Hell, Manifest, Symbole, Service Worker aktiv, lädt offline. Custom Domain https://probelokal.giordanomat.de eingerichtet, HTTPS gültig (geprüft in Chrome auf Matthias' Mac), gleiche Live-Prüfung bestanden. CI auf GitHub grün bis `main` de5178c (Lauf 13). **Abgenommen 25.10.2026:** Matthias hat die App auf iPhone und iPad in Safari geöffnet und zum Home-Bildschirm hinzugefügt. Offen geblieben: Vorschau pro Branch ist bei Workers Builds noch nicht eingeschaltet (nur `main` wird gebaut).

**Abnahme:** Leere Seite mit giordanomat-PROBELOKAL-Kopf läuft per HTTPS auf iPhone und iPad unter der Subdomain und lässt sich zum Home-Bildschirm hinzufügen.

**Braucht von Matthias:** Cloudflare-Konto, Supabase-Konto, Zugang zur DNS-Zone giordanomat.de in Cloudflare.

## M1 · Üben ohne Konto, ein Titel, Mikrofon-Test  ← in Arbeit

- `tools/extract_notes.py` und `tools/make_mixes.sh` für Bad Touch laufen lassen; Audio und Noten-JSON in Supabase Storage, **hinter einem Testzugang** (Entscheid Matthias, 26.10.2026; siehe docs/02-architektur.md).
- Bahn, Griff-Anzeige, Hilfen-Stufen, Notenansicht, Mitspielen, Echo, Rhythmus tippen, Tempo, Schleife, Baustellen – aus `prototype/v7` portiert, mit Tests.
- Mithören als AudioWorklet; Latenz-Abgleich pro Gerät; Vorführung mit eigener Spur.
- Dunkel/Hell, Vollbild, Offline-Cache für diesen einen Titel.

**Stand 25.10.2026:** Reine Logik portiert und getestet (Noten, Griffe, Takt/Zeit, YIN, Bewertung, Coach-Texte, Rhythmus tippen, Tempoleiter, Baustellen, Echo-Ablauf). Bahn mit Griffspur, Hilfen-Stufen, Notenlinien/-namen, Abstand und Griff-Anzeige unter `/ueben` – noch ohne Ton, eine eigene Uhr treibt die Bahn. Noten-JSON vorerst eingecheckt (`src/lib/titles/bad-touch.notes.json`). Offen: Audio (Mischungen aus den Einzelspuren, Storage), Mitspielen/Echo/Rhythmus in der Oberfläche, Mithören als AudioWorklet mit Latenz-Abgleich, Notenansicht, Vollbild, Offline-Cache, Baustellen-Liste.

**Stand 27.10.2026 (Übergabe an den nächsten Chat):**

- **Wo der Code liegt:** Branch `claude/ecstatic-rubin-6t8xzh`, PR https://github.com/giordanomat/probelokal/pull/1. CI ist grün, es gibt keinen Konflikt mit `main`. Matthias muss ihn noch mergen. Bis dahin auf diesem Branch weiterarbeiten oder von ihm abzweigen. Erst nach dem Merge ist er live, weil nur `main` deployt wird.
- **Fertig und getestet:**
  - Logik: `src/lib/music/`, `src/lib/pitch/`, `src/lib/practice/`.
  - Bahn: `src/lib/lane/` und `/ueben`.
  - Testzugang: `/zugang` und `/audio/<slug>/<fassung>/<datei>`, siehe docs/02.
  - Umleitung auf die Hauptadresse: `canonicalRedirect`. Noch aus, weil `CANONICAL_HOST` nicht gesetzt ist.
  - Versatz der Einzelspuren: genau 3 Takte, siehe docs/04.
- **Eingerichtet von Matthias:** privater Bucket `titles` in Supabase, Cloudflare-Secrets `SUPABASE_SECRET_KEY` und `TEST_ACCESS_CODE`.
- **Audio:**
  - Die 13 Mischungen sind erzeugt (`tools/make_mixes.sh`, Spitzen −0,5 bis −1,0 dB): `all.mp3`, `minus_<stimme>.mp3` und `<stimme>.mp3` für `trp1 trp2 pos1 pos2 euph sous`.
  - Matthias hat sie bekommen. Der Upload nach `titles/bad-touch-2-0/schuegu27/` ist **noch nicht bestätigt**.
  - Die Einzelspuren (WAV) liegen in Google Drive, Ordner »arrangements«. Sie liegen nicht im Repository und nicht im Storage. Wer die Mischungen neu erzeugen muss, holt sie dort.
- **Offen, in dieser Reihenfolge:**
  1. Nach dem Upload `/audio/…` live prüfen: Code unter `/zugang` eingeben, dann `/audio/bad-touch-2-0/schuegu27/all.mp3` aufrufen. Erwartet wird eine 302-Weiterleitung auf eine signierte Supabase-Adresse. Fehlt die Datei, kommt 404 »Aufnahme fehlt noch«. Das Signieren gegen das echte Projekt ist bisher **ungeprüft**. Danach `/ueben` mit Ton prüfen (siehe Punkt 2). Geht erst nach dem Merge, weil nur `main` deployt wird.
  2. ~~**Ton in `/ueben`**~~ erledigt am 27.10.2026, siehe docs/02 »Audio«:
     - `src/lib/audio/` mit `StemPlayer` (Band als Uhr der Bahn, eigene Stimme über einen `GainNode`, Nachführen ab 50 ms, Tempo mit `preservesPitch`) und `probeAudio` (Vorabprüfung).
     - Lautstärke »Meine Stimme« (Aus/Leise/Laut). Hinweise bei 401 (mit Weg zu `/zugang`), 404 und 502/503. Bei jedem Fehler läuft die Bahn mit `FreeClock` weiter.
     - Getestet mit Vitest (nachgebaute Elemente) und Playwright: synthetisches WAV über eine abgefangene Route mit Range-Antworten.
     - **Ungeprüft:** gegen das echte Supabase-Projekt. Ob CORS und Range-Anfragen nach der Weiterleitung klappen, zeigt Punkt 1. Dazu in `/ueben` abspielen, hören und springen. Ebenfalls ungeprüft: Gleichlauf auf iPhone/iPad.
  3. Mitspielen, Echo und Rhythmus tippen in der Oberfläche. Die Logik dazu ist fertig: `practice/rhythm.ts`, `echo.ts`, `pass.ts`, `baustellen.ts`.
  4. **Mithören:**
     - `pitch/yin.ts` in einem AudioWorklet laufen lassen.
     - `getUserMedia` mit `echoCancellation`, `noiseSuppression` und `autoGainControl` aus.
     - Latenz-Abgleich pro Gerät, Bewertung mit `classify.ts`.
  5. Notenansicht, Vollbild, Baustellen-Liste.
  6. **Offline-Cache für Bad Touch.** Ungeprüft und offen: `/audio/` leitet auf wechselnde signierte Adressen weiter. Der Service Worker müsste deshalb unter dem `/audio/`-Pfad speichern, nicht unter der signierten Adresse. Auf iOS im Flugmodus prüfen.
  7. Testprotokoll für die Abnahme in `docs/testprotokolle/`.
- **Nebenbei offen:**
  - Sousaphon-Griffe in Takt 84 und 89 in Logic auf `0` nachtragen. In `prototype/v7/badtouch.xml` ist das schon korrigiert.
  - probelokal.ch einrichten (läuft in einem anderen Chat). Danach `CANONICAL_HOST` setzen, siehe docs/02.
  - Cloudflare-Builds für Branches schlagen fehl. Die Ursache ist ungeprüft; die Logs gibt es nur im Cloudflare-Dashboard.

**Abnahme (Testprotokoll in `docs/testprotokolle/`):**
- iPhone und iPad, Safari: Bahn läuft flüssig; Band und eigene Spur bleiben über das ganze Stück innerhalb 50 ms.
- Mikrofon-Freigabe klappt; Matthias spielt mit Trompete und Kopfhörern Lange Töne und Teil A bei 80 %: Treffer-Anteil bei sauberem Spiel ≥ 90 % (Lange Töne) bzw. ≥ 80 % (Teil A). Absichtlich falsche Griffe und Naturtöne werden erkannt. Zahlen sind Startwerte, nach dem ersten Test anpassen.
- Dieselbe Prüfung mit Posaune und Sousaphon, sobald jemand verfügbar ist.
- Flugmodus: Titel bleibt nach einmaligem Laden spielbar.

**Entscheidung nach M1:** Reicht der Browser auf iOS (Audio-Gleichlauf, Mikrofon, Latenz)? Wenn nein → native Hülle vorziehen (M7).

## M2 · Konten, Guugge, Pläne, Etappen, Punkte

- Auth per E-Mail-Link, Guugge anlegen, Einladung per Link mit Rolle, Stimme wählen.
- Hinweise der Leitung (inkl. Realtime), Gesamtplan, Mein Plan, Etappenprüfungen 1–5.
- Edge Functions `exam-result` und `pass-result`: Plausibilitätsprüfung, Punkte, Übetage; Tageslimits.
- Ränge und Belohnungen (Anzeige), Rangliste mit Opt-in, Register-Übersicht über Aggregatfunktion.

**Abnahme:**
- Automatische RLS-Tests: Mitglied sieht keine Etappen, Punkte oder Übetage anderer; Leitung sieht nur Aggregate und erst ab 3 Personen pro Register; Rangliste zeigt nur Opt-in.
- Ein Client kann Punkte nicht direkt schreiben.

## Pilot · 3–5 Leute aus der Schuegu

Zwei bis drei Wochen mit einem echten Gesamtplan. Fragen: Nutzen sie Echo/Etappen? Stimmt die Planaufteilung? Ziehen Ränge und Rangliste – oder stören sie? Ergebnisse in `docs/pilot.md`, Entscheidungen in `docs/01-produkt.md` nachziehen.

## M3 · giordanomat-Dirigent

- Übungsbibliothek als Daten (von Matthias abgenommen), echte Vorspiel-Aufnahmen pro Instrument statt Synthese.
- Edge Function `dirigent-ask` mit Anthropic API, Kostenlimit pro Guugge und Tag, kurze Antworten, Schweizer Rechtschreibung.

## M4 · Leitgerät und Offline für mehrere Titel

- Leitgerät über Supabase Realtime (Stück, Teil, Tempo, Schleife, Start/Stopp); Toleranz für Netzverzögerung im Raum messen.
- Offline-Verwaltung: Titel herunterladen/entfernen, Speicherbedarf anzeigen.

## M5 · Shop

- `arrangements.giordanomat.de`: Katalog, Hörproben, Kauf über Stripe Checkout (CHF, TWINT), Lizenz pro Guugge.
- Bis dahin: vorläufige Landingpage (live unter https://arrangements.giordanomat.de seit 25.10.2026) aus einem separaten claude.ai-Chat, als fertige HTML-Datei in `src/lib/sites/arrangements.html`, ausgeliefert über `src/hooks.server.ts` für den Hostnamen `arrangements.*`. Quelle (`index.src.html`, `build.py`) fehlt im Repository. Offen vor dem Bekanntmachen: gelb markierte Lücken im Impressum und in der Datenschutzerklärung; Anmeldeformular speichert seit 25.10.2026 in Supabase (`public.signups` über Funktion `public.signup`, Migration `supabase/migrations/20261025140000_signups.sql`); ansehen im Supabase-Dashboard → Table Editor. **Double-Opt-in fehlt: niemanden anschreiben, bevor es gebaut ist** (`confirmed_at` bleibt leer).
- Rechnungen, Impressum, AGB, Datenschutz (Inhalte von Matthias).

## M6 · Produktionsstrecke und weitere Titel

- Skripte aus `tools/` zu einem Ablauf verbinden: MusicXML + Einzelspuren rein → Noten-JSON, Mischungen, Qualitätsprüfung (`detect_eval.py` ≥ 95 % pro Stimme), Upload, Titel-Datensatz.
- Die zehn Titel mit Shop-Reife A aus dem Katalog (Google Sheet »Arrangement-Katalog«).

## M7 · Native Hülle (nur wenn nötig)

Die Web-App in eine native Hülle für iOS/iPadOS packen (z. B. Capacitor), wenn M1 oder der Pilot es verlangen (Audio-Gleichlauf, Mikrofon, Hintergrundwiedergabe, Wunsch nach App-Store-Präsenz). **Vorher prüfen:** aktuelle App-Store-Regeln zum Verkauf digitaler Inhalte und Abos in der Schweiz.
