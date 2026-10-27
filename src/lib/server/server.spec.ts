import { describe, expect, it } from 'vitest';
import { BAD_TOUCH } from '#lib/titles/bad-touch.ts';
import { AUDIO_BUCKET, AudioMissingError, audioFiles, audioPath, signedAudioUrl } from './audio';
import { accessToken, codeMatches, hasAccess, normalizeCode } from './test-access';

describe('Testzugang', () => {
	it('Code stimmt unabhängig von Leerzeichen und Grossschreibung', async () => {
		expect(normalizeCode('  Schuegu27 ')).toBe('schuegu27');
		expect(await codeMatches('SCHUEGU27 ', 'schuegu27')).toBe(true);
		expect(await codeMatches('schuegu26', 'schuegu27')).toBe(false);
	});

	it('ohne gesetzten Code gibt es keinen Zugang, auch nicht mit leerem Code', async () => {
		expect(await codeMatches('', undefined)).toBe(false);
		expect(await codeMatches('', '')).toBe(false);
		expect(await codeMatches('', '   ')).toBe(false);
		expect(await hasAccess('irgendwas', undefined)).toBe(false);
	});

	it('Cookie enthält nicht den Code und gilt nur für den aktuellen Code', async () => {
		const token = await accessToken('schuegu27');
		expect(token).toMatch(/^[0-9a-f]{64}$/);
		expect(token).not.toContain('schuegu27');
		expect(await hasAccess(token, 'Schuegu27')).toBe(true);
		expect(await hasAccess(token, 'neuer-code')).toBe(false);
		expect(await hasAccess(undefined, 'schuegu27')).toBe(false);
		expect(await hasAccess(token.slice(1), 'schuegu27')).toBe(false);
	});
});

describe('Audio-Pfade', () => {
	it('kennt pro Stimme Minus-One und eigene Spur, dazu Gesamtmischung und MusicXML', () => {
		const files = audioFiles(BAD_TOUCH);
		expect(files.size).toBe(2 + 2 * 6);
		expect(files.has('score.musicxml')).toBe(true);
		expect(files.has('minus_trp1.mp3')).toBe(true);
		expect(files.has('sous.mp3')).toBe(true);
	});

	it('lässt nur bekannte Dateien zu', () => {
		expect(audioPath(BAD_TOUCH, 'bad-touch-2-0', 'schuegu27', 'minus_pos1.mp3')).toBe(
			'bad-touch-2-0/schuegu27/minus_pos1.mp3'
		);
		expect(audioPath(BAD_TOUCH, 'bad-touch-2-0', 'Schuegu27', 'all.mp3')).toBe(
			'bad-touch-2-0/schuegu27/all.mp3'
		);
		expect(audioPath(BAD_TOUCH, 'bad-touch-2-0', 'schuegu27', '../geheim.wav')).toBeNull();
		expect(audioPath(BAD_TOUCH, 'bad-touch-2-0', 'schuegu27', 'perc.mp3')).toBeNull();
		expect(audioPath(BAD_TOUCH, 'anderer-titel', 'schuegu27', 'all.mp3')).toBeNull();
		expect(audioPath(BAD_TOUCH, 'bad-touch-2-0', 'schuegu15', 'all.mp3')).toBeNull();
	});

	it('holt die signierte Adresse beim Storage mit dem Schlüssel des Servers', async () => {
		const calls: { url: string; init?: RequestInit }[] = [];
		const fakeFetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
			calls.push({ url: String(input), init });
			return new Response(
				JSON.stringify({
					signedURL: '/object/sign/titles/bad-touch-2-0/schuegu27/all.mp3?token=abc'
				}),
				{ status: 200, headers: { 'content-type': 'application/json' } }
			);
		}) as typeof fetch;
		const url = await signedAudioUrl(
			{ url: 'https://beispiel.supabase.co', secretKey: 'sb_secret_test', fetch: fakeFetch },
			'bad-touch-2-0/schuegu27/all.mp3'
		);
		expect(url).toBe(
			'https://beispiel.supabase.co/storage/v1/object/sign/titles/bad-touch-2-0/schuegu27/all.mp3?token=abc'
		);
		expect(calls).toHaveLength(1);
		expect(calls[0].url).toContain(`/storage/v1/object/sign/${AUDIO_BUCKET}/bad-touch-2-0/`);
		const headers = new Headers(calls[0].init?.headers);
		expect(headers.get('apikey')).toBe('sb_secret_test');
	});

	it('meldet eine fehlende Datei eigens, andere Fehler allgemein', async () => {
		const answer = (status: number, body: object) =>
			(async () =>
				new Response(JSON.stringify(body), {
					status,
					headers: { 'content-type': 'application/json' }
				})) as typeof fetch;
		const sign = (f: typeof fetch) =>
			signedAudioUrl(
				{ url: 'https://beispiel.supabase.co', secretKey: 'k', fetch: f },
				'x/y/all.mp3'
			);
		await expect(
			sign(answer(400, { statusCode: '404', error: 'not_found', message: 'Object not found' }))
		).rejects.toBeInstanceOf(AudioMissingError);
		await expect(
			sign(answer(400, { statusCode: '403', error: 'Unauthorized', message: 'invalid signature' }))
		).rejects.toThrow(/Signieren fehlgeschlagen/);
	});
});
