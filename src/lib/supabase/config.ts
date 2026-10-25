// Verbindungsangaben für Supabase aus den öffentlichen Umgebungsvariablen.
//
// Beide Werte sind absichtlich öffentlich (sie stehen ohnehin im Browser): die Projekt-URL und der
// »publishable key«. Der Schutz der Daten liegt in den RLS-Regeln, nicht in diesem Schlüssel.
// Nie hierher gehören: secret key / service_role key, Datenbank-Passwort, Zugangstoken.

export type SupabaseConfig = { url: string; publishableKey: string };

export type PublicEnv = Record<string, string | undefined>;

/**
 * Liest und prüft die Angaben. Gibt null zurück, solange nichts eingerichtet ist (z. B. in CI oder
 * lokal ohne .env) – die App läuft dann ohne Konto-Funktionen weiter.
 * Wirft, wenn etwas eingerichtet, aber offensichtlich falsch ist – lieber früh als still falsch.
 */
export function readSupabaseConfig(env: PublicEnv): SupabaseConfig | null {
	const url = env.PUBLIC_SUPABASE_URL?.trim();
	const publishableKey = env.PUBLIC_SUPABASE_PUBLISHABLE_KEY?.trim();
	if (!url && !publishableKey) return null;
	if (!url || !publishableKey) {
		throw new Error(
			'Supabase: PUBLIC_SUPABASE_URL und PUBLIC_SUPABASE_PUBLISHABLE_KEY nur zusammen setzen.'
		);
	}
	let parsed: URL;
	try {
		parsed = new URL(url);
	} catch {
		throw new Error('Supabase: PUBLIC_SUPABASE_URL ist keine gültige Adresse.');
	}
	const local = parsed.hostname === 'localhost' || parsed.hostname === '127.0.0.1';
	if (parsed.protocol !== 'https:' && !local) {
		throw new Error('Supabase: PUBLIC_SUPABASE_URL muss mit https:// beginnen.');
	}
	// Schutz vor Verwechslung: geheime Schlüssel beginnen mit »sb_secret_«; alte service_role-JWTs
	// lassen sich ohne Dekodieren nicht sicher erkennen, deshalb nur der neue Präfix.
	if (publishableKey.startsWith('sb_secret_')) {
		throw new Error(
			'Supabase: Das ist ein geheimer Schlüssel. Hier gehört der publishable key hin.'
		);
	}
	return { url: parsed.origin, publishableKey };
}
