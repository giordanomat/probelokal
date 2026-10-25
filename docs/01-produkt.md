# 01 · Produkt und Entscheidungen

Stand 25.10.2026. Quelle der Entscheidungen: Gespräche mit Matthias Giordano (Inhaber, spielt selbst Trompete), Prototyp v7.

## Was es ist

Ein Rundumpaket für Amateure und Neulinge, die in einer Guugge oder Brass-Kleinformation spielen – oder allein üben. Auf Smartphone, iPad und Desktop. Auch für Leute, die keine Noten lesen können. Spass an der Musik steht vorne; Üben soll kurz und wirksam sein.

Geschäftsmodell (aus dem Produktkonzept in Drive): Kauf = Lizenz einer Guugge für eine Fassung eines Arrangements, schaltet alle Stimmen für alle Mitglieder frei. Ziel ist, dass Guuggen das Probelokal abonnieren. Markt: zuerst Schweiz, dann international. Preise sind offen.

## Bereiche

### Stück üben
- **Bahn:** Töne laufen als Balken zur Spiellinie. Höhe = Tonhöhe nach Notenlinien (Linie/Zwischenraum, nicht chromatisch), Länge = Dauer. Darunter die **Griffspur**: drei Zeilen für Ventil 1/2/3 (Trompete, Euphonium, Sousaphon) bzw. sieben Zeilen für die Zugpositionen (Posaune). Teilbuchstaben und Taktnummern oben, Atemzeichen bei Pausen ab ¾ Schlag.
- **Hilfen-Stufen:** Alles · Ohne Griffe · Nur Rhythmus (alle Töne auf einer Höhe) · Auswendig (nur Takte und Einsätze).
- **Brücke zum Notenlesen:** »Notenlinien« blendet das System über die Bahn, »Notennamen« schreibt deutsche Namen in die Balken (H und B). Zusätzlich echte Notenansicht (OpenSheetMusicDisplay).
- **Griff-Anzeige:** grosser aktueller Griff (Ventilkreise bzw. Zugskala), Tonname und Länge, nächster Griff, Schläge im Takt, Einzählen vor jedem Einsatz (ein Takt Anlauf).
- **Band:** Pro Stimme eine Minus-One-Mischung (alle ausser mir) plus die eigene Stimme als Führung: Aus / Leise / Laut. Tempo 50–100 % ohne Tonhöhenänderung, Teil in Schleife.
- **Übe-Modi:** Mitspielen · **Echo** (zwei Takte vorhören mit eigener Stimme, dann dieselben zwei Takte selbst spielen) · **Rhythmus tippen** (ohne Instrument, Rückmeldung in Millisekunden).
- **Mithören:** Tonhöhenerkennung im Browser, nie Audio-Upload. Bewertung pro Ton (getroffen/knapp/falsche Stufe/daneben/nicht gehört). Bläser-spezifisch: richtiger Griff, aber anderer Naturton → »eine Stufe zu hoch: Lippen lockerer« usw. Tempoleiter: ab 80 % Treffern +5 % Tempo vorschlagen, unter 50 % langsamer.
- **Baustellen:** Takte mit vielen Fehlern sammeln, mit einem Knopf als Schleife bei 70 % üben. Nur auf dem Gerät gespeichert.
- **Darstellung:** dunkel als Standard, hell wählbar. Vollbild für die Bahn. Abstand zoombar.

### Hinweise der Leitung
Die Leitung markiert Takte und schreibt Dynamik (pp–ff, cresc., decresc.), Artikulation, Atemstellen oder freie Hinweise – für alle, ein Register (Trompeten · Posaunen · Tiefes Blech) oder eine Stimme. Sie erscheinen in Bahn und Noten, mit »neu« bis gelesen.

### giordanomat-Dirigent (KI)
Ein KI-Übebegleiter **von giordanomat**, nicht die musikalische Leitung der Guugge (Entscheidung 25.10.2026).
- Tagesvorschlag (~12 Min.): fällige Etappenprüfung, Einblasen, Baustelle oder Echo, zum Schluss einmal durchs Stück »nur zum Spass«.
- Einblasen als Vorspielen–Nachspielen auf der Bahn: Lange Töne, Lippenbindungen, Zungenstoss, Tonleiter-Häppchen, Bonus »Schränz-Groove« (ab Level 3). Zwei Stufen. Griffe und Lage passend zur Stimme.
- Prüft den Stand: im Plan, voraus, hinterher; nach nicht bestandener Etappe ein persönlicher Tipp.
- Fragen an den Dirigenten (Technik, Notenlesen, Theorie). Im Produkt über eine eigene Server-Funktion mit giordanomat-API-Schlüssel und Kostenlimit pro Guugge, nicht über das Konto der Person.
- Übungstexte sind Entwürfe; fachlich abnehmen durch Matthias.

### Pläne
- **Gesamtplan (Leitung):** Start, Auftrittsdatum, Wochentag Gesamtprobe, Wochentag Registerprobe, Einzel-Übezeit pro Woche → Wochen mit Zielen, Meilensteine. Aufteilung im Prototyp: 55 % Lernen, 20 % Tempo, 15 % Auswendig, Rest Feinschliff; Teile nach Schwierigkeit gewichtet (Töne pro Takt, kurze Noten, Lage über alle Stimmen). **Diese Aufteilung ist eine Annahme und mit echten Guuggen zu prüfen.**
- **Mein Plan (jede Person):** Fälligkeit jeder Etappe pro Teil, Stand voraus/im Plan/hinterher, »Als Nächstes« (überfällig rot), Wochenziele mit Haken.
- **Übersicht der Leitung:** Register-Durchschnitte und eine Tabelle Register × Teil mit durchschnittlich erreichter Etappe gegen den Plan. Keine Einzelwerte.

### Etappenprüfungen (je Teil, je Stimme)
1. **Gehört** – Quiz, automatisch aus den Noten erzeugt (erster Griff, höchster Ton, Taktzahl, Länge des ersten Tons). 3 von 4 richtig.
2. **Griffe sitzen** – bis zu 10 Töne des Teils, jeweils Griff bzw. Zug wählen. 80 %.
3. **80 % Tempo** – Teil spielen (Mithören) oder Rhythmus tippen. 80 %.
4. **Originaltempo** – wie 3 bei 100 %. Ohne Mikrofon: zählt, aber markiert und halbe Punkte.
5. **Auswendig** – Hilfen »Auswendig«, sonst wie 4.

Bewertung: getroffen = 1, knapp/falsche Stufe = 0,5. Der Stand eines Teils zählt **nur über bestandene Prüfungen**, nicht über Selbsteinschätzung. Teile ohne Noten für eine Stimme gelten als »Pause für dich«.

### Punkte, Ränge, Belohnungen
- Punkte nur für nachgewiesene Leistung, **nicht für Zeit**, **keine täglichen Serien** (bestraft Leute mit wenig Zeit). Prototyp-Werte: Etappe 40 (+20 ab 95 %, +15 rechtzeitig, ohne Mikrofon bei 4/5 halbiert), bewerteter Durchgang bis 15 (max. 15 pro Tag), Übung 5 (max. 6 pro Tag), Wochenziel »an 3 Tagen geübt« 25.
- Sieben Ränge: Schnupperi (0) · Lehrling (100) · Schränzer (250) · Gassenhauer (500) · Bühnenfuchs (850) · Guuggen-Ass (1300) · Fasnachtslegende (1900). **Namen und Werte sind Vorschläge.**
- Belohnungen: Bahn-Look »Fasnacht« (Farbe je Griff), Bonusübung »Schränz-Groove«, Bahn-Look »Gold«, goldener Name, Abzeichen; dazu eigene Belohnungen der Leitung pro Level.
- **Punkte müssen im Produkt serverseitig vergeben werden** (siehe Architektur). Im Prototyp sind sie manipulierbar.

### Rangliste
- Die Leitung schaltet sie für die Guugge ein oder aus.
- Jede Person entscheidet selbst, ob sie erscheint – **Standard: aus** (Entscheidung 25.10.2026, »keine Vollüberwachung«).
- Sortierung Gesamt oder diese Woche; Register-Wertung aus den Teilnehmenden.

### Zusammen proben
- **Kein Live-Zusammenspiel über das Internet** (Netzverzögerung). Entschieden 25.10.2026.
- Gemeinsamer Stand (Stück, Fassung, Hinweise, Plan) und ein **Leitgerät** im selben Raum: ein Gerät steuert Stück, Teil, Tempo, Schleife; alle anderen folgen in ihrer Stimme.
- Mithören funktioniert nur beim Einzelüben mit Kopfhörern.
- Offline: Stücke vorab aufs Gerät laden (Probelokale ohne Empfang).

## Rollen
Musikalische Leitung · Registerchef · Mitglied. Im Prototyp nur über die Freigabestufe angenähert; im Produkt echte Rollen pro Guugge.
