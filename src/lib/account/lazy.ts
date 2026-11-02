// Konto-Code und Supabase nur laden, wenn jemand angemeldet ist (Sitzung von supabase-js im
// Speicher des Browsers) oder eine Prüfung läuft; ohne Konto bleiben »Stück üben« und »Einblasen«
// schlank. Nur im Browser aufrufen.

import type { SupabaseClient } from '@supabase/supabase-js';

export type AccountApi = { api: typeof import('./api'); sb: SupabaseClient };

/** Lädt beim ersten Aufruf; null ohne Supabase oder ohne Sitzung. Pro Seite einmal anlegen. */
export function accountLoader(): () => Promise<AccountApi | null> {
	let loaded: Promise<AccountApi | null> | null = null;
	return () =>
		(loaded ??= (async () => {
			const [{ getSupabase }, api] = await Promise.all([
				import('../supabase/client'),
				import('./api')
			]);
			const sb = getSupabase();
			if (!sb || !(await sb.auth.getSession()).data.session) return null;
			return { api, sb };
		})());
}

/** Liegt eine Sitzung im Speicher? Billig, ohne supabase-js zu laden. */
export function maybeSignedIn(): boolean {
	try {
		return Object.keys(localStorage).some((k) => /^sb-.+-auth-token$/.test(k));
	} catch {
		return false;
	}
}
