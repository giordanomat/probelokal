// Der Testtitel in der Datenbank (Migration 20261029100000) muss zu src/lib/titles/bad-touch.ts passen.

import { describe, expect, it } from 'vitest';
import { BAD_TOUCH, BAD_TOUCH_NOTES } from '../../src/lib/titles/bad-touch';
import { pauseSections } from '../../src/lib/plan/stand';
import { createTestDb } from './db';

describe('Katalog', () => {
	it('Bad Touch in der Datenbank = Bad Touch in der App', async () => {
		const db = await createTestDb();
		const [row] = await db.owner<Record<string, unknown>>(
			`select name, version, bpm::float8 as bpm, bars, sections, voices,
			        stem_offset_sec::float8 as stem_offset_sec, published
			 from titles where slug = $1`,
			[BAD_TOUCH.slug]
		);
		expect(row).toEqual({
			name: BAD_TOUCH.name,
			version: BAD_TOUCH.version,
			bpm: BAD_TOUCH.bpm,
			bars: BAD_TOUCH.bars,
			sections: BAD_TOUCH.sections,
			// Pausen pro Stimme aus den Noten, wie »Mein Plan« sie zeigt
			voices: BAD_TOUCH.voices.map((v) => ({
				...v,
				rests: [
					...pauseSections(
						BAD_TOUCH.sections,
						BAD_TOUCH_NOTES.parts.find((p) => p.id === v.part)!.notes
					)
				]
			})),
			stem_offset_sec: BAD_TOUCH.stem_offset_sec,
			published: true
		});
	});
});
