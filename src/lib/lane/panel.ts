// Inhalt der Griff-Anzeige neben der Bahn, portiert aus prototype/v7 (panelUpdate).

import { fingeringLabel, pressedValves } from '../music/fingering';
import { durationName } from '../music/notation';
import { nextNoteIndex, noteIndexAt } from '../music/track';
import type { InstrumentKind, Note } from '../music/types';
import type { HelpLevel } from './geometry';

export interface PanelInput {
	notes: readonly Note[];
	beat: number;
	kind: InstrumentKind;
	help: HelpLevel;
	/** Zählzeit 1–4 beim Einzählen, sonst null */
	countIn: number | null;
	/** Echo-Phase: »Hör zu« / »Jetzt du« ersetzt die grosse Zeile */
	phaseText?: string | null;
}

export interface PanelState {
	/** Kleine Zeile oben (Versalien) */
	kicker: string;
	big: string;
	sub: string;
	next: string;
	/** Gedrückte Ventile 1–3; null = Ventile nicht zeigen */
	valves: number[] | null;
	/** Zugposition 1–7 bzw. 0 (keine); null = Zug nicht zeigen */
	slide: number | null;
	/** Schlag im Takt 0–3, −1 vor Takt 0 */
	beatInBar: number;
	countIn: number | null;
	/** Griff wurde aus der Standardtabelle ergänzt */
	autoFingering: boolean;
}

export function panelState(p: PanelInput): PanelState {
	const { notes, beat, kind, help } = p;
	const beatInBar = beat >= 0 ? ((Math.floor(beat) % 4) + 4) % 4 : -1;
	const base = { beatInBar, countIn: p.countIn, valves: null, slide: null, autoFingering: false };

	if (help === 'memo') {
		return {
			...base,
			kicker: 'Auswendig',
			big: p.phaseText ?? 'Spiel aus dem Kopf',
			sub: 'Die Bahn zeigt nur Takte und Einsätze.',
			next: ''
		};
	}

	const now = noteIndexAt(notes, beat);
	const shown = now >= 0 ? now : nextNoteIndex(notes, beat);
	if (shown < 0) {
		return { ...base, kicker: 'Ende', big: p.phaseText ?? '–', sub: '', next: '' };
	}

	const n = notes[shown];
	const grip = fingeringLabel(n.fing, kind);
	const kicker = now >= 0 ? 'Jetzt' : p.countIn ? 'Einzählen · gleich' : 'Pause · gleich';
	let big: string;
	if (p.phaseText) big = p.phaseText;
	else if (help === 'all') big = grip;
	else if (help === 'nogrip') big = n.name;
	else big = durationName(n.d);

	let sub = '';
	if (help !== 'rhythm') {
		sub = n.name + ' · ' + durationName(n.d);
		if (p.phaseText && help === 'all') sub += ' · ' + grip;
	}

	const after = notes[shown + 1];
	let next = '';
	if (after && help !== 'rhythm') {
		next = 'Dann: ' + (help === 'all' ? fingeringLabel(after.fing, kind) + ' · ' : '') + after.name;
	}

	return {
		...base,
		kicker,
		big,
		sub,
		next,
		valves: help === 'all' && kind === 'valve' ? pressedValves(n.fing) : null,
		slide: help === 'all' && kind === 'slide' ? Number(n.fing) || 0 : null,
		autoFingering: help === 'all' && !!n.fing_auto
	};
}
