import { expect, test } from '@playwright/test';

// Die Landingpage erscheint unter jeder Adresse (Hauptadresse probelokal.ch).

// Ohne Grafikkarte rendert Headless-Chromium die 3D-Bühne in Software und blockiert dabei die Seite.
// Mit »weniger Bewegung« laufen keine Animationen; so bleiben die Formular-Tests stabil.
test.use({ reducedMotion: 'reduce' });

test('Startseite zeigt die Landingpage, nicht den früheren Platzhalter', async ({ page }) => {
	const errors: string[] = [];
	page.on('pageerror', (e) => errors.push(e.message));
	page.on('console', (m) => m.type() === 'error' && errors.push(m.text()));

	const res = await page.goto('/');
	expect(res?.status()).toBe(200);
	await expect(page).toHaveTitle('giordanomat ARRANGEMENTS');
	await expect(page.getByRole('img', { name: 'giordanomat PROBELOKAL' })).toHaveCount(0);
	await page.waitForTimeout(1500);
	expect(errors).toEqual([]);
});

test('unbekannte Pfade liefern 404', async ({ page }) => {
	const res = await page.goto('/irgendwas');
	expect(res?.status()).toBe(404);
});

test('Anmeldung schickt Adresse und Einwilligung an die Supabase-Funktion signup', async ({
	page
}) => {
	// Echte Datenbank nicht anfassen: Aufruf abfangen und prüfen, was die Seite schickt.
	let body: unknown = null;
	await page.route('**/rest/v1/rpc/signup', async (route) => {
		body = route.request().postDataJSON();
		await route.fulfill({ status: 204, body: '' });
	});
	await page.goto('/');
	const form = page.locator('#hero-form');
	await form.locator('input[name="email"]').fill('Test@Example.com');
	// Klicks hängen in Headless-Chromium an den Scroll-Animationen der Seite; deshalb direkt auslösen.
	await form
		.locator('input[name="consent"]')
		.evaluate((el: HTMLInputElement) => (el.checked = true));
	await form.evaluate((f: HTMLFormElement) => f.requestSubmit());
	await expect(form.locator('.msg')).toContainText('Danke');
	expect(body).toEqual({
		p_email: 'test@example.com',
		p_consent: true,
		p_source: 'localhost'
	});
});

test('Anmeldung ohne Häkchen wird nicht verschickt', async ({ page }) => {
	let called = false;
	await page.route('**/rest/v1/rpc/signup', async (route) => {
		called = true;
		await route.fulfill({ status: 204, body: '' });
	});
	await page.goto('/');
	const form = page.locator('#hero-form');
	await form.locator('input[name="email"]').fill('test@example.com');
	await form.evaluate((f: HTMLFormElement) => f.requestSubmit());
	await expect(form.locator('.msg')).toContainText('Häkchen');
	expect(called).toBe(false);
});
