import { describe, expect, it } from 'vitest';
import { badTouchPart } from '../../test/badtouch';
import { buildTrack } from '../music/track';
import type { RawNote } from '../music/types';
import {
	beatAtX,
	computeGeometry,
	noteLook,
	pillHeight,
	visibleBeats,
	xOfBeat,
	yOfDia,
	zoomStep,
	type LaneOptions
} from './geometry';
import { panelState } from './panel';

const trp = buildTrack(badTouchPart('P1').notes, 'valve');
const pos = buildTrack(badTouchPart('P3').notes, 'slide');
const opts: LaneOptions = {
	width: 800,
	height: 380,
	help: 'all',
	kind: 'valve',
	staff: false,
	zoom: 1
};

describe('Geometrie der Bahn', () => {
	it('Griffspur: 3 Zeilen Ventile, 7 Zeilen Zug, ohne Griffe keine', () => {
		const g = computeGeometry(trp, opts);
		expect(g.gripRows).toBe(3);
		expect(g.gripHeight).toBeGreaterThan(0);
		expect(g.gripTop).toBeGreaterThan(g.laneTop + g.laneHeight);
		expect(g.gripTop + g.gripHeight).toBeLessThanOrEqual(g.height);
		const gp = computeGeometry(pos, { ...opts, kind: 'slide' });
		expect(gp.gripRows).toBe(7);
		expect(gp.gripHeight).toBeGreaterThan(g.gripHeight);
		for (const help of ['nogrip', 'rhythm', 'memo'] as const) {
			const gn = computeGeometry(trp, { ...opts, help });
			expect(gn.gripHeight, help).toBe(0);
			expect(gn.laneHeight).toBeGreaterThan(g.laneHeight);
		}
	});

	it('höhere Töne liegen weiter oben, der ganze Umfang passt in die Bahn', () => {
		const g = computeGeometry(trp, opts);
		expect(yOfDia(g, trp.diaMax)).toBeLessThan(yOfDia(g, trp.diaMin));
		expect(yOfDia(g, trp.diaMax)).toBeGreaterThan(g.laneTop);
		expect(yOfDia(g, trp.diaMin)).toBeLessThan(g.laneTop + g.laneHeight);
	});

	it('Notenlinien erweitern den Bereich bis E4–F5, ausser bei »Nur Rhythmus«', () => {
		const low = { diaMin: 33, diaMax: 34 };
		const g = computeGeometry(low, { ...opts, staff: true });
		expect(g.diaLo).toBeLessThanOrEqual(29);
		expect(g.diaHi).toBeGreaterThanOrEqual(39);
		expect(computeGeometry(low, { ...opts, staff: true, help: 'rhythm' }).diaLo).toBe(31.5);
	});

	it('Schlag ↔ x und sichtbarer Bereich', () => {
		const g = computeGeometry(trp, opts);
		expect(xOfBeat(g, 40, 40)).toBe(g.playX);
		expect(beatAtX(g, xOfBeat(g, 43.5, 40), 40)).toBeCloseTo(43.5);
		const [b0, b1] = visibleBeats(g, 40);
		expect(xOfBeat(g, b0, 40)).toBeCloseTo(0);
		expect(xOfBeat(g, b1, 40)).toBeCloseTo(g.width);
	});

	it('Abstand: Pixel pro Schlag 40–160, Stufen enger/weiter', () => {
		expect(computeGeometry(trp, { ...opts, width: 320 }).ppb).toBe(40);
		expect(computeGeometry(trp, { ...opts, zoom: 2 }).ppb).toBe(160);
		expect(zoomStep(1, 1)).toBe(1.25);
		expect(zoomStep(1, -1)).toBe(0.8);
		expect(zoomStep(2, 1)).toBe(2);
		expect(zoomStep(0.5, -1)).toBe(0.5);
	});

	it('Balkenhöhe bleibt lesbar', () => {
		const h = pillHeight(computeGeometry(trp, opts));
		expect(h).toBeGreaterThanOrEqual(14);
		expect(h).toBeLessThanOrEqual(26);
	});

	it('Aussehen: Bewertung vor »jetzt« vor »vorbei«', () => {
		const n = { b: 8, d: 1 };
		expect(noteLook(n, 7, undefined)).toBe('upcoming');
		expect(noteLook(n, 8.5, undefined)).toBe('active');
		expect(noteLook(n, 9, undefined)).toBe('past');
		expect(noteLook(n, 8.5, 'hit')).toBe('hit');
		expect(noteLook(n, 9, 'partial')).toBe('half');
		expect(noteLook(n, 9, 'none')).toBe('missed');
		expect(noteLook(n, 9, 'wrong')).toBe('wrong');
	});
});

describe('Griff-Anzeige', () => {
	const note = (b: number, d: number, m: number, fing: string, extra: Partial<RawNote> = {}) => ({
		b,
		d,
		m,
		fing,
		dia: 0,
		acc: 0,
		step: 'A' as const,
		...extra
	});
	const valve = buildTrack(
		[note(4, 1, 69, '12'), note(5, 0.5, 72, '0'), note(8, 2, 65, '1', { fing_auto: true })],
		'valve'
	).notes;
	const base = { notes: valve, kind: 'valve' as const, help: 'all' as const, countIn: null };

	it('zeigt den aktuellen Griff, Ton, Länge und den nächsten', () => {
		const s = panelState({ ...base, beat: 4.2 });
		expect(s).toMatchObject({
			kicker: 'Jetzt',
			big: '1 + 2',
			sub: 'A · Viertel',
			next: 'Dann: offen · A',
			valves: [1, 2],
			slide: null,
			beatInBar: 0
		});
	});

	it('vor einem Einsatz: einzählen bzw. Pause', () => {
		expect(panelState({ ...base, beat: 6, countIn: 3 }).kicker).toBe('Einzählen · gleich');
		const pause = panelState({ ...base, beat: 6 });
		expect(pause.kicker).toBe('Pause · gleich');
		expect(pause.big).toBe('1');
		expect(pause.autoFingering).toBe(true);
		expect(panelState({ ...base, beat: 11 }).kicker).toBe('Ende');
	});

	it('Hilfen-Stufen', () => {
		expect(panelState({ ...base, beat: 4.2, help: 'nogrip' })).toMatchObject({
			big: 'A',
			next: 'Dann: A',
			valves: null
		});
		expect(panelState({ ...base, beat: 4.2, help: 'rhythm' })).toMatchObject({
			big: 'Viertel',
			sub: '',
			next: ''
		});
		expect(panelState({ ...base, beat: 4.2, help: 'memo' })).toMatchObject({
			kicker: 'Auswendig',
			big: 'Spiel aus dem Kopf'
		});
	});

	it('Posaune: Zugposition statt Ventile', () => {
		const s = panelState({
			...base,
			kind: 'slide',
			notes: buildTrack([note(4, 1, 69, '4')], 'slide').notes,
			beat: 4.5
		});
		expect(s).toMatchObject({ big: 'Zug 4', slide: 4, valves: null });
	});

	it('Echo-Phase ersetzt die grosse Zeile, Griff steht dann unten', () => {
		const s = panelState({ ...base, beat: 4.2, phaseText: 'Hör zu' });
		expect(s.big).toBe('Hör zu');
		expect(s.sub).toBe('A · Viertel · 1 + 2');
	});

	it('Schlag im Takt, vor Takt 0 keiner', () => {
		expect(panelState({ ...base, beat: 7.5 }).beatInBar).toBe(3);
		expect(panelState({ ...base, beat: -0.5 }).beatInBar).toBe(-1);
	});
});
