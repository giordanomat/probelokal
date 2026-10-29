# 02 · Architektur und Technik

Vorschlag vom 25.10.2026. Begründungen stehen dabei, damit Änderungen bewusst passieren. Versionen beim Aufsetzen auf den aktuellen stabilen Stand prüfen, nicht aus diesem Dokument übernehmen.

## Überblick

| Teil | Wahl | Warum |
|---|---|---|
| App | **SvelteKit 3** (Svelte 5, Vite 8) mit TypeScript | Wenig Laufzeit-Overhead, gut für Canvas-Bahn mit 60 fps und Audio; serverseitiges Rendern für die späteren Shop-Seiten (Suchmaschinen). Alternative Next.js wäre ebenso tragfähig; nicht mischen. |
| Installierbar, offline | Web-App-Manifest + eingebauter SvelteKit-Service-Worker (`src/service-worker/`), kein PWA-Plugin | iPhone/iPad: »Zum Home-Bildschirm«. Offline-Cache für Noten und Audio eines Stücks (ab M1): Die Seite speichert die geladenen Dateien selbst und spielt sie offline als `blob:`-Adresse (`src/lib/offline/title-cache.ts`); der Service Worker hält nur Gerüst und Seiten. `@vite-pwa/sveltekit` unterstützt SvelteKit 3 nicht (Stand 25.10.2026, verlangt Kit 1/2). |
| Hosting | **Cloudflare Workers mit statischen Assets** (`@sveltejs/adapter-cloudflare`, `main` = `.svelte-kit/cloudflare/_worker.js`, Assets aus `.svelte-kit/cloudflare`); Workers Builds mit Git-Anbindung an `giordanomat/probelokal`: Build `npm run build`, Deploy `npx wrangler deploy` | Günstig, schnell in der Schweiz, später Cloudflare R2 für Audio ohne Ausgangsgebühren möglich. Workers statt Pages (Entscheid 25.10.2026): Cloudflare legt neue Projekte als Worker an und empfiehlt das; die DNS-Zone liegt ohnehin bei Cloudflare. |
| Domain | **Hauptadresse `probelokal.ch`** (Entscheid Matthias, 27.10.2026; Zone bei Cloudflare, `www` und `probelokal.giordanomat.de` leiten per Redirect Rule dorthin weiter). Daneben `arrangements.giordanomat.de` – **eine App, ein Repository, ein Worker** (Worker `probelokal`, alle Adressen als Custom Domains). Unter jeder Adresse erscheint dieselbe Startseite (Landingpage, siehe `docs/05-roadmap.md` M5); die Weiche nach Hostname und die Platzhalter-Startseite sind seit 27.10.2026 entfernt. Alle anderen Pfade gehören der App (`/ueben`, `/zugang`, `/audio/…`); Unbekanntes ergibt 404. | **DNS-Zone giordanomat.de liegt bei Cloudflare** (Nameserver `pola`/`pablo.ns.cloudflare.com`, geprüft 25.10.2026); die Website selbst läuft weiter bei IONOS (A-Eintrag 217.160.0.109). Zone und Worker liegen im selben Cloudflare-Konto (Matthias). Subdomain im Worker unter »Domains« als Custom Domain eintragen; Cloudflare legt den DNS-Eintrag selbst an. |
| Daten, Konten, Dateien | **Supabase**, Region **Zürich (eu-central-2)**, **ein Projekt für Shop und Probelokal** (Entscheidung Matthias, 25.10.2026) – Lizenzen, Konten und Guuggen hängen zusammen, getrennte Projekte hiessen doppelte Konten | Postgres mit Zeilen-Zugriffsregeln (RLS), Auth, Realtime (Leitgerät, Hinweise), Storage (Audio, MusicXML), Edge Functions. Zürich als festgelegte Region verfügbar (laut Supabase-Doku, Stand 25.10.2026). |
| Zahlungen | Stripe Checkout, CHF, TWINT | Erst Meilenstein M5. Voraussetzungen von TWINT bei Stripe dann aktuell prüfen. |
| KI-Dirigent | Anthropic API über eine Supabase Edge Function | Schlüssel nie im Browser; Kostenlimit pro Guugge und Tag; Antworten kurz. |
| Noten anzeigen | OpenSheetMusicDisplay | Wie im Prototyp; Farben für dunkle Darstellung setzen. |
| Tests | Vitest (Logik), Playwright (Abläufe, synthetisches Audio) | Siehe unten. |

## Audio

- **Wiedergabe:** zwei Spuren pro Stimme – Minus-One-Mischung (Band) und eigene Stimme – als `HTMLAudioElement`, beide über `MediaElementSource` in einen `AudioContext`, eigene Stimme über einen `GainNode`. Grund: iOS ignoriert `element.volume`, `GainNode` funktioniert. Nachführen der eigenen Spur, wenn der Abstand zur Band > 50 ms ist (alle 500 ms prüfen). Tempo über `playbackRate` mit `preservesPitch`.
- **Umsetzung (M1, `src/lib/audio/`):** `StemPlayer` ist die Uhr der Bahn (`band.currentTime`, gleiche Schnittstelle wie `FreeClock`). Der Graph entsteht erst beim ersten Abspielen (iOS verlangt eine Berührung). Lautstärke der eigenen Stimme wie im Prototyp: Aus / Leise (0,35) / Laut, pro Gerät gespeichert. Beim Stimmwechsel werden beide Spuren neu geladen und springen an dieselbe Stelle. Vor dem Laden fragt `/ueben` einmal `/audio/…` ab, ohne der Weiterleitung zu folgen (`redirect: 'manual'`), weil das `<audio>`-Element den HTTP-Status nicht verrät. 401 zeigt den Weg zu `/zugang`, 404 heisst »Aufnahme fehlt noch«, 502/503 »nicht erreichbar«. In allen drei Fällen und bei einem Ladefehler läuft die Bahn mit der eigenen Uhr weiter.
- **Voraussetzungen beim Storage:** Die `<audio>`-Elemente haben `crossorigin="anonymous"`, weil `/audio/` auf Supabase weiterleitet. Ohne CORS-Antwort von Supabase liefert `MediaElementSource` nur Stille. Ausserdem muss der Storage Range-Anfragen beantworten (206), sonst springt Chromium nicht: `currentTime` bleibt bei 0, das ist im Playwright-Test so beobachtet. Beides gegen das echte Supabase-Projekt **ungeprüft**. Prüfen: In `/ueben` abspielen und hören, ob die Band klingt. Dann springen (Teil wählen) und schauen, ob die Bahn an der neuen Stelle weiterläuft.
- **Ungeprüft:** Gleichlauf und Speicherbedarf auf iPhone/iPad. Falls zwei Elemente auseinanderlaufen: beide Spuren dekodieren und mit `AudioBufferSourceNode` sample-genau starten; dann Tempoänderung ohne Tonhöhenänderung separat lösen (z. B. Time-Stretch in einem AudioWorklet). Das erst entscheiden, wenn der Test auf echten Geräten es verlangt.
- **Tonerkennung:** YIN wie im Prototyp, aber in einem **AudioWorklet** statt im Animations-Takt (stabiler, weniger Jank). Parameter siehe `docs/04-erkenntnisse-prototyp.md`. `getUserMedia` mit `echoCancellation`, `noiseSuppression`, `autoGainControl` = false.
  - **Umsetzung (M1):** `src/lib/pitch/tracker.ts` (`PitchTracker`: Ringpuffer, YIN alle ~21 ms, Zeitstempel = Mitte des Ausschnitts in AudioContext-Zeit) läuft in `src/lib/audio/pitch-worklet.ts`. Vite baut das Worklet als eigene Datei (`?worker&url`). Gespeist wird es vom Mikrofon oder bei der »Vorführung mit Aufnahme« von der eigenen Spur vor dem `GainNode`. Bewertet wird in `PracticeSession.hear` (`src/lib/practice/session.ts`).
  - **Zeitbezug:** Ein Messpunkt gehört zum Schlag `jetzt − (Alter der Meldung + Verzögerung) × Schläge pro Sekunde`. Bei der Vorführung ist die Verzögerung 0, weil der Ton direkt aus der Spur kommt.
  - **Ungeprüft:** Rechenzeit im Worklet auf iPhone/iPad. YIN läuft im selben Thread wie die Wiedergabe; ist es zu langsam, setzt auch die Band aus. Prüfen: beim Mithören auf Aussetzer hören. Ausweg wäre, im Worklet nur zu puffern und in einem Worker zu rechnen.
- **Verzögerung:** pro Gerät einmal abgleichen (Klick abspielen, Mikrofon misst die Rückkehr; bzw. Tipp-Abgleich für Rhythmus). Bluetooth-Kopfhörer erkennen bzw. warnen.
  - **Umsetzung (M1, `src/lib/audio/latency.ts`, `measureRoundTrip` in `listen.ts`):** »Verzögerung abgleichen« spielt acht Klicks im Abstand von 0,5 s über den Lautsprecher, das Worklet meldet die Einsätze. Ergebnis ist der Median der passenden Messungen; Ausreisser fallen weg. Es braucht mindestens fünf, die eng beieinanderliegen. Gespeichert pro Gerät (`probelokal.latenz`).
  - Ohne Abgleich gilt wie im Prototyp 80 ms + Ausgabe-Latenz. Ab 150 ms erscheint der Hinweis auf Bluetooth; erkennen lässt sich Bluetooth im Browser nicht.
  - Der Tipp-Abgleich für Rhythmus fehlt noch.
  - **Ungeprüft auf echten Geräten:** ob der Abgleich über Lautsprecher klappt und ob der Wert für Kopfhörer mit Kabel passt (der Lautsprecher-Weg kann anders sein).
- **Klick und Vorspielton** beim Einblasen: Web Audio, vorausgeplant (25-ms-Takt, 0,5 s Vorlauf). Vorspielton ist im Prototyp synthetisch; im Produkt echte Aufnahmen pro Instrument. Umgesetzt in M1 (`src/lib/warmup/player.ts`) noch mit dem synthetischen Ton des Prototyps; die Uhr der Übung ist der AudioContext.

## Sicherheit und Datenschutz

- **Grundsatz »keine Vollüberwachung«** technisch durchsetzen, nicht nur in der Oberfläche:
  - Einzelwerte (Etappen, Punkte, Übungstage) liest nur die Person selbst – RLS.
  - Leitung bekommt Aggregate über `SECURITY DEFINER`-Funktionen, die nur Durchschnitte pro Register liefern und bei weniger als drei Personen pro Register nichts zurückgeben (sonst wären Einzelwerte ablesbar). **Mindestgruppe 3 ist ein Vorschlag.** Personen ohne Ergebnis zählen mit Etappe 0 (sonst wäre bei einem Ergebnis unter dreien der Einzelwert ablesbar). **Grenze:** Eine Leitung, die eigene Zweitkonten einlädt, kann ein Register auf drei bringen und Einzelwerte zurückrechnen. Datenbankregeln verhindern das nicht; abschwächen liesse es sich nur über Hürden beim Beitritt (z. B. Bestätigung durch Registerchef). Für den Pilot in Kauf genommen, beim Ausrollen neu entscheiden.
  - Rangliste liest nur Zeilen von Personen mit `rangliste_opt_in = true` in Guuggen mit eingeschalteter Rangliste.
- **Punkte nur serverseitig**, in **Datenbankfunktionen** statt Edge Functions (Entscheid Matthias, 29.10.2026): Alle Regeln liegen dort, wo Rechte und Daten liegen, und laufen in denselben PGlite-Tests.
  - Der Browser startet eine Prüfung (`start_exam`: Mitglied, Stimme gewählt, Etappe in der Reihenfolge, Art passt zur Etappe) und meldet das Ergebnis (`finish_exam`).
  - `finish_exam` prüft die Dauer seit dem Start, den Wertebereich, ob der Versuch schon abgeschlossen ist und ob er abgelaufen ist (2 Stunden). Dann schreibt es Ergebnis, Punkte und Übetag. Die Mindestdauer ist ein Vorschlag: Quiz 4 s, Griffe 3 s, auf der Bahn 90 % der Spieldauer des Teils.
  - Nicht geprüft: die Anzahl bewerteter Töne. Die Noten liegen nicht in der Datenbank.
  - Clients haben keine Schreibrechte auf `points_ledger`, `exam_results`, `practice_days` und keinen Zugriff auf `exam_attempts`.
  - Bewertete Durchgänge ausserhalb von Prüfungen laufen nach demselben Muster (`start_pass`, `finish_pass`): Mindestdauer 90 % des Bereichs beim gewählten Tempo, höchstens 15 Durchgänge mit Punkten pro Tag und Guugge.
  - **Ehrlich:** Weil die Tonerkennung im Browser läuft, lässt sich Betrug nicht ausschliessen, nur erschweren. Für eine freiwillige Rangliste unter Bekannten reicht das; keine Geldpreise an Ranglisten koppeln.
- Kein Audio verlässt das Gerät. Keine Aufnahmen speichern.
- Zugangsdaten: Im Browser nur Projekt-URL und publishable key – eingetragen in `wrangler.jsonc` (`vars`, gilt für den Cloudflare-Worker) und lokal in `.env` (Vorlage `.env.example`). Projekt: `qieunfhizsxsyzmrrvci`, Zürich. Beide sind absichtlich öffentlich – sie stehen in jedem Browser, der die App lädt. Schutz der Daten allein über RLS: **jede Tabelle im Schema `public` mit RLS**, sonst ist sie mit dem publishable key für alle les- und schreibbar. Prüfen mit den Supabase Advisors nach jeder Migration. Secret key, Datenbank-Passwort und Zugangstoken nie im Repository, nie im Chat; für Migrationen aus GitHub Actions als Repository-Secrets (setzt Matthias). Der Claude-Supabase-Connector hängt an der Organisation »Skim« und wird für Probelokal nicht benutzt.
- **Anmelden (M2):** mit Code aus der E-Mail, ohne Passwort (Supabase Auth, OTP). In der Mail stehen ein Code und ein Link.
  - **Der Code ist der Hauptweg.** Auf dem iPhone öffnet ein Link aus Mail die Seite in Safari. Eine App auf dem Home-Bildschirm hat aber einen eigenen Speicher: Wer den Link antippt, wäre in Safari angemeldet, in der App nicht. Den Code tippt man dort ein, wo man angemeldet sein will, auch wenn die Mail auf einem anderen Gerät liegt.
  - Der Link (`/anmelden?token_hash=…`) meldet in dem Browser an, in dem er aufgeht.
  - Die Sitzung liegt pro Gerät im Browser (supabase-js, localStorage); der Server kennt sie nicht.
  - Wer sich mit einer neuen Adresse anmeldet, bekommt ein Konto.
  - Umsetzung: `src/lib/account/` (`auth.svelte.ts`, `api.ts`, `invite.ts`), Seiten `/anmelden`, `/guugge`, `/guugge/[id]`, `/einladung`. Die Oberfläche ruft nur Datenbank-Funktionen auf (docs/03).
- **Einladung in eine Guugge** per Link mit Rolle: `/einladung#<schlüssel>`. Der Schlüssel steht hinter dem #, geht also nie an einen Server und landet nicht in Logs. Wer noch nicht angemeldet ist, meldet sich zuerst an; bis dahin wartet der Schlüssel im Speicher des Geräts.
- **Einstellungen in Supabase (Matthias, vor dem ersten Konto):**
  1. Authentication → URL Configuration: Site URL `https://probelokal.ch`, Redirect URLs `https://probelokal.ch/**`.
  2. Authentication → Emails → Templates: In »Magic Link« **und** »Confirm signup« (neue Konten) den Code und den Link einsetzen. Vorschlag, Betreff »Dein Code fürs Probelokal«:
     ```html
     <h2>Hoi!</h2>
     <p>Dein Code fürs Probelokal: <strong>{{ .Token }}</strong></p>
     <p>Tipp ihn in der App ein. Oder melde dich mit diesem Link an:
       <a href="{{ .SiteURL }}/anmelden?token_hash={{ .TokenHash }}&type=email">Anmelden</a></p>
     <p>Warst du das nicht? Dann kannst du diese Mail löschen.</p>
     ```
  3. Mailversand: Der eingebaute Versand von Supabase schickt nur wenige Mails pro Stunde. Für den Pilot reicht das vielleicht, für mehr braucht es einen eigenen SMTP-Zugang (Authentication → Emails → SMTP Settings). Aktuelle Grenze in der Supabase-Doku nachsehen.
  - **Ungeprüft gegen das echte Projekt:** ob `type=email` im Link für beide Vorlagen passt, wie lang der Code ist (die Eingabe nimmt 6 bis 12 Ziffern) und wie die Fehlertexte von Supabase genau lauten. Die Abläufe sind nur gegen einen Nachbau getestet (`e2e/fake-supabase.ts`). Prüfen: mit einer echten Adresse anmelden, einmal per Code, einmal per Link.
- Audiodateien im Storage nur für Guuggen mit Lizenz für diese Fassung lesbar (signierte URLs).
- **Testzugang (M1, Entscheid Matthias 26.10.2026):** Bis es Konten und Lizenzen gibt (M2), liegt der Testtitel im privaten Bucket `titles`. Wer unter `/zugang` den Testcode eingibt, bekommt ein Cookie (HMAC des Codes, 60 Tage, httpOnly). `/audio/<slug>/<fassung>/<datei>` prüft das Cookie, lässt nur bekannte Dateinamen zu und leitet auf eine signierte Storage-Adresse (6 h) weiter. Liegt eine erlaubte Datei nicht im Bucket, antwortet es 404 »Aufnahme fehlt noch«. Erlaubt sind die Mischungen und `score.musicxml` für die Notenansicht. Die MusicXML liegt bewusst nicht offen im App-Bundle, sie ist das, was verkauft wird. Das Noten-JSON für die Bahn liegt dagegen vorläufig im Bundle (`docs/05`, M1). Erkannt wird das an der Storage-Meldung »Object not found«; gegen das echte Projekt ungeprüft. Dafür braucht der Worker zwei **Cloudflare-Secrets** (Worker → Settings → Variables and Secrets, Typ »Secret«): `SUPABASE_SECRET_KEY` und `TEST_ACCESS_CODE`. Lokal in `.dev.vars` (nicht eingecheckt). **Abwägung:** Der secret key hat vollen Zugriff auf das Projekt; er liegt nur im Worker und wird dort nur zum Signieren benutzt. Code wechseln = alle Testgeräte ausgesperrt. Service Worker lässt `/audio/` und `/zugang` unberührt.

## Projektstruktur (Vorschlag)

```
src/
  lib/
    music/        Noten-JSON laden, Transposition, Griffe, Notennamen
    lane/         Bahn-Renderer (Canvas), Griffspur, Looks
    audio/        Wiedergabe, Sync, Klick/Ton-Synthese, Latenz-Abgleich
    pitch/        AudioWorklet (YIN), Klassifikation (Treffer, Naturton)
    practice/     Modi (Mitspielen, Echo, Rhythmus), Durchgänge, Baustellen
    exams/        Quiz-Generator, Griffprüfung, Bahn-Prüfungen, Bewertung
    plan/         Planerzeugung, Fälligkeiten, Stand
    game/         Ränge, Belohnungen (Anzeige; Punkte kommen vom Server)
    supabase/     Client, Typen
    theme/        Darstellung Dunkel/Hell
    brand/        Zeichen und Lockup
    styles/       Farben, Schriften
  routes/         SvelteKit-Seiten
  service-worker/ Offline-Cache (eigenes tsconfig)
  env.ts          Umgebungsvariablen (SvelteKit 3)
e2e/              Playwright-Abläufe
supabase/
  migrations/     SQL
  functions/      Edge Functions (dirigent-ask, stripe-webhook); Punkte rechnen Datenbankfunktionen
tools/            Produktionsstrecke (Python/ffmpeg)
prototype/v7/     Referenz
```

## Tests

- Vitest für die Datenbankregeln: `supabase/tests/rls.spec.ts` mit PGlite und nachgebautem Supabase-Rahmen, siehe docs/03 »Tests«.
- Vitest für: Noten-Parser (gegen `prototype/v7/badtouch.xml`: Notenanzahl je Stimme, Übergebundenes zusammengeführt), Transposition, Griff-Äquivalenz (`3` = `12`), Naturton-Erkennung, Planerzeugung (Fälligkeiten, Phasen), Quiz-Generator, Bewertung, Punkte-Regeln.
- Playwright für: Bahn-Darstellung auf Handy/Tablet/Desktop in hell/dunkel (Screenshots), Rhythmus-Prüfung mit simuliertem Tippen, Tonerkennung mit synthetischen Tönen (OscillatorNode in den Analyser) und mit der eigenen Spur als »Spieler« (Vorführung).
- Echte Geräte: Testprotokoll in `docs/` für iPhone und iPad (siehe Roadmap M1).
