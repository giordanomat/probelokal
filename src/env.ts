// Umgebungsvariablen (SvelteKit 3: definiert hier, gelesen über $app/env/public bzw. $app/env/private).
// Beide Supabase-Werte sind öffentlich und vorerst optional: ohne sie läuft die App ohne Konten.
// Ob sie zusammenpassen, prüft readSupabaseConfig() in src/lib/supabase/config.ts.
// Werte setzen: lokal in .env (Vorlage .env.example), online in Cloudflare Pages.
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
	}
});
