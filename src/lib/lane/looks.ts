// Bahn-Looks als Belohnung, portiert aus prototype/v7 (FING_COL, POS_COL, lookFill, lookFg).
// Sie färben nur die kommenden Töne; gespielt, aktuell und bewertet bleiben wie immer.
// »Fasnacht« ab Level 2: jeder Griff bzw. jede Zugposition hat eine eigene Farbe.
// »Gold« ab Level 4. Die Wahl gilt pro Gerät (#lib/practice/prefs.ts).

import { hasUnlock } from '../game/points';
import type { InstrumentKind } from '../music/types';

export type LaneLook = 'std' | 'fasnacht' | 'gold';

export const LANE_LOOKS: readonly { id: LaneLook; label: string }[] = [
	{ id: 'std', label: 'Standard' },
	{ id: 'fasnacht', label: 'Fasnacht' },
	{ id: 'gold', label: 'Gold' }
];

/** Ventilgriff → Farbe; gleichwertige Griffe (12 und 3) gleich */
export const VALVE_COLORS: Readonly<Record<string, string>> = {
	'0': '#F5C242',
	'1': '#E0473C',
	'2': '#6EACDA',
	'12': '#B57EDC',
	'3': '#B57EDC',
	'23': '#3DB874',
	'13': '#F08A3C',
	'123': '#E46FA8'
};

/** Zugposition 1–7 → Farbe */
export const SLIDE_COLORS = [
	'#F5C242',
	'#6EACDA',
	'#E0473C',
	'#B57EDC',
	'#3DB874',
	'#F08A3C',
	'#E46FA8'
] as const;

export const GOLD = '#D4A62A';

/** Schrift auf farbigen Tönen */
export const LOOK_FG = '#141619';

/** Farbe eines kommenden Tons im Look; null = Standardfarbe der Darstellung. */
export function lookFill(look: LaneLook, fing: string, kind: InstrumentKind): string | null {
	if (look === 'gold') return GOLD;
	if (look !== 'fasnacht') return null;
	if (kind === 'slide') return SLIDE_COLORS[(parseInt(fing, 10) || 1) - 1] ?? null;
	return VALVE_COLORS[fing] ?? null;
}

/** Ist der Look mit diesen Punkten freigeschaltet? */
export function lookUnlocked(look: LaneLook, points: number): boolean {
	return look === 'std' || hasUnlock(points, look);
}

/** Gewählter Look, wenn freigeschaltet, sonst Standard. */
export function activeLook(look: LaneLook, points: number): LaneLook {
	return lookUnlocked(look, points) ? look : 'std';
}
