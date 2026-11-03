import { describe, expect, it } from 'vitest';
import { badTouchPart } from '../../test/badtouch';
import { buildTrack } from '../music/track';
import type { RawNote } from '../music/types';
import {
	beatAtX,
	computeGeometry,
	noteLook,
	AboveLabels,
	pillGripLabel,
	pillHeight,
	visibleBeats,
	xOfBeat,
	yOfDia,
	zoomStep,
	type LaneOptions
} from './geometry';
import { panelState } from './panel';

const trp = buildTrack(badTouchPart('P1').notes, 'valve');
const opts: LaneOptions = {
	width: 800,
	height: 380,
	help: 'all',
	kind: 'valve',
	staff: false,
	zoom: 1
};

describe('Geometrie der Bahn', () => {
	it('eine Spur: die ganze Höhe gehört den Tönen, der Griff steht im Balken', () => {
		const g = computeGeometry(trp, opts);
		expect(g.laneTop + g.laneHeight).toBeLessThanOrEqual(g.height);
		for (const help of ['nogrip', 'rhythm', 'memo'] as const) {
			expect(computeGeometry(trp, { ...opts, help }).laneHeight, help).toBe(g.laneHeight);
		}
		expect(pillGripLabel('12', 'valve')).toBe('1 2');
		expect(pillGripLabel('0', 'valve')).toBe('0');
		expect(pillGripLabel('123', 'valve')).toBe('1 2 3');
		expect(pillGripLabel('4', 'slide')).toBe('4');
		expect(pillGripLabel('', 'valve')).toBe('');
	});

	it('Griffe über kurzen Balken: gleicher Griff hintereinander nur einmal, nichts überlappt', () => {
		const lay = new AboveLabels();
		// zwei Achtel mit »1 2« nebeneinander: nur die erste beschriftet
		expect(lay.place(0, '1 2', 100, 18)).toBe(true);
		expect(lay.place(1, '1 2', 120, 18)).toBe(false);
		expect(lay.place(2, '1 2', 140, 18)).toBe(false);
		// anderer Griff, aber zu nah: weg
		expect(lay.place(3, '0', 112, 8)).toBe(false);
		// anderer Griff mit Platz: steht
		expect(lay.place(4, '1', 160, 8)).toBe(true);
		// derselbe Griff nach einem anderen Ton wieder beschriftet
		expect(lay.place(5, '1 2', 200, 18)).toBe(true);
		// gleicher Griff, aber nicht direkt dahinter (Ton dazwischen im Balken beschriftet)
		expect(lay.place(7, '1 2', 260, 18)).toBe(true);
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

	it('Spiellinie weit links: Was kommt, ist wichtiger als was war (Entscheid Matthias 03.11.2026)', () => {
		for (const width of [358, 650, 800, 1100]) {
			const g = computeGeometry(trp, { ...opts, width });
			expect(g.playX / width, String(width)).toBeLessThanOrEqual(0.13);
			expect(g.playX, String(width)).toBeGreaterThanOrEqual(40);
			const [b0, b1] = visibleBeats(g, 40);
			// vorne mindestens fünfmal so viel wie hinten
			expect(b1 - 40, String(width)).toBeGreaterThan(5 * (40 - b0));
		}
		// Handy hochkant: mindestens zwei Takte voraus
		const phone = computeGeometry(trp, { ...opts, width: 358 });
		expect(visibleBeats(phone, 40)[1] - 40).toBeGreaterThanOrEqual(8);
	});

	it('Abstand: Pixel pro Schlag 36–140, Stufen enger/weiter', () => {
		expect(computeGeometry(trp, { ...opts, width: 320 }).ppb).toBe(36);
		expect(computeGeometry(trp, { ...opts, zoom: 2 }).ppb).toBe(140);
		expect(zoomStep(1, 1)).toBe(1.25);
		expect(zoomStep(1, -1)).toBe(0.8);
		expect(zoomStep(2, 1)).toBe(2);
		expect(zoomStep(0.5, -1)).toBe(0.5);
	});

	it('Balkenhöhe bleibt lesbar', () => {
		const h = pillHeight(computeGeometry(trp, opts));
		expect(h).toBeGreaterThanOrEqual(18);
		expect(h).toBeLessThanOrEqual(28);
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

	it('vorgespielte Töne (Einblasen) gestrichelt, ausser wenn sie gerade klingen', () => {
		const call = { b: 8, d: 1, call: true };
		expect(noteLook(call, 7, undefined)).toBe('ghost');
		expect(noteLook(call, 9, undefined)).toBe('ghost');
		expect(noteLook(call, 8.5, undefined)).toBe('active');
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
