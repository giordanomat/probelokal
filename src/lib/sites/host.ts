// Eine App, zwei Adressen (Entscheid 25.10.2026, docs/02-architektur.md):
// arrangements.giordanomat.de = Shop, alles andere = Probelokal.

export type Site = 'arrangements' | 'probelokal';

/** Welche Seite zu einem Hostnamen gehört. Gross-/Kleinschreibung und Port spielen keine Rolle. */
export function siteForHost(host: string): Site {
	const name = host.toLowerCase().split(':')[0];
	return name === 'arrangements.giordanomat.de' || name.startsWith('arrangements.')
		? 'arrangements'
		: 'probelokal';
}

/** Frühere Adressen des Probelokals. Sie leiten auf die Hauptadresse um, sobald diese gesetzt ist. */
export const LEGACY_PROBELOKAL_HOSTS = [
	'probelokal.giordanomat.de',
	'probelokal.giordanomat.workers.dev'
] as const;

/**
 * Umleitung auf die Hauptadresse (z. B. probelokal.ch), oder null. Leitet nur die bekannten alten
 * Adressen und »www.« um – nie localhost, Vorschauen oder den Shop. GET/HEAD dauerhaft (301),
 * alles andere mit 308, damit Formulare (POST) nicht zu GET werden.
 */
export function canonicalRedirect(
	url: URL,
	method: string,
	canonicalHost: string | undefined
): { location: string; status: 301 | 308 } | null {
	const target = canonicalHost?.trim().toLowerCase();
	if (!target) return null;
	const host = url.host.toLowerCase().split(':')[0];
	if (host === target) return null;
	const legacy = (LEGACY_PROBELOKAL_HOSTS as readonly string[]).includes(host);
	if (!legacy && host !== 'www.' + target) return null;
	const status = method === 'GET' || method === 'HEAD' ? 301 : 308;
	return { location: `https://${target}${url.pathname}${url.search}`, status };
}
