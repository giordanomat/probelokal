# 06 · Produktionsstrecke: vom Arrangement zum übbaren Titel

## Was Matthias pro Titel liefert

1. **MusicXML** aus Logic, ein Part pro Stimme, alle im Violinschlüssel in B, **Griffe bzw. Zugpositionen als Liedtext** unter jeder Note (wie bei Bad Touch). Doppelstriche markieren die Teile.
2. **Einzelspuren als WAV**, eine pro Stimme plus Schlagzeug, **alle ab demselben Startpunkt wie der Tutti-Bounce**, Vorzähler mit Klick mitexportiert.
3. **Tutti-Bounce** (WAV) zur Kontrolle.
4. Zuordnung Part → Stimme (z. B. »Trombone 3 = Euphonium«) und Fassungsname.

Ablage der Quellen: Google Drive, Projektordner »Arrangements und Musikservice« (Matthias legt künftig alles in Drive ab). Nicht ins Repository.

## Schritte

| Schritt | Werkzeug | Ergebnis |
|---|---|---|
| Noten auslesen | `tools/extract_notes.py titel.xml --out notes.json` | Noten pro Stimme: Schlag, Dauer, notierte Tonhöhe, Griff, Teile |
| Versatz prüfen | `tools/measure_offset.py tutti.wav stems/*.wav` | Versatz Einzelspuren ↔ Tutti; soll 0 sein (sonst in `titles.stem_offset_sec`) |
| Mischungen | `tools/make_mixes.sh stems/ out/` | `minus_<stimme>.mp3`, `all.mp3`, Einzelspuren als MP3 |
| Qualitätsprüfung | `tools/detect_eval.py` (anpassen auf Titelparameter) | Erkennungsquote pro Stimme; Ziel ≥ 95 % ohne falsch erkannte Töne |
| Hochladen | Supabase Storage (M6: Skript) | Privater Bucket `titles`, Dateien unter `<slug>/<fassung>/…` (Fassung klein geschrieben, z. B. `bad-touch-2-0/schuegu27/minus_trp1.mp3`) |
| Titel anlegen | SQL/Admin-Seite | Zeile in `titles`, `title_assets` |

## Prüfen vor Freigabe

- Transposition je Stimme stimmt (eine Stimme hörbar gegen die Bahn prüfen).
- Jede Note hat einen Griff (sonst zeigt die Griffspur Lücken).
- Teile stimmen mit dem Arrangement überein.
- Erkennungsquote erreicht.
