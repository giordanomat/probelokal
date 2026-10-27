// Die laufende Erkennung so gefüttert, wie das AudioWorklet sie füttert: in Häppchen zu 128
// Abtastungen mit der Zeit der ersten Abtastung.

import { describe, expect, it } from 'vitest';
import { noise, sawtooth } from '../../test/signals';
import { HOP_SEC, PitchTracker, type TrackerMessage } from './tracker';
import { frameSpan, midiToFrequency, PITCH_RANGES } from './yin';

const SR = 48000;
const QUANTUM = 128;

function feed(tracker: PitchTracker, signal: Float32Array, t0 = 0): TrackerMessage[] {
	const out: TrackerMessage[] = [];
	for (let i = 0; i + QUANTUM <= signal.length; i += QUANTUM) {
		out.push(...tracker.push(signal.subarray(i, i + QUANTUM), t0 + i / SR));
	}
	return out;
}

const pitches = (m: TrackerMessage[]) =>
	m.filter((x): x is Extract<TrackerMessage, { type: 'pitch' }> => x.type === 'pitch');

describe('Laufende Tonerkennung', () => {
	it('Trompete: klingendes G4 auf ±10 Cent, etwa alle 20 ms eine Meldung', () => {
		const tr = new PitchTracker(SR, 'trumpet');
		const msgs = pitches(feed(tr, sawtooth(midiToFrequency(67), SR)));
		// 1 s Signal, erste Meldung erst, wenn der Puffer für YIN reicht
		expect(msgs.length).toBeGreaterThan(40);
		expect(msgs.length).toBeLessThan(55);
		for (const m of msgs) expect(Math.abs((m.midi ?? 0) - 67) * 100).toBeLessThan(10);
		const gaps = msgs.slice(1).map((m, i) => m.t - msgs[i].t);
		for (const g of gaps)
			expect(g).toBeCloseTo((Math.round((HOP_SEC * SR) / QUANTUM) * QUANTUM) / SR, 3);
	});

	it('Zeitstempel ist die Mitte des ausgewerteten Ausschnitts', () => {
		const tr = new PitchTracker(SR, 'trumpet');
		const msgs = pitches(feed(tr, sawtooth(midiToFrequency(67), SR / 2), 10));
		const span = frameSpan(SR, PITCH_RANGES.trumpet);
		const first = msgs[0];
		// Ende des Häppchens, in dem die Meldung entstand, minus halber Ausschnitt
		const end = first.t + span / (2 * SR);
		expect(Math.round((end - 10) * SR) % QUANTUM).toBe(0);
		expect(end - 10).toBeGreaterThanOrEqual(span / SR);
	});

	it('Sousaphon und Wechsel des Instruments', () => {
		const tr = new PitchTracker(SR, 'sousaphone');
		const low = pitches(feed(tr, sawtooth(midiToFrequency(41), SR)));
		expect(low.at(-1)?.midi).toBeCloseTo(41, 1);
		tr.setInstrument('trumpet');
		const high = pitches(feed(tr, sawtooth(midiToFrequency(70), SR / 2)));
		expect(high.at(-1)?.midi).toBeCloseTo(70, 1);
	});

	it('Stille und leises Rauschen ergeben keine Tonhöhe', () => {
		const tr = new PitchTracker(SR, 'trumpet');
		const msgs = pitches(feed(tr, noise(SR / 2, 0.002)));
		expect(msgs.length).toBeGreaterThan(0);
		expect(msgs.every((m) => m.midi === null)).toBe(true);
	});

	it('Einsätze nur auf Wunsch, mit der Zeit der ersten lauten Abtastung', () => {
		// 4 Klicks à 10 ms im Abstand von 0,5 s, dazwischen leises Rauschen
		const signal = noise(SR * 2, 0.003);
		const at = [0.3, 0.8, 1.3, 1.8];
		for (const t of at) signal.set(sawtooth(1000, SR / 100, 0.5), Math.round(t * SR));
		const off = feed(new PitchTracker(SR, 'trumpet'), signal);
		expect(off.some((m) => m.type === 'onset')).toBe(false);
		const on = feed(new PitchTracker(SR, 'trumpet', { onsets: true }), signal, 5);
		const onsets = on.filter((m) => m.type === 'onset').map((m) => m.t - 5);
		expect(onsets).toHaveLength(4);
		onsets.forEach((t, i) => expect(Math.abs(t - at[i])).toBeLessThan(0.001));
	});
});
