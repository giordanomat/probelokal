# 05 · Roadmap

Jeder Meilenstein endet mit einer Abnahme durch Matthias. Was »fertig« heisst, steht bei den Abnahmekriterien. Reihenfolge nicht ändern, ohne dieses Dokument nachzuziehen.

## M0 · Aufsetzen  ← als Nächstes

- SvelteKit-Projekt (TypeScript, ESLint, Prettier), Vitest, Playwright, GitHub Actions (Typprüfung, Lint, Tests bei jedem Push).
- Cloudflare-Projekt mit Vorschau pro Branch; `probelokal.giordanomat.de` als Custom Domain (DNS-Zone liegt bei Cloudflare, nicht bei IONOS – geprüft 25.10.2026).
- Supabase-Projekt in Zürich anlegen (noch ohne Daten), Umgebungsvariablen dokumentiert in `.env.example`.
- Befehle in `CLAUDE.md` eintragen.

**Stand 25.10.2026:** Gerüst läuft als Cloudflare-Worker unter https://probelokal.giordanomat.workers.dev (Deploy automatisch bei Push auf `main`). Live geprüft in Chromium (Handy-Grösse): Kopf, Dunkel/Hell, Manifest, Symbole, Service Worker aktiv, lädt offline. Custom Domain https://probelokal.giordanomat.de eingerichtet, HTTPS gültig (geprüft in Chrome auf Matthias' Mac), gleiche Live-Prüfung bestanden. Offen: Abnahme auf echtem iPhone/iPad (Safari, Home-Bildschirm), grüne CI auf GitHub bestätigen.

**Abnahme:** Leere Seite mit giordanomat-PROBELOKAL-Kopf läuft per HTTPS auf iPhone und iPad unter der Subdomain und lässt sich zum Home-Bildschirm hinzufügen.

**Braucht von Matthias:** Cloudflare-Konto, Supabase-Konto, Zugang zur DNS-Zone giordanomat.de in Cloudflare.

## M1 · Üben ohne Konto, ein Titel, Mikrofon-Test

- `tools/extract_notes.py` und `tools/make_mixes.sh` für Bad Touch laufen lassen; Audio und Noten-JSON in Supabase Storage (vorerst öffentlich lesbar nur für diesen Testtitel, oder hinter einem einfachen Testzugang).
- Bahn, Griff-Anzeige, Hilfen-Stufen, Notenansicht, Mitspielen, Echo, Rhythmus tippen, Tempo, Schleife, Baustellen – aus `prototype/v7` portiert, mit Tests.
- Mithören als AudioWorklet; Latenz-Abgleich pro Gerät; Vorführung mit eigener Spur.
- Dunkel/Hell, Vollbild, Offline-Cache für diesen einen Titel.

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
- Rechnungen, Impressum, AGB, Datenschutz (Inhalte von Matthias).

## M6 · Produktionsstrecke und weitere Titel

- Skripte aus `tools/` zu einem Ablauf verbinden: MusicXML + Einzelspuren rein → Noten-JSON, Mischungen, Qualitätsprüfung (`detect_eval.py` ≥ 95 % pro Stimme), Upload, Titel-Datensatz.
- Die zehn Titel mit Shop-Reife A aus dem Katalog (Google Sheet »Arrangement-Katalog«).

## M7 · Native Hülle (nur wenn nötig)

Die Web-App in eine native Hülle für iOS/iPadOS packen (z. B. Capacitor), wenn M1 oder der Pilot es verlangen (Audio-Gleichlauf, Mikrofon, Hintergrundwiedergabe, Wunsch nach App-Store-Präsenz). **Vorher prüfen:** aktuelle App-Store-Regeln zum Verkauf digitaler Inhalte und Abos in der Schweiz.
