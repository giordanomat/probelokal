import { defineConfig, devices } from '@playwright/test';

// Abläufe im Browser. Lokal: npm run test:e2e (baut und startet die Cloudflare-Vorschau auf Port 4173).
// WebKit (Safari) fehlt hier bewusst: Für iPhone/iPad zählen echte Geräte (Testprotokoll, siehe Roadmap).
export default defineConfig({
	testDir: 'e2e',
	testMatch: '**/*.e2e.ts',
	forbidOnly: !!process.env.CI,
	retries: process.env.CI ? 1 : 0,
	reporter: process.env.CI ? [['github'], ['list']] : 'list',
	// Testzugang mit festem Code für die Abläufe; ohne Supabase-Schlüssel (Audio antwortet dann 503).
	webServer: {
		command: 'npm run build && npm run preview -- --var TEST_ACCESS_CODE:e2e-zugang',
		port: 4173,
		timeout: 180_000
	},
	use: { baseURL: 'http://localhost:4173' },
	projects: [
		{ name: 'desktop', use: { ...devices['Desktop Chrome'] } },
		{ name: 'handy', use: { ...devices['Pixel 7'] } }
	]
});
