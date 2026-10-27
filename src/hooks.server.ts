import type { Handle } from '@sveltejs/kit/hooks';
// Startseite unter jeder Adresse ist die Landingpage von giordanomat ARRANGEMENTS.
// Hauptadresse ist probelokal.ch (Entscheid Matthias, 27.10.2026); die frühere Platzhalter-Startseite
// »Hier entsteht dein Probelokal« ist gelöscht.
// Die Landingpage ist eine fertige HTML-Datei (Schriften eingebettet, keine fremden Ressourcen),
// erstellt in einem separaten claude.ai-Chat; die Quelle (index.src.html + build.py) liegt noch
// nicht im Repository.
import landing from './lib/sites/arrangements.html?raw';

export const handle: Handle = async ({ event }) => {
	if (event.url.pathname === '/' || event.url.pathname === '/index.html') {
		return new Response(landing, {
			headers: {
				'content-type': 'text/html; charset=utf-8',
				'cache-control': 'public, max-age=300'
			}
		});
	}
	return new Response('Nicht gefunden', { status: 404 });
};
