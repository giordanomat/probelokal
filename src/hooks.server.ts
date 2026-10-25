import type { Handle } from '@sveltejs/kit/hooks';
import { siteForHost } from './lib/sites/host';
// Vorläufige Landingpage für arrangements.giordanomat.de: eine fertige HTML-Datei
// (Schriften eingebettet, keine fremden Ressourcen). Erstellt in einem separaten claude.ai-Chat;
// die Quelle (index.src.html + build.py) liegt noch nicht im Repository. Wird in M5 durch den Shop ersetzt.
import arrangementsLanding from './lib/sites/arrangements.html?raw';

export const handle: Handle = async ({ event, resolve }) => {
	if (siteForHost(event.url.host) === 'arrangements') {
		if (event.url.pathname === '/' || event.url.pathname === '/index.html') {
			return new Response(arrangementsLanding, {
				headers: {
					'content-type': 'text/html; charset=utf-8',
					'cache-control': 'public, max-age=300'
				}
			});
		}
		return new Response('Nicht gefunden', { status: 404 });
	}
	return resolve(event);
};
