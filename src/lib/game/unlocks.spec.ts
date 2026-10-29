import { describe, expect, it } from 'vitest';
import { BEST_POINTS_KEY, clearBestPoints, loadBestPoints, saveBestPoints } from './unlocks';

describe('Rang auf dem Gerät', () => {
	const store = () => {
		const data = new Map<string, string>();
		return {
			data,
			getItem: (k: string) => data.get(k) ?? null,
			setItem: (k: string, v: string) => void data.set(k, v),
			removeItem: (k: string) => void data.delete(k)
		};
	};

	it('merkt sich die Punkte und vergisst sie beim Abmelden', () => {
		const s = store();
		expect(loadBestPoints(s)).toBe(0);
		saveBestPoints(s, 260);
		expect(loadBestPoints(s)).toBe(260);
		clearBestPoints(s);
		expect(s.data.has(BEST_POINTS_KEY)).toBe(false);
	});

	it('Kaputtes oder gesperrter Speicher gibt 0', () => {
		const s = store();
		s.data.set(BEST_POINTS_KEY, 'viel');
		expect(loadBestPoints(s)).toBe(0);
		const broken = {
			getItem: () => {
				throw new Error('gesperrt');
			},
			setItem: () => {
				throw new Error('gesperrt');
			},
			removeItem: () => {
				throw new Error('gesperrt');
			}
		};
		expect(loadBestPoints(broken)).toBe(0);
		expect(() => saveBestPoints(broken, 5)).not.toThrow();
		expect(() => clearBestPoints(broken)).not.toThrow();
	});
});
