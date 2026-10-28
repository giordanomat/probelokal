// Kurze Rückmeldung beim Mithören, portiert aus prototype/v7 (coach). Wie oft sie wechseln darf
// (im Prototyp alle 350 ms), entscheidet der Aufrufer.

import { fingeringLabel } from '../music/fingering';
import type { InstrumentKind, Note } from '../music/types';
import type { FrameVerdict } from './classify';

export type Tone = '' | 'ok' | 'warn' | 'bad';

export interface CoachMessage {
	text: string;
	tone: Tone;
}

/** Ein Messpunkt der letzten Zeit: bewertet, 'free' (zwischen den Tönen) oder null (nichts gehört). */
export type RecentFrame = FrameVerdict | 'free' | null;

export interface CoachInput {
	/** Letzte Messpunkte, ältester zuerst (der Prototyp hielt 30). */
	recent: readonly RecentFrame[];
	/** Ton, der gerade dran ist, oder null in einer Pause. */
	note: Pick<Note, 'fing'> | null;
	kind: InstrumentKind;
	playing: boolean;
	/** Echo, Phase »Hör zu«: Die Person soll noch nicht spielen. */
	listenPhase: boolean;
	/** Wanduhr-Sekunden seit Beginn des aktuellen Tons. */
	secondsIntoNote: number;
}

/** null = nichts Neues sagen. */
export function coachMessage(input: CoachInput): CoachMessage | null {
	const { recent, note, kind } = input;
	if (input.listenPhase) return { text: 'Hör zu – gleich bist du dran.', tone: '' };
	if (!note) return input.playing ? { text: 'Pause. Atmen.', tone: '' } : null;

	const last10 = recent.slice(-10);
	if (last10.length >= 10 && last10.every((x) => x === null) && input.secondsIntoNote > 0.5) {
		return {
			text: 'Ich höre dich nicht. Lauter spielen oder näher ans Mikrofon.',
			tone: 'warn'
		};
	}

	const r = recent.slice(-12).filter((x): x is FrameVerdict => x !== null && x !== 'free');
	if (!r.length) return null;
	const count = (c: FrameVerdict['c']) => r.filter((x) => x.c === c).length;
	const avg = r.reduce((s, x) => s + x.dev, 0) / r.length;

	if (count('hit') >= r.length * 0.6) {
		const text =
			Math.abs(avg) < 0.15
				? 'Sitzt.'
				: avg < 0
					? 'Sitzt, eher etwas tief.'
					: 'Sitzt, eher etwas hoch.';
		return { text, tone: 'ok' };
	}
	const partial = count('partial');
	if (partial >= r.length * 0.5) {
		const up = r.filter((x) => x.c === 'partial' && x.up).length >= partial / 2;
		const what = kind === 'slide' ? 'Richtiger Zug' : 'Richtiger Griff';
		const fix = up ? 'hoch. Lippen lockerer, Luft wärmer.' : 'tief. Lippen fester, Luft schneller.';
		return { text: `${what}, aber eine Stufe zu ${fix}`, tone: 'warn' };
	}
	if (count('near') >= r.length * 0.5) {
		return {
			text:
				avg < 0
					? 'Knapp zu tief. Mehr Luft, Mundwinkel fest.'
					: 'Knapp zu hoch. Entspannter blasen.',
			tone: 'warn'
		};
	}
	return { text: 'Anderer Ton. Griff: ' + fingeringLabel(note.fing, kind) + '.', tone: 'bad' };
}
