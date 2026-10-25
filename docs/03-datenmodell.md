# 03 · Datenmodell

Entwurf: `supabase/migrations/0001_grundmodell.sql` (ungeprüft, siehe Kopfkommentar dort).

## Kernideen

- **Lizenz pro Guugge und Fassung** (`licenses`): Kauf schaltet alle Stimmen für alle Mitglieder frei. Audio und Noten (`title_assets`) sind nur mit Lizenz lesbar, ausgeliefert über signierte URLs.
- **Titel als Daten** (`titles.sections`, `titles.voices`): Teile, Stimmen, Transposition (`shift` in Halbtönen, Klang = notiert + shift), Instrumententyp (`valve`/`slide`), Register, Versatz der Einzelspuren. Der Prototyp hat das für Bad Touch hart codiert – siehe `docs/04-erkenntnisse-prototyp.md`.
- **Noten als vorverarbeitetes JSON** (`kind = 'notes_json'`), erzeugt von `tools/extract_notes.py`. Die App parst kein MusicXML zur Laufzeit ausser für die Notenansicht.
- **Fortschritt nur serverseitig geschrieben:** `exam_results`, `points_ledger`, `practice_days` haben keine Client-Schreibrechte. Edge Functions prüfen und schreiben.
- **Stand eines Teils** = höchste bestandene Etappe in `exam_results` (bei Etappe 4/5 mit `via = 'rhythm'` markiert).
- **Privatsphäre:** Leitung sieht über `register_overview()` nur Aggregate (mind. 3 Personen pro Register, Vorschlag). Rangliste über `leaderboard()` nur mit Opt-in.

## Offene Punkte

- Wie Registerchefs Hinweise für ihr Register schreiben dürfen (heute nur Leitung).
- Ob Baustellen (heute nur lokal) serverseitig gespeichert werden sollen – Vorschlag: nein, bleiben auf dem Gerät.
- Mehrere Fassungen desselben Titels (Version in `titles.version`, eigene Zeile pro Fassung).
- Löschkonzept: Austritt aus einer Guugge, Konto löschen.

## Angewendet

- `supabase/migrations/20261025140000_signups.sql` – Anmeldungen der Landingpage (25.10.2026, von Hand im SQL-Editor; in der CLI später mit `migration repair` als angewendet markieren).
- `0001_grundmodell.sql` ist weiterhin nur ein Entwurf. Beim ersten Anwenden auf einen Zeitstempel-Namen umbenennen, der nach `20261025140000` liegt, sonst sortiert die CLI ihn davor.
