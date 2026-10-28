// Testzugang für M1 (Entscheid Matthias, 26.10.2026): Der Testtitel liegt in einem privaten
// Bucket. Wer den Testcode kennt, bekommt ein Cookie; nur damit gibt der Worker Audio heraus.
// Das Cookie enthält nicht den Code selbst, sondern eine HMAC daraus. Wechselt der Code
// (Cloudflare-Secret TEST_ACCESS_CODE), sind alle alten Cookies ungültig.
// Ersetzt durch Konten und Lizenzen in M2.

export const ACCESS_COOKIE = 'probelokal_test';
/** 60 Tage */
export const ACCESS_MAX_AGE = 60 * 24 * 60 * 60;

const CONTEXT = 'probelokal-testzugang-v1';

async function hmacHex(key: string, message: string): Promise<string> {
	const enc = new TextEncoder();
	const k = await crypto.subtle.importKey(
		'raw',
		enc.encode(key),
		{ name: 'HMAC', hash: 'SHA-256' },
		false,
		['sign']
	);
	const sig = new Uint8Array(await crypto.subtle.sign('HMAC', k, enc.encode(message)));
	return Array.from(sig, (b) => b.toString(16).padStart(2, '0')).join('');
}

/** Vergleich ohne frühen Abbruch (gleich lange Hex-Werte). */
function sameHex(a: string, b: string): boolean {
	if (a.length !== b.length) return false;
	let diff = 0;
	for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
	return diff === 0;
}

/** Leerzeichen und Gross-/Kleinschreibung beim Eintippen spielen keine Rolle. */
export function normalizeCode(code: string): string {
	return code.trim().toLowerCase();
}

/** Wert für das Cookie, abgeleitet vom gültigen Code. */
export function accessToken(code: string): Promise<string> {
	return hmacHex(normalizeCode(code), CONTEXT);
}

/** Stimmt der eingegebene Code? Ohne gesetzten Code gibt es keinen Testzugang. */
export async function codeMatches(given: string, expected: string | undefined): Promise<boolean> {
	if (!expected || !normalizeCode(expected) || !normalizeCode(given)) return false;
	return sameHex(await accessToken(given), await accessToken(expected));
}

/** Hat das Cookie Zugang? */
export async function hasAccess(
	cookie: string | undefined,
	expected: string | undefined
): Promise<boolean> {
	if (!cookie || !expected || !normalizeCode(expected)) return false;
	return sameHex(cookie, await accessToken(expected));
}
