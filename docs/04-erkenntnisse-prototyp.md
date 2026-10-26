# 04 · Erkenntnisse aus dem Prototyp (Bad Touch 2.0)

Alles hier ist am Prototyp gemessen oder beobachtet; wo nicht, steht »ungeprüft«.

## Titel »Bad Touch 2.0«, Fassung Schuegu27

- MusicXML aus Logic, MusicXML 2.0, 7 Parts: P1 Trumpet 1, P2 Trumpet 2, P3 Trombone 1, P4 Trombone 2, P5 Trombone 3, P6 Tuba, P7 SoCal (Schlagzeug).
- Zuordnung im Produkt: P5 → **Euphonium**, P6 → **Sousaphon** (bestätigt von Matthias, 25.10.2026).
- 93 Takte inkl. Vorzähler (Takt 0), durchgehend 4/4, ♩ = 115 (Tempo-Angabe ab Takt 5, gilt aber auch für Takt 0–4), nur eine Stimme pro Part, keine Dynamik im MusicXML.
- Teile aus den Doppelstrichen: Starttakte `0,1,9,13,17,21,25,29,37,45,53,55,59,63,67,71,75,88` → Vorzähler, A–Q.
- **Alle Stimmen sind im Violinschlüssel in B notiert** (Schweizer Guuggen-Praxis). Klang = notiert + shift:
  - Trompete: −2 (gemessen: notiert A4 klingt G4, 393,8 Hz)
  - Posaune, Euphonium in B (Violinschlüssel): −14 (gemessen an Posaune 1)
  - Sousaphon in B (Violinschlüssel): −26 (gemessen)
- **Griffe stehen als Liedtext (lyrics)** unter den Noten: Ventile als `0`, `1`, `2`, `12`, `13`, `23`, `123`; Posaunen als Zugposition `1`–`7`. Alle passen zur Naturtonreihe (automatisch geprüft in `src/lib/music/track.spec.ts`). **Korrigiert 25.10.2026 (Entscheid Matthias):** Sousaphon (P6) Takte 84 und 89, je viermal C5 mit Griff `1` statt `0` – in `prototype/v7/badtouch.xml` auf `0` gesetzt. **In Logic noch nachtragen**, sonst kommt der Fehler mit dem nächsten Export zurück. `3` und `12` sind gleichwertig (beide 3 Halbtöne tiefer).
- **Fehlende Griffe in der MusicXML** (gefunden mit `tools/extract_notes.py` am 25.10.2026): Sousaphon (P6) Takte 17–20 und Takt 45 – 18 Noten; Trompete 2 (P2) Takt 75, Schlag 3,25 – 1 Note. Im Prototyp zeigen diese Noten keinen Griff. **Entscheid Matthias (25.10.2026): aus der Standardtabelle ergänzen** – `extract_notes.py --fill-missing`, die Tabelle deckt alle 19 Noten ab (Sousaphon notiert F4, G4, A4, C5). Die Noten tragen `fing_auto: true` und werden in der App als ergänzter Griff gekennzeichnet.
- Teile aus Doppelstrichen: `extract_notes.py` findet alle ausser dem Ende des Vorzählers (Takt 1) – das ist kein Doppelstrich und muss pro Titel ergänzt werden.
- Naturtonreihe in B, notiert: 48, 60, 67, 72, 76, 79, 82, 84, 86, 88 (MIDI). Für Ventil und Zug gleich, weil alles in B-Violinschlüssel notiert ist.

## Audio

- **Die Einzelspuren beginnen genau 3 Takte (6,261 s bei ♩ 115) vor Takt 0.** Gemessen am 26.10.2026 an den WAV-Exporten »… Bad Touch 02.wav« (44,1 kHz, 24 Bit): Der erste Ton (Takt 1, Schlag 1 = 8,348 s) setzt in Trompete 1, Posaune 1 und Sousaphon bei 8,349–8,351 s ein, Trompete 2 bei 8,356 s. Die Kreuzkorrelation gegen den Tutti-Bounce ergibt 6,237 s (konstant, keine Drift) – die 24 ms Unterschied sind sehr wahrscheinlich der Encoder-Vorlauf der Bounce-**MP3** (LAME ≈ 1105 Samples = 25 ms). Der Prototyp nahm 6,237 s; im Produkt gilt 6,261 s (`stem_offset_sec`). Folge für die Produktionsstrecke: Versatz gegen einen WAV-Bounce messen, nicht gegen MP3. Ungeprüft: ob Safari den Vorlauf unserer eigenen MP3-Mischungen genauso entfernt wie Chrome (betrifft Bahn ↔ Ton, bis 25 ms; Band und eigene Stimme verschieben sich gleich).
- **Export-Regel für alle weiteren Titel:** Einzelspuren und Tutti ab demselben Startpunkt exportieren; Vorzähler mit Klick mitexportieren. Dann entfällt die Messung (sie bleibt als Prüfung in `tools/measure_offset.py`).
- Minus-One-Mischungen per ffmpeg `amix=inputs=N:normalize=0,alimiter=limit=0.89:level=0` (ohne `level=0` zieht der Limiter den Pegel automatisch auf 0 dB hoch), MP3 128 kbit/s. Längen: Gesamtmischung 204,4 s, Einzelspuren 200,7 s (Schlagzeug länger) – unkritisch, Start gleich.
- Die alten »Übungsfiles« (Fokus-Mischungen vom Juni) liefen bei ♩ ≈ 110 und passten nicht zur MusicXML; nicht mehr verwendet.
- iOS: `element.volume` wird ignoriert → Lautstärke der eigenen Stimme über `GainNode` (umgesetzt). `AudioContext` erst bei einer Nutzergeste erzeugen.
- Sieben gleichzeitige `<audio>`-Elemente (frühe Version) waren auf dem Desktop synchron; auf Handys nie getestet. Mit Minus-One sind es nur zwei.

## Tonerkennung (YIN)

- Schwelle 0,15; parabolische Interpolation; RMS-Tor `max(0,006; 3 × gleitender Rauschboden)`.
- Frequenzbereiche: Trompete 140–1100 Hz (ohne Dezimierung, Fenster ≥ 22 ms), Posaune/Euph 60–600 Hz und Sousaphon 35–300 Hz (Dezimierung 2, Analyser-Puffer 8192).
- Bewertungsfenster pro Ton: ab Tonbeginn + min(60 ms; 30 % der Tondauer) bis Tonende − min(40 ms; 20 %). Ton »getroffen«, wenn ≥ 50 % der stimmhaften Frames innerhalb ±50 Cent liegen; »knapp« bis ±100 Cent; »falsche Stufe«, wenn der erkannte Ton + Griff-Absenkung ein Naturton ist; sonst »daneben«; ohne stimmhafte Frames »nicht gehört«.
- **Fehler im Prototyp (gefunden 25.10.2026):** `lowerOf()` las Zugpositionen `1`–`3` wie Ventile (Zug 1 → 2 Halbtöne statt 0, Zug 3 → 3 statt 2). Dadurch war »falsche Stufe« bei der Posaune auf Zug 1 und 3 falsch. Im Produkt kennt die Absenkung die Instrumentenart (`loweringOf(fing, kind)`).
- **Gegenprobe mit den Einzelspuren (Logic-Instrumente, nicht echte Bläser):** Trompete 1: 345/345 Töne erkannt; Posaune 1: 336/336; Sousaphon: 374/393 (95 %), 19 nicht gehört, **keiner falsch**. Synthetische Töne (Sägezahn): richtig, ±10 Cent, Naturton höher, falscher Ton korrekt klassifiziert.
- **Ungeprüft:** echte Bläser, Handymikrofone, Hall im Probelokal, tiefe Instrumente in echt, Bluetooth-Verzögerung.
- Verzögerung im Prototyp: Mikrofon `0,08 s + outputLatency + baseLatency`; Vorführung (eigene Spur als Spieler) 0,02 s. Muss pro Gerät abgeglichen werden.

## Rhythmus tippen

- Toleranz: ≤ 70 ms getroffen, ≤ 140 ms knapp, sonst daneben; Tipp > 250 ms von jedem Ton entfernt = »da kommt kein Ton«; nicht getippte Töne nach 250 ms = verpasst.
- Ausgleich: `outputLatency + baseLatency + 15 ms`. Simuliertes, exaktes Tippen: 20/20 getroffen. **Echte Finger auf echten Handys: ungeprüft.**

## Bedienung

- Einzählen: Springen in einen Teil startet einen Takt vorher; Bahn zeigt grosse Zählzahl, Anzeige »Einzählen · gleich«.
- Echo-Ablauf: Phase »Hör zu« (eigene Stimme laut) über 2 Takte, zurück mit Anlauf, Phase »Jetzt du« (eigene Stimme stumm), dann nächste 2 Takte; am Teilende Durchgangsergebnis.
- Auf dem Handy liegt die Bahn weit unten: Play scrollt sie in den Blick. Vollbild blendet alles ausser Bahn und Transport aus.
- Artifact-Plattform (claude.ai): kein Mikrofon als Fähigkeit vorgesehen; Rollen nur über Freigabestufen; Punkte im Browser → manipulierbar. Gründe für den Umzug in eine eigene App.

## Planerzeugung (Prototyp)

- Wochen ab Montag der Startwoche bis Auftrittswoche. Phasen: Lernen 55 %, Tempo 20 % (mind. 1 Woche ab 4 Wochen), Auswendig 15 % (mind. 1 ab 5), Rest Feinschliff.
- Lernwoche pro Teil nach kumuliertem Schwierigkeitsgewicht (Töne/Takt + 0,8 × Sechzehntel/Takt + Umfang in Oktaven, gemittelt über die 6 Stimmen, × Taktzahl/4, min. 0,5).
- Fälligkeit je Etappe: 1 = Ende Lernwoche, 2 = Ende folgende Woche (max. letzte Lernwoche), 3 = Ende Lernphase, 4 = Ende Tempophase, 5 = Ende Auswendigphase.
