# 03 · Datenmodell

Grundmodell: `supabase/migrations/0001_grundmodell.sql`, ergänzt um Konten und Guuggen in `20261028150000_m2_konten_guuggen.sql`. Die Regeln sind mit `supabase/tests/rls.spec.ts` getestet (siehe »Tests«).

## Kernideen

- **Lizenz pro Guugge und Fassung** (`licenses`): Kauf schaltet alle Stimmen für alle Mitglieder frei. Audio und Noten (`title_assets`) sind nur mit Lizenz lesbar, ausgeliefert über signierte URLs.
- **Titel als Daten** (`titles.sections`, `titles.voices`): Teile, Stimmen, Transposition (`shift` in Halbtönen, Klang = notiert + shift), Instrumententyp (`valve`/`slide`), Register, Versatz der Einzelspuren. Der Prototyp hat das für Bad Touch hart codiert – siehe `docs/04-erkenntnisse-prototyp.md`.
- **Noten als vorverarbeitetes JSON** (`kind = 'notes_json'`), erzeugt von `tools/extract_notes.py`. Die App parst kein MusicXML zur Laufzeit ausser für die Notenansicht.
- **Fortschritt nur serverseitig geschrieben:** `exam_results`, `points_ledger`, `practice_days` haben keine Client-Schreibrechte. Es schreiben nur Datenbankfunktionen (`finish_exam`, Entscheid Matthias 29.10.2026, siehe docs/02 »Sicherheit«).
- **Stand eines Teils** = höchste bestandene Etappe in `exam_results` (bei Etappe 4/5 mit `via = 'rhythm'` markiert).
- **Privatsphäre:** Leitung sieht über `register_overview()` nur Aggregate (mind. 3 Personen pro Register, Vorschlag). Personen ohne Ergebnis zählen mit Etappe 0, sonst wäre bei drei Personen und einem Ergebnis der Einzelwert ablesbar. Rangliste über `leaderboard()` nur mit Opt-in.
- **Mitgliedschaften und Einladungen ändert der Browser nie direkt**, nur über Funktionen, die selbst prüfen (seit `20261028150000`): `create_guugge`, `create_invite` / `revoke_invites` / `accept_invite`, `set_my_voice` (Register folgt aus der Stimme, `voice_register`), `set_rangliste_opt_in` (nur die Person selbst), `set_member_role` und `remove_member` (Leitung; die letzte Leitung bleibt), `guugge_members` (Name, Rolle, Stimme für alle Mitglieder). Vorher erlaubte 0001 einem Mitglied, die eigene Rolle auf Leitung zu setzen, und der Leitung, das Opt-in anderer zu setzen; ein Test hält beides fest.
- **Einladung per Link:** Der Schlüssel (64 Hex-Zeichen) steht nur im Link, gespeichert ist sein SHA-256 (`invites.token_hash`). Ein Link gilt für mehrere Personen, 1–60 Tage (Standard 14), bis die Leitung alle zurückzieht. Wer schon Mitglied ist, behält beim Annehmen seine Rolle.
- **Profile** entstehen beim ersten Anmelden (Trigger auf `auth.users`), Name höchstens 40 Zeichen.
- **Teile** sind in `exam_results.section` als Index in `titles.sections` gezählt, ab 0.
- **Etappenprüfungen** (seit `20261029120000`): `start_exam` legt einen Versuch in `exam_attempts` an (kein Client-Zugriff), `finish_exam` prüft und schreibt Ergebnis, Punkte (`points_ledger`, `ref` = Versuch) und Übetag. `my_points` liefert die eigenen Punkte gesamt und diese Woche. Die Punkteregeln (`exam_points`, `exam_pass_mark`) stehen auch in `src/lib/game/points.ts`; `supabase/tests/points.spec.ts` hält beide gleich.
- **Pläne:** `plans.gp_weekday` und `rp_weekday` zählen wie JavaScript, 0 = Sonntag. Lesen und schreiben über `get_plan` und `set_plan` (seit `20261029100000`). `plans.due` hält die Fälligkeit jeder Etappe pro Teil. Sie wird vom Browser der Leitung berechnet, weil die Gewichtung der Teile die Noten braucht; der Server liest daraus nur den Bonus »rechtzeitig«.
- **Pausen pro Stimme:** `titles.voices[].rests` listet die Teile ohne Ton. Sie sind aus den Noten abgeleitet, weil die Datenbank die Noten nicht kennt; `catalog.spec.ts` rechnet sie nach. `register_overview` zählt diese Teile als erledigt, wie »Mein Plan«.
- **Belohnungen der Guugge:** `guuggen.level_rewards` ({"2": "…"} für Level 2–7, je höchstens 80 Zeichen) über `set_level_rewards` (Leitung) und `guugge_settings` (Mitglieder).
- **Katalog:** Bad Touch steht per Migration in `titles`, damit Pläne, Hinweise und Ergebnisse darauf verweisen können. `supabase/tests/catalog.spec.ts` prüft, dass der Eintrag zu `src/lib/titles/bad-touch.ts` passt. Weitere Titel legt später die Produktionsstrecke an (docs/06).

## Offene Punkte

- Wie Registerchefs Hinweise für ihr Register schreiben dürfen (heute nur Leitung).
- Ob Baustellen (heute nur lokal) serverseitig gespeichert werden sollen – Vorschlag: nein, bleiben auf dem Gerät.
- Mehrere Fassungen desselben Titels (Version in `titles.version`, eigene Zeile pro Fassung).
- Löschkonzept: Konto löschen, Guugge auflösen. Beim Austritt bleiben Etappen, Punkte und Übetage bei der Person.
- Zweitkonten: Wer als Leitung eigene Zweitkonten einlädt, kann ein Register auf drei Personen bringen und Einzelwerte zurückrechnen. Das verhindern Datenbankregeln nicht; siehe docs/02.
- Teile ohne Noten für eine Stimme (»Pause für dich«) zählen in `register_overview` noch mit Etappe 0.
- Woche in `register_overview` und `leaderboard` beginnt Montag 0 Uhr in der Zeitzone der Datenbank (bei Supabase UTC), nicht Schweizer Zeit.

## Tests

`supabase/tests/rls.spec.ts` läuft mit `npm run test:unit` (Vitest). Grundlage ist PGlite: Postgres als WebAssembly im Testprozess, ohne Docker. `supabase/tests/supabase-stub.sql` baut den Teil von Supabase nach, auf den die Regeln bauen: die Rollen `anon`, `authenticated`, `service_role`, `auth.users`, `auth.uid()` und die Standardfreigaben im Schema `public`. Danach werden alle Migrationen in Namensreihenfolge angewendet, wie bei der CLI. Getestet wird pro Rolle (nicht angemeldet, fremde Person, Mitglied, Registerchef, Leitung, Service-Rolle).

**Grenze:** PGlite ist nicht Supabase (andere Postgres-Version, Erweiterungen und Auth nur nachgebaut). Nach dem Anwenden deshalb die Supabase Advisors ansehen.

## Anwenden

**Vorher klären (Stand 28.10.2026):** Die GitHub-Anbindung von Supabase ist mit dem Repository verbunden. An PR #4 erscheint der Check »Supabase Preview« (übersprungen). Ist in Supabase unter Project Settings → Integrations → GitHub »Deploy to production« eingeschaltet, wendet Supabase beim Merge auf `main` die Migrationen selbst an. Ohne nachgetragenen Verlauf würde es dabei `20261025140000` ein zweites Mal ausführen, und das schlägt fehl (Tabelle `signups` gibt es schon). Entweder »Deploy to production« ausschalten und den Ablauf unten benutzen, oder zuerst den Verlauf nachtragen (Schritt 2 unten) und dann die Anbindung anwenden lassen. Bis das entschieden ist, keine Migrationen auf `main` mergen.

Über den Ablauf `.github/workflows/supabase-migrationen.yml`, von Hand gestartet unter GitHub → Actions → »Supabase-Migrationen«. Der Claude-Connector wird dafür nicht benutzt (docs/02).

**Matthias, einmalig:**
1. Unter GitHub → Settings → Secrets and variables → Actions zwei Repository-Secrets anlegen:
   - `SUPABASE_ACCESS_TOKEN`: Supabase-Dashboard → Account → Access Tokens
   - `SUPABASE_DB_PASSWORD`: das Datenbank-Passwort des Projekts
2. Den Ablauf in dieser Reihenfolge starten:
   1. `anzeigen` – zeigt den Migrationsverlauf.
   2. `verlauf-nachtragen` – trägt `20261025140000` und `20261025180000` als angewendet ein. Beide sind von Hand angewendet (siehe unten); ohne diesen Schritt würde die CLI sie ein zweites Mal ausführen.
   3. `probelauf` – zeigt, was angewendet würde. Erwartet: nur `20261028150000`.
   4. `anwenden` – nur vom Branch `main`.
3. Danach die Supabase Advisors ansehen. Erwartet werden Warnungen für die neuen `SECURITY DEFINER`-Funktionen, die für angemeldete Personen aufrufbar sind. Das ist gewollt: Sie prüfen selbst, wer was darf.

Der Ablauf ist **ungeprüft**, bis er zum ersten Mal läuft: Die CLI liess sich hier nicht installieren, die Downloads von GitHub sind gesperrt. Ebenfalls ungeprüft ist, ob die minimale `supabase/config.toml` der CLI genügt.

## Angewendet (Stand 25.10.2026, im Supabase-Projekt `qieunfhizsxsyzmrrvci` nachgesehen)

`20261028150000_m2_konten_guuggen.sql` ist noch **nicht** angewendet (Stand 28.10.2026). Bis dahin gilt im echten Projekt die Lücke aus 0001: Ein Mitglied kann sich selbst zur Leitung machen. Das schadet nicht, solange es keine Konten und Guuggen gibt. Die Migration muss aber angewendet sein, bevor Konten freigeschaltet werden.


- `0001_grundmodell.sql` ist **bereits angewendet**, Migrationsverlauf Version `0001 grundmodell` – obwohl als ungeprüfter Entwurf markiert. Wer und womit (vermutlich `supabase db push`), ist offen. Der Security Advisor meldete dazu 8 Warnungen (SECURITY-DEFINER-Funktionen für `anon` und angemeldete Nutzer aufrufbar).
- `20261025180000_anon_sperren.sql` – entzieht `anon` alle Rechte am Grundmodell und das Ausführrecht der vier Funktionen. Von Hand angewendet, geprüft über die öffentliche API (Aufrufe ohne Anmeldung: 401). Advisor danach: 5 Warnungen, alle gewollt – `signup` (öffentlich, schreibt nur) und die vier Funktionen für angemeldete Personen (von den RLS-Regeln gebraucht, prüfen selbst Mitgliedschaft bzw. Leitung). Im Migrationsverlauf mit `migration repair` nachtragen.
- `20261025140000_signups.sql` – Anmeldungen der Landingpage, von Hand im SQL-Editor angewendet, **nicht** im Migrationsverlauf. In der CLI mit `supabase migration repair --status applied 20261025140000` nachtragen. Die Warnung des Advisors zu `public.signup` ist gewollt (öffentlich aufrufbar, schreibt nur).
