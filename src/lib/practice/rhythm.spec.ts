import { describe, expect, it } from 'vitest';
import { badTouchPart } from '../../test/badtouch';
import { BAD_TOUCH } from '#lib/titles/bad-touch.ts';
import { secondsPerBeat } from '../music/timing';
import { noteIndicesInBars } from '../music/track';
import type { RawNote } from '../music/types';
import { judgeTap, missedNotes, tapBeat, tapFeedback, type TapContext } from './rhythm';

const spb = secondsPerBeat(BAD_TOUCH);
const LAT = 0.03; // angenommene Ausgabe-Latenz des Geräts

function ctx(notes: readonly RawNote[], judged = new Set<number>(), rate = 1): TapContext {
	return { notes, passFrom: 0, judged, spb, rate };
}
/** Schlag, an dem jemand tippt, der den Ton um `offsetSec` zu spät hört und drückt. */
const beatNowFor = (b: number, offsetSec: number, rate = 1) =>
	b + ((LAT + 0.015 + offsetSec) * rate) / spb;

describe('Rhythmus tippen', () => {
	it('exaktes Tippen trifft jeden Ton von Teil A (Trompete 1), auch bei 70 %', () => {
		const notes = badTouchPart('P1').notes;
		const a = BAD_TOUCH.sections[1];
		const idx = noteIndicesInBars(notes, a.from, a.to);
		expect(idx.length).toBeGreaterThan(15);
		for (const rate of [1, 0.7]) {
			const judged = new Set<number>();
			for (const i of idx) {
				const r = judgeTap(
					ctx(notes, judged, rate),
					tapBeat(beatNowFor(notes[i].b, 0, rate), LAT, spb, rate)
				);
				expect(r).toMatchObject({ kind: 'judged', index: i, verdict: 'hit' });
				judged.add(i);
			}
		}
	});

	const one: RawNote[] = [{ b: 8, d: 1, m: 67, dia: 32, acc: 0, step: 'G', fing: '0' }];
	const tapAt = (offsetSec: number) =>
		judgeTap(ctx(one), tapBeat(beatNowFor(8, offsetSec), LAT, spb, 1));

	it('Grenzen: 70 ms getroffen, 140 ms knapp, bis 250 ms daneben, darüber kein Ton', () => {
		expect(tapAt(0.069)).toMatchObject({ verdict: 'hit' });
		expect(tapAt(-0.1)).toMatchObject({ verdict: 'near' });
		expect(tapAt(0.2)).toMatchObject({ verdict: 'wrong' });
		expect(tapAt(0.3)).toEqual({ kind: 'no-note' });
	});

	it('meldet zu früh/zu spät in Millisekunden', () => {
		expect(tapFeedback(tapAt(0))).toEqual({ text: 'Genau.', tone: 'ok' });
		expect(tapFeedback(tapAt(-0.1))).toEqual({ text: 'Etwas zu früh (100 ms).', tone: 'warn' });
		expect(tapFeedback(tapAt(0.2))?.text).toBe('Etwas zu spät (200 ms).');
		expect(tapFeedback(tapAt(0.3))?.text).toBe('Da kommt kein Ton.');
	});

	it('bewertete Töne und Töne vor dem Durchgang zählen nicht nochmals', () => {
		expect(judgeTap(ctx(one, new Set([0])), 8)).toEqual({ kind: 'ignored' });
		expect(judgeTap({ ...ctx(one), passFrom: 9 }, 8)).toEqual({ kind: 'ignored' });
		expect(tapFeedback({ kind: 'ignored' })).toBeNull();
	});

	it('verpasste Töne erst 250 ms nach ihrem Beginn', () => {
		const notes: RawNote[] = [one[0], { ...one[0], b: 9 }, { ...one[0], b: 10 }];
		const c = ctx(notes, new Set([1]));
		expect(missedNotes(c, 8 + (LAT + 0.24) / spb, LAT)).toEqual([]);
		expect(missedNotes(c, 9.9 + (LAT + 0.25) / spb, LAT)).toEqual([0]);
	});
});
