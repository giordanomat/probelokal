import { expect, test } from '@playwright/test';

const AUDIO = '/audio/bad-touch-2-0/schuegu27/minus_trp1.mp3';

test('Audio nur mit Testzugang', async ({ page, request }) => {
	// ohne Cookie: gesperrt
	expect((await request.get(AUDIO, { maxRedirects: 0 })).status()).toBe(401);

	await page.goto('/zugang');
	await expect(page.getByRole('heading', { name: /Code/ })).toBeVisible();

	// falscher Code
	await page.getByLabel('Code').fill('falsch');
	await page.getByRole('button', { name: 'Freischalten' }).click();
	await expect(page.getByRole('alert')).toHaveText(/stimmt nicht/);

	// richtiger Code, Gross-/Kleinschreibung egal → weiter zum Üben
	await page.getByLabel('Code').fill(' E2E-Zugang ');
	await page.getByRole('button', { name: 'Freischalten' }).click();
	await expect(page).toHaveURL(/\/ueben$/);

	// mit Cookie: erlaubt, aber ohne Supabase-Schlüssel noch nicht eingerichtet
	const ok = await page.request.get(AUDIO, { maxRedirects: 0 });
	expect(ok.status()).toBe(503);
	// unbekannte Datei bleibt 404, auch mit Zugang
	const bad = await page.request.get('/audio/bad-touch-2-0/schuegu27/perc.wav', {
		maxRedirects: 0
	});
	expect(bad.status()).toBe(404);

	await page.goto('/zugang');
	await expect(page.getByText('Dein Gerät hat schon Zugang.')).toBeVisible();
});
