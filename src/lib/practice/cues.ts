// Zurufe auf der Bahn (Entscheid Matthias 08.11.2026, nach Entwurf): kurze Texte über der Bahn, die
// im Takt bis zum Einsatz mitzählen. Abgeleitet aus den Noten der gewählten Stimme:
// - lange Pause (ab 2 Takten) → »Gleich du!«
// - ff-Teil des Titels (Title.ff, aus der Partitur nicht ablesbar, von Matthias festgelegt) oder
//   Hinweis der Leitung mit f/ff → »Volle Lotte!«, mit p/pp → »Ganz fein!«
// - Einsatz neben dem Schlag nach mindestens einem Schlag Pause, beim ersten Mal im Teil
// - Lob beim Mithören: 8 getroffene Töne am Stück (praiseDue)
// Höchstens ein Zuruf gleichzeitig; überschneiden sich zwei, gewinnt der wichtigere.
// Ob die Regeln musikalisch stimmen, prüft Matthias auf dem Gerät (Testprotokoll M2, 4a).

import { sectionIndexOf } from '../music/timing';
import type { Section } from '../music/types';
import type { NoteVerdict } from '../pitch/classify';

/** Alle Texte an einem Ort (von Matthias abzunehmen). */
export const CUE_TEXTS = {
	rest: 'Gleich du!',
	loud: 'Volle Lotte!',
	soft: 'Ganz fein!',
	offbeatOne: 'Die 1 ist Pause!',
	offbeat: 'Auf das Und!',
	offbeatOther: 'Genau zählen!',
	praise: ['Sehr gut!', 'Sitzt!', 'Weiter so!', 'Starch!']
} as const;

export type CueKind = 'rest' | 'loud' | 'soft' | 'offbeat';

export interface CueCount {
	label: string;
	/** Schlag, ab dem diese Zählzeit leuchtet */
	at: number;
}

export interface Cue {
	kind: CueKind;
	/** Ab diesem Schlag sichtbar */
	from: number;
	/** Einsatz (Schlag); kurz danach verschwindet der Zuruf */
	to: number;
	kicker: string;
	text: string;
	count: CueCount[];
}

export interface CueInput {
	notes: readonly { b: number; d: number }[];
	sections: readonly Section[];
	/** Namen der ff-Teile des Titels, z. B. ['G', 'P'] */
	ff: readonly string[];
	/** Hinweise der Leitung für diese Stimme (nur Dynamik zählt) */
	hints?: readonly { bar_from: number; dyn: string | null }[];
}

const BEATS = 4;
const EPS = 1e-6;
/** Ab so vielen Schlägen Pause gilt sie als lang */
export const LONG_REST_BEATS = 2 * BEATS;
/** So lange bleibt ein Zuruf nach dem Einsatz stehen */
export const CUE_TAIL_BEATS = 0.5;

const PRIORITY: Record<CueKind, number> = { loud: 3, soft: 3, rest: 2, offbeat: 1 };

/** Zählzeit im Takt: 0 → »1«, 2.5 → »3 und«, 1.25 → »2 e«. */
export function beatLabel(posInBar: number): string {
	const whole = Math.floor(posInBar + EPS);
	const frac = posInBar - whole;
	const sfx =
		Math.abs(frac) < 0.01
			? ''
			: Math.abs(frac - 0.5) < 0.01
				? ' und'
				: Math.abs(frac - 0.25) < 0.01
					? ' e'
					: Math.abs(frac - 0.75) < 0.01
						? ' und e'
						: '';
	return `${whole + 1}${sfx}`;
}

/** Zählzeiten bis zum Einsatz: ab Taktbeginn, bei frühem Einsatz ab Schlag 3 des Takts davor. */
function countTo(entry: number): { count: CueCount[]; from: number } {
	const barStart = Math.floor(entry / BEATS + EPS) * BEATS;
	const pos = entry - barStart;
	const start = pos >= 2 - EPS ? barStart : barStart - 2;
	const count: CueCount[] = [];
	for (let w = start; w < entry - EPS; w++) {
		if (Math.abs(w - Math.floor(entry + EPS)) < EPS && pos % 1 > EPS) continue;
		count.push({ label: beatLabel(((w % BEATS) + BEATS) % BEATS), at: w });
	}
	count.push({ label: beatLabel(pos), at: entry });
	// zwei Schläge zum Lesen, bevor gezählt wird
	return { count, from: start - 2 };
}

/** Einsatz in einen Teil ab Takt `bar`: mit Auftakt (zusammenhängende Töne kurz davor) oder die 1. */
function entryInto(notes: CueInput['notes'], bar: number, lastBar: number): number | null {
	const start = bar * BEATS;
	const k = notes.findIndex((n) => n.b >= start - EPS);
	if (k < 0 || notes[k].b >= (lastBar + 1) * BEATS - EPS) return null;
	let j = k;
	while (
		j > 0 &&
		notes[j - 1].b >= start - 2 - EPS &&
		notes[j].b - (notes[j - 1].b + notes[j - 1].d) < 0.26
	)
		j--;
	const gapBefore = j === 0 ? Infinity : notes[j].b - (notes[j - 1].b + notes[j - 1].d);
	return j < k && gapBefore >= 0.5 - EPS ? notes[j].b : notes[k].b;
}

function make(kind: CueKind, entry: number, kicker: string, text: string): Cue {
	const { count, from } = countTo(entry);
	return { kind, from, to: entry, kicker, text, count };
}

/** Alle Zurufe einer Stimme, in Zeitfolge und ohne Überschneidung. */
export function planCues(input: CueInput): Cue[] {
	const { notes, sections } = input;
	const out: Cue[] = [];
	const sectionName = (beat: number) =>
		sections[sectionIndexOf(sections, beat / BEATS)]?.name ?? '';

	// Dynamik: zuerst Hinweise der Leitung, dann ff-Teile des Titels
	const dynCue = (bar: number, lastBar: number, dyn: 'loud' | 'soft', kicker: string) => {
		const entry = entryInto(notes, bar, lastBar);
		if (entry === null) return;
		out.push(make(dyn, entry, kicker, dyn === 'loud' ? CUE_TEXTS.loud : CUE_TEXTS.soft));
	};
	for (const h of input.hints ?? []) {
		const dyn =
			h.dyn === 'ff' || h.dyn === 'f' ? 'loud' : h.dyn === 'pp' || h.dyn === 'p' ? 'soft' : null;
		if (!dyn) continue;
		dynCue(h.bar_from, h.bar_from + 3, dyn, `Teil ${sectionName(h.bar_from * BEATS)} · ${h.dyn}`);
	}
	for (const s of sections) {
		if (input.ff.includes(s.name)) dynCue(s.from, s.to, 'loud', `Teil ${s.name}`);
	}

	// Pausen und Einsätze neben dem Schlag
	const offbeatSeen = new Set<string>();
	for (let i = 1; i < notes.length; i++) {
		const prevEnd = notes[i - 1].b + notes[i - 1].d;
		const gap = notes[i].b - prevEnd;
		const entry = notes[i].b;
		if (gap >= LONG_REST_BEATS - EPS) {
			out.push(make('rest', entry, `nach ${Math.round(gap / BEATS)} Takten Pause`, CUE_TEXTS.rest));
			continue;
		}
		const pos = entry - Math.floor(entry / BEATS + EPS) * BEATS;
		const frac = pos % 1;
		if (gap < 1 - EPS || frac < EPS) continue;
		const name = sectionName(entry);
		if (offbeatSeen.has(name)) continue;
		offbeatSeen.add(name);
		const text =
			Math.abs(frac - 0.5) > 0.01
				? CUE_TEXTS.offbeatOther
				: pos < 1
					? CUE_TEXTS.offbeatOne
					: CUE_TEXTS.offbeat;
		out.push(make('offbeat', entry, `Teil ${name}`, text));
	}

	// Gleicher Einsatz: zusammenlegen (Dynamik gewinnt, die Pause bleibt im Kicker)
	const byEntry = new Map<number, Cue>();
	for (const c of out) {
		const key = Math.round(c.to * 1000);
		const had = byEntry.get(key);
		if (!had) {
			byEntry.set(key, c);
			continue;
		}
		const [win, lose] = PRIORITY[c.kind] > PRIORITY[had.kind] ? [c, had] : [had, c];
		const kicker =
			lose.kind === 'rest' && win.kind !== 'rest' ? `${lose.kicker} · ${win.kicker}` : win.kicker;
		byEntry.set(key, { ...win, kicker });
	}

	// Überschneidungen: der wichtigere bleibt
	const sorted = [...byEntry.values()].sort((a, b) => a.to - b.to);
	const kept: Cue[] = [];
	for (const c of sorted) {
		const last = kept.at(-1);
		if (!last || c.from >= last.to) {
			kept.push(c);
		} else if (PRIORITY[c.kind] > PRIORITY[last.kind]) {
			kept[kept.length - 1] = c;
			// der ersetzte darf den davor nicht überlappen
			while (kept.length > 1 && kept[kept.length - 1].from < kept[kept.length - 2].to) {
				kept.splice(kept.length - 2, 1);
			}
		}
	}
	return kept;
}

/** Zuruf, der bei diesem Schlag zu sehen ist (der zuletzt begonnene), oder null. */
export function cueAt(cues: readonly Cue[], beat: number): Cue | null {
	let hit: Cue | null = null;
	for (const c of cues) {
		if (c.from > beat) break;
		if (beat < c.to + CUE_TAIL_BEATS) hit = c;
	}
	return hit;
}

/** Ab so vielen getroffenen Tönen am Stück gibt es Lob */
export const PRAISE_STREAK = 8;

/**
 * Lob fällig? Gibt den Index des Tons zurück, bei dem gelobt wird, wenn die letzten bewerteten Töne
 * mindestens PRAISE_STREAK Mal am Stück getroffen sind und seit dem letzten Lob genug neue dazukamen.
 */
export function praiseDue(
	judged: ReadonlyMap<number, NoteVerdict>,
	lastPraised: number
): number | null {
	let last = -1;
	for (const i of judged.keys()) last = Math.max(last, i);
	if (last < 0 || last - lastPraised < PRAISE_STREAK) return null;
	let streak = 0;
	for (let i = last; judged.get(i) === 'hit'; i--) streak++;
	return streak >= PRAISE_STREAK ? last : null;
}
