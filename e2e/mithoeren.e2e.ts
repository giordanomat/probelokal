import { expect, test } from '@playwright/test';
import { fakeAudio } from './audio';

// Mithören mit künstlichem Mikrofon (Chromium spielt ein WAV ab, siehe e2e/global-setup.ts):
// Sägezahn auf klingendem G4, für Trompete notiert A4 (MIDI 69). Echte Bläser, Handymikrofone und
// Hall prüft das nicht; das bleibt der Gerätetest der Abnahme von M1.

test('Mikrofon: gehörter Ton, Rückmeldung, Bewertung in der Schleife, eigene Stimme stumm', async ({
	page
}) => {
	test.setTimeout(45_000);
	const errors: string[] = [];
	page.on('pageerror', (e) => errors.push(e.message));
	await page.goto('/ueben');
	await expect(page.getByTestId('verzoegerung')).toContainText('geschätzt');

	await page.getByRole('button', { name: 'Mithören' }).click();
	const box = page.getByTestId('mithoeren');
	await expect(box).toBeVisible();
	await expect(box).toContainText('Ich höre zu');
	// Schon vor dem Abspielen: gehört wird notiert A4
	await expect(box).toHaveAttribute('data-heard', '69');

	// Mithören und Rhythmus tippen schliessen sich aus
	await expect(page.getByRole('button', { name: 'Rhythmus tippen' })).toBeEnabled();

	await page.getByLabel('Teil').selectOption({ label: 'Teil C · T. 13–16' });
	await page.getByRole('button', { name: 'Schleife' }).click();
	await page.getByRole('button', { name: 'Abspielen' }).click();
	// Die Rückmeldung wechselt auf eine Bewertung oder »Pause. Atmen.«
	await expect(box.locator('.say')).not.toContainText('Ich höre zu', { timeout: 8000 });
	await expect(page.getByTestId('ergebnis')).toContainText(
		/Durchgang 1: \d+ von 12 Tönen getroffen/,
		{ timeout: 20_000 }
	);
	await page.getByRole('button', { name: 'Anhalten' }).click();

	// Ausschalten
	await page.getByRole('button', { name: 'Mithören' }).click();
	await expect(box).toHaveCount(0);
	expect(errors).toEqual([]);
});

test('Vorführung: die eigene Spur wird bewertet', async ({ page }) => {
	const errors: string[] = [];
	page.on('pageerror', (e) => errors.push(e.message));
	await fakeAudio(page);
	await page.goto('/ueben');
	const demo = page.getByRole('button', { name: 'Vorführung mit Aufnahme' });
	await expect(demo).toBeEnabled();
	await demo.click();
	// Vorführung startet die Wiedergabe selbst
	await expect(page.getByRole('button', { name: 'Anhalten' })).toBeVisible();
	const box = page.getByTestId('mithoeren');
	// eigene Spur klingt 440 Hz = A4, für Trompete notiert H4 (MIDI 71)
	await expect(box).toHaveAttribute('data-heard', '71', { timeout: 8000 });
	await expect(page.getByRole('button', { name: 'Vorführung beenden' })).toBeVisible();
	await page.getByRole('button', { name: 'Vorführung beenden' }).click();
	await expect(box).toHaveCount(0);
	expect(errors).toEqual([]);
});

test('ohne Mikrofon-Freigabe: verständliche Meldung', async ({ browser }) => {
	const context = await browser.newContext({ permissions: [] });
	const page = await context.newPage();
	await page.addInitScript(() => {
		navigator.mediaDevices.getUserMedia = () =>
			Promise.reject(new DOMException('nein', 'NotAllowedError'));
	});
	await page.goto('/ueben');
	await page.getByRole('button', { name: 'Mithören' }).click();
	await expect(page.getByRole('button', { name: 'Mithören' })).toHaveAttribute(
		'aria-pressed',
		'false'
	);
	await expect(page.getByRole('alert')).toHaveText(/Mikrofon ist gesperrt/);
	await context.close();
});
