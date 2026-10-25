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
