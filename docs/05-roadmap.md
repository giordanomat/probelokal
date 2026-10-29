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
- Bahn, Griff-Anzeige, Hilfen-Stufen, Notenansicht, Mitspielen, Echo, Rhythmus tippen, Tempo, Schleife, Baustellen, Einblasen (für »Lange Töne« in der Abnahme) – aus `prototype/v7` portiert, mit Tests.
- Mithören als AudioWorklet; Latenz-Abgleich pro Gerät; Vorführung mit eigener Spur.
- Dunkel/Hell, Vollbild, Offline-Cache für diesen einen Titel.

**Stand 25.10.2026:** Reine Logik portiert und getestet (Noten, Griffe, Takt/Zeit, YIN, Bewertung, Coach-Texte, Rhythmus tippen, Tempoleiter, Baustellen, Echo-Ablauf). Bahn mit Griffspur, Hilfen-Stufen, Notenlinien/-namen, Abstand und Griff-Anzeige unter `/ueben` – noch ohne Ton, eine eigene Uhr treibt die Bahn. Noten-JSON vorerst eingecheckt (`src/lib/titles/bad-touch.notes.json`). Offen: Audio (Mischungen aus den Einzelspuren, Storage), Mitspielen/Echo/Rhythmus in der Oberfläche, Mithören als AudioWorklet mit Latenz-Abgleich, Notenansicht, Vollbild, Offline-Cache, Baustellen-Liste.

**Stand 27.10.2026 (Übergabe an den nächsten Chat):**

- **Wo der Code liegt:** PR https://github.com/giordanomat/probelokal/pull/1 ist am 28.10.2026 gemergt. Weiter auf dem Branch `claude/dreamy-franklin-mle6hm` (neuer PR). Live ist nur, was auf `main` liegt.
- **Fertig und getestet:**
  - Logik: `src/lib/music/`, `src/lib/pitch/`, `src/lib/practice/`.
  - Bahn: `src/lib/lane/` und `/ueben`.
  - Testzugang: `/zugang` und `/audio/<slug>/<fassung>/<datei>`, siehe docs/02.
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
  3. ~~Mitspielen, Echo und Rhythmus tippen in der Oberfläche~~ erledigt am 27.10.2026:
     - Ablauf in `src/lib/practice/session.ts` (`PracticeSession`): Modus, Übebereich, Echo-Phasen, Schleife, Bewertung beim Tippen und Auswertung. `/ueben` verdrahtet ihn nur.
     - **Echo:** »Hör zu« und »Jetzt du« auf der Bahn und in der Griff-Anzeige. Die eigene Stimme ist im »Hör zu« laut und im »Jetzt du« stumm.
     - **Rhythmus tippen:** Tipp-Taste, die Bahn antippen oder die Leertaste. Rückmeldung in ms, verpasste Töne werden markiert.
     - **Auswertung:** Nach einem ganzen Durchgang (Schleife bzw. Echo-Bereich) kommt das Ergebnis mit Tempo-Vorschlag, beim Anhalten ein Zwischenstand.
     - Wacklige Takte werden pro Titel und Stimme auf dem Gerät gespeichert. Die Liste dazu kommt mit Punkt 5.
     - Bewertet wird vorerst nur beim Rhythmus tippen. Mitspielen und Echo bewerten erst mit dem Mithören (Punkt 4).
     - Getestet mit Vitest (`session.spec.ts`, u. a. exakt getippter Teil A bei 80 %) und Playwright (Rhythmus in der Schleife, Echo-Phasen).
     - **Ungeprüft:** echte Finger auf echten Handys. Ebenso die Ausgabe-Latenz, die iOS über `AudioContext.outputLatency` meldet: Ohne Meldung gelten 20 ms wie im Prototyp, ohne Ton 0 ms.
  4. ~~**Mithören**~~ erledigt am 27.10.2026, siehe docs/02 »Audio«:
     - `PitchTracker` (YIN mit Ringpuffer) läuft im AudioWorklet `src/lib/audio/pitch-worklet.ts`. Das Mikrofon läuft ohne Echo-Unterdrückung, Rauschfilter und Pegelautomatik.
     - Bewertung in `PracticeSession.hear` mit `classify.ts`: Mitspielen und Echo (nur »Jetzt du«), Rückmeldung (`coach.ts`) mit Zeiger tief/hoch, Tonspur auf der Bahn.
     - Beim Mithören ist die eigene Stimme stumm.
     - »Vorführung mit Aufnahme«: Die eigene Spur wird statt des Mikrofons bewertet.
     - »Verzögerung abgleichen« mit acht Klicks über den Lautsprecher, gespeichert pro Gerät. Ab 150 ms erscheint ein Hinweis auf Bluetooth.
     - Getestet mit Vitest (sauber gespielter Teil A, eine Stufe zu hoch, nichts gehört, Verzögerung, Echo, letzter Ton in der Schleife) und Playwright mit künstlichem Mikrofon (Chromium spielt ein erzeugtes WAV ab).
     - **Ungeprüft:** echte Bläser, Handymikrofone und Hall. Ebenso die Rechenzeit des Worklets auf iPhone/iPad (Aussetzer der Band?), der Abgleich auf echten Geräten und die Mikrofon-Freigabe in Safari. Das ist der Gerätetest der Abnahme.
     - **Offen:** Tipp-Abgleich der Verzögerung für Rhythmus tippen.
  5. ~~Notenansicht, Vollbild, Baustellen-Liste~~ erledigt am 27.10.2026:
     - **Notenansicht:** `src/lib/score/ScoreView.svelte` mit OpenSheetMusicDisplay 2.2.1 (BSD-3, wird erst beim Öffnen geladen). Nur die gewählte Stimme, Griffe und Zugpositionen ein- und ausschaltbar. Der aktuelle Takt ist markiert und bleibt im Blick, Antippen springt.
     - **Die MusicXML kommt aus dem Bucket** (`score.musicxml`, hinter dem Testzugang wie das Audio). **Matthias:** `prototype/v7/badtouch.xml` als `titles/bad-touch-2-0/schuegu27/score.musicxml` hochladen. Ohne Datei steht »Die Noten sind noch nicht hochgeladen.«
     - **Vollbild:** nur Bahn, Griff-Anzeige (auf dem Handy ohne) und Wiedergabe; Esc oder »Vollbild beenden«.
     - **Baustellen-Liste:** die drei wackligsten Takte pro Stimme, »Üben bei 70 %« (zwei Takte in der Schleife), »Baustellen zurücksetzen«.
     - Getestet mit Vitest (Takt-Kästen, Mitscrollen) und Playwright (Noten mit der MusicXML aus dem Prototyp, Takt läuft mit, Antippen, ohne Testzugang, Vollbild, Baustellen).
     - **Ungeprüft:** Abruf der MusicXML über die Weiterleitung (CORS bei Supabase, wie beim Audio), Ladezeit und Speicher der 1,9-MB-MusicXML auf iPhone/iPad.
  6. ~~**Offline-Cache für Bad Touch**~~ erledigt am 28.10.2026 (`src/lib/offline/title-cache.ts`):
     - Die Seite speichert, was sie lädt (Band und eigene Stimme der gewählten Stimme, dazu die MusicXML), in einem Cache pro Titel und Fassung unter dem `/audio/…`-Pfad. Offline spielt sie daraus als `blob:`-Adresse.
     - Der Service Worker beantwortet also keine Range-Anfragen (in Safari heikel); er legt wie bisher nur Gerüst und Seiten ab.
     - Beim ersten Laden wird jede Spur einmal zusätzlich ganz geladen.
     - Ersetzte Dateien unter derselben Fassung sieht ein Gerät erst, wenn sein Speicher leer ist. Neue Mischungen deshalb als neue Fassung ablegen.
     - Getestet mit Playwright im Flugmodus von Chromium: Stimme und Noten laufen, eine nicht gespeicherte Stimme meldet »nicht erreichbar«.
     - **Ungeprüft:** ob Safari auf iPhone/iPad den Speicher behält (`navigator.storage.persist()` wird angefragt).
  7. ~~Testprotokoll für die Abnahme~~ Vorlage am 28.10.2026: `docs/testprotokolle/m1-abnahme.md`. Dazu die Messanzeige `/ueben?diag` (grösste Abweichung der eigenen Spur, Latenzen).
  8. ~~**Einblasen**~~ (Entscheid Matthias, 28.10.2026: gehört in M1, weil die Abnahme »Lange Töne« verlangt) erledigt am 28.10.2026 unter `/einblasen`:
     - Übungen Lange Töne, Lippenbindungen, Zungenstoss und Tonleiter-Häppchen aus dem Prototyp, je in den Stufen Einstieg und Weiter (`src/lib/warmup/exercises.ts`).
     - Der Dirigent spielt einen Takt vor (gestrichelt, synthetischer Ton), du spielst ihn nach. Klick und Vorspielton werden in Web Audio vorausgeplant (`src/lib/warmup/player.ts`).
     - Mithören bewertet nur das Nachspielen (`PracticeSession`, vorgespielte Töne tragen `call`).
     - Noch nicht dabei: Schränz-Groove (im Prototyp ab Level 3, Levels kommen mit M2), Tagesvorschlag, Fragen an den Dirigenten (KI).
     - **Ungeprüft:** wie der synthetische Vorspielton auf Handy-Lautsprecher und Kopfhörer klingt; echte Aufnahmen pro Instrument sind geplant (docs/02).
- **Stand 28.10.2026:** PR #1 (Punkte 2–5) und PR #2 (Punkte 6 und 7) sind gemergt und live. Punkt 8 (Einblasen) ist mit PR #3 gemergt und live (`/einblasen`, geprüft 28.10.2026). Offen sind die Uploads (13 Mischungen und `score.musicxml`) und der Gerätetest nach dem Protokoll.
- **Nebenbei offen:**
  - Sousaphon-Griffe in Takt 84 und 89 in Logic auf `0` nachtragen. In `prototype/v7/badtouch.xml` ist das schon korrigiert.
  - Cloudflare-Builds für Branches schlugen fehl (Ursache ungeprüft). Matthias hat die Preview-Builds am 28.10.2026 abgeschaltet; Branches prüft nur noch GitHub Actions.

**Abnahme (Testprotokoll in `docs/testprotokolle/`):**
- iPhone und iPad, Safari: Bahn läuft flüssig; Band und eigene Spur bleiben über das ganze Stück innerhalb 50 ms.
- Mikrofon-Freigabe klappt; Matthias spielt mit Trompete und Kopfhörern Lange Töne und Teil A bei 80 %: Treffer-Anteil bei sauberem Spiel ≥ 90 % (Lange Töne) bzw. ≥ 80 % (Teil A). Absichtlich falsche Griffe und Naturtöne werden erkannt. Zahlen sind Startwerte, nach dem ersten Test anpassen.
- Dieselbe Prüfung mit Posaune und Sousaphon, sobald jemand verfügbar ist.
- Flugmodus: Titel bleibt nach einmaligem Laden spielbar.

**Entscheidung nach M1:** Reicht der Browser auf iOS (Audio-Gleichlauf, Mikrofon, Latenz)? Wenn nein → native Hülle vorziehen (M7).

## M2 · Konten, Guugge, Pläne, Etappen, Punkte

- Auth per E-Mail-Link, Guugge anlegen, Einladung per Link mit Rolle, Stimme wählen.
- Hinweise der Leitung (inkl. Realtime), Gesamtplan, Mein Plan, Etappenprüfungen 1–5.
- Punkte auf dem Server (Datenbankfunktionen, Entscheid 29.10.2026): Plausibilitätsprüfung, Punkte, Übetage; Tageslimits.
- Ränge und Belohnungen (Anzeige), Rangliste mit Opt-in, Register-Übersicht über Aggregatfunktion.

**Stand 28.10.2026 (begonnen, Branch `claude/dreamy-franklin-mle6hm`):**

1. ~~**Datenbank: Konten, Guuggen, Einladungen, Rollen**~~ erledigt am 28.10.2026, Migration `20261028150000_m2_konten_guuggen.sql`, Einzelheiten in docs/03:
   - Schliesst eine Lücke aus 0001: Ein Mitglied konnte sich selbst zur Leitung machen, die Leitung das Opt-in anderer setzen. Im echten Projekt besteht die Lücke, bis die Migration angewendet ist.
   - Mitgliedschaften und Einladungen nur über prüfende Funktionen. Einladungs-Schlüssel nur als Hash gespeichert. Profile automatisch beim ersten Anmelden.
   - `register_overview` zählt Personen ohne Ergebnis mit Etappe 0.
   - RLS-Tests pro Rolle mit PGlite (`supabase/tests/`), laufen mit `npm run test:unit` und in CI. Sie decken die Abnahme unten ab.
   - Ablauf »Supabase-Migrationen« in GitHub Actions. **Matthias:** Secrets anlegen und den Ablauf starten (docs/03 »Anwenden«). **Ungeprüft**, bis er gelaufen ist.
2. ~~**Anmelden**~~ erledigt am 28.10.2026, mit Code aus der E-Mail statt nur per Link. Grund: Auf dem iPhone öffnet ein Link aus Mail die Seite in Safari, nicht in der App auf dem Home-Bildschirm. Einzelheiten in docs/02 »Anmelden«. **Matthias:** URL-Einstellungen, Mailvorlagen und Mailversand in Supabase, siehe dort.
3. ~~Guugge anlegen, Einladungslink teilen, Stimme wählen~~ erledigt am 28.10.2026:
   - `/guugge`: Name, eigene Guuggen, neue Guugge anlegen, abmelden.
   - `/guugge/[id]`: Stimme, Rangliste mitmachen. Für die Leitung zusätzlich einladen (Link mit Rolle, kopieren, teilen, zurückziehen), Rollen, entfernen, Rangliste ein/aus. Austreten.
   - `/einladung#<schlüssel>`: beitreten, auch über das Anmelden hinweg.
   - Dazu die Migration `20261028170000_m2_konto_funktionen.sql` (`my_account`, `set_my_name`, `set_rangliste_enabled`).
   - Getestet mit Vitest und Playwright: ganzer Ablauf mit zwei Geräten gegen einen Supabase-Nachbau (`e2e/fake-supabase.ts`, echte Migrationen in PGlite).
   - **Ungeprüft:** gegen das echte Supabase. Geht erst, wenn die Migrationen angewendet und die Einstellungen gesetzt sind.
   - Die Stimmen sind vorerst die von Bad Touch. Wie `/ueben` die gewählte Stimme übernimmt, kommt mit den Plänen.
4. ~~Logik für Pläne, Etappen und Punkte~~ portiert am 29.10.2026, noch ohne Oberfläche:
   - `src/lib/plan/`: Gesamtplan mit Gewichtung der Teile, Fälligkeit der Etappen, »Mein Plan« (Pausen, voraus/hinterher, als Nächstes, Wochenziele). Kalendertage ohne Zeitzone; »heute« gilt in der Schweiz.
   - `src/lib/exams/`: Quiz, Griffprüfung, Bewertung auf der Bahn, Bestehensgrenzen.
   - `src/lib/game/points.ts`: Punkte, Ränge, Tageslimits, Wochenziel.
   - Gegen den Prototyp gerechnet: Gewichte, Lernwochen, Wochentexte, Fälligkeiten und Meilensteine stimmten in vier Fällen überein, auch über die Zeitumstellung. Die Sollwerte stehen in `plan.spec.ts`.
5. ~~Gesamtplan und »Mein Plan« in der Oberfläche~~ erledigt am 29.10.2026, unter `/guugge/[id]/plan`:
   - Die Leitung legt den Plan an und ändert ihn; alle Mitglieder sehen Wochen und Meilensteine.
   - »Mein Plan« für die eigene Stimme: voraus/hinterher, Prozent bis auftrittsreif, als Nächstes mit Fälligkeit, Wochenziele, alle Teile mit Etappen. Pausen zählen als erledigt.
   - Migration `20261029100000_m2_titel_plan.sql`: Bad Touch im Katalog (`catalog.spec.ts` prüft, dass er zu `bad-touch.ts` passt), `get_plan`, `set_plan` (nur Leitung, mit Plausibilitätsprüfung), `my_stages`.
   - Getestet mit Vitest (Regeln) und Playwright (Plan anlegen, Mitglied sieht seinen Stand).
   - Noch ohne Etappenprüfungen: Der Stand bleibt bei 0, bis Prüfungen Ergebnisse schreiben.
6. ~~Etappen 1 und 2 mit Punkten auf dem Server~~ erledigt am 29.10.2026:
   - **Entscheid Matthias (29.10.2026):** Punkte rechnen Datenbankfunktionen, nicht Edge Functions (docs/02 »Sicherheit«).
   - Migration `20261029120000_m2_etappen_punkte.sql`: `start_exam`, `finish_exam`, `my_points`, Wochenziel am dritten Übetag. `plans.due` für den Bonus »rechtzeitig«.
   - `supabase/tests/points.spec.ts`: Die Punkteregeln in SQL und TypeScript stimmen in allen 1920 Kombinationen überein. Dazu Reihenfolge, Mindestdauer, fremde und abgelaufene Versuche.
   - Seite `/guugge/[id]/pruefung?teil=…&etappe=…` mit Quiz (Etappe 1) und Griffprüfung (Etappe 2), Ergebnis mit Punkten. Im Plan stehen die Punkte, der Rang und bei »Als Nächstes« ein Link »Prüfung«.
   - Getestet mit Playwright: Quiz und Griffe bestanden, ein falscher Griff wird erkannt, Rang steigt auf Lehrling.
   - **Ungeprüft:** ob 4 s und 3 s Mindestdauer im Alltag passen.
7. ~~Etappen 3–5 auf der Bahn~~ erledigt am 29.10.2026:
   - Die Prüfungsseite schickt nach `/ueben?pruefung=<guugge>&teil=…&etappe=…&art=mic|rhythm`.
   - Dort ist alles fest eingestellt: Teil, Tempo (Etappe 3: 80 %, sonst 100 %), Hilfen (Etappe 5: »Auswendig«) und Modus. Stimme, Modus und Mithören sind ausgeblendet; Teil, Schleife, Tempo und Hilfen sind gesperrt.
   - »Abspielen« startet das Mikrofon und meldet den Versuch an (`start_exam`). Gibt es kein Mikrofon, geht es mit Rhythmus tippen weiter, wie im Prototyp.
   - Am Ende des Teils zählen alle Töne der Stimme (`sectionScore`; nicht gehört = 0). Das Ergebnis geht an `finish_exam`, danach gelten wieder die Einstellungen von vorher.
   - Ergebnis mit Punkten in »Stück üben«, mit Links »Weiter zu Etappe …«, »Nochmals« und »Zurück zum Plan«.
   - Getestet mit Playwright: Rhythmus tippen ohne Tipp ergibt 0 %, und der Server speichert das Ergebnis. Mit dem künstlichen Mikrofon geht das Ergebnis als »mic« an den Server.
   - **Ungeprüft:** ein bestandener Durchgang auf der Bahn im Browser-Test (Tippen müsste auf 70 ms genau sein, zu wackelig für CI) und mit echten Bläsern. Das gehört in den Gerätetest.
8. ~~Rangliste, Belohnungen, Übersicht der Leitung~~ erledigt am 29.10.2026:
   - `/guugge/[id]/rangliste`:
     - eigener Rang mit Fortschritt zum nächsten Level und letzten Punkten;
     - Belohnungen pro Level, dazu die eigenen der Guugge;
     - Rangliste nur eingeschaltet und nur mit Opt-in, sortiert gesamt oder nach dieser Woche, mit Register-Wertung aus den Teilnehmenden.
   - Die Leitung schaltet die Rangliste ein und legt Belohnungen fest.
   - Die Schalter zur Rangliste sind von der Guugge-Seite hierher umgezogen.
   - Im Gesamtplan sieht die Leitung die Übersicht der Register: Karten mit Schnitt und »hat diese Woche geübt«, dazu eine Tabelle Register × Teil mit der Plan-Zeile. Nur Register mit mindestens drei Personen.
   - Migration `20261029140000_m2_rangliste_uebersicht.sql`: `register_overview` zählt Pausen der Stimme als erledigt (`titles.voices[].rests`, wie »Mein Plan«); dazu `leitung_overview`, `guugge_settings`, `set_level_rewards`, `my_points_log`.
   - **Noch nicht gebaut**, in der Oberfläche als »kommt bald« markiert: Bahn-Looks »Fasnacht« und »Gold«, Bonusübung »Schränz-Groove«, Abzeichen. Gebaut ist nur der goldene Name in der Rangliste.
   - Getestet mit Vitest (Rechte, Belohnungen, Pausen in der Übersicht) und Playwright (Rangliste mit Opt-in, Übersicht nur für die Leitung).
9. ~~Hinweise der Leitung~~ erledigt am 29.10.2026:
   - `/guugge/[id]/hinweise`: Die Leitung trägt Hinweise ein (Takte, für Alle, ein Register oder eine Stimme; Dynamik, Artikulation, Atmen oder freier Text) und löscht sie.
   - Alle sehen die Hinweise für ihre Stimme oder alle, mit »neu«, bis sie gelesen sind. »Hinhören« springt in »Stück üben« an die Stelle (`/ueben?takt=…`). Auf der Guugge-Seite steht die Zahl neuer Hinweise.
   - Auf der Bahn erscheint ein gelbes Band mit Kurztext (»pp«, »Atmen«, »! Text«), gefiltert nach der gewählten Stimme. »Stück üben« lädt den Konto-Code dafür nur, wenn jemand angemeldet ist.
   - Migration `20261029160000_m2_hinweise.sql`: `add_hint` (nur Leitung, prüft Takte, Ziel, Stärke, Text), `delete_hint`, `list_hints`, `mark_hints_read`.
   - Getestet mit Vitest (Rechte, Prüfungen, gelesen) und Playwright (eintragen, neu, Hinhören, Band je nach Stimme, löschen).
   - **Noch nicht:** Hinweise in der Notenansicht, Aktualisierung ohne Neuladen (Realtime, docs/02), Hinweise von Registerchefs (docs/03).
10. ~~Punkte für bewertete Durchgänge~~ erledigt am 29.10.2026:
    - »Stück üben« meldet jeden Durchgang in der Schleife oder im Echo mit Bewertung beim Server an (`start_pass`) und ab (`finish_pass`). Ab 50 % ein Punkt pro 10 %, höchstens 10, im Originaltempo × 1,5. Höchstens 15 Durchgänge mit Punkten pro Tag und Guugge, wie im Prototyp.
    - Die Punkte gehen an jede Guugge, in der die Person Mitglied ist (»Stück üben« gehört zu keiner Guugge).
    - **Neu (Vorschlag, docs/01):** Ein Übetag zählt erst ab einem getroffenen Ton, sonst brächte ein Durchgang ohne Spielen das Wochenziel. Gilt auch für Prüfungen.
    - Migration `20261029180000_m2_durchgaenge.sql`. Die Punkteregel in SQL und TypeScript stimmt für alle 1111 Kombinationen überein.
    - Getestet mit Playwright: Ein Durchgang wird angemeldet, abgeschlossen und neu gestartet; 0 % gibt keine Punkte und keinen Übetag.
    - **Noch nicht:** Punkte fürs Einblasen (5 pro Übung, höchstens 6 pro Tag, docs/01).
11. Offen in M2: Punkte fürs Einblasen; Hinweise in der Notenansicht und ohne Neuladen; Belohnungen Bahn-Looks und Schränz-Groove. Danach Abnahme M2 (Testprotokoll).

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
- Bis dahin: vorläufige Landingpage (live seit 25.10.2026, seit 27.10.2026 Startseite unter allen Adressen, Hauptadresse https://probelokal.ch) aus einem separaten claude.ai-Chat, als fertige HTML-Datei in `src/lib/sites/arrangements.html`, ausgeliefert über `src/hooks.server.ts` für `/`; alle anderen Pfade gehören der App (`/ueben`, `/zugang`, `/audio/…`), Unbekanntes liefert 404. Die Seite nennt im Fuss noch `arrangements.giordanomat.de` und `probelokal.giordanomat.de` als Adressen – anpassen, sobald die Quelle im Repository liegt. Quelle (`index.src.html`, `build.py`) fehlt im Repository. Offen vor dem Bekanntmachen: gelb markierte Lücken im Impressum und in der Datenschutzerklärung; Anmeldeformular speichert seit 25.10.2026 in Supabase (`public.signups` über Funktion `public.signup`, Migration `supabase/migrations/20261025140000_signups.sql`); ansehen im Supabase-Dashboard → Table Editor. **Double-Opt-in fehlt: niemanden anschreiben, bevor es gebaut ist** (`confirmed_at` bleibt leer).
- Rechnungen, Impressum, AGB, Datenschutz (Inhalte von Matthias).

## M6 · Produktionsstrecke und weitere Titel

- Skripte aus `tools/` zu einem Ablauf verbinden: MusicXML + Einzelspuren rein → Noten-JSON, Mischungen, Qualitätsprüfung (`detect_eval.py` ≥ 95 % pro Stimme), Upload, Titel-Datensatz.
- Die zehn Titel mit Shop-Reife A aus dem Katalog (Google Sheet »Arrangement-Katalog«).

## M7 · Native Hülle (nur wenn nötig)

Die Web-App in eine native Hülle für iOS/iPadOS packen (z. B. Capacitor), wenn M1 oder der Pilot es verlangen (Audio-Gleichlauf, Mikrofon, Hintergrundwiedergabe, Wunsch nach App-Store-Präsenz). **Vorher prüfen:** aktuelle App-Store-Regeln zum Verkauf digitaler Inhalte und Abos in der Schweiz.
