// Testtitel für M1. Später kommt dieser Datensatz aus `titles` in Supabase; bis dahin hier.
// Werte aus docs/04-erkenntnisse-prototyp.md.
//
// P5 = Euphonium, P6 = Sousaphon (bestätigt von Matthias, 25.10.2026). Noten mit --fill-missing
// erzeugen: 19 fehlende Griffe kommen aus der Standardtabelle (docs/04).

import { sectionsFromStarts } from '#lib/music/timing.ts';
import type { Title } from '#lib/music/types.ts';

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
	// Alle Stimmen im Violinschlüssel in B: Klang = notiert + shift (gemessen, siehe docs/04).
	voices: [
		{
			id: 'trp1',
			short: 'Trp 1',
			name: 'Trompete 1',
			part: 'P1',
			kind: 'valve',
			instrument: 'trumpet',
			shift: -2,
			register: 'trp'
		},
		{
			id: 'trp2',
			short: 'Trp 2',
			name: 'Trompete 2',
			part: 'P2',
			kind: 'valve',
			instrument: 'trumpet',
			shift: -2,
			register: 'trp'
		},
		{
			id: 'pos1',
			short: 'Pos 1',
			name: 'Posaune 1',
			part: 'P3',
			kind: 'slide',
			instrument: 'trombone',
			shift: -14,
			register: 'pos'
		},
		{
			id: 'pos2',
			short: 'Pos 2',
			name: 'Posaune 2',
			part: 'P4',
			kind: 'slide',
			instrument: 'trombone',
			shift: -14,
			register: 'pos'
		},
		{
			id: 'euph',
			short: 'Euph',
			name: 'Euphonium',
			part: 'P5',
			kind: 'valve',
			instrument: 'euphonium',
			shift: -14,
			register: 'tief'
		},
		{
			id: 'sous',
			short: 'Sous',
			name: 'Sousaphon',
			part: 'P6',
			kind: 'valve',
			instrument: 'sousaphone',
			shift: -26,
			register: 'tief'
		}
	],
	// Einzelspuren beginnen 6,237 s vor Takt 0, per Kreuzkorrelation gemessen. Knapp 3 Takte –
	// genau 3 Takte wären 6,261 s; massgebend ist die Messung (docs/04).
	stem_offset_sec: 6.237
};
