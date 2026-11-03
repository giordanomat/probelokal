import { readFileSync } from 'node:fs';
import { expect, test } from '@playwright/test';
import { fakeAudio } from './audio';
import { chooseView, chooseVoice, closeSheet, openMore } from './practice';

// Abnahme M1 »Flugmodus: Titel bleibt nach einmaligem Laden spielbar« – hier in Chromium mit
// synthetischem Audio. Ob Safari auf iPhone/iPad den Speicher behält, prüft das nicht.
const XML = readFileSync(new URL('../prototype/v7/badtouch.xml', import.meta.url));

test('Flugmodus: nach einmaligem Laden spielen Stimme und Noten ohne Netz', async ({
	page,
	context
}) => {
	test.setTimeout(60_000);
	const errors: string[] = [];
	page.on('pageerror', (e) => errors.push(e.message));
	await fakeAudio(page);
	await page.route('**/audio/**/score.musicxml', (route) =>
		route.fulfill({ status: 200, contentType: 'application/xml', body: XML })
	);

	await page.goto('/ueben');
	// »Gespeichert« steht im Blatt »Mehr«; Noten einmal öffnen, damit auch sie gespeichert werden
	await openMore(page);
	await expect(page.getByTestId('offline')).toBeVisible({ timeout: 15_000 });
	await page.getByRole('button', { name: 'Noten', exact: true }).click();
	await closeSheet(page);
	await expect(page.getByTestId('noten').locator('svg').first()).toBeVisible({ timeout: 20_000 });
	// Service Worker bereit; ein zweiter Besuch legt die Seite selbst in seinen Speicher
	await page.evaluate(() => navigator.serviceWorker.ready.then(() => true));
	await page.reload();
	await openMore(page);
	await expect(page.getByTestId('offline')).toBeVisible();
	await closeSheet(page);

	// Netz weg, auch keine abgefangenen Antworten mehr
	await page.unrouteAll();
	await context.setOffline(true);
	await page.reload();

	await expect(page.getByRole('heading', { level: 1, name: 'Bad Touch 2.0' })).toBeVisible();
	await openMore(page);
	await expect(page.getByTestId('offline')).toBeVisible();
	await closeSheet(page);
	await expect(page.getByTestId('ton-hinweis')).toHaveCount(0);
	const band = page.locator('audio[data-stem="band"]');
	await expect.poll(() => band.evaluate((el: HTMLAudioElement) => el.src)).toMatch(/^blob:/);
	await page.getByRole('button', { name: 'Abspielen' }).click();
	const t0 = await band.evaluate((el: HTMLAudioElement) => el.currentTime);
	await expect
		.poll(() => band.evaluate((el: HTMLAudioElement) => el.currentTime))
		.toBeGreaterThan(t0 + 0.5);
	await page.getByRole('button', { name: 'Anhalten' }).click();

	await chooseView(page, 'Noten');
	await expect(page.getByTestId('noten').locator('svg').first()).toBeVisible({ timeout: 20_000 });

	// Andere Stimme ist nicht gespeichert: ohne Netz kein Ton, die Bahn läuft weiter
	await chooseView(page, 'Bahn');
	await chooseVoice(page, 'Pos 1');
	await openMore(page);
	await expect(page.getByTestId('offline')).toHaveCount(0);
	await closeSheet(page);
	await expect(page.getByTestId('ton-hinweis')).toContainText('nicht erreichbar');

	await context.setOffline(false);
	expect(errors).toEqual([]);
});
