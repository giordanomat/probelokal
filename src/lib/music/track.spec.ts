import { describe, expect, it } from 'vitest';
import { badTouchNotes, badTouchPart } from '../../test/badtouch';
import { BAD_TOUCH } from '#lib/titles/bad-touch.ts';
import { buildTrack, isRestInBars, nextNoteIndex, noteIndexAt, noteIndicesInBars } from './track';
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

	it('erkennt Posaunen als Zug und kennt die Lücken bei den Griffen', () => {
		const parts = badTouchNotes().parts;
		expect(parts.filter((p) => p.kind === 'slide').map((p) => p.id)).toEqual(['P3', 'P4']);
		const missing = (id: string) => badTouchPart(id).notes.filter((x) => !x.fing).length;
		expect(missing('P6')).toBe(18);
		expect(missing('P2')).toBe(1);
		expect(missing('P1')).toBe(0);
	});

	it('jede Stimme des Titels hat einen Part mit passender Art', () => {
		for (const v of BAD_TOUCH.voices) expect(badTouchPart(v.part).kind).toBe(v.kind);
	});
});

describe('Spur aufbereiten', () => {
	it('setzt Namen und Absenkung', () => {
		const t = buildTrack(badTouchPart('P1').notes);
		expect(t.notes[0]).toMatchObject({ m: 69, name: 'A', fing: '12', lower: 3 });
		expect(t.diaMin).toBeLessThan(t.diaMax);
	});

	it('Atemzeichen ab ¾ Schlag Pause, Einsätze ab einem Schlag', () => {
		const t = buildTrack([note(0, 1), note(1.5, 1), note(3.25, 1), note(5.25, 1)]);
		// Lücken: 0,5 · 0,75 · 1
		expect(t.rests).toEqual([2.5, 4.25]);
		expect(t.entries).toEqual([0, 5.25]);
	});

	it('übersteht eine leere Stimme', () => {
		expect(buildTrack([])).toEqual({ notes: [], rests: [], entries: [], diaMin: 0, diaMax: 0 });
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
