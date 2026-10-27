import { expect, test } from '@playwright/test';

const canvasBeat = (page: import('@playwright/test').Page) =>
	page.locator('.lane canvas').getAttribute('data-beat').then(Number);

test('Bahn: Stimme, Griff-Anzeige, Hilfen und Wiedergabe', async ({ page }) => {
	const errors: string[] = [];
	page.on('pageerror', (e) => errors.push(e.message));
	// Keine App-Startseite mehr (Landingpage unter /): Testpersonen bekommen den Link zu /ueben.
	await page.goto('/ueben');
	await expect(page.getByRole('heading', { level: 1, name: 'Bad Touch 2.0' })).toBeVisible();
	await expect(page.getByRole('figure', { name: /Bahn/ })).toBeVisible();

	// Start bei Teil A mit einem Takt Anlauf: Trompete 1 beginnt mit A und Griff 1 + 2
	await expect(page.getByTestId('griff')).toHaveText('1 + 2');
	expect(await canvasBeat(page)).toBeCloseTo(0, 1);

	// Posaune zeigt die Zugposition
	await page.getByRole('button', { name: 'Pos 1' }).click();
	await expect(page.getByTestId('griff')).toHaveText(/^Zug \d$/);

	// Hilfen: ohne Griffe steht der Notenname, auswendig nur der Hinweis
	const help = page.getByLabel('Hilfen');
	await help.selectOption('nogrip');
	await expect(page.getByTestId('griff')).not.toHaveText(/Zug/);
	await help.selectOption('memo');
	await expect(page.getByTestId('griff')).toHaveText('Spiel aus dem Kopf');

	// Einstellungen bleiben pro Gerät
	await page.reload();
	await expect(page.getByRole('button', { name: 'Pos 1' })).toHaveAttribute('aria-pressed', 'true');
	await expect(page.getByLabel('Hilfen')).toHaveValue('memo');

	// Wiedergabe läuft und hält an
	await page.getByRole('button', { name: 'Abspielen' }).click();
	await expect.poll(() => canvasBeat(page)).toBeGreaterThan(1);
	await page.getByRole('button', { name: 'Anhalten' }).click();
	const stopped = await canvasBeat(page);
	await page.waitForTimeout(300);
	expect(await canvasBeat(page)).toBe(stopped);

	// Teil wählen springt mit Anlauf (Teil C beginnt in Takt 13 → Bahn steht bei Takt 12)
	await page.getByLabel('Teil').selectOption({ label: 'Teil C · T. 13–16' });
	expect(await canvasBeat(page)).toBeCloseTo(48, 1);

	expect(errors).toEqual([]);
});
