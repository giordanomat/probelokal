import { readFileSync } from 'node:fs';
import { expect, test, type Page } from '@playwright/test';

// Notenansicht, Vollbild und Baustellen. Die MusicXML kommt im Produkt aus dem privaten Bucket
// (score.musicxml); hier liefert eine abgefangene Route die Datei aus dem Prototyp.
const XML = readFileSync(new URL('../prototype/v7/badtouch.xml', import.meta.url));

async function fakeScore(page: Page) {
	await page.route('**/audio/**/score.musicxml', (route) =>
		route.fulfill({ status: 200, contentType: 'application/xml', body: XML })
	);
}

const canvasBeat = (page: Page) =>
	page.locator('.lane canvas').getAttribute('data-beat').then(Number);

test('Noten: gewählte Stimme, aktueller Takt läuft mit, Antippen springt', async ({ page }) => {
	test.setTimeout(45_000);
	const errors: string[] = [];
	page.on('pageerror', (e) => errors.push(e.message));
	await fakeScore(page);
	await page.goto('/ueben');
	await page.getByRole('button', { name: 'Noten', exact: true }).click();
	const score = page.getByTestId('noten');
	await expect(score.locator('svg').first()).toBeVisible({ timeout: 20_000 });
	// Start bei Teil A mit Anlauf: markiert ist Takt 0
	await expect(score).toHaveAttribute('data-bar', '0');
	await expect(page.getByRole('figure', { name: /Bahn/ })).toHaveCount(0);

	await page.getByRole('button', { name: 'Abspielen' }).click();
	await expect(score).toHaveAttribute('data-bar', '1', { timeout: 6000 });
	await page.getByRole('button', { name: 'Anhalten' }).click();

	// Andere Stimme und ohne Griffe: neu gezeichnet, ohne Fehler
	await page.getByRole('button', { name: 'Pos 1' }).click();
	await page.getByLabel('Griffe und Zugpositionen').uncheck();
	await expect(score.locator('svg').first()).toBeVisible();

	// Antippen eines Takts springt dorthin (mit Anlauf: markiert ist der Takt davor)
	const box = await score.locator('.host').boundingBox();
	if (!box) throw new Error('keine Noten');
	await score.locator('.host').click({ position: { x: box.width * 0.5, y: 260 } });
	await expect(score).not.toHaveAttribute('data-bar', '1');

	// Zurück zur Bahn
	await page.getByRole('button', { name: 'Bahn', exact: true }).click();
	await expect(page.getByRole('figure', { name: /Bahn/ })).toBeVisible();
	expect(errors).toEqual([]);
});

test('Noten ohne Testzugang: Hinweis mit Weg zum Code', async ({ page }) => {
	await page.goto('/ueben');
	await page.getByRole('button', { name: 'Noten', exact: true }).click();
	await expect(page.getByTestId('noten-hinweis')).toContainText('Testzugang');
	await expect(page.getByTestId('noten-hinweis').getByRole('link')).toHaveAttribute(
		'href',
		'/zugang'
	);
});

test('Vollbild: nur Bahn und Wiedergabe, Esc beendet', async ({ page }) => {
	await page.goto('/ueben');
	const lane = page.locator('.lane canvas');
	const before = (await lane.boundingBox())?.height ?? 0;
	await page.getByRole('button', { name: 'Vollbild', exact: true }).click();
	await expect(page.locator('header.topbar')).toBeHidden();
	await expect(page.getByRole('group', { name: 'Stimme', exact: true })).toBeHidden();
	await expect(page.getByRole('button', { name: 'Abspielen' })).toBeVisible();
	await expect.poll(async () => (await lane.boundingBox())?.height ?? 0).toBeGreaterThan(before);
	await page.keyboard.press('Escape');
	await expect(page.locator('header.topbar')).toBeVisible();
	await page.getByRole('button', { name: 'Vollbild', exact: true }).click();
	await page.getByRole('button', { name: 'Vollbild beenden' }).click();
	await expect(page.getByRole('group', { name: 'Stimme', exact: true })).toBeVisible();
});

test('Baustellen: Liste, Üben bei 70 % in der Schleife, zurücksetzen', async ({ page }) => {
	await page.addInitScript(() => {
		if (!sessionStorage.getItem('gesetzt')) {
			sessionStorage.setItem('gesetzt', '1');
			localStorage.setItem(
				'probelokal.bau.bad-touch-2-0.trp1',
				JSON.stringify({ 13: { t: 4, b: 3 }, 20: { t: 4, b: 1 }, 30: { t: 1, b: 1 } })
			);
		}
	});
	await page.goto('/ueben');
	const items = page.locator('.bau li');
	// Takt 30 hat zu wenige Versuche
	await expect(items).toHaveCount(2);
	await expect(items.first()).toContainText('Takt 13–14');
	await expect(items.first()).toContainText('Teil C · 75 % der Töne wackeln (4 Versuche)');

	await items.first().getByRole('button', { name: 'Üben bei 70 %' }).click();
	await expect(page.getByLabel('Tempo')).toHaveValue('70');
	await expect(page.getByRole('button', { name: 'Schleife' })).toHaveAttribute(
		'aria-pressed',
		'true'
	);
	await expect(page.getByLabel('Teil')).toHaveValue('c');
	await expect(page.getByLabel('Teil').locator('option:checked')).toHaveText(
		'Baustelle · T. 13–14'
	);
	expect(await canvasBeat(page)).toBeCloseTo(48, 1);

	await page.getByRole('button', { name: 'Baustellen zurücksetzen' }).click();
	await expect(page.locator('.bau')).toContainText('Noch keine.');
	await page.reload();
	await expect(page.locator('.bau')).toContainText('Noch keine.');
});
