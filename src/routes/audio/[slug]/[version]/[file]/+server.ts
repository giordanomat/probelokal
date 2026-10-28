// Audio des Testtitels: nur mit Testzugang, Weiterleitung auf eine signierte Storage-Adresse.
// Der Browser lädt die Datei dann direkt bei Supabase (mit Range-Anfragen fürs Springen).
import { error, redirect } from '@sveltejs/kit';
import { PUBLIC_SUPABASE_URL } from '$app/env/public';
import { SUPABASE_SECRET_KEY, TEST_ACCESS_CODE } from '$app/env/private';
import { AudioMissingError, audioPath, signedAudioUrl } from '#lib/server/audio.ts';
import { ACCESS_COOKIE, hasAccess } from '#lib/server/test-access.ts';
import { BAD_TOUCH } from '#lib/titles/bad-touch.ts';
import type { RequestHandler } from './$types';

export const GET: RequestHandler = async ({ params, cookies, setHeaders }) => {
	if (!(await hasAccess(cookies.get(ACCESS_COOKIE), TEST_ACCESS_CODE))) {
		error(401, 'Testzugang nötig');
	}
	const path = audioPath(BAD_TOUCH, params.slug, params.version, params.file);
	if (!path) error(404, 'Nicht gefunden');
	if (!PUBLIC_SUPABASE_URL || !SUPABASE_SECRET_KEY) error(503, 'Audio ist noch nicht eingerichtet');
	let url: string;
	try {
		url = await signedAudioUrl({ url: PUBLIC_SUPABASE_URL, secretKey: SUPABASE_SECRET_KEY }, path);
	} catch (e) {
		if (e instanceof AudioMissingError) error(404, 'Aufnahme fehlt noch');
		console.error(e);
		error(502, 'Audio gerade nicht erreichbar');
	}
	setHeaders({ 'cache-control': 'private, no-store' });
	redirect(302, url);
};
