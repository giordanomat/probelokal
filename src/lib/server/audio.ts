// Audio des Testtitels aus dem privaten Storage-Bucket: Pfad prüfen, signierte Adresse holen.
// Ablage wie in docs/06-produktionsstrecke.md: Bucket `titles`, Pfad <slug>/<fassung>/<datei>.
// Dateien je Stimme: minus_<id>.mp3 (Band ohne mich), <id>.mp3 (eigene Stimme), dazu all.mp3 und
// die MusicXML für die Notenansicht (score.musicxml). Die Noten liegen bewusst ebenfalls hinter dem
// Testzugang und nicht offen im App-Bundle: Sie sind das, was verkauft wird.

import { createClient } from '@supabase/supabase-js';
import type { Title } from '../music/types';

export const AUDIO_BUCKET = 'titles';
/** Gültigkeit der signierten Adresse. Lang genug für eine Übe-Sitzung mit Springen. */
export const SIGNED_URL_SECONDS = 6 * 60 * 60;
/** MusicXML eines Titels im Bucket (Notenansicht) */
export const SCORE_FILE = 'score.musicxml';

/** Erlaubte Dateinamen eines Titels; alles andere ist 404 (kein freies Durchreichen von Pfaden). */
export function audioFiles(title: Pick<Title, 'voices'>): Set<string> {
	const files = new Set(['all.mp3', SCORE_FILE]);
	for (const v of title.voices) {
		files.add(`minus_${v.id}.mp3`);
		files.add(`${v.id}.mp3`);
	}
	return files;
}

/** Storage-Pfad, oder null wenn Titel, Fassung oder Datei nicht passen. */
export function audioPath(
	title: Pick<Title, 'slug' | 'version' | 'voices'>,
	slug: string,
	version: string,
	file: string
): string | null {
	if (slug !== title.slug || version.toLowerCase() !== title.version.toLowerCase()) return null;
	if (!audioFiles(title).has(file)) return null;
	return `${title.slug}/${title.version.toLowerCase()}/${file}`;
}

export interface StorageAccess {
	url: string;
	secretKey: string;
	fetch?: typeof fetch;
}

/** Die Datei ist erlaubt, liegt aber (noch) nicht im Bucket. */
export class AudioMissingError extends Error {}

/**
 * Signierte, zeitlich begrenzte Adresse für eine Datei im privaten Bucket.
 * Ungeprüft gegen das echte Projekt (braucht Bucket und Secret) – prüfen nach dem ersten Upload.
 * Fehlt die Datei, antwortet Storage mit »Object not found« (so in storage-js dokumentiert;
 * gegen das echte Projekt ebenfalls ungeprüft) → AudioMissingError.
 */
export async function signedAudioUrl(access: StorageAccess, path: string): Promise<string> {
	const supabase = createClient(access.url, access.secretKey, {
		auth: { persistSession: false, autoRefreshToken: false },
		global: access.fetch ? { fetch: access.fetch } : undefined
	});
	const { data, error } = await supabase.storage
		.from(AUDIO_BUCKET)
		.createSignedUrl(path, SIGNED_URL_SECONDS);
	if (error && /not.?found/i.test(error.message)) throw new AudioMissingError(path);
	if (error || !data?.signedUrl)
		throw new Error('Signieren fehlgeschlagen: ' + (error?.message ?? 'leer'));
	return data.signedUrl;
}
