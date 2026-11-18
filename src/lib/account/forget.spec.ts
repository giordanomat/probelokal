import { describe, expect, it } from 'vitest';
import { forgetDevice } from './forget';

function memoryStorage(init: Record<string, string>) {
	const data = new Map(Object.entries(init));
	return {
		data,
		get length() {
			return data.size;
		},
		key: (i: number) => [...data.keys()][i] ?? null,
		removeItem: (k: string) => void data.delete(k)
	};
}

describe('Gerät vergessen nach dem Löschen des Kontos', () => {
	it('entfernt nur Einträge und Caches von Probelokal, das Gerüst der App bleibt', async () => {
		const storage = memoryStorage({
			'probelokal.theme': 'light',
			'probelokal.bau.bad-touch-2-0.trp1': '[]',
			'probelokal.punkte': '120',
			'sb-xyz-auth-token': 'x',
			fremd: '1'
		});
		const names = new Set(['probelokal-titel-bad-touch-2-0-schuegu27', 'probelokal-shell-123']);
		const caches = {
			keys: async () => [...names],
			delete: async (n: string) => names.delete(n)
		};
		expect(await forgetDevice(storage, caches)).toBe(4);
		expect([...storage.data.keys()]).toEqual(['sb-xyz-auth-token', 'fremd']);
		expect([...names]).toEqual(['probelokal-shell-123']);
	});

	it('ohne Speicher oder Cache: kein Fehler', async () => {
		expect(await forgetDevice(undefined, undefined)).toBe(0);
		const broken = {
			get length(): number {
				throw new Error('gesperrt');
			},
			key: () => null,
			removeItem: () => undefined
		};
		const noCaches = {
			keys: async (): Promise<string[]> => {
				throw new Error('nein');
			},
			delete: async () => false
		};
		expect(await forgetDevice(broken, noCaches)).toBe(0);
	});
});
