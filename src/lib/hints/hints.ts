// Hinweise der Leitung: Texte und Filter, portiert aus prototype/v7 (DYN_TXT, hintShort, hintLong,
// targetName, myHints). Gespeichert werden sie in der Datenbank (add_hint, list_hints, my_hints).

import { REGISTER_LABELS } from '../music/registers';
import type { Register } from '../music/types';

export type HintKind = 'dyn' | 'artik' | 'atem' | 'text';

export interface Hint {
	id: string;
	bar_from: number;
	bar_to: number;
	/** 'alle', ein Register ('trp', 'pos', 'tief', 'perc') oder eine Stimme ('trp1' …) */
	target: string;
	kind: HintKind;
	dyn: string | null;
	body: string | null;
	is_read: boolean;
}

export const HINT_KINDS: Record<HintKind, string> = {
	dyn: 'Dynamik',
	artik: 'Artikulation',
	atem: 'Atmen',
	text: 'Hinweis'
};

export const DYNAMICS = ['pp', 'p', 'mp', 'mf', 'f', 'ff', 'cresc.', 'decresc.'] as const;

export const DYN_TEXT: Record<(typeof DYNAMICS)[number], string> = {
	pp: 'sehr leise',
	p: 'leise',
	mp: 'halbleise',
	mf: 'halblaut',
	f: 'laut',
	ff: 'sehr laut',
	'cresc.': 'lauter werden',
	'decresc.': 'leiser werden'
};

/** Höchstlänge des Texts (wie im Prototyp) */
export const HINT_BODY_MAX = 160;

/** Text ist Pflicht bei Artikulation und freiem Hinweis. */
export const bodyRequired = (kind: HintKind) => kind === 'artik' || kind === 'text';

/** Kurz für die Bahn: »pp«, »Atmen«, »Artik.«, »! Hier Solo« (gekürzt). */
export function hintShort(h: Pick<Hint, 'kind' | 'dyn' | 'body'>): string {
	if (h.kind === 'dyn') return h.dyn ?? '';
	if (h.kind === 'atem') return 'Atmen';
	if (h.kind === 'artik') return 'Artik.';
	const t = h.body ?? '';
	return '!' + (t ? ' ' + (t.length > 18 ? t.slice(0, 18) + '…' : t) : '');
}

/** Lang für die Liste: »pp – sehr leise. Trompeten zurück« */
export function hintLong(h: Pick<Hint, 'kind' | 'dyn' | 'body'>): string {
	let s = '';
	if (h.kind === 'dyn') s = `${h.dyn} – ${DYN_TEXT[h.dyn as keyof typeof DYN_TEXT] ?? ''}`;
	else if (h.kind === 'atem') s = 'Hier atmen';
	else if (h.kind === 'artik') s = 'Artikulation';
	return [s, h.body].filter(Boolean).join('. ');
}

/** Für wen: »Alle«, »Trompeten«, »Trompete 1« */
export function targetLabel(
	target: string,
	voices: readonly { id: string; name: string }[]
): string {
	if (target === 'alle') return 'Alle';
	if (target in REGISTER_LABELS) return REGISTER_LABELS[target as Register];
	return voices.find((v) => v.id === target)?.name ?? target;
}

/** Hinweise für eine Stimme: an alle, an ihr Register oder an sie selbst. */
export function hintsFor<T extends Pick<Hint, 'target'>>(
	hints: readonly T[],
	voice: { id: string; register: Register } | null
): T[] {
	if (!voice) return [...hints];
	return hints.filter(
		(h) => h.target === 'alle' || h.target === voice.register || h.target === voice.id
	);
}

/** »T. 9–12« bzw. »T. 13« */
export function barsLabel(h: Pick<Hint, 'bar_from' | 'bar_to'>): string {
	return h.bar_from === h.bar_to ? `T. ${h.bar_from}` : `T. ${h.bar_from}–${h.bar_to}`;
}
