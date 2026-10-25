// Ein gemeinsamer Supabase-Client für den Browser. Wird erst ab M2 (Konten) gebraucht.
// Ungeprüft gegen ein echtes Projekt: Die Werte fehlen noch (siehe .env.example).
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { PUBLIC_SUPABASE_PUBLISHABLE_KEY, PUBLIC_SUPABASE_URL } from '$app/env/public';
import { readSupabaseConfig } from './config';

let client: SupabaseClient | null | undefined;

/** Gibt den Client zurück oder null, wenn Supabase (noch) nicht eingerichtet ist. */
export function getSupabase(): SupabaseClient | null {
	if (client !== undefined) return client;
	const config = readSupabaseConfig({ PUBLIC_SUPABASE_URL, PUBLIC_SUPABASE_PUBLISHABLE_KEY });
	client = config ? createClient(config.url, config.publishableKey) : null;
	return client;
}
