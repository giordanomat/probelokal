// Stimmen von Bad Touch 2.0 (Fassung Schuegu27), eigene Datei ohne Noten-JSON: Die Konto-Seiten
// brauchen nur die Stimmen und sollen das Noten-JSON nicht mitladen.
import type { Voice } from '#lib/music/types.ts';

export const BAD_TOUCH_SLUG = 'bad-touch-2-0';

// Alle Stimmen im Violinschlüssel in B: Klang = notiert + shift (gemessen, siehe docs/04).
export const BAD_TOUCH_VOICES: Voice[] = [
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
];
