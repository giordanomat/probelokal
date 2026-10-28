// Vorabprüfung, ob der Ton geladen werden darf und bereitliegt. Das <audio>-Element verrät bei
// einem Fehler den HTTP-Status nicht; deshalb einmal per fetch nachfragen, ohne der Weiterleitung
// zu folgen (keine Daten laden, nur die Antwort von /audio/… lesen).

/** ok: Weiterleitung auf die signierte Adresse; locked: Testzugang fehlt; missing: Datei liegt
 * nicht im Storage; unavailable: Storage nicht eingerichtet oder nicht erreichbar. */
export type AudioStatus = 'ok' | 'locked' | 'missing' | 'unavailable';

/** Pfad wie in src/routes/audio/[slug]/[version]/[file]. */
export function audioUrl(slug: string, version: string, file: string): string {
	return `/audio/${slug}/${version.toLowerCase()}/${file}`;
}

/** Band ohne mich (Minus-One) und eigene Stimme, Dateinamen wie in docs/06. */
export function stemUrls(
	title: { slug: string; version: string },
	voiceId: string
): { band: string; own: string } {
	return {
		band: audioUrl(title.slug, title.version, `minus_${voiceId}.mp3`),
		own: audioUrl(title.slug, title.version, `${voiceId}.mp3`)
	};
}

/** Status aus der Antwort; mit redirect: 'manual' ist die Weiterleitung eine »opaqueredirect«. */
export function audioStatusOf(res: Pick<Response, 'type' | 'status' | 'ok'>): AudioStatus {
	if (res.type === 'opaqueredirect' || res.ok) return 'ok';
	if (res.status === 401) return 'locked';
	if (res.status === 404) return 'missing';
	return 'unavailable';
}

export async function probeAudio(url: string, f: typeof fetch = fetch): Promise<AudioStatus> {
	try {
		const res = await f(url, { redirect: 'manual', credentials: 'same-origin' });
		return audioStatusOf(res);
	} catch {
		return 'unavailable';
	}
}

/** Hinweis über der Bahn, wenn der Ton fehlt. */
export const AUDIO_NOTICE: Record<Exclude<AudioStatus, 'ok'>, string> = {
	locked: 'Für den Ton brauchst du den Testzugang.',
	missing: 'Die Aufnahmen sind noch nicht hochgeladen. Die Bahn läuft ohne Ton.',
	unavailable: 'Der Ton ist gerade nicht erreichbar. Die Bahn läuft ohne Ton.'
};
