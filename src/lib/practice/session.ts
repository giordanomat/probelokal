// Ablauf beim Stück üben: Modus (Mitspielen, Echo, Rhythmus tippen), Übebereich, Echo-Phasen,
// Bewertung beim Tippen und Auswertung eines Durchgangs. Portiert aus prototype/v7 (setMode,
// tick, doTap, rhythmMisses, finishPass). Reine Logik ohne Browser; die Seite /ueben ruft sie pro
// Bild auf und setzt Sprünge, Lautstärke und Anzeige um.
//
// Bewertet wird vorerst nur beim Rhythmus tippen. Mithören (Mikrofon) kommt in M1 Punkt 4 dazu
// und bewertet dann auch Mitspielen und Echo (»Jetzt du«).

import type { RawNote } from '../music/types';
import type { NoteVerdict } from '../pitch/classify';
import { echoStep, ownVoiceVolume, type BarRange, type EchoState, type PracticeMode } from './echo';
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
	/** Echo beginnt beim ersten Abspielen am Anfang des Bereichs */
	private echoFresh = true;

	constructor(
		public notes: readonly RawNote[],
		private readonly spb: number,
		public range: BarRange
	) {
		this.echo = { from: range.from, phase: 'hear' };
	}

	setNotes(notes: readonly RawNote[]) {
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

	/** Bewertet wird gerade (vorerst nur beim Rhythmus tippen). */
	get judging(): boolean {
		return this.mode === 'rhythm';
	}

	/** »Hör zu« / »Jetzt du« im Echo, sonst null */
	get phaseText(): string | null {
		if (this.mode !== 'echo') return null;
		return this.echo.phase === 'hear' ? 'Hör zu' : 'Jetzt du';
	}

	/** Lautstärke der eigenen Stimme bei der Wahl Aus/Leise/Laut. */
	ownVolume(chosen: number): number {
		return ownVoiceVolume({
			micListening: false,
			mode: this.mode,
			echoPhase: this.echo.phase,
			chosen
		});
	}

	resetPass() {
		this.judged = new Map();
		this.deviations = new Map();
		this.passFrom = null;
	}

	/** Tipp beim Rhythmus tippen. Ohne Bewertung (anderer Modus) still ignoriert. */
	tap(f: FrameInfo): TapResult {
		if (!this.judging) return { kind: 'ignored' };
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
		if (!this.judging) return false;
		if (this.passFrom === null) this.passFrom = Math.max(f.beat, startBeat(f.target));
		const missed = missedNotes(this.ctx(f), f.beat, f.latency);
		for (const i of missed) this.judged.set(i, 'none');
		return missed.length > 0;
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
