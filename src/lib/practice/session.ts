// Ablauf beim Stück üben: Modus (Mitspielen, Echo, Rhythmus tippen), Übebereich, Echo-Phasen,
// Bewertung beim Tippen und Auswertung eines Durchgangs. Portiert aus prototype/v7 (setMode,
// tick, doTap, rhythmMisses, finishPass). Reine Logik ohne Browser; die Seite /ueben ruft sie pro
// Bild auf und setzt Sprünge, Lautstärke und Anzeige um.
//
// Bewertet wird beim Rhythmus tippen (Tipps) und beim Mithören (erkannte Tonhöhe, micFrame im
// Prototyp) in Mitspielen und Echo; im Echo nur in der Phase »Jetzt du«.

import { diaFromMidi } from '../music/notation';
import { noteIndexAt } from '../music/track';
import type { InstrumentKind, Note, RawNote } from '../music/types';
import {
	addToTally,
	classifyFrame,
	emptyTally,
	inJudgingWindow,
	noteVerdict,
	type FrameVerdict,
	type NoteTally,
	type NoteVerdict
} from '../pitch/classify';
import { coachMessage, type CoachMessage, type RecentFrame } from '../pitch/coach';
import type { TracePoint } from '../lane/draw';
import {
	ECHO_BARS,
	echoStep,
	ownVoiceVolume,
	type BarRange,
	type EchoState,
	type PracticeMode
} from './echo';
import {
	meanDeviationText,
	passHeadline,
	summarizePass,
	tempoAdvice,
	type TempoAdvice
} from './pass';
import { judgeTap, missedNotes, tapBeat, type TapContext, type TapResult } from './rhythm';

export const MODE_LABELS: Record<PracticeMode, string> = {
	play: 'Mitspielen',
	echo: 'Echo',
	rhythm: 'Rhythmus tippen'
};

export const MODE_HINTS: Record<PracticeMode, string> = {
	play: 'Die Band spielt, du spielst mit.',
	echo: 'Zwei Takte vorhören (deine Stimme klingt), dann dieselben zwei Takte selbst spielen. Danach die nächsten zwei.',
	rhythm: 'Tippe bei jedem Ton im richtigen Moment. Nur Rhythmus, ohne Instrument.'
};

/** Was die Seite zum Zeitpunkt eines Bildes weiss. */
export interface FrameInfo {
	/** Schlag ab Takt 0 */
	beat: number;
	/** Ausgabe-Latenz des Geräts in Sekunden (0 ohne Ton) */
	latency: number;
	/** Tempo, 1 = 100 % */
	rate: number;
	/** Sprungziel mit Anlauf (Takt) oder null */
	target: number | null;
}

/** Ton für den Übe-Ablauf; die Absenkung durch den Griff braucht nur das Mithören. */
export type SessionNote = RawNote & Partial<Pick<Note, 'lower'>>;

/** Mithören: aus, Mikrofon oder Vorführung (die eigene Spur wird bewertet). */
export type Listening = 'off' | 'mic' | 'demo';

/** Länge der Spur der erkannten Tonhöhe auf der Bahn (Messpunkte), wie im Prototyp. */
const TRACE_MAX = 900;
const RECENT_MAX = 30;
const EPS = 0.01;

export interface PassReport {
	final: boolean;
	headline: string;
	/** »2 knapp · im Schnitt 40 ms zu früh«, leer wenn nichts */
	detail: string;
	/** Nur nach einem ganzen Durchgang */
	advice: TempoAdvice;
	/** Bewertete Töne (für die Baustellen), nur nach einem ganzen Durchgang */
	judged: [number, NoteVerdict][];
}

export interface AdvanceStep {
	/** Springen (mit einem Takt Anlauf), ohne den Durchgang zu verwerfen; null = weiterlaufen */
	seekTo: number | null;
	report: PassReport | null;
}

export class PracticeSession {
	mode: PracticeMode = 'play';
	loop = false;
	echo: EchoState;
	judged = new Map<number, NoteVerdict>();
	/** Abweichung beim Tippen pro Ton in Sekunden (negativ = zu früh) */
	deviations = new Map<number, number>();
	passFrom: number | null = null;
	passCount = 0;
	listening: Listening = 'off';
	/** Erkannte Tonhöhe (notiert, diatonisch) für die Spur auf der Bahn */
	trace: TracePoint[] = [];
	/** Gerade gehörte Tonhöhe (diatonisch) oder null */
	current: number | null = null;
	/** Letzte Messpunkte für die Rückmeldung */
	recent: RecentFrame[] = [];
	/** Abweichung des letzten Messpunkts vom erwarteten Ton (Halbtöne), für die Anzeige */
	lastDeviation: number | null = null;
	/** Echo beginnt beim ersten Abspielen am Anfang des Bereichs */
	private echoFresh = true;
	private tallies = new Map<number, NoteTally>();
	private heardBeat = -Infinity;

	constructor(
		public notes: readonly SessionNote[],
		private readonly spb: number,
		public range: BarRange
	) {
		this.echo = { from: range.from, phase: 'hear' };
	}

	setNotes(notes: readonly SessionNote[]) {
		this.notes = notes;
		this.resetPass();
	}

	setMode(mode: PracticeMode) {
		this.mode = mode;
		this.echo = { from: this.range.from, phase: 'hear' };
		this.echoFresh = true;
		this.resetPass();
	}

	setRange(range: BarRange) {
		this.range = range;
		this.echo = { from: range.from, phase: 'hear' };
	}

	/** Echo ab einem bestimmten Takt (Antippen der Bahn). */
	echoFrom(bar: number) {
		this.echo = { from: bar, phase: 'hear' };
	}

	/**
	 * Vor dem Abspielen: Im Echo beim ersten Mal an den Anfang des Bereichs springen.
	 * Gibt den Takt zurück oder null.
	 */
	startEcho(): number | null {
		if (this.mode !== 'echo' || !this.echoFresh) return null;
		this.echoFresh = false;
		this.echo = { from: this.range.from, phase: 'hear' };
		return this.echo.from;
	}

	/** Mithören an oder aus; Rhythmus tippen und Mithören schliessen sich aus. */
	setListening(listening: Listening) {
		this.listening = listening;
		if (listening !== 'off' && this.mode === 'rhythm') this.setMode('play');
		else this.resetPass();
		this.recent = [];
		this.current = null;
	}

	/** Bewertet wird gerade: beim Rhythmus tippen und beim Mithören (im Echo nur »Jetzt du«). */
	get judging(): boolean {
		if (this.mode === 'rhythm') return true;
		if (this.listening === 'off') return false;
		return !(this.mode === 'echo' && this.echo.phase === 'hear');
	}

	/** »Hör zu« / »Jetzt du« im Echo, sonst null */
	get phaseText(): string | null {
		if (this.mode !== 'echo') return null;
		return this.echo.phase === 'hear' ? 'Hör zu' : 'Jetzt du';
	}

	/** Lautstärke der eigenen Stimme bei der Wahl Aus/Leise/Laut. */
	ownVolume(chosen: number): number {
		return ownVoiceVolume({
			micListening: this.listening === 'mic',
			mode: this.mode,
			echoPhase: this.echo.phase,
			chosen
		});
	}

	resetPass() {
		this.judged = new Map();
		this.deviations = new Map();
		this.tallies = new Map();
		this.trace = [];
		this.passFrom = null;
	}

	/** Tipp beim Rhythmus tippen. In einem anderen Modus still ignoriert. */
	tap(f: FrameInfo): TapResult {
		if (this.mode !== 'rhythm') return { kind: 'ignored' };
		if (this.passFrom === null) this.passFrom = Math.max(f.beat - 1, startBeat(f.target));
		const r = judgeTap(this.ctx(f), tapBeat(f.beat, f.latency, this.spb, f.rate));
		if (r.kind === 'judged') {
			this.judged.set(r.index, r.verdict);
			this.deviations.set(r.index, r.deviationSec);
		}
		return r;
	}

	/** Töne, die ohne Tipp vorbei sind, als verpasst markieren. true, wenn sich etwas geändert hat. */
	catchMisses(f: FrameInfo): boolean {
		if (this.mode !== 'rhythm') return false;
		if (this.passFrom === null) this.passFrom = Math.max(f.beat, startBeat(f.target));
		const missed = missedNotes(this.ctx(f), f.beat, f.latency);
		for (const i of missed) this.judged.set(i, 'none');
		return missed.length > 0;
	}

	/**
	 * Ein Messpunkt beim Mithören. written: gehörte Tonhöhe in notierter Lage (klingend − shift der
	 * Stimme) oder null. delaySec: wie lange der Messpunkt hinter der Band liegt (Verzögerung des
	 * Geräts plus Alter der Meldung). Gibt true zurück, wenn ein Ton fertig bewertet wurde.
	 */
	hear(written: number | null, f: FrameInfo, delaySec: number): boolean {
		if (this.listening === 'off') return false;
		const bps = f.rate / this.spb;
		const b = f.beat - delaySec * bps;
		this.heardBeat = b;
		const active = this.judging && this.mode !== 'rhythm';
		if (active && this.passFrom === null) this.passFrom = Math.max(b, startBeat(f.target));
		const i = noteIndexAt(this.notes, b);
		let info: FrameVerdict | null = null;
		if (written !== null) {
			this.current = diaFromMidi(written);
			let inWindow = false;
			if (i >= 0) {
				const n = this.notes[i];
				info = classifyFrame(written, { m: n.m, lower: n.lower ?? null });
				const sinceStart = (b - n.b) / bps;
				const untilEnd = (n.b + n.d - b) / bps;
				inWindow = inJudgingWindow(sinceStart, untilEnd, n.d / bps);
				if (active && this.passFrom !== null && n.b >= this.passFrom - EPS && inWindow) {
					this.tallies.set(i, addToTally(this.tallies.get(i) ?? emptyTally(), info));
				}
			}
			this.trace.push({ b, dia: this.current, c: inWindow && info ? info.c : 'free' });
			if (this.trace.length > TRACE_MAX) this.trace.splice(0, TRACE_MAX / 3);
			this.recent.push(info ?? 'free');
		} else {
			this.current = null;
			this.recent.push(null);
		}
		if (this.recent.length > RECENT_MAX) this.recent.shift();
		this.lastDeviation = info?.dev ?? null;

		// Töne, die vorbei sind, aus ihren Messpunkten bewerten
		let changed = false;
		if (active && this.passFrom !== null) {
			for (let k = 0; k < this.notes.length; k++) {
				const n = this.notes[k];
				if (n.b < this.passFrom - EPS) continue;
				if (n.b + n.d > b) break;
				if (this.judged.has(k)) continue;
				this.judged.set(k, noteVerdict(this.tallies.get(k)));
				changed = true;
			}
		}
		return changed;
	}

	/** Kurze Rückmeldung zum Mithören (der Aufrufer bestimmt, wie oft). */
	coach(kind: InstrumentKind, playing: boolean, rate: number): CoachMessage | null {
		const i = noteIndexAt(this.notes, this.heardBeat);
		const note = i >= 0 ? this.notes[i] : null;
		return coachMessage({
			recent: this.recent,
			note,
			kind,
			playing,
			listenPhase: this.mode === 'echo' && this.echo.phase === 'hear',
			secondsIntoNote: note ? ((this.heardBeat - note.b) * this.spb) / rate : 0
		});
	}

	/**
	 * Pro Bild beim Abspielen: Echo-Phasen und Schleife. Am Ende eines Durchgangs (Bereich einmal
	 * durch) kommt die Auswertung zurück.
	 */
	advance(f: FrameInfo, tempo: number): AdvanceStep {
		const bar = f.beat / 4;
		if (this.mode === 'echo') {
			const step = echoStep(this.echo, bar, this.range);
			if (step.seekTo === null) return { seekTo: null, report: null };
			if (this.echo.phase === 'play') {
				this.closeHeard(Math.min(this.echo.from + ECHO_BARS, this.range.to + 1) * 4);
			}
			this.echo = step.state;
			let report: PassReport | null = null;
			if (step.passDone) {
				report = this.finish(true, tempo);
				this.resetPass();
			}
			return { seekTo: step.seekTo, report };
		}
		if (this.loop && bar >= this.range.to + 1) {
			this.catchMisses(f);
			this.closeHeard((this.range.to + 1) * 4);
			const report = this.finish(true, tempo);
			this.resetPass();
			return { seekTo: this.range.from, report };
		}
		return { seekTo: null, report: null };
	}

	/**
	 * Auswertung: final nach einem ganzen Durchgang (zählt, mit Tempo-Vorschlag), sonst Zwischenstand
	 * beim Anhalten. null bei weniger als drei bewerteten Tönen.
	 */
	finish(final: boolean, tempo: number): PassReport | null {
		const entries = [...this.judged.entries()];
		const summary = summarizePass(entries.map(([, v]) => v));
		if (!summary) return null;
		if (final) this.passCount++;
		const parts = [summary.half ? `${summary.half} knapp` : ''];
		if (this.mode === 'rhythm') parts.push(meanDeviationText([...this.deviations.values()]) ?? '');
		return {
			final,
			headline: passHeadline(summary, {
				final,
				number: this.passCount,
				rhythm: this.mode === 'rhythm'
			}),
			detail: parts.filter(Boolean).join(' · '),
			advice: final ? tempoAdvice(summary.pct, tempo) : null,
			judged: final ? entries : []
		};
	}

	/**
	 * Beim Mithören am Ende eines Bereichs alle angefangenen Töne aus ihren Messpunkten bewerten.
	 * Die Meldungen hinken um die Verzögerung hinter der Band her; ohne das bliebe der letzte Ton
	 * vor dem Rücksprung offen (so war es im Prototyp).
	 */
	private closeHeard(endBeat: number) {
		if (this.listening === 'off' || this.mode === 'rhythm' || this.passFrom === null) return;
		for (let k = 0; k < this.notes.length; k++) {
			const n = this.notes[k];
			if (n.b >= endBeat - EPS) break;
			if (n.b < this.passFrom - EPS || this.judged.has(k)) continue;
			this.judged.set(k, noteVerdict(this.tallies.get(k)));
		}
	}

	private ctx(f: FrameInfo): TapContext {
		return {
			notes: this.notes,
			passFrom: this.passFrom ?? -Infinity,
			judged: this.judged,
			spb: this.spb,
			rate: f.rate
		};
	}
}

/** Mit Anlauf zählt der Durchgang erst ab dem Sprungziel. */
function startBeat(target: number | null): number {
	return target !== null ? target * 4 : -Infinity;
}
