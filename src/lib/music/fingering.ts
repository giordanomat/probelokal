// Griffe und Naturtöne für Blech in B, notiert im Violinschlüssel. Portiert aus prototype/v7.
// Die Tabellen sind nur Ersatz und für Übungen ohne MusicXML; massgebend ist der Griff aus dem
// Liedtext der MusicXML (docs/04-erkenntnisse-prototyp.md).

import type { InstrumentKind } from './types';

/** Naturtonreihe in B, notiert (MIDI). Für Ventil und Zug gleich. */
export const NATURAL_SERIES = [48, 60, 67, 72, 76, 79, 82, 84, 86, 88] as const;

/** Absenkung in Halbtönen je Ventilkombination. '3' und '12' sind gleichwertig. */
const VALVE_LOWERING: Record<string, number> = {
	'0': 0,
	'2': 1,
	'1': 2,
	'12': 3,
	'3': 3,
	'23': 4,
	'13': 5,
	'123': 6
};

/** Übliche Ventilkombination je Absenkung (0–6 Halbtöne), für Übungen und Antwortmöglichkeiten. */
export const VALVE_BY_LOWERING = ['0', '2', '1', '12', '23', '13', '123'] as const;

/** Standardgriffe Ventil (notiert, MIDI → Griff). Wie VALVE in tools/extract_notes.py. */
export const STANDARD_VALVE: Readonly<Record<number, string>> = {
	54: '123',
	55: '13',
	56: '23',
	57: '12',
	58: '1',
	59: '2',
	60: '0',
	61: '123',
	62: '13',
	63: '23',
	64: '12',
	65: '1',
	66: '2',
	67: '0',
	68: '23',
	69: '12',
	70: '1',
	71: '2',
	72: '0',
	73: '12',
	74: '1',
	75: '2',
	76: '0',
	77: '1',
	78: '2',
	79: '0',
	80: '23',
	81: '12',
	82: '1',
	83: '2',
	84: '0'
};

/** Standard-Zugpositionen (notiert, MIDI → Zug). Wie SLIDE in tools/extract_notes.py. */
export const STANDARD_SLIDE: Readonly<Record<number, number>> = {
	58: 3,
	59: 2,
	60: 1,
	61: 7,
	62: 6,
	63: 5,
	64: 4,
	65: 3,
	66: 2,
	67: 1,
	68: 5,
	69: 4,
	70: 3,
	71: 2,
	72: 1,
	73: 4,
	74: 3,
	75: 2,
	76: 1,
	77: 3,
	78: 2,
	79: 1
};

/**
 * Absenkung in Halbtönen: Ventilkombination nach Tabelle, Zugposition p als p − 1.
 * null, wenn kein oder ein unbekannter Griff angegeben ist.
 */
export function loweringOf(fing: string): number | null {
	if (fing in VALVE_LOWERING) return VALVE_LOWERING[fing];
	const pos = parseInt(fing, 10);
	return isNaN(pos) ? null : pos - 1;
}

/**
 * Gleicher Griff im Sinn der Prüfung »Griffe sitzen«: Ventile nach Absenkung (also '3' = '12'),
 * Zug nach Position.
 */
export function sameFingering(given: string, expected: string, kind: InstrumentKind): boolean {
	if (kind === 'slide') {
		const a = parseInt(given, 10);
		return !isNaN(a) && a === parseInt(expected, 10);
	}
	const a = loweringOf(given);
	return a !== null && a === loweringOf(expected);
}

/** Griff zum Vorlesen und für die grosse Anzeige: »offen«, »1 + 2«, »Zug 3«, »–« ohne Griff. */
export function fingeringLabel(fing: string, kind: InstrumentKind): string {
	if (!fing) return '–';
	if (kind === 'slide') return 'Zug ' + fing;
	return fing === '0' ? 'offen' : fing.split('').join(' + ');
}

/** Gedrückte Ventile (1–3) für die Ventilkreise; leer bei »offen« oder ohne Griff. */
export function pressedValves(fing: string): number[] {
	return !fing || fing === '0' ? [] : fing.split('').map(Number);
}

/** Standardgriff aus der Tabelle, '' wenn der Ton ausserhalb liegt. */
export function standardFingering(midi: number, kind: InstrumentKind): string {
	if (kind === 'slide') return STANDARD_SLIDE[midi] ? String(STANDARD_SLIDE[midi]) : '';
	return STANDARD_VALVE[midi] ?? '';
}

/** Liegt der Ton (notiert, MIDI) auf der Naturtonreihe? */
export function isNaturalTone(midi: number): boolean {
	return (NATURAL_SERIES as readonly number[]).includes(midi);
}
