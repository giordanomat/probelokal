# 02 · Architektur und Technik

Vorschlag vom 25.10.2026. Begründungen stehen dabei, damit Änderungen bewusst passieren. Versionen beim Aufsetzen auf den aktuellen stabilen Stand prüfen, nicht aus diesem Dokument übernehmen.

## Überblick

| Teil | Wahl | Warum |
|---|---|---|
| App | **SvelteKit 3** (Svelte 5, Vite 8) mit TypeScript | Wenig Laufzeit-Overhead, gut für Canvas-Bahn mit 60 fps und Audio; serverseitiges Rendern für die späteren Shop-Seiten (Suchmaschinen). Alternative Next.js wäre ebenso tragfähig; nicht mischen. |
| Installierbar, offline | Web-App-Manifest + eingebauter SvelteKit-Service-Worker (`src/service-worker/`), kein PWA-Plugin | iPhone/iPad: »Zum Home-Bildschirm«. Offline-Cache für Noten und Audio eines Stücks (ab M1). `@vite-pwa/sveltekit` unterstützt SvelteKit 3 nicht (Stand 25.10.2026, verlangt Kit 1/2). |
| Hosting | **Cloudflare Workers mit statischen Assets** (`@sveltejs/adapter-cloudflare`, `main` = `.svelte-kit/cloudflare/_worker.js`, Assets aus `.svelte-kit/cloudflare`); Workers Builds mit Git-Anbindung an `giordanomat/probelokal`: Build `npm run build`, Deploy `npx wrangler deploy` | Günstig, schnell in der Schweiz, später Cloudflare R2 für Audio ohne Ausgangsgebühren möglich. Workers statt Pages (Entscheid 25.10.2026): Cloudflare legt neue Projekte als Worker an und empfiehlt das; die DNS-Zone liegt ohnehin bei Cloudflare. |
| Domain | **Hauptadresse `probelokal.ch`** (Entscheid Matthias, 27.10.2026; Zone bei Cloudflare, `www` und `probelokal.giordanomat.de` leiten per Redirect Rule dorthin weiter). Daneben `arrangements.giordanomat.de` – **eine App, ein Repository, ein Worker** (Worker `probelokal`, alle Adressen als Custom Domains). Unter jeder Adresse erscheint dieselbe Startseite (Landingpage, siehe `docs/05-roadmap.md` M5); die Weiche nach Hostname und die Platzhalter-Startseite sind seit 27.10.2026 entfernt. | **DNS-Zone giordanomat.de liegt bei Cloudflare** (Nameserver `pola`/`pablo.ns.cloudflare.com`, geprüft 25.10.2026); die Website selbst läuft weiter bei IONOS (A-Eintrag 217.160.0.109). Zone und Worker liegen im selben Cloudflare-Konto (Matthias). Subdomain im Worker unter »Domains« als Custom Domain eintragen; Cloudflare legt den DNS-Eintrag selbst an. |
| Daten, Konten, Dateien | **Supabase**, Region **Zürich (eu-central-2)**, **ein Projekt für Shop und Probelokal** (Entscheidung Matthias, 25.10.2026) – Lizenzen, Konten und Guuggen hängen zusammen, getrennte Projekte hiessen doppelte Konten | Postgres mit Zeilen-Zugriffsregeln (RLS), Auth, Realtime (Leitgerät, Hinweise), Storage (Audio, MusicXML), Edge Functions. Zürich als festgelegte Region verfügbar (laut Supabase-Doku, Stand 25.10.2026). |
| Zahlungen | Stripe Checkout, CHF, TWINT | Erst Meilenstein M5. Voraussetzungen von TWINT bei Stripe dann aktuell prüfen. |
| KI-Dirigent | Anthropic API über eine Supabase Edge Function | Schlüssel nie im Browser; Kostenlimit pro Guugge und Tag; Antworten kurz. |
| Noten anzeigen | OpenSheetMusicDisplay | Wie im Prototyp; Farben für dunkle Darstellung setzen. |
| Tests | Vitest (Logik), Playwright (Abläufe, synthetisches Audio) | Siehe unten. |

## Audio

- **Wiedergabe:** zwei Spuren pro Stimme – Minus-One-Mischung (Band) und eigene Stimme – als `HTMLAudioElement`, beide über `MediaElementSource` in einen `AudioContext`, eigene Stimme über einen `GainNode`. Grund: iOS ignoriert `element.volume`, `GainNode` funktioniert. Nachführen der eigenen Spur, wenn der Abstand zur Band > 50 ms ist (alle 500 ms prüfen). Tempo über `playbackRate` mit `preservesPitch`.
- **Ungeprüft:** Gleichlauf und Speicherbedarf auf iPhone/iPad. Falls zwei Elemente auseinanderlaufen: beide Spuren dekodieren und mit `AudioBufferSourceNode` sample-genau starten; dann Tempoänderung ohne Tonhöhenänderung separat lösen (z. B. Time-Stretch in einem AudioWorklet). Das erst entscheiden, wenn der Test auf echten Geräten es verlangt.
- **Tonerkennung:** YIN wie im Prototyp, aber in einem **AudioWorklet** statt im Animations-Takt (stabiler, weniger Jank). Parameter siehe `docs/04-erkenntnisse-prototyp.md`. `getUserMedia` mit `echoCancellation`, `noiseSuppression`, `autoGainControl` = false.
- **Verzögerung:** pro Gerät einmal abgleichen (Klick abspielen, Mikrofon misst die Rückkehr; bzw. Tipp-Abgleich für Rhythmus). Bluetooth-Kopfhörer erkennen bzw. warnen.
- **Klick und Vorspielton** beim Einblasen: Web Audio, vorausgeplant (25-ms-Takt, 0,5 s Vorlauf). Vorspielton ist im Prototyp synthetisch; im Produkt echte Aufnahmen pro Instrument.

## Sicherheit und Datenschutz

- **Grundsatz »keine Vollüberwachung«** technisch durchsetzen, nicht nur in der Oberfläche:
  - Einzelwerte (Etappen, Punkte, Übungstage) liest nur die Person selbst – RLS.
  - Leitung bekommt Aggregate über `SECURITY DEFINER`-Funktionen, die nur Durchschnitte pro Register liefern und bei weniger als drei Personen pro Register nichts zurückgeben (sonst wären Einzelwerte ablesbar). **Mindestgruppe 3 ist ein Vorschlag.**
  - Rangliste liest nur Zeilen von Personen mit `rangliste_opt_in = true` in Guuggen mit eingeschalteter Rangliste.
- **Punkte nur serverseitig:** Der Browser meldet ein Prüfungs- oder Durchgangsergebnis an eine Edge Function. Diese prüft Plausibilität (Dauer seit Start ≥ Dauer des Teils beim gewählten Tempo, Anzahl bewerteter Töne = Töne des Teils, Tageslimits, Reihenfolge der Etappen) und schreibt Ergebnis und Punkte. Clients haben keine Schreibrechte auf `points_ledger` und `exam_results`.
  - **Ehrlich:** Weil die Tonerkennung im Browser läuft, lässt sich Betrug nicht ausschliessen, nur erschweren. Für eine freiwillige Rangliste unter Bekannten reicht das; keine Geldpreise an Ranglisten koppeln.
- Kein Audio verlässt das Gerät. Keine Aufnahmen speichern.
- Zugangsdaten: Im Browser nur Projekt-URL und publishable key – eingetragen in `wrangler.jsonc` (`vars`, gilt für den Cloudflare-Worker) und lokal in `.env` (Vorlage `.env.example`). Projekt: `qieunfhizsxsyzmrrvci`, Zürich. Beide sind absichtlich öffentlich – sie stehen in jedem Browser, der die App lädt. Schutz der Daten allein über RLS: **jede Tabelle im Schema `public` mit RLS**, sonst ist sie mit dem publishable key für alle les- und schreibbar. Prüfen mit den Supabase Advisors nach jeder Migration. Secret key, Datenbank-Passwort und Zugangstoken nie im Repository, nie im Chat; für Migrationen aus GitHub Actions als Repository-Secrets (setzt Matthias). Der Claude-Supabase-Connector hängt an der Organisation »Skim« und wird für Probelokal nicht benutzt.
- Auth: E-Mail-Link (magic link) als Start; Einladung in eine Guugge per Link mit Rolle.
- Audiodateien im Storage nur für Guuggen mit Lizenz für diese Fassung lesbar (signierte URLs).

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
  functions/      Edge Functions (exam-result, pass-result, dirigent-ask, stripe-webhook)
tools/            Produktionsstrecke (Python/ffmpeg)
prototype/v7/     Referenz
```

## Tests

- Vitest für: Noten-Parser (gegen `prototype/v7/badtouch.xml`: Notenanzahl je Stimme, Übergebundenes zusammengeführt), Transposition, Griff-Äquivalenz (`3` = `12`), Naturton-Erkennung, Planerzeugung (Fälligkeiten, Phasen), Quiz-Generator, Bewertung, Punkte-Regeln.
- Playwright für: Bahn-Darstellung auf Handy/Tablet/Desktop in hell/dunkel (Screenshots), Rhythmus-Prüfung mit simuliertem Tippen, Tonerkennung mit synthetischen Tönen (OscillatorNode in den Analyser) und mit der eigenen Spur als »Spieler« (Vorführung).
- Echte Geräte: Testprotokoll in `docs/` für iPhone und iPad (siehe Roadmap M1).
