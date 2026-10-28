// Testtitel für M1. Später kommt dieser Datensatz aus `titles` in Supabase; bis dahin hier.
// Werte aus docs/04-erkenntnisse-prototyp.md.
//
// P5 = Euphonium, P6 = Sousaphon (bestätigt von Matthias, 25.10.2026). 19 fehlende Griffe kommen
// aus der Standardtabelle (--fill-missing, docs/04).

import { sectionsFromStarts } from '#lib/music/timing.ts';
import type { NotesFile, Title } from '#lib/music/types.ts';
import { BAD_TOUCH_VOICES } from './bad-touch-voices.ts';
// Ausgabe von `npm run notes` (tools/extract_notes.py --fill-missing). Nicht von Hand ändern;
// Quelle ist prototype/v7/badtouch.xml. Kommt ab M1-Abschluss aus Supabase Storage.
import notes from './bad-touch.notes.json';

export const BAD_TOUCH_NOTES = notes as NotesFile;

const BARS = 93;
// Teilanfänge aus den Doppelstrichen; Takt 1 (Ende Vorzähler) ist kein Doppelstrich und ergänzt.
const STARTS = [0, 1, 9, 13, 17, 21, 25, 29, 37, 45, 53, 55, 59, 63, 67, 71, 75, 88];

export const BAD_TOUCH: Title = {
	slug: 'bad-touch-2-0',
	name: 'Bad Touch 2.0',
	version: 'Schuegu27',
	bpm: 115,
	bars: BARS,
	sections: sectionsFromStarts(STARTS, BARS),
	voices: BAD_TOUCH_VOICES,
	// Einzelspuren beginnen genau 3 Takte vor Takt 0 (am ersten Einsatz gemessen, docs/04).
	// Die früheren 6,237 s kamen vom MP3-Vorlauf des Tutti-Bounce.
	stem_offset_sec: (3 * 4 * 60) / 115
};
