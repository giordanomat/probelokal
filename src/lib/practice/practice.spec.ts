import { describe, expect, it } from 'vitest';
import type { RawNote } from '../music/types';
import type { NoteVerdict } from '../pitch/classify';
import {
	BAUSTELLE_TEMPO,
	baustellenKey,
	parseBarStats,
	recordPass,
	topBaustellen
} from './baustellen';
import { echoStep, ownVoiceVolume, type EchoState } from './echo';
import { meanDeviationText, passHeadline, summarizePass, tempoAdvice } from './pass';

describe('Durchgang auswerten', () => {
	it('zählt getroffen und halbe, Prozent gerundet; unter 3 Tönen kein Ergebnis', () => {
		const v: NoteVerdict[] = ['hit', 'hit', 'near', 'partial', 'wrong', 'none'];
		expect(summarizePass(v)).toEqual({ total: 6, hit: 2, half: 2, pct: 33 });
		expect(summarizePass(['hit', 'hit'])).toBeNull();
	});

	it('Tempoleiter: ab 80 % +5, unter 50 % −10, Grenzen 50/100', () => {
		expect(tempoAdvice(80, 70)).toEqual({ kind: 'faster', tempo: 75 });
		expect(tempoAdvice(95, 98)).toEqual({ kind: 'faster', tempo: 100 });
		expect(tempoAdvice(90, 100)).toEqual({ kind: 'done' });
		expect(tempoAdvice(49, 80)).toEqual({ kind: 'slower', tempo: 70 });
		expect(tempoAdvice(10, 55)).toEqual({ kind: 'slower', tempo: 50 });
		expect(tempoAdvice(10, 50)).toBeNull();
		expect(tempoAdvice(65, 80)).toBeNull();
	});

	it('mittlere Abweichung beim Tippen', () => {
		expect(meanDeviationText([])).toBeNull();
		expect(meanDeviationText([0.02, -0.01])).toBe('im Schnitt genau');
		expect(meanDeviationText([-0.04, -0.06])).toBe('im Schnitt 50 ms zu früh');
		expect(meanDeviationText([0.03])).toBe('im Schnitt 30 ms zu spät');
	});

	it('Überschrift', () => {
		const s = { total: 16, hit: 14, half: 1, pct: 88 };
		expect(passHeadline(s, { final: true, number: 3, rhythm: false })).toBe(
			'Durchgang 3: 14 von 16 Tönen getroffen (88 %)'
		);
		expect(passHeadline(s, { final: false, number: 0, rhythm: true })).toBe(
			'Bisher: 14 von 16 Einsätzen genau (88 %)'
		);
	});
});

describe('Baustellen', () => {
	const n = (b: number): RawNote => ({ b, d: 1, m: 67, dia: 32, acc: 0, step: 'G', fing: '0' });
	const notes = [n(4), n(5), n(8), n(9), n(12)]; // Takte 1, 1, 2, 2, 3

	it('sammelt pro Takt Versuche und Wackler, ohne die alte Statistik zu verändern', () => {
		const before = {};
		const s1 = recordPass(
			before,
			[
				[0, 'hit'],
				[1, 'wrong'],
				[2, 'near'],
				[3, 'none'],
				[4, 'hit']
			],
			notes
		);
		expect(before).toEqual({});
		expect(s1).toEqual({ 1: { t: 2, b: 1 }, 2: { t: 2, b: 2 }, 3: { t: 1, b: 0 } });
		const s2 = recordPass(s1, [[4, 'wrong']], notes);
		expect(s1[3]).toEqual({ t: 1, b: 0 });
		expect(s2[3]).toEqual({ t: 2, b: 1 });
	});

	it('zeigt höchstens drei, ab 2 Versuchen und 25 % Wacklern, schlimmste zuerst', () => {
		const top = topBaustellen({
			1: { t: 4, b: 1 },
			2: { t: 2, b: 2 },
			3: { t: 1, b: 1 },
			4: { t: 10, b: 2 },
			5: { t: 6, b: 3 },
			6: { t: 8, b: 4 }
		});
		expect(top.map((x) => x.bar)).toEqual([2, 6, 5]);
		expect(top[0]).toEqual({ bar: 2, tries: 2, shaky: 2, ratio: 1 });
		expect(BAUSTELLE_TEMPO).toBe(70);
	});

	it('Speichern pro Titel und Stimme, Unlesbares ergibt leer', () => {
		expect(baustellenKey('bad-touch-2-0', 'trp1')).toBe('probelokal.bau.bad-touch-2-0.trp1');
		expect(parseBarStats('{"7":{"t":3,"b":1}}')).toEqual({ 7: { t: 3, b: 1 } });
		expect(parseBarStats('kaputt')).toEqual({});
		expect(parseBarStats(null)).toEqual({});
		expect(parseBarStats('{"7":{"t":"x"},"8":{"t":0,"b":0}}')).toEqual({});
	});
});

describe('Echo', () => {
	const range = { from: 1, to: 4 }; // Teil mit 4 Takten

	it('Hör zu → Jetzt du → nächste zwei Takte → am Ende Durchgang und von vorn', () => {
		let s: EchoState = { from: 1, phase: 'hear' };
		expect(echoStep(s, 2.5, range)).toMatchObject({ seekTo: null, passDone: false });

		let step = echoStep(s, 3, range);
		expect(step).toEqual({ state: { from: 1, phase: 'play' }, seekTo: 1, passDone: false });
		s = step.state;

		step = echoStep(s, 3, range);
		expect(step).toEqual({ state: { from: 3, phase: 'hear' }, seekTo: 3, passDone: false });
		s = echoStep(step.state, 5, range).state; // vorgehört
		step = echoStep(s, 5, range);
		expect(step).toEqual({ state: { from: 1, phase: 'hear' }, seekTo: 1, passDone: true });
	});

	it('ungerade Taktzahl: letztes Häppchen ist kürzer', () => {
		const step = echoStep({ from: 5, phase: 'hear' }, 6, { from: 1, to: 5 });
		expect(step.seekTo).toBe(5);
	});

	it('Lautstärke der eigenen Stimme', () => {
		const o = {
			micListening: false,
			mode: 'play' as const,
			echoPhase: 'hear' as const,
			chosen: 0.4
		};
		expect(ownVoiceVolume(o)).toBe(0.4);
		expect(ownVoiceVolume({ ...o, micListening: true })).toBe(0);
		expect(ownVoiceVolume({ ...o, mode: 'echo' })).toBe(1);
		expect(ownVoiceVolume({ ...o, mode: 'echo', echoPhase: 'play' })).toBe(0);
	});
});
