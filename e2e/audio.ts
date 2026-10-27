// Synthetisches Audio für die Abläufe: WAV-Dateien und abgefangene Aufnahmen (/audio/…).
import type { Page } from '@playwright/test';

const SECONDS = 30;
/** WAV (16 Bit, mono) aus einer Funktion der Zeit mit Werten zwischen −1 und 1. */
export function wav(seconds: number, rate: number, at: (t: number) => number): Buffer {
	const n = Math.round(seconds * rate);
	const buf = Buffer.alloc(44 + n * 2);
	buf.write('RIFF', 0);
	buf.writeUInt32LE(36 + n * 2, 4);
	buf.write('WAVEfmt ', 8);
	buf.writeUInt32LE(16, 16);
	buf.writeUInt16LE(1, 20); // PCM
	buf.writeUInt16LE(1, 22); // mono
	buf.writeUInt32LE(rate, 24);
	buf.writeUInt32LE(rate * 2, 28);
	buf.writeUInt16LE(2, 32);
	buf.writeUInt16LE(16, 34);
	buf.write('data', 36);
	buf.writeUInt32LE(n * 2, 40);
	for (let i = 0; i < n; i++) {
		buf.writeInt16LE(Math.round(Math.max(-1, Math.min(1, at(i / rate))) * 32767), 44 + i * 2);
	}
	return buf;
}

export function sineWav(freq: number, seconds = SECONDS, rate = 8000): Buffer {
	return wav(seconds, rate, (t) => 0.25 * Math.sin(2 * Math.PI * freq * t));
}

/** Sägezahn: obertonreich wie Blech, wie in den Vitest-Tests der Tonerkennung. */
export function sawWav(freq: number, seconds: number, rate = 48000): Buffer {
	return wav(seconds, rate, (t) => 0.3 * 2 * (t * freq - Math.floor(t * freq + 0.5)));
}

/**
 * /audio/… abfangen: Band 220 Hz, eigene Stimme 440 Hz (klingend), mit Range-Antworten.
 * Gibt die angefragten Dateinamen zurück.
 */
export async function fakeAudio(page: Page) {
	const band = sineWav(220);
	const own = sineWav(440);
	const requested: string[] = [];
	// Mit Range-Antworten wie bei Supabase: Ohne sie springt Chromium nicht (currentTime bleibt 0).
	await page.route('**/audio/**', (route) => {
		const req = route.request();
		const file = new URL(req.url()).pathname.split('/').pop() ?? '';
		requested.push(file);
		const body = file.startsWith('minus_') ? band : own;
		const headers: Record<string, string> = {
			'access-control-allow-origin': '*',
			'accept-ranges': 'bytes',
			'content-type': 'audio/wav'
		};
		const range = /bytes=(\d+)-(\d*)/.exec(req.headers()['range'] ?? '');
		if (!range) return route.fulfill({ status: 200, headers, body });
		const start = Number(range[1]);
		const end = range[2] ? Math.min(Number(range[2]), body.length - 1) : body.length - 1;
		return route.fulfill({
			status: 206,
			headers: { ...headers, 'content-range': `bytes ${start}-${end}/${body.length}` },
			body: body.subarray(start, end + 1)
		});
	});
	return requested;
}
