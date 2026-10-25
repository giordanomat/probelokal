import { describe, expect, it } from 'vitest';
import { DEFAULT_THEME, THEME_STORAGE_KEY, loadTheme, resolveTheme, saveTheme } from './theme';

function memoryStorage(initial: Record<string, string> = {}) {
	const data = new Map(Object.entries(initial));
	return {
		getItem: (k: string) => data.get(k) ?? null,
		setItem: (k: string, v: string) => void data.set(k, v),
		data
	};
}

const throwing = {
	getItem: () => {
		throw new Error('gesperrt');
	},
	setItem: () => {
		throw new Error('gesperrt');
	}
};

describe('Darstellung', () => {
	it('ist ohne gespeicherte Wahl dunkel', () => {
		expect(DEFAULT_THEME).toBe('dark');
		expect(resolveTheme(null)).toBe('dark');
		expect(resolveTheme(undefined)).toBe('dark');
	});

	it('übernimmt nur bekannte Werte', () => {
		expect(resolveTheme('light')).toBe('light');
		expect(resolveTheme('dark')).toBe('dark');
		expect(resolveTheme('LIGHT')).toBe('dark');
		expect(resolveTheme('')).toBe('dark');
	});

	it('speichert und liest pro Gerät', () => {
		const s = memoryStorage();
		saveTheme(s, 'light');
		expect(s.data.get(THEME_STORAGE_KEY)).toBe('light');
		expect(loadTheme(s)).toBe('light');
	});

	it('übersteht fehlenden oder gesperrten Speicher', () => {
		expect(loadTheme(undefined)).toBe('dark');
		expect(loadTheme(throwing)).toBe('dark');
		expect(() => saveTheme(throwing, 'light')).not.toThrow();
	});
});
