import { describe, expect, it } from 'vitest';
import { readSupabaseConfig } from './config';

const URL_OK = 'https://abcdefghijklmnop.supabase.co';
const KEY_OK = 'sb_publishable_beispiel';

describe('readSupabaseConfig', () => {
	it('ist null, solange nichts eingerichtet ist', () => {
		expect(readSupabaseConfig({})).toBeNull();
		expect(
			readSupabaseConfig({ PUBLIC_SUPABASE_URL: ' ', PUBLIC_SUPABASE_PUBLISHABLE_KEY: '' })
		).toBeNull();
	});

	it('liest gültige Angaben und schneidet Pfad und Leerzeichen ab', () => {
		expect(
			readSupabaseConfig({
				PUBLIC_SUPABASE_URL: ` ${URL_OK}/ `,
				PUBLIC_SUPABASE_PUBLISHABLE_KEY: KEY_OK
			})
		).toEqual({ url: URL_OK, publishableKey: KEY_OK });
	});

	it('verlangt beide Werte zusammen', () => {
		expect(() => readSupabaseConfig({ PUBLIC_SUPABASE_URL: URL_OK })).toThrow(/zusammen/);
		expect(() => readSupabaseConfig({ PUBLIC_SUPABASE_PUBLISHABLE_KEY: KEY_OK })).toThrow(
			/zusammen/
		);
	});

	it('verlangt https ausser lokal', () => {
		expect(() =>
			readSupabaseConfig({
				PUBLIC_SUPABASE_URL: 'http://x.supabase.co',
				PUBLIC_SUPABASE_PUBLISHABLE_KEY: KEY_OK
			})
		).toThrow(/https/);
		expect(
			readSupabaseConfig({
				PUBLIC_SUPABASE_URL: 'http://127.0.0.1:54321',
				PUBLIC_SUPABASE_PUBLISHABLE_KEY: KEY_OK
			})
		).toEqual({ url: 'http://127.0.0.1:54321', publishableKey: KEY_OK });
		expect(() =>
			readSupabaseConfig({
				PUBLIC_SUPABASE_URL: 'kein url',
				PUBLIC_SUPABASE_PUBLISHABLE_KEY: KEY_OK
			})
		).toThrow(/gültige/);
	});

	it('weist einen geheimen Schlüssel ab', () => {
		expect(() =>
			readSupabaseConfig({
				PUBLIC_SUPABASE_URL: URL_OK,
				PUBLIC_SUPABASE_PUBLISHABLE_KEY: 'sb_secret_xyz'
			})
		).toThrow(/geheimer/);
	});
});
