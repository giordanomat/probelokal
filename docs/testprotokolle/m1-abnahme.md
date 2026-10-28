# Testprotokoll M1 · Üben ohne Konto, ein Titel, Mikrofon-Test

Vorlage für die Abnahme von M1 (Kriterien in `docs/05-roadmap.md`). Pro Gerät einmal ausfüllen. Felder »Ist« und »OK?« beim Test eintragen, Auffälliges unter »Bemerkungen«. Zahlen sind Startwerte und werden nach dem ersten Test angepasst (dann `docs/05` nachziehen).

## Vorbereitung (einmal)

- [ ] Im Bucket `titles` liegen unter `bad-touch-2-0/schuegu27/` die 13 Mischungen (`all.mp3`, `minus_<stimme>.mp3`, `<stimme>.mp3` für `trp1 trp2 pos1 pos2 euph sous`) und `score.musicxml` (= `prototype/v7/badtouch.xml`).
- [ ] Die App ist live: `https://probelokal.ch/ueben` zeigt die Bahn (nicht 404).
- [ ] Testcode zur Hand (Cloudflare-Secret `TEST_ACCESS_CODE`).
- [ ] Kopfhörer **mit Kabel** (Bluetooth verzögert stark; siehe docs/04).
- [ ] Zum Messen `https://probelokal.ch/ueben?diag` öffnen. Die Zeile »Messung: …« zeigt die grösste Abweichung der eigenen Spur von der Band, die Ausgabe-Latenz und die Verzögerung beim Mithören.

## Gerät

| | |
|---|---|
| Datum | |
| Person | |
| Gerät und Modell | |
| iOS-Version | |
| Browser bzw. Home-Bildschirm-App | |
| Kopfhörer | |
| Instrument | |

## 1 · Laden und Ton

| Prüfung | Soll | Ist | OK? |
|---|---|---|---|
| `/zugang`: Code eingeben | Weiter zu `/ueben`, »Dein Gerät hat schon Zugang« bei erneutem Aufruf | | |
| Abspielen | Band hörbar, Bahn läuft mit | | |
| »Meine Stimme« Aus / Leise / Laut | Eigene Stimme verschwindet bzw. wird leiser/lauter (GainNode, iOS) | | |
| Teil wählen, z. B. Teil C | Einzählen, Bahn und Ton starten bei Takt 12 | | |
| Tempo 70 % | Langsamer, Tonhöhe bleibt | | |
| »Noten« | Noten der gewählten Stimme, aktueller Takt markiert | | |

Wenn kein Ton: Steht ein Hinweis über der Bahn? Mögliche Ursache sind fehlende CORS- oder Range-Antworten bei Supabase (docs/02 »Audio«).

## 2 · Bahn und Gleichlauf (iPhone und iPad, Safari)

| Prüfung | Soll | Ist | OK? |
|---|---|---|---|
| Bahn läuft flüssig über das ganze Stück | kein Ruckeln, keine Sprünge | | |
| Abweichung eigene Spur (Anzeige `?diag`) nach dem ganzen Stück, »Meine Stimme« Laut | ≤ 50 ms (Nachführen ab 50 ms ist eingebaut; Wert davor notieren) | | |
| Anzahl Korrekturen (Anzeige `?diag`) | Zahl notieren | | |
| Hörbar doppelt / flatternd? | nein | | |
| Vollbild | nur Bahn, Griffe, Wiedergabe | | |

## 3 · Mithören mit Trompete

Vorher einmal »Verzögerung abgleichen« (Kopfhörer ab, Lautsprecher laut), dann Kopfhörer wieder auf.

| Prüfung | Soll | Ist | OK? |
|---|---|---|---|
| Mikrofon-Freigabe in Safari | Abfrage erscheint, danach »Ich höre zu« | | |
| Gemessene Verzögerung | Wert notieren (ms); Hinweis bei > 150 ms | | |
| **Lange Töne:** unter »Einblasen« die Übung Lange Töne, Stufe Einstieg, Mithören an, sauber nachgespielt | Treffer ≥ 90 % (»Geschafft: … von 8 Tönen getroffen«) | | |
| Lange Töne, Stufe Weiter (15 Töne, auch Halbtöne) | Treffer ≥ 90 % | | |
| **Teil A** (T. 1–8) bei 80 %, sauber gespielt | Treffer ≥ 80 % | | |
| Absichtlich falscher Griff | Ton rot, Rückmeldung »Anderer Ton. Griff: …« | | |
| Richtiger Griff, Naturton daneben (höher bzw. tiefer angeblasen) | Ton gelb, »Richtiger Griff, aber eine Stufe zu hoch/tief …« | | |
| Band setzt beim Mithören aus? | nein (Rechenzeit der Tonerkennung, docs/02) | | |
| Echo mit Mithören | »Hör zu« ohne Bewertung, »Jetzt du« bewertet | | |

**Lange Töne:** unter `/einblasen` (Entscheid Matthias, 28.10.2026: Einblasen gehört in M1). Der Dirigent spielt jeden Ton einen Takt lang vor; bewertet wird nur dein Nachspielen. Der Vorspielton ist synthetisch; ob er auf dem Handy-Lautsprecher bzw. im Kopfhörer brauchbar klingt, hier notieren.

## 4 · Posaune und Sousaphon

Wie Abschnitt 3 mit der Stimme Pos 1 bzw. Sous, sobald jemand verfügbar ist. Für die Posaune zusätzlich: falsche Zugposition statt falscher Griff.

| Instrument | Lange Töne (Einblasen) | Teil A | Falscher Griff/Zug | Naturton | OK? |
|---|---|---|---|---|---|
| Posaune | | | | | |
| Sousaphon | | | | | |

## 5 · Rhythmus tippen

| Prüfung | Soll | Ist | OK? |
|---|---|---|---|
| Teil A in der Schleife tippen | Rückmeldung in ms, Ergebnis nach dem Durchgang | | |
| Wirkt die Bewertung fair? | »im Schnitt genau« bei sauberem Tippen | | |

## 6 · Flugmodus

| Prüfung | Soll | Ist | OK? |
|---|---|---|---|
| Online einmal abspielen, bis »Diese Stimme ist gespeichert« erscheint; »Noten« einmal öffnen | Hinweis erscheint | | |
| Seite einmal neu laden (Service Worker legt die Seite ab) | | | |
| Flugmodus an, App bzw. Seite neu öffnen | Bahn, Ton der gespeicherten Stimme und Noten laufen | | |
| Andere, nicht gespeicherte Stimme im Flugmodus | Hinweis »nicht erreichbar«, Bahn läuft ohne Ton | | |
| Nach einem Tag erneut im Flugmodus öffnen | noch gespeichert (Safari räumt manchmal auf) | | |

## Bemerkungen

-

## Entscheidung nach M1

Reicht der Browser auf iOS (Audio-Gleichlauf, Mikrofon, Latenz)? Wenn nein, die native Hülle vorziehen (M7).

- [ ] Ja, weiter im Browser
- [ ] Nein, native Hülle vorziehen. Grund:
