// Gesamtplan der Leitung und Fälligkeiten der Etappen, portiert aus prototype/v7 (difficulty,
// buildPlan, dueOf, expectedOf). Ein Plan gilt für die ganze Guugge; welche Teile eine Stimme
// pausiert, regelt stand.ts.
//
// Aufteilung wie im Prototyp: 55 % der Wochen Lernen, 20 % Tempo, 15 % Auswendig, Rest
// Feinschliff; Teile nach Schwierigkeit über alle Stimmen gewichtet. Die Aufteilung ist eine
// Annahme und mit echten Guuggen zu prüfen (docs/01 »Pläne«).

import type { RawNote, Section } from '../music/types';
import { addDays, daysBetween, mondayOf, shortDate, type Day } from './dates';

export type Phase = 'Lernen' | 'Tempo' | 'Auswendig' | 'Feinschliff';

export interface PlanParams {
	/** Erster Tag des Plans */
	start: Day;
	/** Auftritt */
	perf: Day;
	/** Wochentag der Gesamtprobe, 0 = Sonntag … 6 = Samstag (wie `plans.gp_weekday`) */
	gpWeekday: number;
	/** Wochentag der Registerprobe oder null */
	rpWeekday: number | null;
	/** Einzel-Übezeit pro Woche in Minuten */
	minutesPerWeek: number;
}

export interface PlanWeek {
	monday: Day;
	sunday: Day;
	phase: Phase;
	items: string[];
}

export interface Milestone {
	text: string;
	date: Day;
}

export interface Plan {
	weeks: PlanWeek[];
	milestones: Milestone[];
	/** Lernwoche pro Teil (Index in sections; Teil 0 = Vorzähler fehlt) */
	learnWeek: Record<number, number>;
	nLearn: number;
	nTempo: number;
	nMemo: number;
	firstMonday: Day;
}

export const PHASE_SHARE = { learn: 0.55, tempo: 0.2, memo: 0.15 } as const;

/**
 * Schwierigkeit pro Teil, summiert über alle Stimmen: Töne pro Takt, kurze Noten (≤ Sechzehntel)
 * pro Takt × 0,8, Tonumfang in Oktaven; dann auf die Länge des Teils skaliert, mindestens 0,5.
 * Teil 0 (Vorzähler) hat Gewicht 0.
 */
export function sectionWeights(
	sections: readonly Section[],
	parts: readonly RawNote[][]
): number[] {
	return sections.map((s, i) => {
		if (i === 0) return 0;
		const bars = s.to - s.from + 1;
		let w = 0;
		for (const notes of parts) {
			const ns = notes.filter((n) => n.b >= s.from * 4 && n.b < (s.to + 1) * 4);
			const range = ns.length
				? (Math.max(...ns.map((n) => n.m)) - Math.min(...ns.map((n) => n.m))) / 12
				: 0;
			w += ns.length / bars + (ns.filter((n) => n.d <= 0.25).length / bars) * 0.8 + range;
		}
		return Math.max(0.5, ((w / 6) * bars) / 4);
	});
}

/** Sonntag der Woche w (ab 0) */
export function weekEnd(plan: Pick<Plan, 'firstMonday'>, w: number): Day {
	return addDays(plan.firstMonday, (w + 1) * 7 - 1);
}

/** »Teil A–D« bei mehr als zwei Teilen, sonst »Teil A, B« */
function partList(names: string[]): string {
	return 'Teil ' + (names.length > 2 ? `${names[0]}–${names.at(-1)}` : names.join(', '));
}

export function buildPlan(
	p: PlanParams,
	sections: readonly Section[],
	weights: readonly number[]
): Plan {
	const firstMonday = mondayOf(p.start);
	const nW = Math.max(1, Math.round(daysBetween(firstMonday, mondayOf(p.perf)) / 7) + 1);
	const secIdx = sections.map((_, i) => i).slice(1);
	const totalW = secIdx.reduce((s, i) => s + weights[i], 0);
	const nLearn = Math.max(1, Math.round(nW * PHASE_SHARE.learn));
	const nTempo = Math.max(nW >= 4 ? 1 : 0, Math.round(nW * PHASE_SHARE.tempo));
	const nMemo = Math.max(nW >= 5 ? 1 : 0, Math.round(nW * PHASE_SHARE.memo));

	const learnWeek: Record<number, number> = {};
	let cum = 0;
	for (const i of secIdx) {
		const mid = cum + weights[i] / 2;
		learnWeek[i] = Math.min(nLearn - 1, Math.floor((mid / totalW) * nLearn));
		cum += weights[i];
	}

	const names = (pred: (i: number) => boolean) => secIdx.filter(pred).map((i) => sections[i].name);
	const group = (k: number, n: number) => {
		const size = Math.ceil(secIdx.length / Math.max(1, n));
		return secIdx.slice(k * size, (k + 1) * size).map((i) => sections[i].name);
	};

	const weeks: PlanWeek[] = [];
	for (let w = 0; w < nW; w++) {
		const monday = addDays(firstMonday, w * 7);
		const gp = shortDate(addDays(monday, (p.gpWeekday + 6) % 7));
		const rp = p.rpWeekday === null ? null : shortDate(addDays(monday, (p.rpWeekday + 6) % 7));
		const items: string[] = [];
		let phase: Phase;
		if (w < nLearn) {
			phase = 'Lernen';
			const now = names((i) => learnWeek[i] === w);
			const prev = names((i) => learnWeek[i] === w - 1);
			if (now.length) items.push(`Neu: ${partList(now)} – Etappen 1 und 2`);
			if (prev.length) items.push(`Festigen: ${partList(prev)} – Etappe 2 bis Sonntag`);
			if (rp) {
				items.push(
					`Registerprobe ${rp}: ${now.length ? partList(now) + ' langsam zusammen, Einsätze' : 'Wiederholen'}`
				);
			}
			items.push(
				`Gesamtprobe ${gp}: ${now.length ? partList(now) + ' neu, ' : ''}Bisheriges durchspielen`
			);
		} else if (w < nLearn + nTempo) {
			phase = 'Tempo';
			const g = group(w - nLearn, nTempo);
			if (g.length) items.push(`Tempo: ${partList(g)} – Etappe 4`);
			if (rp) items.push(`Registerprobe ${rp}: schnelle Stellen im Originaltempo`);
			items.push(`Gesamtprobe ${gp}: ganzes Stück im Originaltempo`);
		} else if (w < nLearn + nTempo + nMemo) {
			phase = 'Auswendig';
			const g = group(w - nLearn - nTempo, nMemo);
			if (g.length) items.push(`Auswendig: ${partList(g)} – Etappe 5`);
			if (rp) items.push(`Registerprobe ${rp}: auswendig, Blick zur Leitung`);
			items.push(`Gesamtprobe ${gp}: auswendig durchspielen`);
		} else {
			phase = 'Feinschliff';
			items.push('Durchläufe, Übergänge, Dynamik der Leitung');
			items.push(`Gesamtprobe ${gp}: Auftritt simulieren, stehend und auswendig`);
		}
		if (p.minutesPerWeek > 0) {
			items.push(
				`Einzeln: ${p.minutesPerWeek} Min. pro Woche, z. B. ${Math.max(1, Math.round(p.minutesPerWeek / 12))} × 12 Min. mit dem Dirigenten`
			);
		}
		weeks.push({ monday, sunday: addDays(monday, 6), phase, items });
	}

	const end = (w: number) => weekEnd({ firstMonday }, w);
	const milestones: Milestone[] = [
		{ text: 'Etappe 3 für alle Teile', date: end(nLearn - 1) },
		{ text: 'Originaltempo', date: end(nLearn + nTempo - 1) },
		{ text: 'Auswendig', date: end(nLearn + nTempo + nMemo - 1) },
		{ text: 'Auftrittsreif', date: p.perf }
	];
	return { weeks, milestones, learnWeek, nLearn, nTempo, nMemo, firstMonday };
}

/**
 * Bis wann Etappe 1–5 eines Teils fällig ist (Sonntag der jeweiligen Woche): 1 in der Lernwoche,
 * 2 eine Woche später (höchstens letzte Lernwoche), 3 Ende Lernen, 4 Ende Tempo, 5 Ende Auswendig.
 */
export function dueOf(plan: Plan, section: number, stage: number): Day {
	const lw = plan.learnWeek[section] ?? 0;
	const w = [
		lw,
		Math.min(lw + 1, plan.nLearn - 1),
		plan.nLearn - 1,
		plan.nLearn + plan.nTempo - 1,
		plan.nLearn + plan.nTempo + plan.nMemo - 1
	][Math.min(Math.max(stage, 1), 5) - 1];
	return weekEnd(plan, w);
}

/** Etappe, die ein Teil am Tag `today` laut Plan erreicht haben sollte (0–5). */
export function expectedStage(plan: Plan, section: number, today: Day): number {
	let e = 0;
	for (let k = 1; k <= 5; k++) if (dueOf(plan, section, k) < today) e = k;
	return e;
}
