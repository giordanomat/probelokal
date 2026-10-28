import { describe, expect, it } from 'vitest';
import type { FrameVerdict } from './classify';
import { coachMessage, type CoachInput, type RecentFrame } from './coach';

const base: CoachInput = {
	recent: [],
	note: { fing: '12' },
	kind: 'valve',
	playing: true,
	listenPhase: false,
	secondsIntoNote: 0.2
};
const v = (c: FrameVerdict['c'], dev = 0, up?: boolean): FrameVerdict => ({ c, dev, up });
const many = (n: number, f: RecentFrame) => Array<RecentFrame>(n).fill(f);
const say = (patch: Partial<CoachInput>) => coachMessage({ ...base, ...patch });

describe('Rückmeldung beim Mithören', () => {
	it('Echo »Hör zu« und Pausen', () => {
		expect(say({ listenPhase: true })?.text).toBe('Hör zu – gleich bist du dran.');
		expect(say({ note: null })?.text).toBe('Pause. Atmen.');
		expect(say({ note: null, playing: false })).toBeNull();
	});

	it('meldet, wenn nichts zu hören ist – erst nach einer halben Sekunde', () => {
		expect(say({ recent: many(10, null), secondsIntoNote: 0.6 })).toMatchObject({ tone: 'warn' });
		expect(say({ recent: many(10, null), secondsIntoNote: 0.4 })).toBeNull();
	});

	it('sitzt, mit Hinweis auf Tendenz', () => {
		expect(say({ recent: many(12, v('hit', 0.05)) })).toEqual({ text: 'Sitzt.', tone: 'ok' });
		expect(say({ recent: many(12, v('hit', -0.3)) })?.text).toBe('Sitzt, eher etwas tief.');
	});

	it('falsche Stufe: Lippen-Tipp je nach Richtung, Zug bei Posaune', () => {
		expect(say({ recent: many(12, v('partial', 5, true)) })?.text).toBe(
			'Richtiger Griff, aber eine Stufe zu hoch. Lippen lockerer, Luft wärmer.'
		);
		expect(say({ recent: many(12, v('partial', -7, false)), kind: 'slide' })?.text).toBe(
			'Richtiger Zug, aber eine Stufe zu tief. Lippen fester, Luft schneller.'
		);
	});

	it('knapp und daneben', () => {
		expect(say({ recent: many(12, v('near', -0.8)) })?.text).toBe(
			'Knapp zu tief. Mehr Luft, Mundwinkel fest.'
		);
		expect(say({ recent: many(12, v('wrong', 2)) })).toEqual({
			text: 'Anderer Ton. Griff: 1 + 2.',
			tone: 'bad'
		});
	});

	it('wertet nur die letzten 12 bewerteten Messpunkte', () => {
		const recent = [...many(20, v('wrong', 2)), ...many(12, v('hit'))];
		expect(say({ recent })?.tone).toBe('ok');
		expect(say({ recent: many(12, 'free') })).toBeNull();
	});
});
