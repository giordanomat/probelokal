// »Mein Plan«: Stand einer Stimme gegen den Gesamtplan, portiert aus prototype/v7 (standFor,
// nextExams, planStatus, renderMine). Der Stand eines Teils zählt nur über bestandene Prüfungen
// (höchste bestandene Etappe), nie über Selbsteinschätzung (docs/01).

import type { RawNote, Section } from '../music/types';
import { isRestInBars } from '../music/track';
import { type Day } from './dates';
import { dueOf, expectedStage, type Plan } from './plan';

export const STAGES = [
	{ k: 1, name: 'Gehört' },
	{ k: 2, name: 'Griffe sitzen' },
	{ k: 3, name: '80 % Tempo' },
	{ k: 4, name: 'Originaltempo' },
	{ k: 5, name: 'Auswendig' }
] as const;

/** Höchste bestandene Etappe pro Teil (Index in sections); fehlt = 0. */
export type Stages = Record<number, number>;

/** Teile ohne Ton für diese Stimme: »Pause für dich«. Teil 0 (Vorzähler) zählt nie. */
export function pauseSections(
	sections: readonly Section[],
	notes: readonly RawNote[]
): Set<number> {
	const out = new Set<number>();
	sections.forEach((s, i) => {
		if (i > 0 && isRestInBars(notes, s.from, s.to)) out.add(i);
	});
	return out;
}

/** Teile, die für diese Stimme zählen (ohne Vorzähler und Pausen). */
export function playedSections(sections: readonly Section[], notes: readonly RawNote[]): number[] {
	const pause = pauseSections(sections, notes);
	return sections.map((_, i) => i).filter((i) => i > 0 && !pause.has(i));
}

/** Prozent bis auftrittsreif: erreichte Etappen / (5 × gespielte Teile). */
export function standPercent(played: readonly number[], stages: Stages): number {
	if (!played.length) return 0;
	const sum = played.reduce((s, i) => s + Math.min(5, stages[i] ?? 0), 0);
	return Math.round((sum / (played.length * 5)) * 100);
}

export interface NextExam {
	section: number;
	stage: number;
	due: Day | null;
}

/** Nächste Etappe pro Teil, nach Fälligkeit sortiert (ohne Plan: nach Teil). */
export function nextExams(
	played: readonly number[],
	stages: Stages,
	plan: Plan | null
): NextExam[] {
	const out: NextExam[] = [];
	for (const i of played) {
		const k = (stages[i] ?? 0) + 1;
		if (k > 5) continue;
		out.push({ section: i, stage: k, due: plan ? dueOf(plan, i, k) : null });
	}
	return out.sort(
		(a, b) =>
			(a.due ?? '9999').localeCompare(b.due ?? '9999') || a.section - b.section || a.stage - b.stage
	);
}

export interface PlanStatus {
	/** Erreichte Etappen */
	sum: number;
	/** Laut Plan bis heute erwartet */
	expected: number;
	max: number;
	/** sum − expected: > 0 voraus, < 0 hinterher */
	diff: number;
}

export function planStatus(
	played: readonly number[],
	stages: Stages,
	plan: Plan | null,
	today: Day
): PlanStatus {
	let sum = 0;
	let expected = 0;
	for (const i of played) {
		sum += Math.min(5, stages[i] ?? 0);
		if (plan) expected += expectedStage(plan, i, today);
	}
	return { sum, expected, max: played.length * 5, diff: plan ? sum - expected : 0 };
}

/** Grosse Zeile in »Mein Plan«: »2 Etappen voraus«, »Genau im Plan«, »1 Etappe hinterher«. */
export function statusText(s: PlanStatus, hasPlan: boolean): string {
	if (!hasPlan) return `${s.sum} von ${s.max} Etappen`;
	const n = Math.abs(s.diff);
	const etappen = n === 1 ? 'Etappe' : 'Etappen';
	if (s.diff > 0) return `${n} ${etappen} voraus`;
	if (s.diff < 0) return `${n} ${etappen} hinterher`;
	return 'Genau im Plan';
}

/** Etappen, die in der Woche (Montag–Sonntag) fällig werden, mit Haken, wenn geschafft. */
export function weekGoals(
	played: readonly number[],
	stages: Stages,
	plan: Plan,
	monday: Day,
	sunday: Day
): { section: number; stage: number; done: boolean }[] {
	const out: { section: number; stage: number; done: boolean }[] = [];
	for (const i of played) {
		for (let k = 1; k <= 5; k++) {
			const d = dueOf(plan, i, k);
			if (d >= monday && d <= sunday)
				out.push({ section: i, stage: k, done: (stages[i] ?? 0) >= k });
		}
	}
	return out;
}
