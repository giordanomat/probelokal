import { describe, expect, it } from 'vitest';
import { badTouchPart } from '../../test/badtouch';
import { buildTrack } from '../music/track';
import type { Section } from '../music/types';
import type { NoteVerdict } from '../pitch/classify';
import { BAD_TOUCH } from '../titles/bad-touch';
import { CUE_TEXTS, cueAt, planCues, praiseDue, type Cue } from './cues';

const trp1 = buildTrack(badTouchPart('P1').notes, 'valve');
const plan = (extra: Partial<Parameters<typeof planCues>[0]> = {}) =>
	planCues({ notes: trp1.notes, sections: BAD_TOUCH.sections, ff: BAD_TOUCH.ff ?? [], ...extra });
const labels = (c: Cue) => c.count.map((x) => x.label);

describe('Zurufe aus den Noten (Bad Touch, Trompete 1)', () => {
	it('ff-Teile von Bad Touch: G, P, Q (Entscheid Matthias 08.11.2026)', () => {
		expect(BAD_TOUCH.ff).toEqual(['G', 'P', 'Q']);
	});

	it('nach 25 Takten Pause: »Gleich du!«, gezählt bis »3 und« in Takt 70', () => {
		const c = plan().find((x) => x.kind === 'rest' && x.to === 70 * 4 + 2.5);
		expect(c).toBeDefined();
		expect(c!.text).toBe(CUE_TEXTS.rest);
		expect(c!.kicker).toBe('nach 25 Takten Pause');
		expect(labels(c!)).toEqual(['1', '2', '3 und']);
		expect(c!.count.at(-1)!.at).toBe(c!.to);
		// sichtbar etwas vor dem Zählen, damit man es lesen kann
		expect(c!.from).toBeLessThan(c!.count[0].at);
	});

	it('Teil C, Takt 13: Pause auf der 1, Einsatz auf »1 und«', () => {
		const c = plan().find((x) => x.kind === 'offbeat');
		expect(c).toBeDefined();
		expect(c!.to).toBe(13 * 4 + 0.5);
		expect(c!.text).toBe(CUE_TEXTS.offbeatOne);
		expect(c!.kicker).toBe('Teil C');
		expect(labels(c!)).toEqual(['3', '4', '1 und']);
		// nur beim ersten Mal im Teil (Takt 14 und 15 gleich)
		expect(plan().filter((x) => x.kind === 'offbeat' && x.kicker === 'Teil C')).toHaveLength(1);
	});

	it('»Volle Lotte!« nur vor den ff-Teilen, nicht vor jedem Teil', () => {
		const loud = plan().filter((x) => x.kind === 'loud');
		expect(loud.map((x) => x.kicker)).toEqual(['Teil G', 'Teil P', 'Teil Q']);
		expect(loud.every((x) => x.text === CUE_TEXTS.loud)).toBe(true);
		expect(plan({ ff: [] }).filter((x) => x.kind === 'loud')).toHaveLength(0);
	});

	it('Zurufe überlappen nie und kommen in Zeitfolge', () => {
		const all = plan();
		expect(all.length).toBeGreaterThan(3);
		for (let i = 1; i < all.length; i++) {
			expect(all[i].from, `${all[i].kicker}`).toBeGreaterThanOrEqual(all[i - 1].to);
		}
	});
});

describe('Zurufe: Regeln', () => {
	const sections: Section[] = [
		{ from: 0, to: 0, name: 'Vorzähler' },
		{ from: 1, to: 4, name: 'A' },
		{ from: 5, to: 8, name: 'B' }
	];
	const n = (b: number, d = 1) => ({ b, d });

	it('Hinweis der Leitung: pp → »Ganz fein!«, ff → »Volle Lotte!«, auch ohne ff im Titel', () => {
		const notes = Array.from({ length: 24 }, (_, i) => n(4 + i));
		const soft = planCues({ notes, sections, ff: [], hints: [{ bar_from: 5, dyn: 'pp' }] });
		expect(soft).toEqual([
			expect.objectContaining({ kind: 'soft', text: CUE_TEXTS.soft, kicker: 'Teil B · pp', to: 20 })
		]);
		const loud = planCues({ notes, sections, ff: [], hints: [{ bar_from: 5, dyn: 'ff' }] });
		expect(loud[0]).toMatchObject({ kind: 'loud', kicker: 'Teil B · ff' });
	});

	it('lange Pause in einen ff-Teil: ein Zuruf, Text »Volle Lotte!«, Pause im Kicker', () => {
		const notes = [n(4), n(20), n(21)];
		const cues = planCues({ notes, sections, ff: ['B'] });
		expect(cues).toHaveLength(1);
		expect(cues[0]).toMatchObject({ kind: 'loud', text: CUE_TEXTS.loud });
		expect(cues[0].kicker).toBe('nach 4 Takten Pause · Teil B');
	});

	it('Einsatz auf der 1 nach langer Pause: »3 4« vorher, Einsatz »1«', () => {
		const cues = planCues({ notes: [n(4), n(24)], sections, ff: [] });
		expect(cues).toHaveLength(1);
		expect(labels(cues[0])).toEqual(['3', '4', '1']);
	});

	it('Teil, in dem die Stimme nicht spielt: kein »Volle Lotte!«', () => {
		expect(planCues({ notes: [n(4), n(5)], sections, ff: ['B'] })).toEqual([]);
	});

	it('cueAt: sichtbar von »from« bis kurz nach dem Einsatz', () => {
		const cues = planCues({ notes: [n(4), n(24)], sections, ff: [] });
		const c = cues[0];
		expect(cueAt(cues, c.from - 0.01)).toBeNull();
		expect(cueAt(cues, c.from)).toBe(c);
		expect(cueAt(cues, c.to + 0.2)).toBe(c);
		expect(cueAt(cues, c.to + 0.6)).toBeNull();
	});
});

describe('Lob beim Mithören', () => {
	const run = (vs: NoteVerdict[], start = 0) => new Map(vs.map((v, i) => [start + i, v] as const));

	it('8 getroffene Töne am Stück, danach erst wieder nach 8 weiteren', () => {
		const hit = Array<NoteVerdict>(8).fill('hit');
		expect(praiseDue(run(hit.slice(0, 7)), -1)).toBeNull();
		expect(praiseDue(run(hit), -1)).toBe(7);
		expect(praiseDue(run(hit), 7)).toBeNull();
		expect(praiseDue(run([...hit, ...hit]), 7)).toBe(15);
	});

	it('ein Fehler unterbricht die Serie', () => {
		const vs: NoteVerdict[] = ['hit', 'hit', 'hit', 'wrong', 'hit', 'hit', 'hit', 'hit', 'hit'];
		expect(praiseDue(run(vs), -1)).toBeNull();
	});
});
