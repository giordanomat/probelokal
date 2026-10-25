# Prototyp v7 (claude.ai-Artifact, 25.10.2026)

Eine HTML-Datei mit allem: Bahn, Griffspur, Notenansicht (OSMD), Mitspielen/Echo/Rhythmus, Mithören (YIN), Baustellen, Hinweise der Leitung, Einblasen mit dem giordanomat-Dirigenten, Gesamtplan/Mein Plan, Etappenprüfungen, Punkte/Ränge/Rangliste, Dunkel/Hell.

**Referenz, nicht Grundlage.** Algorithmen und Texte portieren, Code neu strukturieren (siehe `docs/02-architektur.md`).

Abhängigkeiten zur Laufzeit, die es in der echten App nicht gibt:
- `window.claude.use('db' | 'user' | 'sample')` – Speicher, Identität und KI der Artifact-Plattform. Ohne sie fällt der Prototyp auf lokale Speicherung zurück (`fallbackLocal()`).
- Audio unter `mix/minus_<stimme>.mp3`, `mix/all.mp3`, `stems/<stimme>.mp3` – nicht im Repository. Erzeugen mit `tools/make_mixes.sh` aus den Einzelspuren (Quelle: Matthias, Google Drive bzw. iCloud »Arrangements/bad touch/26_Bad Touch 2.0/Einzelspuren«).

Lokal starten: `node tools/rangeserver.js "$PWD/prototype/v7" 8771` und `http://localhost:8771` öffnen. Testhilfen im Browser unter `window.__probelokal`.
