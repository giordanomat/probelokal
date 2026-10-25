import { describe, expect, it } from 'vitest';
import { badTouchNotes, badTouchPart } from '../../test/badtouch';
import { BAD_TOUCH } from '#lib/titles/bad-touch.ts';
import { buildTrack, isRestInBars, nextNoteIndex, noteIndexAt, noteIndicesInBars } from './track';
import { isNaturalTone, loweringOf, standardFingering } from './fingering';
import type { RawNote } from './types';

const note = (b: number, d: number, fing = '0'): RawNote => ({
	b,
	d,
	m: 60,
	dia: 28,
	acc: 0,
	step: 'C',
	fing
});

describe('Noten aus der MusicXML (Bad Touch)', () => {
	it('liefert die bekannte Notenanzahl je Stimme, Schlagzeug ausgelassen', () => {
		const counts = Object.fromEntries(badTouchNotes().parts.map((p) => [p.id, p.notes.length]));
		expect(counts).toEqual({ P1: 345, P2: 320, P3: 336, P4: 279, P5: 286, P6: 393 });
		expect(badTouchNotes().bars).toBe(BAD_TOUCH.bars);
	});

	it('führt übergebundene Noten zusammen (Trompete 1, Takt 1: C5 punktierte Achtel)', () => {
		const n = badTouchPart('P1').notes;
		const tied = n.find((x) => x.b === 5.75);
		expect(tied).toMatchObject({ m: 72, d: 0.75 });
		expect(n.some((x) => x.b === 6 && x.m === 72)).toBe(false);
	});

	it('Teile aus Doppelstrichen = Titel-Teile ohne das Ende des Vorzählers', () => {
		const fromXml = badTouchNotes().sections_from_barlines;
		const starts = BAD_TOUCH.sections.map((s) => s.from);
		expect(fromXml).toEqual(starts.filter((s) => s !== 1));
	});

	it('erkennt Posaunen als Zug', () => {
		const parts = badTouchNotes().parts;
		expect(parts.filter((p) => p.kind === 'slide').map((p) => p.id)).toEqual(['P3', 'P4']);
	});

	it('fehlende Griffe sind aus der Standardtabelle ergänzt und gekennzeichnet', () => {
		const parts = badTouchNotes().parts;
		for (const p of parts)
			expect(
				p.notes.every((x) => x.fing),
				p.id
			).toBe(true);
		const auto = (id: string) => badTouchPart(id).notes.filter((x) => x.fing_auto);
		expect(auto('P6')).toHaveLength(18);
		expect(auto('P2')).toHaveLength(1);
		expect(auto('P1')).toHaveLength(0);
		for (const n of [...auto('P6'), ...auto('P2')]) {
			expect(n.fing).toBe(standardFingering(n.m, 'valve'));
		}
	});

	it('Griffe aus der MusicXML passen zur Naturtonreihe', () => {
		for (const p of badTouchNotes().parts) {
			for (const n of p.notes) {
				const lower = loweringOf(n.fing, p.kind) as number;
				expect(isNaturalTone(n.m + lower), `${p.id} b=${n.b} m=${n.m} ${n.fing}`).toBe(true);
			}
		}
	});

	it('jede Stimme des Titels hat einen Part mit passender Art', () => {
		for (const v of BAD_TOUCH.voices) expect(badTouchPart(v.part).kind).toBe(v.kind);
	});
});

describe('Spur aufbereiten', () => {
	it('setzt Namen und Absenkung', () => {
		const t = buildTrack(badTouchPart('P1').notes, 'valve');
		expect(t.notes[0]).toMatchObject({ m: 69, name: 'A', fing: '12', lower: 3 });
		expect(t.diaMin).toBeLessThan(t.diaMax);
		const pos = buildTrack(badTouchPart('P3').notes, 'slide');
		const zug1 = pos.notes.find((x) => x.fing === '1');
		expect(zug1?.lower).toBe(0);
	});

	it('Atemzeichen ab ¾ Schlag Pause, Einsätze ab einem Schlag', () => {
		const t = buildTrack([note(0, 1), note(1.5, 1), note(3.25, 1), note(5.25, 1)], 'valve');
		// Lücken: 0,5 · 0,75 · 1
		expect(t.rests).toEqual([2.5, 4.25]);
		expect(t.entries).toEqual([0, 5.25]);
	});

	it('übersteht eine leere Stimme', () => {
		expect(buildTrack([], 'slide')).toEqual({
			notes: [],
			rests: [],
			entries: [],
			diaMin: 0,
			diaMax: 0
		});
	});
});

describe('Noten finden', () => {
	const n = [note(4, 1), note(5, 0.5), note(6, 2)];

	it('findet den klingenden Ton, knapp vorher schon den nächsten', () => {
		expect(noteIndexAt(n, 4.5)).toBe(0);
		expect(noteIndexAt(n, 4.99)).toBe(0);
		expect(noteIndexAt(n, 5.99)).toBe(2);
		expect(noteIndexAt(n, 5.6)).toBe(-1);
		expect(noteIndexAt(n, 7.9)).toBe(2);
		expect(noteIndexAt(n, 8)).toBe(-1);
		expect(nextNoteIndex(n, 5.6)).toBe(2);
		expect(nextNoteIndex(n, 6)).toBe(-1);
	});

	it('Töne pro Takt und »Pause für dich«', () => {
		expect(noteIndicesInBars(n, 1, 1)).toEqual([0, 1, 2]);
		expect(noteIndicesInBars(n, 2, 3)).toEqual([]);
		expect(isRestInBars(n, 2, 3)).toBe(true);
		expect(isRestInBars(n, 1, 1)).toBe(false);
	});
});
