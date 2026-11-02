# Testprotokoll M2 · Konten, Guugge, Pläne, Etappen, Punkte

Vorlage für die Abnahme von M2 (Kriterien in `docs/05-roadmap.md`). Einmal pro Durchgang ausfüllen. Felder »Ist« und »OK?« beim Test eintragen, Auffälliges unter »Bemerkungen«.

Die automatischen Tests (Rechte pro Rolle, Punkteregeln, Abläufe) laufen in CI gegen einen Nachbau von Supabase. Dieses Protokoll prüft dasselbe am **echten Projekt und auf echten Geräten**. Alles, was hier zum ersten Mal echt läuft, ist im Text als »erstmals echt« markiert.

## Rollen und Geräte

| Kürzel | Wer | Gerät | Stimme |
|---|---|---|---|
| **L** | Leitung (Matthias) | **A**: Computer oder iPad, Browser | – |
| **T1** | Trompete 1 (Matthias mit Trompete) | **B**: iPhone, App auf dem Home-Bildschirm | Trp 1 |
| **T2** | Trompete 2 | beliebig, z. B. A in einem privaten Fenster | Trp 2 |
| **T3** | Trompete 1 | beliebig | Trp 1 |
| **P1** | Posaune (freiwillig) | beliebig | Pos 1 |

Drei Trompeten braucht es, weil die Leitung ein Register erst ab drei Personen sieht. T2, T3 und P1 müssen keine echten Personen sein, es reichen eigene Adressen. Bei Gmail gehen Varianten mit Plus, z. B. `name+t2@gmail.com`; sie landen im selben Postfach.

## Vorbereitung (einmal)

- [ ] **Eigener Mailversand (SMTP) eingerichtet** (docs/02 »Einstellungen in Supabase«, Schritt 3). Ohne ihn schickt Supabase Codes nur an Adressen aus dem Team des Projekts und nur wenige pro Stunde (Supabase-Doku »Send emails with custom SMTP«). T2, T3 und P1 könnten sich dann nicht anmelden.
- [ ] PR #4 gemergt und alle Migrationen angewendet (docs/03 »Anwenden«). Der Ablauf »Supabase-Migrationen« zeigt bei `anzeigen` alles bis `20261029220000` als angewendet.
- [ ] Supabase → Advisors → Security Advisor: keine Fehler. Warnungen für `SECURITY DEFINER`-Funktionen sind gewollt (docs/03). Bildschirmfoto an Claude.
- [ ] Supabase → Database → Publications → `supabase_realtime`: Tabelle `hints` ist eingeschaltet.
- [ ] Authentication → URL Configuration und die beiden Mailvorlagen gesetzt (docs/02 »Einstellungen in Supabase«, Schritte 1 und 2).
- [ ] Für den Ton: Mischungen und `score.musicxml` liegen im Storage (siehe `m1-abnahme.md`, Vorbereitung), Testcode zur Hand.
- [ ] Gerät B: `https://probelokal.ch/ueben` in Safari öffnen, »Zum Home-Bildschirm«, ab jetzt nur diese App benutzen. Testcode unter `/zugang` in der App eingeben.
- [ ] Kopfhörer mit Kabel und Trompete für Abschnitt 4.

## Durchgang

| | |
|---|---|
| Datum | |
| Person | |
| Gerät A (Modell, Browser) | |
| Gerät B (Modell, iOS-Version) | |
| Adressen L, T1, T2, T3, P1 | |

## 1 · Anmelden (Gerät B, T1)

| Prüfung | Soll | Ist | OK? |
|---|---|---|---|
| »Meine Guugge« → »Anmelden →«, Adresse eingeben, »Code schicken« | »Schau in deine Mails.« | | |
| Mail kommt an | innert einer Minute, Betreff »Dein Code fürs Probelokal«, nicht im Spam. Zeit notieren | | |
| Wie lang ist der Code? | 6 Ziffern (die Eingabe nimmt 6 bis 12). Erstmals echt | | |
| Falschen Code eintippen | »Der Code stimmt nicht oder ist abgelaufen.« Erstmals echt: Supabase könnte anders antworten, Text notieren | | |
| Richtigen Code eintippen | angemeldet, Seite »Meine Guugge« | | |
| Den Link in derselben Mail antippen (öffnet Safari, nicht die App) | in Safari angemeldet; in der App bleibt alles gleich. Erstmals echt | | |
| Namen eintragen, »Speichern« | »Gespeichert.« | | |
| App ganz schliessen und neu öffnen | noch angemeldet | | |

## 2 · Guugge und Einladung (L auf A, T1 auf B, dann T2, T3)

| Prüfung | Soll | Ist | OK? |
|---|---|---|---|
| L meldet sich an, »Name der Guugge« »Testguugge«, »Anlegen« | Seite der Guugge, Rolle »Leitung« | | |
| L: Rolle »Mitglied«, »Einladungslink erstellen«, Link per Nachricht an Gerät B schicken | Link endet auf `/einladung#…` | | |
| B: Link in der Nachricht antippen (öffnet Safari) | Einladung in die Testguugge; dort anmelden (Code) und beitreten | | |
| B: zurück in die App | Testguugge erscheint ohne erneute Einladung | | |
| T1 wählt Stimme Trp 1 | gespeichert | | |
| L lädt T2 (Trp 2), T3 (Trp 1) und freiwillig P1 (Pos 1) ein, alle treten bei | Mitgliederliste bei L vollständig, mit Stimmen | | |
| T1 sieht die Seite der Guugge | keine Knöpfe zum Einladen, für Rollen oder zum Entfernen | | |
| L macht T1 zum Registerchef und wieder zum Mitglied | Rolle wechselt bei L und nach Neuladen bei T1 | | |
| L: »Alle Einladungslinks zurückziehen«, dann den alten Link nochmals öffnen | Beitritt geht nicht mehr, verständliche Meldung (Text notieren) | | |

## 3 · Plan (L auf A, T1 auf B)

| Prüfung | Soll | Ist | OK? |
|---|---|---|---|
| L: »Plan ansehen →«, Start heute, Auftritt in etwa 6 Wochen, Gesamtprobe und Registerprobe wählen, Minuten pro Woche, »Plan speichern« | Wochen und Meilensteine erscheinen | | |
| T1: »Mein Plan« | Stand in %, voraus oder hinterher, »Als Nächstes« mit Fälligkeit, Wochenziele | | |
| T1: Teile, in denen Trp 1 nichts spielt | als Pause, zählen als erledigt | | |
| T1: »Gesamtplan« | sichtbar, aber nicht änderbar | | |

## 4 · Etappen (T1 auf B, mit Trompete und Kopfhörer)

Bestehen: Etappe 1 ab 75 %, sonst ab 80 %. Punkte beim ersten Bestehen 40, ab 95 % plus 20, bis zur Fälligkeit plus 15.

| Prüfung | Soll | Ist | OK? |
|---|---|---|---|
| »Prüfung Teil A, Etappe 1«: Quiz | Ergebnis mit Punkten, Rang steigt | | |
| Gleich nochmals Etappe 1 | »Wiederholen geht, gibt aber keine Punkte.« | | |
| Etappe 2: Griffe | bestanden, Punkte | | |
| Nach Etappe 1 und 2, beide vor der Fälligkeit | mindestens 110 Punkte, Level 2 (Lehrling) | | |
| Etappe 3: »Vorspielen mit Mikrofon« | »Stück üben« mit Teil A, 80 % Tempo, gesperrten Einstellungen; Mikrofon startet mit »Abspielen« | | |
| Etappe 3 sauber gespielt | bestanden (ab 80 %), Punkte, Links »Weiter zu Etappe 4« und »Zurück zum Plan«. **Erstmals mit echtem Instrument** | | |
| Etappe 3 absichtlich schlecht | nicht bestanden, Ermutigung, kein Punkt | | |
| Etappe 4 (Originaltempo) und 5 (Auswendig: die Bahn zeigt nur die Einsätze) | wie Etappe 3. Treffer notieren | | |
| Etappe 4 mit »Ohne Mikrofon: Rhythmus tippen« | zählt, aber halbe Punkte | | |
| »Mein Plan« danach | Etappen und Stand nachgeführt, »Als Nächstes« weiter | | |

## 5 · Punkte für Üben (T1 auf B)

| Prüfung | Soll | Ist | OK? |
|---|---|---|---|
| »Stück üben«, Teil A in der Schleife, Mithören, sauber | nach jedem Durchgang ab 50 % »+… Punkte« | | |
| »Einblasen«, Lange Töne, Mithören, sauber | »+5 Punkte«. **Erstmals mit echtem Instrument** | | |
| Lange Töne ohne Mithören | keine Punkte | | |
| »Punkte und Rangliste →«: »Letzte Punkte« | Etappen, Durchgänge und Einblasen mit Datum | | |
| Wochenziel (über die Woche): an drei verschiedenen Tagen geübt | am dritten Tag +25 »Wochenziel«. Datum der drei Tage notieren | | |

## 6 · Rangliste und Datenschutz (L, T1, T2, T3)

Vorher T2 und T3 je eine Etappe ablegen lassen (Quiz reicht), damit es Werte gibt.

| Prüfung | Soll | Ist | OK? |
|---|---|---|---|
| T1: Rangliste vor dem Einschalten | »Die Rangliste ist für die Guugge ausgeschaltet.« | | |
| L: »Rangliste für die Guugge einschalten« | eingeschaltet | | |
| T1 macht mit (»Ich mache mit«), T2 nicht | bei L und T1 steht nur T1 in der Rangliste, T2 und T3 nicht | | |
| L: Belohnung für Level 2 »Getränk nach der Probe«, »Belohnungen speichern« | T1 sieht sie unter »Belohnungen« | | |
| L: »Gesamtplan« → Übersicht der Register | Trompeten mit Schnitt und »diese Woche geübt«, ohne Namen und Einzelwerte | | |
| Posaunen (nur P1 oder niemand) | erscheinen nicht (unter drei Personen) | | |
| Irgendwo bei L Punkte oder Etappen von T2 sichtbar? | nein, nirgends | | |
| T1 macht nicht mehr mit | verschwindet bei L nach dem Neuladen (die Rangliste aktualisiert sich nicht von selbst) | | |

## 7 · Hinweise der Leitung (L auf A, T1 auf B)

Gerät B hat die Seite »Hinweise« der Testguugge offen.

| Prüfung | Soll | Ist | OK? |
|---|---|---|---|
| L trägt ein: T. 13–16, für Trompeten, Dynamik pp | bei T1 erscheint der Hinweis **ohne Neuladen** mit »neu«. Zeit bis dahin notieren. **Realtime erstmals echt** | | |
| L trägt ein: T. 17–20, für Posaunen, Atmen | bei T1 nicht (oder nur unter »Alle«) | | |
| T1: »Hinhören« | »Stück üben« springt an Takt 12 (ein Takt Anlauf), gelbes Band »pp« über T. 13–16 | | |
| T1: »Noten« | dasselbe Band über den Takten 13–16 | | |
| T1 zurück auf »Hinweise« | »neu« ist weg | | |
| T1: App in den Hintergrund (Home-Taste), L trägt einen weiteren Hinweis ein, nach 1 Minute App wieder öffnen | neuer Hinweis ist da, ohne Neuladen | | |
| L löscht den Trompeten-Hinweis | verschwindet bei T1 ohne Neuladen, auch auf der Bahn | | |
| T1 hat die Seite der Guugge offen, L trägt einen Hinweis ein und löscht ihn wieder | »… neu« bei »Hinweise der Leitung« geht ohne Neuladen hoch und wieder runter | | |

## 8 · Belohnungen (T1 auf B, sobald der Rang erreicht ist)

| Prüfung | Soll | Ist | OK? |
|---|---|---|---|
| Ab Level 2: »Stück üben« → »Bahn-Look« »Fasnacht« | jeder Griff in eigener Farbe; gespielte und bewertete Töne wie immer | | |
| Wirkt »Fasnacht« beim Spielen verwirrend? (Rot, Gelb, Blau bedeuten sonst Bewertung) | Eindruck notieren | | |
| Ab Level 3 (250 Punkte): »Einblasen« → »Schränz-Groove« | spielbar, vorher »ab Level 3« | | |
| Abmelden, dann »Stück üben« | Look wieder Standard | | |

## 9 · Rechte im echten Projekt (Matthias, Supabase → SQL Editor)

Abnahmekriterium »Ein Client kann Punkte nicht direkt schreiben«. Die Abfrage spielt eine angemeldete Person aus der Testguugge und versucht, 1000 Punkte selbst einzutragen. Sie läuft in einer Transaktion und wird am Ende zurückgerollt; selbst wenn der Test fehlschlägt, bleibt nichts zurück.

```sql
begin;
select set_config(
  'request.jwt.claims',
  json_build_object('sub', (select user_id from public.memberships limit 1), 'role', 'authenticated')::text,
  true
);
set local role authenticated;
insert into public.points_ledger (user_id, guugge_id, points, reason)
select user_id, guugge_id, 1000, 'Test' from public.memberships limit 1;
rollback;
```

| Prüfung | Soll | Ist | OK? |
|---|---|---|---|
| Abfrage ausführen | Fehler »permission denied for table points_ledger«. Bildschirmfoto an Claude | | |

Ungeprüft: Die Abfrage lief bisher nur im Nachbau, nicht im SQL Editor von Supabase. Kommt eine andere Fehlermeldung oder gar keine, Bildschirmfoto an Claude.

## Bemerkungen

-

## Entscheide nach M2

Diese Vorschläge sind gebaut und warten auf deinen Entscheid. Abweichungen hier notieren, dann zieht Claude `docs/01` und `docs/02` nach.

- [ ] Ein Übetag zählt erst ab einem getroffenen Ton.
- [ ] Einblasen gibt Punkte nur mit Mithören und ab 50 % getroffen.
- [ ] Bahn-Looks und Schränz-Groove gelten mit dem höchsten Rang aus allen eigenen Guuggen.
- [ ] Die Leitung sieht ein Register erst ab drei Personen.
- [ ] Mindestdauer: Quiz 4 s, Griffe 3 s, auf der Bahn 90 % der Spieldauer.
- [ ] Namen und Punktwerte der Ränge bleiben so.

Danach: Pilot mit 3–5 Leuten aus der Schuegu (docs/05).
