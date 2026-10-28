import { expect, test } from '@playwright/test';

// Einblasen: Navigation, Vorspielen/Nachspielen und Bewertung mit dem künstlichen Mikrofon
// (klingendes G4 = notiert A4 für Trompete, siehe e2e/global-setup.ts). Tonleiter-Häppchen
// Einstieg bei ♩ 120: vier Runden, 13 Töne zum Nachspielen, gut 18 s.

test('Einblasen: Dirigent spielt vor, du spielst nach, Mithören bewertet nur dein Nachspielen', async ({
	page
}) => {
	test.setTimeout(60_000);
	const errors: string[] = [];
	page.on('pageerror', (e) => errors.push(e.message));
	await page.goto('/ueben');
	await page.getByRole('link', { name: 'Einblasen' }).click();
	await expect(page).toHaveURL(/\/einblasen$/);
	await expect(page.getByRole('heading', { level: 1 })).toHaveText(
		'Mit dem giordanomat-Dirigenten'
	);
	await expect(page.getByRole('link', { name: 'Einblasen' })).toHaveAttribute(
		'aria-current',
		'page'
	);

	// Lange Töne ist vorgewählt; Tipps passen zur Übung
	await expect(page.getByRole('button', { name: 'Lange Töne' })).toHaveAttribute(
		'aria-pressed',
		'true'
	);
	await expect(page.locator('.tip h2')).toHaveText('Lange Töne');

	await page.getByRole('button', { name: 'Tonleiter-Häppchen' }).click();
	await expect(page.locator('.tip h2')).toHaveText('Tonleiter-Häppchen');
	await page.getByLabel('Tempo').fill('120');
	await expect(page.locator('.transport output')).toHaveText('♩ 120');

	await page.getByRole('button', { name: 'Mithören' }).click();
	await expect(page.getByTestId('mithoeren')).toContainText('Ich höre zu');

	await page.getByRole('button', { name: 'Übung starten' }).click();
	const big = page.getByTestId('griff');
	await expect(big).toHaveText('Hör zu', { timeout: 5000 });
	await expect(big).toHaveText('Jetzt du', { timeout: 5000 });

	// Ganze Übung durch: 13 nachgespielte Töne bewertet (das Mikrofon hört nur ein A)
	await expect(page.getByTestId('ergebnis')).toContainText(
		/Geschafft: \d+ von 13 Tönen getroffen/,
		{ timeout: 30_000 }
	);
	await expect(big).toHaveText('Fertig');
	await expect(page.getByRole('button', { name: 'Übung starten' })).toBeVisible();
	expect(errors).toEqual([]);
});

test('Einblasen ohne Mithören: Stufe und Stimme wechseln, anhalten', async ({ page }) => {
	await page.goto('/einblasen');
	await page.getByRole('button', { name: 'Weiter' }).click();
	await page.getByRole('button', { name: 'Pos 1' }).click();
	await page.getByRole('button', { name: 'Übung starten' }).click();
	await expect(page.getByTestId('griff')).toHaveText('Hör zu', { timeout: 6000 });
	// Posaune: Zugposition in der Griff-Anzeige
	await page.getByRole('button', { name: 'Übung anhalten' }).click();
	await expect(page.getByRole('button', { name: 'Übung starten' })).toBeVisible();
	await expect(page.getByTestId('ergebnis')).toHaveCount(0);
});
