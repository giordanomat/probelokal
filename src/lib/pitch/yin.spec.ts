// Synthetische Töne wie im Prototyp (Sägezahn = obertonreich wie Blech). Echte Bläser,
// Handymikrofone und Hall sind damit nicht geprüft – das bleibt der Gerätetest in M1.

import { describe, expect, it } from 'vitest';
import { BAD_TOUCH } from '#lib/titles/bad-touch.ts';
import {
	NoiseGate,
	PITCH_RANGES,
	bufferSizeFor,
	detectPitch,
	midiToFrequency,
	prepareFrame
} from './yin';
import { noise, sawtooth } from '../../test/signals';

const SR = 48000;

const cents = (a: number, b: number) => Math.abs(a - b) * 100;

describe('YIN mit synthetischen Tönen', () => {
	// Notierte Töne aus dem Umfang jeder Stimme, klingend = notiert + shift
	const cases = BAD_TOUCH.voices.flatMap((v) =>
		[58, 64, 69, 72, 77].map((written) => ({ voice: v, sounding: written + v.shift }))
	);

	it.each(cases)('$voice.name, klingend MIDI $sounding auf ±10 Cent', ({ voice, sounding }) => {
		const range = PITCH_RANGES[voice.instrument];
		const buf = sawtooth(midiToFrequency(sounding), bufferSizeFor(range));
		const midi = detectPitch(buf, SR, range, new NoiseGate());
		expect(midi).not.toBeNull();
		expect(cents(midi as number, sounding)).toBeLessThanOrEqual(10);
	});

	it('funktioniert auch bei 44,1 kHz', () => {
		const range = PITCH_RANGES.trumpet;
		const buf = sawtooth(midiToFrequency(67), 2048, 0.3, 44100);
		const midi = detectPitch(buf, 44100, range, new NoiseGate());
		expect(cents(midi as number, 67)).toBeLessThanOrEqual(10);
	});

	it('Puffer zu kurz für die tiefste Frequenz → nichts', () => {
		expect(prepareFrame(new Float32Array(256), SR, PITCH_RANGES.sousaphone)).toBeNull();
	});
});

describe('Rauschtor', () => {
	it('Stille und leises Rauschen werden nicht ausgewertet', () => {
		const range = PITCH_RANGES.trumpet;
		const gate = new NoiseGate();
		expect(detectPitch(new Float32Array(2048), SR, range, gate)).toBeNull();
		expect(detectPitch(noise(2048, 0.005), SR, range, gate)).toBeNull();
	});

	it('nach lautem Rauschen braucht ein Ton deutlich mehr Pegel', () => {
		const gate = new NoiseGate();
		// lange lautes Rauschen: Boden steigt langsam an
		for (let i = 0; i < 3000; i++) gate.pass(0.05);
		expect(gate.floor).toBeGreaterThan(0.03);
		expect(gate.pass(0.05)).toBe(false);
		expect(gate.pass(0.2)).toBe(true);
	});

	it('Boden fällt schnell, wenn es leise wird', () => {
		const gate = new NoiseGate();
		gate.floor = 0.05;
		for (let i = 0; i < 40; i++) gate.pass(0.001);
		expect(gate.floor).toBeLessThan(0.002);
	});
});
