// AudioWorklet für das Mithören (docs/02-architektur.md »Audio«): Die Erkennung läuft im
// Audio-Thread statt im Animations-Takt. Meldungen gehen über den Port an die Seite.
//
// Ungeprüft: Rechenzeit auf iPhone/iPad. YIN braucht pro Auswertung einige Hunderttausend
// Rechenschritte. Dauert das zu lange, setzt auch die Band aus, weil sie im selben Thread läuft.
// Prüfen: Beim Mithören auf Aussetzer der Band hören. Ausweg wäre ein Worker statt des Worklets.

import { PitchTracker } from '../pitch/tracker';
import type { Instrument } from '../music/types';

// Globale Namen des AudioWorkletGlobalScope (nicht in der DOM-Bibliothek von TypeScript)
declare const sampleRate: number;
declare const currentTime: number;
declare class AudioWorkletProcessor {
	readonly port: MessagePort;
	constructor(options?: unknown);
}
declare function registerProcessor(
	name: string,
	ctor: new (options: { processorOptions?: unknown }) => AudioWorkletProcessor
): void;

export interface PitchWorkletOptions {
	instrument: Instrument;
	onsets?: boolean;
}

export type PitchWorkletCommand =
	{ type: 'instrument'; instrument: Instrument } | { type: 'onsets'; on: boolean };

class PitchProcessor extends AudioWorkletProcessor {
	private tracker: PitchTracker;

	constructor(options: { processorOptions?: unknown }) {
		super(options);
		const o = options.processorOptions as PitchWorkletOptions;
		this.tracker = new PitchTracker(sampleRate, o.instrument, { onsets: o.onsets });
		this.port.onmessage = (e: MessageEvent<PitchWorkletCommand>) => {
			if (e.data.type === 'instrument') this.tracker.setInstrument(e.data.instrument);
			else this.tracker.setOnsets(e.data.on);
		};
	}

	process(inputs: Float32Array[][]): boolean {
		const channel = inputs[0]?.[0];
		if (channel) for (const m of this.tracker.push(channel, currentTime)) this.port.postMessage(m);
		return true;
	}
}

registerProcessor('pitch-tracker', PitchProcessor);
