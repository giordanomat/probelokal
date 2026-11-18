// Ablauf von »Tippen abgleichen« mit Web Audio: Klicks auf der Uhr des AudioContext planen und
// Tipps auf derselben Uhr festhalten. Auswertung in src/lib/practice/tapcal.ts.
// Ungeprüft auf iPhone/iPad: wie genau currentTime beim Tippen ist (Rechenblöcke von ~3 ms).

import {
	clickTimes,
	TAPCAL_COUNT_IN,
	TAPCAL_GAP_SEC,
	tapcalOutcome,
	type TapcalOutcome
} from '../practice/tapcal.ts';

/** Vorlauf bis zum ersten Klick */
const LEAD_SEC = 0.8;
/** Nach dem letzten Klick noch so lange auf einen Tipp warten */
const TAIL_SEC = 0.35;

export type TapcalPhase =
	| { kind: 'wait' }
	/** Zuhören, Klick n von 4 */
	| { kind: 'listen'; n: number }
	/** Mittippen, Klick n von 12 */
	| { kind: 'tap'; n: number }
	| { kind: 'done' };

export class TapCalibration {
	readonly clicks: number[];
	private readonly taps: number[] = [];
	private readonly nodes: AudioScheduledSourceNode[] = [];

	constructor(private readonly ctx: AudioContext) {
		this.clicks = clickTimes(ctx.currentTime + LEAD_SEC);
		this.clicks.forEach((t, i) => this.click(t, i < TAPCAL_COUNT_IN));
	}

	/** Kurzer Klick, beim Zuhören höher */
	private click(at: number, countIn: boolean) {
		const osc = this.ctx.createOscillator();
		const gain = this.ctx.createGain();
		osc.frequency.value = countIn ? 1320 : 880;
		gain.gain.setValueAtTime(0.0001, at);
		gain.gain.exponentialRampToValueAtTime(0.6, at + 0.003);
		gain.gain.exponentialRampToValueAtTime(0.0001, at + 0.06);
		osc.connect(gain).connect(this.ctx.destination);
		osc.start(at);
		osc.stop(at + 0.07);
		this.nodes.push(osc);
	}

	tap() {
		this.taps.push(this.ctx.currentTime);
	}

	/** Tipps, die schon nahe an einem der Klicks zum Mittippen liegen (für die Punkte) */
	tapped(): boolean[] {
		return this.clicks
			.slice(TAPCAL_COUNT_IN)
			.map((c) => this.taps.some((t) => Math.abs(t - c) <= TAPCAL_GAP_SEC / 2));
	}

	phase(): TapcalPhase {
		const now = this.ctx.currentTime;
		const last = this.clicks[this.clicks.length - 1];
		if (now >= last + TAIL_SEC) return { kind: 'done' };
		const i = this.clicks.findLastIndex((c) => c <= now + 0.02);
		if (i < 0) return { kind: 'wait' };
		return i < TAPCAL_COUNT_IN
			? { kind: 'listen', n: i + 1 }
			: { kind: 'tap', n: i - TAPCAL_COUNT_IN + 1 };
	}

	/** Seit dem letzten Klick vergangen (s), für das Aufleuchten */
	sinceClick(): number {
		const now = this.ctx.currentTime;
		const i = this.clicks.findLastIndex((c) => c <= now);
		return i < 0 ? Infinity : now - this.clicks[i];
	}

	outcome(): TapcalOutcome {
		return tapcalOutcome(this.clicks, this.taps);
	}

	stop() {
		for (const n of this.nodes) {
			try {
				n.stop();
			} catch {
				// schon vorbei
			}
		}
	}
}
