// Wiedergabe beim Einblasen, portiert aus prototype/v7 (exPlay, exSchedule, click, tone):
// Klick und vorgespielte Töne in Web Audio vorausgeplant (25-ms-Takt, 0,5 s Vorlauf, docs/02).
// Die Uhr ist der AudioContext: Schlag = Startschlag + (jetzt − Start) × Tempo.
// Der Vorspielton ist wie im Prototyp synthetisch; im Produkt kommen echte Aufnahmen pro
// Instrument (docs/02). Wie er auf Handy-Lautsprechern klingt, ist ungeprüft.

import { midiToFrequency } from '../pitch/yin';
import { beatEvents, type ExerciseNote } from './exercises';

const TICK_MS = 25;
const LOOKAHEAD_SEC = 0.5;

export class WarmupPlayer {
	notes: readonly ExerciseNote[] = [];
	total = 0;
	bpm = 72;
	click = true;
	/** Klingend = notiert + shift der Stimme */
	shift = 0;

	private _playing = false;
	private t0 = 0;
	private beat0 = 0;
	private next = 0;
	private timer: ReturnType<typeof setInterval> | null = null;
	private out: GainNode | null = null;
	private voices: AudioScheduledSourceNode[] = [];

	constructor(private readonly ctx: AudioContext) {}

	get playing() {
		return this._playing;
	}

	/** Schlag ab Beginn der Übung (0–4 = Einzählen) */
	beat(): number {
		return this._playing
			? this.beat0 + ((this.ctx.currentTime - this.t0) * this.bpm) / 60
			: this.beat0;
	}

	start(fromBeat = this.beat0) {
		if (this._playing) return;
		if (this.ctx.state === 'suspended') void this.ctx.resume();
		this.beat0 = fromBeat >= this.total - 0.01 ? 0 : Math.max(0, fromBeat);
		this.out = this.ctx.createGain();
		this.out.gain.value = 0.5;
		this.out.connect(this.ctx.destination);
		this.t0 = this.ctx.currentTime + 0.08;
		this.next = Math.ceil(this.beat0);
		this._playing = true;
		this.timer = setInterval(() => this.schedule(), TICK_MS);
		this.schedule();
	}

	stop() {
		if (!this._playing) return;
		this.beat0 = Math.min(this.beat(), this.total);
		this._playing = false;
		if (this.timer) clearInterval(this.timer);
		this.timer = null;
		for (const v of this.voices) {
			try {
				v.stop();
			} catch {
				// schon beendet
			}
		}
		this.voices = [];
		this.out?.disconnect();
		this.out = null;
	}

	/** An den Anfang (oder einen Schlag) setzen, ohne abzuspielen. */
	seek(beat: number) {
		this.stop();
		this.beat0 = Math.max(0, beat);
	}

	private beatTime(b: number) {
		return this.t0 + ((b - this.beat0) * 60) / this.bpm;
	}

	private schedule() {
		if (!this._playing) return;
		const horizon = this.beat() + (LOOKAHEAD_SEC * this.bpm) / 60;
		while (this.next <= horizon && this.next < this.total) {
			const b = this.next;
			const t = this.beatTime(b);
			if (t >= this.ctx.currentTime - 0.01) {
				const ev = beatEvents(b, this.notes, this.click);
				if (ev.click) this.clickAt(t, ev.click.accent);
				for (const n of ev.tones) {
					this.toneAt(this.beatTime(n.b), (n.d * 60) / this.bpm, n.m + this.shift);
				}
			}
			this.next++;
		}
	}

	private clickAt(t: number, accent: boolean) {
		if (!this.out) return;
		const o = this.ctx.createOscillator();
		const g = this.ctx.createGain();
		o.frequency.value = accent ? 1760 : 1320;
		g.gain.setValueAtTime(0.0001, t);
		g.gain.exponentialRampToValueAtTime(accent ? 0.35 : 0.2, t + 0.002);
		g.gain.exponentialRampToValueAtTime(0.0001, t + 0.05);
		o.connect(g).connect(this.out);
		o.start(t);
		o.stop(t + 0.06);
		this.voices.push(o);
	}

	/** Zwei leicht verstimmte Sägezähne durch einen Tiefpass, wie im Prototyp. */
	private toneAt(t: number, dur: number, sounding: number) {
		if (!this.out) return;
		const f = midiToFrequency(sounding);
		const o = this.ctx.createOscillator();
		const o2 = this.ctx.createOscillator();
		const lp = this.ctx.createBiquadFilter();
		const g = this.ctx.createGain();
		o.type = 'sawtooth';
		o2.type = 'sawtooth';
		o.frequency.value = f;
		o2.frequency.value = f * 1.003;
		lp.type = 'lowpass';
		lp.frequency.value = Math.min(4000, f * 6);
		lp.Q.value = 0.8;
		const end = t + Math.max(0.12, dur * 0.92);
		g.gain.setValueAtTime(0.0001, t);
		g.gain.exponentialRampToValueAtTime(0.18, t + 0.04);
		g.gain.setValueAtTime(0.16, end - 0.06);
		g.gain.exponentialRampToValueAtTime(0.0001, end);
		o.connect(lp);
		o2.connect(lp);
		lp.connect(g).connect(this.out);
		o.start(t);
		o2.start(t);
		o.stop(end + 0.02);
		o2.stop(end + 0.02);
		this.voices.push(o, o2);
	}
}
