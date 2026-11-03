// »Einblasen« heisst seit 03.11.2026 »Aufwärmen« (Entscheid Matthias). Alte Links und Lesezeichen
// auf dem Home-Bildschirm führen weiter.
import { redirect } from '@sveltejs/kit';
import type { RequestHandler } from './$types';

export const GET: RequestHandler = ({ url }) => {
	redirect(308, '/aufwaermen' + url.search);
};
