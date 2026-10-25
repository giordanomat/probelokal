import { expect, test } from '@playwright/test';

// Chromium löst *.localhost auf 127.0.0.1 auf; so lässt sich der Shop-Hostname lokal prüfen.
const SHOP = 'http://arrangements.localhost:4173';

test('arrangements-Adresse zeigt die Landingpage, nicht das Probelokal', async ({ page }) => {
	const errors: string[] = [];
	page.on('pageerror', (e) => errors.push(e.message));
	page.on('console', (m) => m.type() === 'error' && errors.push(m.text()));

	const res = await page.goto(SHOP + '/');
	expect(res?.status()).toBe(200);
	await expect(page).toHaveTitle('giordanomat ARRANGEMENTS');
	await expect(page.getByRole('img', { name: 'giordanomat PROBELOKAL' })).toHaveCount(0);
	await page.waitForTimeout(1500);
	expect(errors).toEqual([]);
});

test('arrangements-Adresse liefert für unbekannte Pfade 404', async ({ page }) => {
	const res = await page.goto(SHOP + '/irgendwas');
	expect(res?.status()).toBe(404);
});

test('Probelokal bleibt unter der normalen Adresse', async ({ page }) => {
	await page.goto('/');
	await expect(page.getByRole('img', { name: 'giordanomat PROBELOKAL' })).toBeVisible();
});
