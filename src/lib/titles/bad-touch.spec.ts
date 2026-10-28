import { execFileSync } from 'node:child_process';
import { describe, expect, it } from 'vitest';
import { BAD_TOUCH_NOTES } from './bad-touch';

describe('Noten-JSON von Bad Touch', () => {
	it('entspricht der Ausgabe von tools/extract_notes.py (sonst: npm run notes)', () => {
		const fresh = JSON.parse(
			execFileSync(
				'python3',
				['tools/extract_notes.py', 'prototype/v7/badtouch.xml', '--fill-missing'],
				{ encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }
			)
		);
		expect(BAD_TOUCH_NOTES).toEqual(fresh);
	});
});
