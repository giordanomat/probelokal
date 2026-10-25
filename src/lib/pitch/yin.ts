// Tonhöhenerkennung nach YIN, portiert aus prototype/v7 (detect). Reine Rechnung auf einem
// Puffer, damit sie später unverändert im AudioWorklet laufen kann (docs/02-architektur.md).
// Parameter aus docs/04-erkenntnisse-prototyp.md: Schwelle 0,15, parabolische Interpolation,
// Fenster ≥ 22 ms, RMS-Tor max(0,006; 3 × gleitender Rauschboden).

import type { Instrument } from '../music/types';

export interface PitchRange {
	/** Tiefste und höchste erwartete Grundfrequenz (Hz, klingend). */
	fmin: number;
	fmax: number;
	/** Jede wievielte Abtastung (Mittelwert) – 2 für tiefe Instrumente spart Rechenzeit. */
	decimation: number;
}

export const PITCH_RANGES: Record<Instrument, PitchRange> = {
	trumpet: { fmin: 140, fmax: 1100, decimation: 1 },
	trombone: { fmin: 60, fmax: 600, decimation: 2 },
	euphonium: { fmin: 60, fmax: 600, decimation: 2 },
	sousaphone: { fmin: 35, fmax: 300, decimation: 2 }
};

export const YIN_THRESHOLD = 0.15;
/** Mindestlänge des Vergleichsfensters (s). */
const MIN_WINDOW_SEC = 0.022;
/** Absolute Untergrenze des Pegels (RMS), unter der nichts ausgewertet wird. */
export const MIN_RMS = 0.006;

/** Puffergrösse, die der Prototyp für den Analyser nahm (reicht für tmax + Fenster). */
export function bufferSizeFor(range: PitchRange): number {
	return range.decimation > 1 ? 8192 : 2048;
}

export interface Frame {
	samples: Float32Array;
	sampleRate: number;
	rms: number;
	/** Verzögerungen in Abtastungen, zwischen denen gesucht wird. */
	tauMin: number;
	tauMax: number;
	window: number;
}

/**
 * Nimmt das Ende des Puffers, mittelt je `decimation` Abtastungen und misst den Pegel.
 * null, wenn der Puffer für die tiefste Frequenz zu kurz ist.
 */
export function prepareFrame(
	buffer: Float32Array,
	sampleRate: number,
	range: PitchRange
): Frame | null {
	const dec = range.decimation;
	const sr = sampleRate / dec;
	const tauMin = Math.floor(sr / range.fmax);
	const tauMax = Math.ceil(sr / range.fmin);
	const window = Math.max(tauMax, Math.round(sr * MIN_WINDOW_SEC));
	const length = window + tauMax + 2;
	const start = buffer.length - length * dec;
	if (start < 0) return null;
	const samples = new Float32Array(length);
	let sum = 0;
	for (let i = 0; i < length; i++) {
		let s = 0;
		for (let k = 0; k < dec; k++) s += buffer[start + i * dec + k];
		samples[i] = s / dec;
		sum += samples[i] * samples[i];
	}
	return { samples, sampleRate: sr, rms: Math.sqrt(sum / length), tauMin, tauMax, window };
}

/** YIN auf einem vorbereiteten Ausschnitt: klingende Tonhöhe als (krumme) MIDI-Zahl oder null. */
export function yin(frame: Frame, threshold = YIN_THRESHOLD): number | null {
	const { samples: x, sampleRate: sr, tauMin, tauMax, window: W } = frame;
	const d = new Float32Array(tauMax + 2);
	for (let t = 1; t <= tauMax + 1; t++) {
		let s = 0;
		for (let i = 0; i < W; i++) {
			const q = x[i] - x[i + t];
			s += q * q;
		}
		d[t] = s;
	}
	// kumulierte mittlere normierte Differenz
	const cm = new Float32Array(tauMax + 2);
	cm[0] = 1;
	let run = 0;
	for (let t = 1; t <= tauMax + 1; t++) {
		run += d[t];
		cm[t] = run > 0 ? (d[t] * t) / run : 1;
	}
	for (let t = Math.max(2, tauMin); t < tauMax; t++) {
		if (cm[t] < threshold) {
			while (t + 1 < tauMax && cm[t + 1] < cm[t]) t++;
			const a = cm[t - 1];
			const b = cm[t];
			const c = cm[t + 1];
			const den = a - 2 * b + c;
			const shift = den ? (0.5 * (a - c)) / den : 0;
			return frequencyToMidi(sr / (t + shift));
		}
	}
	return null;
}

export function frequencyToMidi(hz: number): number {
	return 69 + 12 * Math.log2(hz / 440);
}

export function midiToFrequency(midi: number): number {
	return 440 * 2 ** ((midi - 69) / 12);
}

/**
 * Rauschtor mit gleitendem Rauschboden: fällt schnell auf leise Stellen, steigt nur langsam.
 * Durchgelassen wird ab max(0,006; 3 × Rauschboden).
 */
export class NoiseGate {
	floor = 0.004;

	/** Rauschboden nachführen und sagen, ob dieser Pegel ausgewertet werden soll. */
	pass(rms: number): boolean {
		this.floor = rms < this.floor ? this.floor * 0.9 + rms * 0.1 : this.floor * 0.999 + rms * 0.001;
		return rms >= Math.max(MIN_RMS, this.floor * 3);
	}
}

/** Ein Schritt der Erkennung: Ausschnitt, Rauschtor, YIN. Klingende MIDI-Zahl oder null. */
export function detectPitch(
	buffer: Float32Array,
	sampleRate: number,
	range: PitchRange,
	gate: NoiseGate
): number | null {
	const frame = prepareFrame(buffer, sampleRate, range);
	if (!frame || !gate.pass(frame.rms)) return null;
	return yin(frame);
}
