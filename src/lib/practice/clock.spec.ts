import { describe, expect, it } from 'vitest';
import { FreeClock } from './clock';
import { DEFAULT_PREFS, PREFS_KEY, loadPrefs, parsePrefs, savePrefs } from './prefs';

describe('Übe-Uhr ohne Audio', () => {
	it('läuft nur beim Spielen, im gewählten Tempo', () => {
		let t = 100;
		const c = new FreeClock(() => t);
		c.seek(5);
		t = 102;
		expect(c.time()).toBe(5);
		c.play();
		t = 104;
		expect(c.time()).toBe(7);
		c.rate = 0.5;
		t = 106;
		expect(c.time()).toBe(8);
		c.pause();
		t = 200;
		expect(c.time()).toBe(8);
		expect(c.playing).toBe(false);
	});

	it('Springen während des Spielens, nie vor den Anfang', () => {
		let t = 0;
		const c = new FreeClock(() => t);
		c.play();
		t = 3;
		c.seek(10);
		t = 4;
		expect(c.time()).toBe(11);
		c.seek(-3);
		expect(c.time()).toBe(0);
	});
});

describe('Einstellungen der Bahn', () => {
	const voices = ['trp1', 'pos1'];

	it('Standard bei leerem oder kaputtem Speicher', () => {
		expect(parsePrefs(null, voices)).toEqual(DEFAULT_PREFS);
		expect(parsePrefs('kaputt', voices)).toEqual(DEFAULT_PREFS);
		expect(
			parsePrefs('{"voice":"tuba","help":"x","zoom":3,"names":"ja","own":0.5}', voices)
		).toEqual(DEFAULT_PREFS);
	});

	it('übernimmt gültige Werte', () => {
		const p = {
			voice: 'pos1',
			help: 'memo' as const,
			names: true,
			staff: true,
			zoom: 1.6,
			own: 0.35
		};
		expect(parsePrefs(JSON.stringify(p), voices)).toEqual(p);
	});

	it('speichert und liest pro Gerät, übersteht gesperrten Speicher', () => {
		const data = new Map<string, string>();
		const s = {
			getItem: (k: string) => data.get(k) ?? null,
			setItem: (k: string, v: string) => void data.set(k, v)
		};
		savePrefs(s, { ...DEFAULT_PREFS, voice: 'pos1' });
		expect(data.has(PREFS_KEY)).toBe(true);
		expect(loadPrefs(s, voices).voice).toBe('pos1');
		const broken = {
			getItem: () => {
				throw new Error('gesperrt');
			},
			setItem: () => {
				throw new Error('gesperrt');
			}
		};
		expect(loadPrefs(broken, voices)).toEqual(DEFAULT_PREFS);
		expect(() => savePrefs(broken, DEFAULT_PREFS)).not.toThrow();
	});
});
