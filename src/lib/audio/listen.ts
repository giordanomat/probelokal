// Mithören im Browser: Mikrofon (oder die eigene Spur bei der Vorführung) → AudioWorklet mit der
// Tonerkennung → Meldungen an die Seite. Dazu der Abgleich der Verzögerung mit Klicks.
// Ungeprüft auf iPhone/iPad (Mikrofon-Freigabe, Rechenzeit im Worklet, Verzögerung); das ist
// Teil der Abnahme von M1.

import workletUrl from './pitch-worklet.ts?worker&url';
import type { PitchWorkletCommand, PitchWorkletOptions } from './pitch-worklet';
import {
	CALIBRATION_CLICKS,
	CALIBRATION_GAP_SEC,
	estimateRoundTrip,
	type LatencyEstimate
} from './latency';
import type { Instrument } from '../music/types';
import type { TrackerMessage } from '../pitch/tracker';

const modules = new WeakMap<BaseAudioContext, Promise<void>>();

/** Mikrofon ohne Echo-Unterdrückung, Rauschfilter und Pegelautomatik (verfälschen die Tonhöhe). */
export const MIC_CONSTRAINTS: MediaStreamConstraints = {
	audio: { echoCancellation: false, noiseSuppression: false, autoGainControl: false }
};

export class Listener {
	onmessage: ((m: TrackerMessage) => void) | null = null;

	private constructor(
		private readonly node: AudioWorkletNode,
		private readonly source: AudioNode,
		private readonly stream: MediaStream | null
	) {
		node.port.onmessage = (e: MessageEvent<TrackerMessage>) => this.onmessage?.(e.data);
	}

	/** Startet das Mithören. input: 'mic' oder eine Quelle im selben AudioContext. */
	static async start(
		ctx: AudioContext,
		input: AudioNode | 'mic',
		options: PitchWorkletOptions
	): Promise<Listener> {
		if (!ctx.audioWorklet) throw Object.assign(new Error('kein AudioWorklet'), { name: 'NoMedia' });
		let loading = modules.get(ctx);
		if (!loading) {
			loading = ctx.audioWorklet.addModule(workletUrl);
			modules.set(ctx, loading);
		}
		let stream: MediaStream | null = null;
		let source: AudioNode;
		if (input === 'mic') {
			if (!navigator.mediaDevices?.getUserMedia) {
				throw Object.assign(new Error('kein Mikrofonzugriff'), { name: 'NoMedia' });
			}
			[stream] = await Promise.all([navigator.mediaDevices.getUserMedia(MIC_CONSTRAINTS), loading]);
			source = ctx.createMediaStreamSource(stream);
		} else {
			await loading;
			source = input;
		}
		const node = new AudioWorkletNode(ctx, 'pitch-tracker', {
			numberOfInputs: 1,
			numberOfOutputs: 1,
			channelCount: 1,
			channelCountMode: 'explicit',
			processorOptions: options
		});
		// Stumm an den Ausgang hängen: Manche Browser rechnen Knoten ohne Verbindung nicht.
		const sink = ctx.createGain();
		sink.gain.value = 0;
		source.connect(node);
		node.connect(sink).connect(ctx.destination);
		return new Listener(node, source, stream);
	}

	setInstrument(instrument: Instrument) {
		this.send({ type: 'instrument', instrument });
	}

	stop() {
		this.node.port.onmessage = null;
		try {
			this.source.disconnect(this.node);
		} catch {
			// schon getrennt
		}
		this.node.disconnect();
		this.stream?.getTracks().forEach((t) => t.stop());
	}

	private send(cmd: PitchWorkletCommand) {
		this.node.port.postMessage(cmd);
	}
}

/** Text für Fehler beim Starten des Mikrofons. */
export function micErrorText(e: unknown): string {
	const name = (e as { name?: string } | null)?.name;
	if (name === 'NotAllowedError' || name === 'SecurityError') {
		return 'Das Mikrofon ist gesperrt. Erlaube es in den Einstellungen deines Browsers.';
	}
	if (name === 'NotFoundError') return 'Kein Mikrofon gefunden.';
	if (name === 'NoMedia') return 'Dieser Browser kann nicht mithören.';
	return 'Das Mikrofon ist gerade nicht verfügbar.';
}

function click(ctx: AudioContext, t: number) {
	const osc = ctx.createOscillator();
	const gain = ctx.createGain();
	osc.type = 'square';
	osc.frequency.value = 1000;
	gain.gain.setValueAtTime(0.0001, t);
	gain.gain.exponentialRampToValueAtTime(0.8, t + 0.001);
	gain.gain.exponentialRampToValueAtTime(0.0001, t + 0.012);
	osc.connect(gain).connect(ctx.destination);
	osc.start(t);
	osc.stop(t + 0.02);
}

/**
 * Verzögerung messen: acht Klicks über den Lautsprecher, das Mikrofon meldet die Einsätze.
 * null, wenn es nicht geklappt hat (zu leise, zu laut im Raum, Kopfhörer auf).
 */
export async function measureRoundTrip(
	ctx: AudioContext,
	instrument: Instrument
): Promise<LatencyEstimate | null> {
	const listener = await Listener.start(ctx, 'mic', { instrument, onsets: true });
	const onsets: number[] = [];
	listener.onmessage = (m) => {
		if (m.type === 'onset') onsets.push(m.t);
	};
	const start = ctx.currentTime + 0.6;
	const clicks = Array.from(
		{ length: CALIBRATION_CLICKS },
		(_, k) => start + k * CALIBRATION_GAP_SEC
	);
	for (const t of clicks) click(ctx, t);
	const total = 0.6 + CALIBRATION_CLICKS * CALIBRATION_GAP_SEC + 0.5;
	await new Promise((r) => setTimeout(r, total * 1000));
	listener.stop();
	return estimateRoundTrip(clicks, onsets);
}
