// Umgebungsvariablen (SvelteKit 3: definiert hier, gelesen über $app/env/public bzw. $app/env/private).
// Beide Supabase-Werte sind öffentlich und vorerst optional: ohne sie läuft die App ohne Konten.
// Ob sie zusammenpassen, prüft readSupabaseConfig() in src/lib/supabase/config.ts.
// Werte setzen: lokal in .env (Vorlage .env.example), online im Cloudflare-Worker (vars bzw. Secrets).
import { defineEnvVars } from '@sveltejs/kit/env';

const optional = (value: string | undefined) => value?.trim() || undefined;

export const variables = defineEnvVars({
	PUBLIC_SUPABASE_URL: {
		public: true,
		schema: optional,
		description: 'Supabase-Projekt-URL (Zürich), z. B. https://<ref>.supabase.co'
	},
	PUBLIC_SUPABASE_PUBLISHABLE_KEY: {
		public: true,
		schema: optional,
		description: 'Supabase publishable key (sb_publishable_…). Nie den secret key.'
	},
	// Geheim, nur auf dem Server: in Cloudflare als Secret, lokal in .dev.vars (nicht eingecheckt).
	SUPABASE_SECRET_KEY: {
		schema: optional,
		description:
			'Supabase secret key (sb_secret_…), nur für signierte Audio-Adressen. Nie ins Repository.'
	},
	TEST_ACCESS_CODE: {
		schema: optional,
		description: 'Code für den Testzugang (M1). Ohne Wert ist der Testzugang aus.'
	}
});
