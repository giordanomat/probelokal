import { describe, expect, it } from 'vitest';
import {
	addToTally,
	classifyFrame,
	emptyTally,
	inJudgingWindow,
	noteVerdict,
	verdictScore
} from './classify';

// G4 notiert, offen (Absenkung 0) – Naturtöne darüber/darunter: C5 (72), C4 (60)
const g4open = { m: 67, lower: 0 };
// A4 notiert mit 1+2 (Absenkung 3): mit diesem Griff klingen die Naturtöne − 3, also E4 (64), A4 (69), Cis5 (73)
const a4valve12 = { m: 69, lower: 3 };

describe('Messpunkt bewerten', () => {
	it('±50 Cent = getroffen', () => {
		expect(classifyFrame(67.4, g4open)).toMatchObject({ c: 'hit' });
		expect(classifyFrame(66.5, g4open)).toMatchObject({ c: 'hit' });
	});

	it('richtiger Griff, anderer Naturton = falsche Stufe, mit Richtung', () => {
		expect(classifyFrame(72, g4open)).toEqual({ c: 'partial', dev: 5, up: true });
		expect(classifyFrame(60.2, g4open)).toMatchObject({ c: 'partial', up: false });
		expect(classifyFrame(64, a4valve12)).toMatchObject({ c: 'partial', up: false });
		expect(classifyFrame(73, a4valve12)).toMatchObject({ c: 'partial', up: true });
	});

	it('bis ±100 Cent knapp, sonst daneben', () => {
		expect(classifyFrame(67.8, g4open)).toMatchObject({ c: 'near' });
		expect(classifyFrame(66.1, g4open)).toMatchObject({ c: 'near' });
		expect(classifyFrame(69, g4open)).toMatchObject({ c: 'wrong', dev: 2 });
	});

	it('ein Halbton daneben, der zufällig Naturton ist, zählt als falsche Stufe (wie Prototyp)', () => {
		// notiert B4 (71) mit Ventil 2 (Absenkung 1): 72 gerundet + 1 = 73 → kein Naturton → knapp
		expect(classifyFrame(72, { m: 71, lower: 1 })).toMatchObject({ c: 'near' });
		// notiert H4 offen gedacht (Absenkung 0): 72 ist Naturton → falsche Stufe
		expect(classifyFrame(72, { m: 71, lower: 0 })).toMatchObject({ c: 'partial', up: true });
	});

	it('ohne Griff keine falsche Stufe', () => {
		expect(classifyFrame(72, { m: 67, lower: null })).toMatchObject({ c: 'wrong' });
	});
});

describe('Bewertungsfenster', () => {
	it('lässt Ansatz und Ende aussen vor', () => {
		// Viertel bei ♩ 115 ≈ 0,52 s: ab 60 ms, bis 40 ms vor Ende
		expect(inJudgingWindow(0.05, 0.47, 0.52)).toBe(false);
		expect(inJudgingWindow(0.06, 0.46, 0.52)).toBe(true);
		expect(inJudgingWindow(0.49, 0.03, 0.52)).toBe(false);
		// Sechzehntel ≈ 0,13 s: 30 % / 20 % greifen
		expect(inJudgingWindow(0.04, 0.09, 0.13)).toBe(true);
		expect(inJudgingWindow(0.03, 0.1, 0.13)).toBe(false);
	});
});

describe('Ton aus Messpunkten', () => {
	const tally = (...cs: Parameters<typeof classifyFrame>[0][]) =>
		cs.reduce((t, w) => addToTally(t, classifyFrame(w, g4open)), emptyTally());

	it('Hälfte getroffen = getroffen', () => {
		expect(noteVerdict(tally(67, 67, 69, 69))).toBe('hit');
	});
	it('getroffen + knapp ≥ Hälfte = knapp', () => {
		expect(noteVerdict(tally(67, 67.8, 69, 69))).toBe('near');
	});
	it('meist anderer Naturton = falsche Stufe, zählt »oben« mit', () => {
		const t = tally(72, 72, 72, 69);
		expect(noteVerdict(t)).toBe('partial');
		expect(t.up).toBe(3);
	});
	it('sonst daneben, ohne Messpunkt nicht gehört', () => {
		expect(noteVerdict(tally(69, 69, 72, 67))).toBe('wrong');
		expect(noteVerdict(emptyTally())).toBe('none');
		expect(noteVerdict(undefined)).toBe('none');
	});
	it('Punkte: getroffen 1, knapp und falsche Stufe 0,5', () => {
		expect(
			['hit', 'near', 'partial', 'wrong', 'none'].map((v) => verdictScore(v as never))
		).toEqual([1, 0.5, 0.5, 0, 0]);
	});
});
