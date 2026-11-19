# Pilot mit der Schuegu

Plan, freigegeben von Matthias am 19.11.2026 (Leitung, Teilnehmende, Auswertung). Was noch **OFFEN** ist, ist markiert. Die Ergebnisse kommen am Ende in diese Datei (Abschnitt »Ergebnisse«), Entscheidungen daraus nach `docs/01-produkt.md` (Roadmap, »Pilot«).

## Ziel

Zwei bis drei Wochen mit 3–5 Leuten aus der Schuegu und einem echten Gesamtplan. Wir wollen wissen:

1. Üben die Leute damit, und zwar mehr als einmal?
2. Hilft es, die eigene Stimme sicherer zu können (Etappen, Echo, Mithören)?
3. Hilft der Gesamtplan der Leitung, und stimmt seine Aufteilung (etwa die Hälfte Lernen, dann Tempo, Auswendig, Feinschliff)?
4. Spornen Punkte, Level und Rangliste an, oder stören sie?
5. Was ist unklar, was fehlt, was nervt?

## Bevor es losgeht (Checkliste)

- [ ] M2-Abnahme auf dem Gerät bestanden, vor allem Mikrofon (Lange Töne), Etappen 3–5, Konto löschen und Guugge auflösen mit Wegwerf-Daten (Abschnitte 10, 11).
- [ ] Impressum und Datenschutz live (Entwurf liegt vor, es fehlen die Angaben von Matthias und Hans).
- [ ] Testcode bereit; `score.musicxml` im Speicher, damit die Notenansicht geht.
- [ ] Rückmeldung einmal selbst geschickt und in Supabase → Table Editor → `feedback` gesehen (Abschnitt 12).
- [ ] Die sechs »Entscheide nach M2« im Testprotokoll abgehakt oder geändert.
- [x] Leitung im Pilot: Matthias (Entscheid 19.11.2026).

## Wer macht mit (Entscheid Matthias 19.11.2026)

- **Leitung:** Matthias. Er wählt im Pilot keine Trompetenstimme, sonst zählt er im Register mit und könnte aus dem Durchschnitt auf die anderen schliessen.
- **Drei Trompeten** (Trp 1 oder Trp 2), damit »So steht die Guugge« das Register zeigt (Datenschutz-Regel: erst ab drei Personen mit gewählter Stimme). Weitere Stimmen von Bad Touch (Pos 1/2, Euph, Sous) dürfen dazu, höchstens 5 Personen insgesamt. Pauke und Chochi gehen noch nicht.
- Wenn möglich: mindestens eine Person, die keine Noten liest; ein Android-Handy und ein iPad neben iPhones.
- Jede Person braucht: eigenes Handy oder iPad mit E-Mail-Adresse, eigenes Instrument, Kopfhörer mit Kabel (Bluetooth verzögert stark), Zeit für 15 Minuten Start, zwei bis drei Wochen je ein paar Mal 10–15 Minuten, 10 Minuten Gespräch am Ende.
- **OFFEN:** Namen. Zusagen am besten persönlich einholen, nicht nur per Chat.

## Ablauf

**Woche 0 (Einrichten, etwa 30 Minuten, Leitung):**
1. Guugge »Schuegu Pilot« anlegen.
2. Gesamtplan anlegen. **OFFEN (folgt von Matthias):** Auftrittsdatum. Ein echtes Ziel (Fasnacht oder ein Ständli) wirkt besser als ein ausgedachtes.
3. Einladungslink erstellen und mit der Nachricht unten verschicken; den Testcode separat.

**Start (15 Minuten an einer Probe, alle mit Handy):**
1. Link öffnen, anmelden, Stimme wählen.
2. In Safari »Teilen« → »Zum Home-Bildschirm«; ab dann nur noch diese App benutzen.
3. `probelokal.ch/zugang`, Testcode eingeben.
4. »Stück üben« → »Mehr« → »Tippen abgleichen«, einmal.
5. Einmal »Mithören« drücken und das Mikrofon erlauben.
6. Zeigen, wo »Rückmeldung geben« ist.

**Woche 1–3:**
- Die Leute üben, wann sie wollen. Die Leitung schreibt wie gewohnt Hinweise und schaut auf »So steht die Guugge«.
- **Ein fester Tag pro Woche** (Vorschlag: Sonntagabend): Matthias liest die neuen Rückmeldungen (Table Editor → `feedback`), führt die Abfrage aus und gibt Claude die wichtigsten Punkte. Fehler werden in derselben Woche behoben.
- Nichts nachfragen, solange es läuft. Wir wollen sehen, ob es ohne Anstoss genutzt wird.

**Ende (je 10 Minuten pro Person, persönlich oder am Telefon):** die Fragen unten, Antworten stichwortartig unter »Ergebnisse«.

## Woran wir es messen

Grundsatz »keine Vollüberwachung«: Auch im Pilot schauen wir nicht in die Einzelwerte der Leute. Es zählen nur:

- **Nur gesamt** (Entscheid Matthias 19.11.2026), aus der Datenbank: pro Woche wie viele Personen geübt haben, Übetage im Schnitt, bestandene Etappen insgesamt. Keine Namen, ohne die Leitung. Abfrage: `supabase/queries/pilot_wochen.sql` im Supabase-Dashboard → SQL Editor (Namen der Guugge darin anpassen); sie liest nur. Getestet in `supabase/tests/rls.spec.ts`.
- **Rückmeldungen** aus der App.
- **Gespräch am Ende.**

Erfolg (Vorschlag von Claude, noch nicht freigegeben):
- Mindestens 3 von 5 Personen üben in mindestens 2 der 3 Wochen an mindestens 2 Tagen.
- Mindestens die Hälfte besteht Etappe 3 in einem Teil (Spielen zur Band mit Mithören).
- Keine Rückmeldung »Mithören bewertet falsch«, die wir nicht innert einer Woche erklären oder beheben können.
- Die Leitung sagt, der Gesamtplan habe ihr bei mindestens einer Probe geholfen.

## Fragen am Ende

1. Wie oft hast du geübt, und was hat dich dazu gebracht?
2. Was hast du am meisten benutzt: Mitspielen, Echo, Rhythmus, Aufwärmen, Etappen?
3. Hat das Mithören richtig gehört? Wo nicht?
4. Wusstest du immer, was als Nächstes dran ist (»Heute dran«)?
5. Punkte, Level, Rangliste: motivierend, egal oder störend?
6. Was war unklar? Was hat gefehlt? Würdest du weitermachen?
7. Nur Leitung: Hat der Gesamtplan geholfen? Stimmte die Aufteilung? War »So steht die Guugge« nützlich?

## Risiken

- **Mikrofon ungenau:** Etappen 3–5 frustrieren. Deshalb vorher Lange Töne testen und den Abgleich der Verzögerung zeigen.
- **Musik:** Bad Touch wird nur intern geübt, kein öffentliches Teilen von Aufnahmen. Die Musikrechte für Werbung sind weiter offen.
- **Ton aus:** Stummschalter am iPhone aus. Das gleich beim Start zeigen.
- **Konten:** Die Pilot-Leute geben ihre E-Mail an, deshalb erst starten, wenn der Datenschutz live ist.

## Nachricht an die Pilot-Leute (zum Einfügen)

> Hoi zäme
>
> Danke, dass ihr beim Pilot von Probelokal mitmacht! Zwei bis drei Wochen lang übt ihr Bad Touch mit der App, wann ihr wollt. Am Schluss frage ich euch kurz, wie es war.
>
> 1. Öffnet diesen Link: [Einladungslink]. E-Mail eingeben, Code aus der Mail eintippen, Stimme wählen.
> 2. In Safari »Teilen« → »Zum Home-Bildschirm«, dann immer über das Symbol öffnen.
> 3. probelokal.ch/zugang öffnen und den Testcode eingeben, den ich euch separat schicke.
> 4. Stummschalter am iPhone aus, dann »Stück üben«.
>
> Fällt euch etwas auf, ob Fehler, Idee oder Lob: in der App unter »Mehr« → »Rückmeldung geben«. Wir lesen alles.
>
> Matthias und Hans

## Ergebnisse

Noch keine. Hier nach dem Pilot: Zahlen pro Woche, Rückmeldungen (zusammengefasst), Antworten aus den Gesprächen, Entscheidungen.
