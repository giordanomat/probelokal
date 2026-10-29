import type { Handle } from '@sveltejs/kit/hooks';
// Startseite unter jeder Adresse ist die Landingpage von Probelokal (Datei heisst historisch arrangements.html).
// Hauptadresse ist probelokal.ch (Entscheid Matthias, 27.10.2026); die frühere Platzhalter-Startseite
// »Hier entsteht dein Probelokal« ist gelöscht. Alte Adressen leiten per Redirect Rule bei
// Cloudflare um, nicht hier.
// Die Landingpage ist eine fertige HTML-Datei (Schriften eingebettet, keine fremden Ressourcen),
// erstellt in einem separaten claude.ai-Chat; die Quelle (index.src.html + build.py) liegt noch
// nicht im Repository.
import landing from './lib/sites/arrangements.html?raw';

export const handle: Handle = async ({ event, resolve }) => {
	if (event.url.pathname === '/' || event.url.pathname === '/index.html') {
		return new Response(landing, {
			headers: {
				'content-type': 'text/html; charset=utf-8',
				'cache-control': 'public, max-age=300'
			}
		});
	}
	// Übrige Pfade: die App (/ueben, /zugang, /audio/…, M1); Unbekanntes beantwortet SvelteKit mit 404.
	return resolve(event);
};
