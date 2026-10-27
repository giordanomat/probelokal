// Ton fürs Stück üben nach docs/02-architektur.md »Audio«: Band (Minus-One) und eigene Stimme als
// zwei <audio>-Elemente, beide über MediaElementSource in einen AudioContext, die eigene Stimme
// über einen GainNode (iOS ignoriert element.volume). Die Band ist die Uhr: Die Bahn liest ihre
// currentTime. Die eigene Spur wird nachgeführt, wenn sie mehr als 50 ms abweicht (alle 500 ms
// geprüft). Tempo über playbackRate mit preservesPitch. Portiert aus prototype/v7 (playAll,
// setTime, applyRate, Nachführen in frame()).
//
// Ungeprüft: Gleichlauf und Speicherbedarf auf iPhone/iPad (Abnahme M1, Testprotokoll).

import type { PracticeClock } from '../practice/clock';

export const SYNC_INTERVAL_MS = 500;
export const MAX_DRIFT_SEC = 0.05;

/** Was der Spieler von einem <audio>-Element braucht (im Test nachgebaut). */
export type MediaLike = Pick<
	HTMLMediaElement,
	| 'currentTime'
	| 'paused'
	| 'playbackRate'
	| 'defaultPlaybackRate'
	| 'preservesPitch'
	| 'readyState'
	| 'src'
	| 'volume'
	| 'muted'
	| 'play'
	| 'pause'
	| 'load'
> &
	EventTarget;

export interface AudioGraph {
	resume(): void;
	setOwnGain(value: number): void;
}

export type GraphFactory = (band: MediaLike, own: MediaLike) => AudioGraph;

/** Verkabelung im Browser. Erst beim ersten Abspielen aufrufen (iOS verlangt eine Berührung). */
export const webAudioGraph: GraphFactory = (band, own) => {
	const Ctx =
		window.AudioContext ??
		(window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
	const ctx = new Ctx();
	ctx.createMediaElementSource(band as HTMLMediaElement).connect(ctx.destination);
	const gain = ctx.createGain();
	ctx
		.createMediaElementSource(own as HTMLMediaElement)
		.connect(gain)
		.connect(ctx.destination);
	return {
		resume() {
			if (ctx.state === 'suspended') void ctx.resume();
		},
		setOwnGain(value) {
			gain.gain.value = value;
		}
	};
};

/** HAVE_METADATA: Erst ab hier lässt sich currentTime zuverlässig setzen. */
const HAVE_METADATA = 1;

/** Abweichung der eigenen Spur, ab der sie auf die Band gesetzt wird. */
export function needsResync(bandTime: number, ownTime: number): boolean {
	return Math.abs(ownTime - bandTime) > MAX_DRIFT_SEC;
}

export class StemPlayer implements PracticeClock {
	/** Wird aufgerufen, wenn eine Spur nicht geladen werden kann. */
	onerror: (() => void) | null = null;

	private graph: AudioGraph | null = null;
	private graphFailed = false;
	private readonly pending = new Map<MediaLike, number>();
	private _rate = 1;
	private _ownGain = 1;
	private lastSync = -Infinity;

	constructor(
		private readonly band: MediaLike,
		private readonly own: MediaLike,
		private readonly makeGraph: GraphFactory = webAudioGraph
	) {
		for (const el of [band, own]) {
			el.addEventListener('loadedmetadata', this.onMeta);
			el.addEventListener('error', this.onError);
		}
		// Auch ein Anhalten von aussen (Sperrbildschirm, Anruf) hält beide Spuren an.
		band.addEventListener('pause', this.onBandPause);
	}

	/** Spuren einer Stimme laden und an derselben Stelle weitermachen. */
	load(urls: { band: string; own: string }, at = this.time()) {
		const was = this.playing;
		this.pause();
		for (const [el, url] of [
			[this.band, urls.band],
			[this.own, urls.own]
		] as const) {
			el.src = url;
			el.load();
			this.pending.set(el, at);
		}
		if (was) this.play();
	}

	get playing() {
		return !this.band.paused;
	}

	time(): number {
		return this.band.readyState >= HAVE_METADATA
			? this.band.currentTime
			: (this.pending.get(this.band) ?? 0);
	}

	get rate() {
		return this._rate;
	}

	set rate(r: number) {
		this._rate = r;
		this.applyRate(this.band);
		this.applyRate(this.own);
	}

	/** Lautstärke der eigenen Stimme, 0–1. */
	get ownGain() {
		return this._ownGain;
	}

	set ownGain(v: number) {
		this._ownGain = v;
		this.applyOwnGain();
	}

	play() {
		this.ensureGraph();
		this.graph?.resume();
		if (this.loaded()) this.own.currentTime = this.band.currentTime;
		this.lastSync = -Infinity;
		this.own.play().catch(() => {});
		return this.band.play().catch(() => {
			// Abgelehnt (keine Berührung, Datei fehlt): Beide bleiben stehen, playing ist false.
			this.own.pause();
		});
	}

	pause() {
		this.band.pause();
		this.own.pause();
	}

	seek(seconds: number) {
		const t = Math.max(0, seconds);
		for (const el of [this.band, this.own]) {
			if (el.readyState >= HAVE_METADATA) {
				el.currentTime = t;
				this.pending.delete(el);
			} else {
				this.pending.set(el, t);
			}
		}
	}

	/**
	 * Eigene Spur nachführen; aus dem Animations-Takt aufrufen. Prüft höchstens alle 500 ms.
	 * Gibt true zurück, wenn nachgeführt wurde.
	 */
	maybeSync(nowMs: number): boolean {
		if (!this.playing || nowMs - this.lastSync < SYNC_INTERVAL_MS) return false;
		this.lastSync = nowMs;
		if (!this.loaded() || !needsResync(this.band.currentTime, this.own.currentTime)) return false;
		this.own.currentTime = this.band.currentTime;
		return true;
	}

	destroy() {
		this.pause();
		for (const el of [this.band, this.own]) {
			el.removeEventListener('loadedmetadata', this.onMeta);
			el.removeEventListener('error', this.onError);
		}
		this.band.removeEventListener('pause', this.onBandPause);
	}

	private loaded() {
		return this.band.readyState >= HAVE_METADATA && this.own.readyState >= HAVE_METADATA;
	}

	private applyRate(el: MediaLike) {
		el.playbackRate = this._rate;
		el.defaultPlaybackRate = this._rate;
		el.preservesPitch = true;
		// älteres Safari
		(el as { webkitPreservesPitch?: boolean }).webkitPreservesPitch = true;
	}

	private applyOwnGain() {
		if (this.graph) this.graph.setOwnGain(this._ownGain);
		else if (this.graphFailed) {
			this.own.volume = this._ownGain;
			this.own.muted = this._ownGain === 0;
		}
		// Ohne Graph und ohne Fehler: wird beim ersten Abspielen gesetzt.
	}

	private ensureGraph() {
		if (this.graph || this.graphFailed) return;
		try {
			this.graph = this.makeGraph(this.band, this.own);
		} catch {
			this.graphFailed = true;
		}
		this.applyOwnGain();
	}

	private readonly onMeta = (e: Event) => {
		const el = e.target === this.band ? this.band : this.own;
		this.applyRate(el);
		const at = this.pending.get(el);
		if (at !== undefined) {
			el.currentTime = at;
			this.pending.delete(el);
		}
	};

	private readonly onError = () => {
		this.pause();
		this.onerror?.();
	};

	private readonly onBandPause = () => {
		this.own.pause();
	};
}
