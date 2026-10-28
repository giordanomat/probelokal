// Laufende Tonerkennung auf einem Strom von Abtastungen: Ringpuffer, alle ~20 ms YIN, dazu auf
// Wunsch Einsätze (Klicks) für den Latenz-Abgleich. Reine Rechnung ohne Browser-Schnittstellen,
// damit dieselbe Klasse im AudioWorklet (src/lib/audio/pitch-worklet.ts) und im Test läuft.
//
// Zeiten sind Sekunden der AudioContext-Uhr. Eine Tonhöhe trägt die Zeit der Mitte des
// ausgewerteten Ausschnitts, ein Einsatz die Zeit der ersten lauten Abtastung.

import { NoiseGate, PITCH_RANGES, bufferSizeFor, detectPitch, frameSpan } from './yin';
import type { PitchRange } from './yin';
import type { Instrument } from '../music/types';

/** Abstand zwischen zwei Auswertungen. Der Prototyp lief im Bildtakt (~16 ms). */
export const HOP_SEC = 0.02;
/** Einsatz: Pegel einer Abtastung über dieser Schwelle … */
export const ONSET_MIN_LEVEL = 0.05;
/** … und mindestens so viel lauter als der Rauschboden. */
export const ONSET_FACTOR = 8;
/** Nach einem Einsatz so lange keinen weiteren melden. */
export const ONSET_REFRACTORY_SEC = 0.15;

export type TrackerMessage =
	{ type: 'pitch'; midi: number | null; t: number } | { type: 'onset'; t: number };

export interface TrackerOptions {
	/** Einsätze melden (nur beim Latenz-Abgleich) */
	onsets?: boolean;
}

export class PitchTracker {
	private range: PitchRange;
	private buf: Float32Array;
	private filled = 0;
	private sinceHop = 0;
	private readonly hop: number;
	private gate = new NoiseGate();
	private onsets: boolean;
	private onsetFloor = 0.01;
	private lastOnset = -Infinity;

	constructor(
		private readonly sampleRate: number,
		instrument: Instrument,
		options: TrackerOptions = {}
	) {
		this.range = PITCH_RANGES[instrument];
		this.buf = new Float32Array(bufferSizeFor(this.range));
		this.hop = Math.max(128, Math.round(sampleRate * HOP_SEC));
		this.onsets = options.onsets ?? false;
	}

	setInstrument(instrument: Instrument) {
		this.range = PITCH_RANGES[instrument];
		this.buf = new Float32Array(bufferSizeFor(this.range));
		this.filled = 0;
		this.gate = new NoiseGate();
	}

	setOnsets(on: boolean) {
		this.onsets = on;
	}

	/** Neue Abtastungen; t0 = Zeit der ersten. Gibt die Meldungen dieses Stücks zurück. */
	push(samples: Float32Array, t0: number): TrackerMessage[] {
		const out: TrackerMessage[] = [];
		const n = samples.length;
		const sr = this.sampleRate;
		if (this.onsets) this.findOnset(samples, t0, out);

		// Ringpuffer als verschobenes Feld: das Neueste steht immer am Ende.
		const size = this.buf.length;
		if (n >= size) {
			this.buf.set(samples.subarray(n - size));
		} else {
			this.buf.copyWithin(0, n);
			this.buf.set(samples, size - n);
		}
		this.filled = Math.min(size, this.filled + n);
		this.sinceHop += n;

		const span = frameSpan(sr, this.range);
		if (this.sinceHop >= this.hop && this.filled >= span) {
			this.sinceHop = 0;
			const midi = detectPitch(this.buf, sr, this.range, this.gate);
			const tEnd = t0 + n / sr;
			out.push({ type: 'pitch', midi, t: tEnd - span / (2 * sr) });
		}
		return out;
	}

	private findOnset(samples: Float32Array, t0: number, out: TrackerMessage[]) {
		let peak = 0;
		let first = -1;
		const threshold = Math.max(ONSET_MIN_LEVEL, this.onsetFloor * ONSET_FACTOR);
		for (let i = 0; i < samples.length; i++) {
			const a = Math.abs(samples[i]);
			if (a > peak) peak = a;
			if (first < 0 && a >= threshold) first = i;
		}
		const t = t0 + (first >= 0 ? first : 0) / this.sampleRate;
		if (first >= 0 && t - this.lastOnset >= ONSET_REFRACTORY_SEC) {
			this.lastOnset = t;
			out.push({ type: 'onset', t });
		}
		// Boden folgt leisen Stellen schnell, lauten nur langsam (wie das Rauschtor)
		this.onsetFloor =
			peak < this.onsetFloor
				? this.onsetFloor * 0.8 + peak * 0.2
				: this.onsetFloor * 0.995 + peak * 0.005;
	}
}
