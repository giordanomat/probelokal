// Masse und Koordinaten der Bahn, portiert aus prototype/v7 (Lane.layout, yOf, beatAtX).
// Reine Rechnung, damit sie ohne Canvas testbar ist.

import type { InstrumentKind } from '../music/types';
import type { NoteVerdict } from '../pitch/classify';

/** Hilfen-Stufen: Alles · Ohne Griffe · Nur Rhythmus · Auswendig (docs/01-produkt.md). */
export type HelpLevel = 'all' | 'nogrip' | 'rhythm' | 'memo';

export const HELP_LABELS: Record<HelpLevel, string> = {
	all: 'Alles zeigen',
	nogrip: 'Ohne Griffe',
	rhythm: 'Nur Rhythmus',
	memo: 'Auswendig'
};

/** Diatonische Stufen der fünf Notenlinien im Violinschlüssel (E4, G4, H4, D5, F5). */
export const STAFF_LINES = [30, 32, 34, 36, 38] as const;

export interface LaneOptions {
	width: number;
	height: number;
	help: HelpLevel;
	kind: InstrumentKind;
	/** Notenlinien einblenden */
	staff: boolean;
	/** Abstand: 1 = Standard, 0,5–2 */
	zoom: number;
}

export interface LaneGeometry {
	width: number;
	height: number;
	/** Oberkante der Tonbalken (darüber Taktnummern und Hinweise) */
	laneTop: number;
	laneHeight: number;
	/** Griffspur; Höhe 0, wenn keine Griffe gezeigt werden */
	gripTop: number;
	gripHeight: number;
	gripRows: number;
	/** Pixel pro Schlag */
	ppb: number;
	/** x der Spiellinie */
	playX: number;
	diaLo: number;
	diaHi: number;
}

/** Standardhöhe der Bahn (Handy schmaler). */
export function defaultLaneHeight(width: number): number {
	return width < 600 ? 300 : 380;
}

const HEADER = 26;

export function computeGeometry(
	track: { diaMin: number; diaMax: number },
	o: LaneOptions
): LaneGeometry {
	let diaLo = track.diaMin - 1.5;
	let diaHi = track.diaMax + 1.5;
	if (o.staff && o.help !== 'rhythm') {
		diaLo = Math.min(diaLo, STAFF_LINES[0] - 1);
		diaHi = Math.max(diaHi, STAFF_LINES[STAFF_LINES.length - 1] + 1);
	}
	const showGrip = o.help === 'all';
	const gripRows = o.kind === 'slide' ? 7 : 3;
	const gripHeight = showGrip ? Math.round(o.height * (o.kind === 'slide' ? 0.3 : 0.27)) : 0;
	const laneTop = HEADER + 6;
	const laneHeight = o.height - laneTop - gripHeight - (showGrip ? 14 : 10);
	return {
		width: o.width,
		height: o.height,
		laneTop,
		laneHeight,
		gripTop: laneTop + laneHeight + 8,
		gripHeight,
		gripRows,
		ppb: Math.max(40, Math.min(160, (o.width / 8) * o.zoom)),
		playX: Math.round(Math.max(56, o.width * 0.22)),
		diaLo,
		diaHi
	};
}

/** y-Mitte einer diatonischen Stufe. */
export function yOfDia(g: LaneGeometry, dia: number): number {
	return g.laneTop + ((g.diaHi - dia) / (g.diaHi - g.diaLo)) * g.laneHeight;
}

/** x eines Schlags, wenn gerade `now` an der Spiellinie steht. */
export function xOfBeat(g: LaneGeometry, beat: number, now: number): number {
	return g.playX + (beat - now) * g.ppb;
}

/** Schlag unter einem x (für Antippen der Bahn). */
export function beatAtX(g: LaneGeometry, x: number, now: number): number {
	return now + (x - g.playX) / g.ppb;
}

/** Sichtbarer Bereich in Schlägen. */
export function visibleBeats(g: LaneGeometry, now: number): [number, number] {
	return [now - g.playX / g.ppb, now + (g.width - g.playX) / g.ppb];
}

/** Höhe der Tonbalken: 1,5 Stufen, begrenzt auf 14–26 px. */
export function pillHeight(g: LaneGeometry): number {
	return Math.max(14, Math.min(26, (g.laneHeight / (g.diaHi - g.diaLo)) * 1.5));
}

/** Abstand-Stufen für »Enger« und »Weiter«. */
export const ZOOM_STEPS = [0.5, 0.65, 0.8, 1, 1.25, 1.6, 2] as const;

export function zoomStep(current: number, dir: 1 | -1): number {
	const i = ZOOM_STEPS.findIndex((z) => z >= current - 1e-9);
	const at = i < 0 ? ZOOM_STEPS.length - 1 : i;
	return ZOOM_STEPS[Math.max(0, Math.min(ZOOM_STEPS.length - 1, at + dir))];
}

/** Aussehen eines Tonbalkens: Bewertung geht vor, dann »jetzt«, dann »vorbei«. */
export type NoteLook = 'upcoming' | 'past' | 'active' | 'hit' | 'half' | 'wrong' | 'missed';

export function noteLook(
	note: { b: number; d: number },
	now: number,
	verdict: NoteVerdict | undefined
): NoteLook {
	if (verdict === 'hit') return 'hit';
	if (verdict === 'near' || verdict === 'partial') return 'half';
	if (verdict === 'wrong') return 'wrong';
	if (verdict === 'none') return 'missed';
	if (now >= note.b && now < note.b + note.d) return 'active';
	if (note.b + note.d <= now) return 'past';
	return 'upcoming';
}
