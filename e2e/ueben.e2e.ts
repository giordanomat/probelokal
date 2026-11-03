import { expect, test } from '@playwright/test';
import { chooseVoice, closeSheet, openMore } from './practice';

const canvasBeat = (page: import('@playwright/test').Page) =>
	page.locator('.lane canvas').getAttribute('data-beat').then(Number);

test('Bahn: Stimme, Griff, Hilfen und Wiedergabe', async ({ page }) => {
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
	await chooseVoice(page, 'Pos 1');
	await expect(page.getByRole('button', { name: /^Stimme:/ })).toHaveText(/Pos 1/);
	await expect(page.getByTestId('griff')).toHaveText(/^Zug \d$/);

	// Hilfen (im Blatt »Mehr«): ohne Griffe steht der Notenname, auswendig nur der Hinweis
	await openMore(page);
	const help = page.getByLabel('Hilfen');
	await help.selectOption('nogrip');
	await expect(page.getByTestId('griff')).not.toHaveText(/Zug/);
	await help.selectOption('memo');
	await expect(page.getByTestId('griff')).toHaveText('Spiel aus dem Kopf');
	await closeSheet(page);

	// Einstellungen bleiben pro Gerät
	await page.reload();
	await expect(page.getByRole('button', { name: /^Stimme:/ })).toHaveText(/Pos 1/);
	await openMore(page);
	await expect(page.getByLabel('Hilfen')).toHaveValue('memo');
	await closeSheet(page);

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

test('Aufbau: hochkant untereinander, quer die Bedienung rechts, nichts zum Scrollen', async ({
	page
}) => {
	// iPhone hochkant und quer, iPad quer
	for (const [w, h] of [
		[390, 844],
		[844, 390],
		[1180, 820]
	]) {
		await page.setViewportSize({ width: w, height: h });
		await page.goto('/ueben');
		// boundingBox wartet nicht: erst warten, bis beides da ist
		await expect(page.locator('.lane canvas')).toBeVisible();
		await expect(page.getByRole('button', { name: 'Abspielen' })).toBeVisible();
		const lane = await page.locator('.lane').boundingBox();
		const play = await page.getByRole('button', { name: 'Abspielen' }).boundingBox();
		if (!lane || !play) throw new Error('Bahn oder Abspielen fehlt');
		const size = `${w}×${h}`;
		expect(
			await page.evaluate(() => document.documentElement.scrollHeight),
			size
		).toBeLessThanOrEqual(h);
		expect(play.y + play.height, size).toBeLessThanOrEqual(h);
		if (w > h) {
			expect(play.x, size).toBeGreaterThan(lane.x + lane.width);
			expect(lane.height, size).toBeGreaterThan(h * 0.85);
		} else {
			expect(play.y, size).toBeGreaterThan(lane.y + lane.height);
			expect(lane.height, size).toBeGreaterThan(h * 0.45);
		}
	}
});

test('Link aus der Guugge gibt die Stimme mit', async ({ page }) => {
	await page.goto('/ueben?stimme=pos1');
	await expect(page.getByRole('button', { name: /^Stimme:/ })).toHaveText(/Pos 1/);
	await expect(page.getByTestId('griff')).toHaveText(/^Zug \d$/);
	// Unbekannte Stimme: bleibt bei der gespeicherten
	await page.goto('/ueben?stimme=tuba');
	await expect(page.getByRole('button', { name: /^Stimme:/ })).toHaveText(/Pos 1/);
});
