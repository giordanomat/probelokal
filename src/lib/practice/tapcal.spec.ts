import { describe, expect, it } from 'vitest';
import {
	clickTimes,
	estimateTapOffset,
	loadTapOffset,
	saveTapOffset,
	tapcalOutcome,
	tapOffsetText,
	TAPCAL_COUNT_IN,
	TAPCAL_GAP_SEC,
	TAPCAL_MEASURED
} from './tapcal';
import { missedNotes, tapBeat } from './rhythm';

describe('Tippen abgleichen (Entwurf Matthias 18.11.2026)', () => {
	const start = 1;
	const all = clickTimes(start);
	const measured = all.slice(TAPCAL_COUNT_IN);

	it('Klicks im Tempo 100: 4 zum Zuhören, 12 zum Mittippen', () => {
		expect(TAPCAL_GAP_SEC).toBeCloseTo(0.6);
		expect(all).toHaveLength(TAPCAL_COUNT_IN + TAPCAL_MEASURED);
		expect(all[0]).toBe(start);
		expect(all[1] - all[0]).toBeCloseTo(0.6);
	});

	it('gleichmässig 45 ms nach dem Klick: Versatz 45 ms', () => {
		const taps = measured.map((t, i) => t + 0.045 + (i % 2 ? 0.01 : -0.01));
		const r = estimateTapOffset(all, taps);
		expect(r).not.toBeNull();
		expect(r!.sec).toBeCloseTo(0.045, 3);
		expect(r!.matched).toBe(12);
	});

	it('Tipps beim Zuhören und weit weg zählen nicht, ein Ausreisser stört den Median nicht', () => {
		const taps = [
			all[0] + 0.05, // beim Zuhören
			...measured.map((t) => t + 0.03),
			measured[3] + 0.4 // weit weg von jedem Klick
		];
		taps[5] += 0.2; // ein Ausreisser innerhalb der 0,25 s
		const r = estimateTapOffset(all, taps)!;
		expect(r.matched).toBe(12);
		expect(r.sec).toBeCloseTo(0.03, 3);
	});

	it('weniger als 8 Tipps: kein Ergebnis', () => {
		expect(
			estimateTapOffset(
				all,
				measured.slice(0, 7).map((t) => t + 0.04)
			)
		).toBeNull();
	});

	it('zu unregelmässig (Streuung über 40 ms): kein Ergebnis', () => {
		const taps = measured.map((t, i) => t + (i % 2 ? 0.12 : -0.05));
		expect(estimateTapOffset(all, taps)).toBeNull();
	});

	it('zu früh tippen geht auch (negativer Versatz)', () => {
		const r = estimateTapOffset(
			all,
			measured.map((t) => t - 0.02)
		)!;
		expect(r.sec).toBeCloseTo(-0.02, 3);
	});

	it('Ergebnis für die Oberfläche: ok, zu wenige, zu unregelmässig; Text', () => {
		expect(
			tapcalOutcome(
				all,
				measured.map((t) => t + 0.045)
			).kind
		).toBe('ok');
		expect(tapcalOutcome(all, measured.slice(0, 5)).kind).toBe('few');
		expect(
			tapcalOutcome(
				all,
				measured.map((t, i) => t + (i % 2 ? 0.12 : -0.05))
			).kind
		).toBe('uneven');
		expect(tapOffsetText(0.0453)).toBe('Du tippst 45 ms nach dem Klick.');
		expect(tapOffsetText(-0.02)).toBe('Du tippst 20 ms vor dem Klick.');
		expect(tapOffsetText(0.0002)).toBe('Du tippst genau auf den Klick.');
	});

	it('pro Gerät gespeichert; Unsinn wird verworfen', () => {
		const data = new Map<string, string>();
		const storage = {
			getItem: (k: string) => data.get(k) ?? null,
			setItem: (k: string, v: string) => void data.set(k, v),
			removeItem: (k: string) => void data.delete(k)
		};
		expect(loadTapOffset(storage)).toBeNull();
		saveTapOffset(storage, 0.0453);
		expect(loadTapOffset(storage)).toBeCloseTo(0.0453, 4);
		data.set('probelokal.tippen', 'abc');
		expect(loadTapOffset(storage)).toBeNull();
		data.set('probelokal.tippen', '2');
		expect(loadTapOffset(storage)).toBeNull();
		expect(loadTapOffset(undefined)).toBeNull();
	});
});

describe('Rhythmus mit gemessenem Versatz', () => {
	const spb = 0.5;
	it('ersetzt Ausgabe-Latenz plus 15 ms', () => {
		// ohne Messung: 0,02 + 0,015 s
		expect(tapBeat(10, 0.02, spb, 1)).toBeCloseTo(10 - 0.035 / spb, 6);
		expect(tapBeat(10, 0.02, spb, 1, null)).toBeCloseTo(10 - 0.035 / spb, 6);
		// mit Messung: nur der gemessene Versatz
		expect(tapBeat(10, 0.02, spb, 1, 0.06)).toBeCloseTo(10 - 0.06 / spb, 6);
		expect(tapBeat(10, 0.02, spb, 0.8, 0.06)).toBeCloseTo(10 - (0.06 * 0.8) / spb, 6);
	});

	it('verpasste Töne: Grenze rückt mit dem gemessenen Versatz', () => {
		const ctx = {
			notes: [{ b: 8, d: 1, p: 60 }] as never,
			passFrom: 0,
			judged: new Set<number>(),
			spb,
			rate: 1
		};
		// mit 0,1 s Versatz ist 8 + (0,1 + 0,24)/spb noch nicht verpasst, + 0,26 schon
		expect(missedNotes(ctx, 8 + 0.34 / spb, 0.02, 0.1)).toEqual([]);
		expect(missedNotes(ctx, 8 + 0.36 / spb, 0.02, 0.1)).toEqual([0]);
	});
});
