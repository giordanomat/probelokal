import { describe, expect, it } from 'vitest';
import { badTouchPart } from '../../test/badtouch';
import { BAD_TOUCH } from '#lib/titles/bad-touch.ts';
import { secondsPerBeat } from '../music/timing';
import { NATURAL_SERIES } from '../music/fingering';
import { buildTrack, noteIndicesInBars } from '../music/track';
import type { RawNote } from '../music/types';
import { TAP_EXTRA_LATENCY_SEC } from './rhythm';
import { PracticeSession, type FrameInfo } from './session';

const spb = secondsPerBeat(BAD_TOUCH);
const LAT = 0.03;
const A = { from: 1, to: 8 };

/** Viertel auf jedem Schlag in Takt 1–8 */
const quarters: RawNote[] = Array.from({ length: 32 }, (_, k) => ({
	b: 4 + k,
	d: 1,
	m: 67,
	dia: 32,
	acc: 0,
	step: 'G',
	fing: '0'
}));

const frame = (beat: number, extra: Partial<FrameInfo> = {}): FrameInfo => ({
	beat,
	latency: LAT,
	rate: 1,
	target: null,
	...extra
});
/** Schlag, an dem jemand tippt, der genau im Takt drückt (Latenz eingerechnet). */
const tapNow = (b: number, offsetSec = 0, rate = 1) =>
	b + ((LAT + TAP_EXTRA_LATENCY_SEC + offsetSec) * rate) / spb;

describe('Übe-Ablauf: Rhythmus tippen', () => {
	it('bewertet nur im Modus Rhythmus tippen', () => {
		const s = new PracticeSession(quarters, spb, A);
		expect(s.tap(frame(tapNow(4)))).toEqual({ kind: 'ignored' });
		expect(s.catchMisses(frame(10))).toBe(false);
		s.setMode('rhythm');
		expect(s.tap(frame(tapNow(4)))).toMatchObject({ kind: 'judged', index: 0, verdict: 'hit' });
		expect(s.judged.get(0)).toBe('hit');
	});

	it('exakt getippter Teil A von Trompete 1 in der Schleife: 100 %, Vorschlag schneller', () => {
		const notes = badTouchPart('P1').notes;
		const a = BAD_TOUCH.sections[1];
		const s = new PracticeSession(notes, spb, { from: a.from, to: a.to });
		s.setMode('rhythm');
		s.loop = true;
		const target = a.from;
		const rate = 0.8;
		// Start mit einem Takt Anlauf
		s.catchMisses(frame((a.from - 1) * 4, { target, rate }));
		for (const i of noteIndicesInBars(notes, a.from, a.to)) {
			const b = tapNow(notes[i].b, 0, rate);
			s.catchMisses(frame(b, { target, rate }));
			expect(s.tap(frame(b, { target, rate }))).toMatchObject({ verdict: 'hit' });
		}
		const step = s.advance(frame((a.to + 1) * 4 + 0.01, { target, rate }), 80);
		expect(step.seekTo).toBe(a.from);
		expect(step.report).toMatchObject({
			final: true,
			advice: { kind: 'faster', tempo: 85 },
			detail: 'im Schnitt genau'
		});
		expect(step.report?.headline).toMatch(/^Durchgang 1: (\d+) von \1 Einsätzen genau \(100 %\)$/);
		expect(step.report?.judged.length).toBe(noteIndicesInBars(notes, a.from, a.to).length);
		// neuer Durchgang beginnt leer
		expect(s.judged.size).toBe(0);
	});

	it('nicht getippte Töne sind verpasst; ein Durchgang ohne Treffer schlägt langsamer vor', () => {
		const s = new PracticeSession(quarters, spb, A);
		s.setMode('rhythm');
		s.loop = true;
		s.catchMisses(frame(4, { target: 1 }));
		expect(s.catchMisses(frame(20))).toBe(true);
		expect([...s.judged.values()].every((v) => v === 'none')).toBe(true);
		const step = s.advance(frame(36.1), 100);
		expect(step.report?.advice).toEqual({ kind: 'slower', tempo: 90 });
		expect(step.report?.headline).toBe('Durchgang 1: 0 von 32 Einsätzen genau (0 %)');
	});

	it('vor dem Sprungziel (Anlauftakt) zählt nichts', () => {
		const s = new PracticeSession(quarters, spb, A);
		s.setMode('rhythm');
		// Sprung auf Takt 2 mit Anlauf: Takt 1 läuft, zählt aber nicht
		s.catchMisses(frame(4, { target: 2 }));
		s.catchMisses(frame(8.3, { target: 2 }));
		expect(s.judged.size).toBe(0);
		expect(s.passFrom).toBe(8);
		// der Ton am Sprungziel zählt
		s.catchMisses(frame(9, { target: 2 }));
		expect([...s.judged.keys()]).toEqual([4]);
	});

	it('Zwischenstand beim Anhalten zählt nicht als Durchgang', () => {
		const s = new PracticeSession(quarters, spb, A);
		s.setMode('rhythm');
		s.catchMisses(frame(3.5));
		for (const b of [4, 5, 6]) s.tap(frame(tapNow(b, -0.1)));
		const r = s.finish(false, 100);
		expect(r).toMatchObject({
			final: false,
			headline: 'Bisher: 0 von 3 Einsätzen genau (0 %)',
			detail: '3 knapp · im Schnitt 100 ms zu früh',
			advice: null,
			judged: []
		});
		expect(s.passCount).toBe(0);
		// zu wenig bewertete Töne: keine Auswertung
		s.resetPass();
		expect(s.finish(false, 100)).toBeNull();
	});

	it('ohne Schleife läuft das Stück einfach weiter', () => {
		const s = new PracticeSession(quarters, spb, A);
		s.setMode('rhythm');
		expect(s.advance(frame(40), 100)).toEqual({ seekTo: null, report: null });
	});
});

describe('Übe-Ablauf: Echo', () => {
	it('zwei Takte hören, dieselben zwei selbst, dann weiter; eigene Stimme laut bzw. stumm', () => {
		const s = new PracticeSession(quarters, spb, A);
		s.setMode('echo');
		expect(s.startEcho()).toBe(1);
		expect(s.startEcho()).toBeNull();
		expect(s.phaseText).toBe('Hör zu');
		expect(s.ownVolume(0)).toBe(1);

		expect(s.advance(frame(11.9), 100).seekTo).toBeNull();
		expect(s.advance(frame(12), 100).seekTo).toBe(1);
		expect(s.phaseText).toBe('Jetzt du');
		expect(s.ownVolume(1)).toBe(0);

		expect(s.advance(frame(12), 100).seekTo).toBe(3);
		expect(s.echo).toEqual({ from: 3, phase: 'hear' });
	});

	it('am Ende des Bereichs von vorn; ohne Bewertung kein Ergebnis', () => {
		const s = new PracticeSession(quarters, spb, A);
		s.setMode('echo');
		s.echo = { from: 7, phase: 'play' };
		expect(s.advance(frame(36), 100)).toEqual({ seekTo: 1, report: null });
		expect(s.echo).toEqual({ from: 1, phase: 'hear' });
	});

	it('Antippen der Bahn setzt den Echo-Anfang; Moduswechsel beginnt neu', () => {
		const s = new PracticeSession(quarters, spb, A);
		s.setMode('echo');
		s.startEcho();
		s.echoFrom(5);
		expect(s.echo).toEqual({ from: 5, phase: 'hear' });
		s.setMode('play');
		expect(s.phaseText).toBeNull();
		expect(s.ownVolume(0.35)).toBe(0.35);
		s.setMode('echo');
		expect(s.startEcho()).toBe(1);
	});
});

describe('Übe-Ablauf: Mitspielen', () => {
	it('Schleife springt am Bereichsende zurück, ohne Bewertung kein Ergebnis', () => {
		const s = new PracticeSession(quarters, spb, A);
		expect(s.advance(frame(36), 100)).toEqual({ seekTo: null, report: null });
		s.loop = true;
		expect(s.advance(frame(35.9), 100).seekTo).toBeNull();
		expect(s.advance(frame(36), 100)).toEqual({ seekTo: 1, report: null });
	});

	it('Stimme wechseln verwirft den laufenden Durchgang', () => {
		const s = new PracticeSession(quarters, spb, A);
		s.setMode('rhythm');
		s.tap(frame(tapNow(4)));
		s.setNotes(quarters.slice(4));
		expect(s.judged.size).toBe(0);
		expect(s.passFrom).toBeNull();
	});
});

describe('Übe-Ablauf: Mithören', () => {
	const notes = buildTrack(badTouchPart('P1').notes, 'valve').notes;
	const a = BAD_TOUCH.sections[1];
	const inA = noteIndicesInBars(notes, a.from, a.to);
	const STEP = 0.02; // eine Meldung alle 20 ms wie im Worklet

	/**
	 * Spielt Teil A mit 50 Messpunkten pro Sekunde. pitchAt: was die Person zum Schlag spielt
	 * (notiert) oder null. lateSec: so viel später kommt es im Mikrofon an; delaySec: so viel
	 * rechnet die Bewertung zurück.
	 */
	function playA(
		s: PracticeSession,
		pitchAt: (n: (typeof notes)[number]) => number | null,
		{ lateSec = 0, delaySec = 0, rate = 1 } = {}
	) {
		const bps = rate / spb;
		const from = (a.from - 1) * 4; // Anlauftakt
		const to = (a.to + 1) * 4 + 1;
		for (let beat = from; beat < to; beat += STEP * bps) {
			// gespielt wurde zum Schlag beat − lateSec
			const played = beat - lateSec * bps;
			const i = notes.findIndex((n) => played >= n.b && played < n.b + n.d);
			const written = i >= 0 ? pitchAt(notes[i]) : null;
			s.hear(written, frame(beat, { target: a.from, rate }), delaySec);
		}
	}

	function listeningSession(listening: 'mic' | 'demo' = 'mic') {
		const s = new PracticeSession(notes, spb, { from: a.from, to: a.to });
		s.setListening(listening);
		return s;
	}

	it('sauber gespielter Teil A: jeder Ton getroffen, auch bei 70 %', () => {
		for (const rate of [1, 0.7]) {
			const s = listeningSession();
			playA(s, (n) => n.m, { rate });
			for (const i of inA) expect(s.judged.get(i), `Ton ${i}`).toBe('hit');
			expect(s.finish(true, 70)?.headline).toBe(
				`Durchgang 1: ${inA.length} von ${inA.length} Tönen getroffen (100 %)`
			);
		}
	});

	it('richtiger Griff, eine Stufe zu hoch: falsche Stufe; nichts gespielt: nicht gehört', () => {
		const above = (n: (typeof notes)[number]) => {
			const sounding = n.m + (n.lower ?? 0);
			const next = NATURAL_SERIES.find((x) => x > sounding);
			return next === undefined ? null : next - (n.lower ?? 0);
		};
		const s = listeningSession();
		playA(s, above);
		for (const i of inA) expect(s.judged.get(i)).toBe('partial');
		expect(s.coach('valve', true, 1)?.text).toMatch(/^Richtiger Griff, aber eine Stufe zu hoch/);

		const quiet = listeningSession();
		playA(quiet, () => null);
		for (const i of inA) expect(quiet.judged.get(i)).toBe('none');
		expect(quiet.coach('valve', true, 1)?.text).toMatch(/Ich höre dich nicht|Pause/);
	});

	it('Verzögerung des Geräts: richtig zurückgerechnet trifft alles', () => {
		for (const late of [0.12, 0.25]) {
			const s = listeningSession();
			playA(s, (n) => n.m, { lateSec: late, delaySec: late });
			for (const i of inA) expect(s.judged.get(i)).toBe('hit');
		}
	});

	it('ohne Abgleich: 120 ms schaden in Teil A kaum, 250 ms (Bluetooth) schon', () => {
		const hits = (late: number) => {
			const s = listeningSession();
			playA(s, (n) => n.m, { lateSec: late, delaySec: 0 });
			return inA.filter((i) => s.judged.get(i) === 'hit').length;
		};
		// Das Bewertungsfenster spart Ansatz und Ende aus; viele Töne wiederholen die Tonhöhe.
		expect(hits(0.12)).toBe(inA.length);
		expect(hits(0.25)).toBeLessThan(inA.length * 0.8);
	});

	it('Schleife: der letzte Ton zählt, obwohl die Meldungen hinter der Band herhinken', () => {
		const s = listeningSession();
		s.loop = true;
		const bps = 1 / spb;
		const delay = 0.1;
		const end = (a.to + 1) * 4;
		for (let beat = (a.from - 1) * 4; beat < end; beat += 0.02 * bps) {
			const played = beat - delay * bps;
			const n = notes.find((x) => played >= x.b && played < x.b + x.d);
			s.hear(n ? n.m : null, frame(beat, { target: a.from }), delay);
		}
		const step = s.advance(frame(end + 0.01, { target: a.from }), 100);
		expect(step.report?.headline).toBe(
			`Durchgang 1: ${inA.length} von ${inA.length} Tönen getroffen (100 %)`
		);
	});

	it('Spur auf der Bahn und Abweichung für die Anzeige', () => {
		const s = listeningSession();
		playA(s, (n) => n.m + 0.2);
		expect(s.trace.length).toBeGreaterThan(100);
		expect(s.trace.some((p) => p.c === 'hit')).toBe(true);
		expect(s.lastDeviation).toBeCloseTo(0.2, 5);
		expect(s.coach('valve', true, 1)).toEqual({ text: 'Sitzt, eher etwas hoch.', tone: 'ok' });
	});

	it('Echo bewertet nur »Jetzt du«; Mithören stellt die eigene Stimme stumm, die Vorführung nicht', () => {
		const s = new PracticeSession(notes, spb, { from: a.from, to: a.to });
		s.setMode('echo');
		s.setListening('mic');
		expect(s.judging).toBe(false); // »Hör zu«
		expect(s.coach('valve', true, 1)?.text).toBe('Hör zu – gleich bist du dran.');
		s.echo = { from: a.from, phase: 'play' };
		expect(s.judging).toBe(true);

		const m = listeningSession('mic');
		expect(m.ownVolume(1)).toBe(0);
		const d = listeningSession('demo');
		expect(d.ownVolume(0.35)).toBe(0.35);
	});

	it('Rhythmus tippen und Mithören schliessen sich aus', () => {
		const s = new PracticeSession(notes, spb, { from: a.from, to: a.to });
		s.setMode('rhythm');
		s.setListening('mic');
		expect(s.mode).toBe('play');
		expect(s.tap(frame(4))).toEqual({ kind: 'ignored' });
		s.setListening('off');
		expect(s.hear(70, frame(5), 0)).toBe(false);
		expect(s.trace).toHaveLength(0);
	});
});
