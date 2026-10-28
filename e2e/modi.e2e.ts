import { expect, test } from '@playwright/test';

// Übe-Modi in /ueben ohne Ton (ohne Testzugang läuft die Bahn mit der eigenen Uhr). Die Zeiten sind
// echt: Teil C (T. 13–16) dauert mit Anlauf gut 10 s, die ersten zwei Echo-Takte gut 6 s.

test('Rhythmus tippen: Rückmeldung, Durchgang in der Schleife, Tempo-Vorschlag, Baustellen', async ({
	page
}) => {
	test.setTimeout(45_000);
	const errors: string[] = [];
	page.on('pageerror', (e) => errors.push(e.message));
	await page.goto('/ueben');

	await page.getByRole('button', { name: 'Rhythmus tippen' }).click();
	await expect(page.getByTestId('modus-hinweis')).toContainText('Tippe bei jedem Ton');
	const tap = page.getByRole('button', { name: 'Tippen', exact: true });
	await expect(tap).toBeVisible();

	await page.getByLabel('Teil').selectOption({ label: 'Teil C · T. 13–16' });
	await page.getByRole('button', { name: 'Schleife' }).click();
	await page.getByRole('button', { name: 'Abspielen' }).click();

	// Im Anlauftakt kommt noch kein Ton
	await tap.click();
	await expect(page.getByTestId('tipp-rueckmeldung')).toHaveText('Da kommt kein Ton.');

	// Ohne weitere Tipps: alle 12 Töne verpasst, nach einem Durchgang langsamer vorschlagen
	const result = page.getByTestId('ergebnis');
	await expect(result).toContainText('Durchgang 1: 0 von 12 Einsätzen genau (0 %)', {
		timeout: 20_000
	});
	await page.getByRole('button', { name: 'Anhalten' }).click();
	await page.getByRole('button', { name: 'Langsamer: 90 %' }).click();
	await expect(page.getByLabel('Tempo')).toHaveValue('90');
	await expect(result).toHaveCount(0);

	// Wacklige Takte sind pro Titel und Stimme auf dem Gerät gespeichert
	const bau = await page.evaluate(() => localStorage.getItem('probelokal.bau.bad-touch-2-0.trp1'));
	expect(Object.keys(JSON.parse(bau ?? '{}'))).toEqual(['13', '14', '15', '16']);

	// Moduswechsel blendet das Tippen aus
	await page.getByRole('button', { name: 'Mitspielen' }).click();
	await expect(tap).toHaveCount(0);
	expect(errors).toEqual([]);
});

test('Echo: erst »Hör zu«, nach zwei Takten »Jetzt du«', async ({ page }) => {
	test.setTimeout(30_000);
	await page.goto('/ueben');
	await page.getByRole('button', { name: 'Echo' }).click();
	await expect(page.getByTestId('modus-hinweis')).toContainText('Zwei Takte vorhören');

	await page.getByRole('button', { name: 'Abspielen' }).click();
	const big = page.getByTestId('griff');
	await expect(big).toHaveText('Hör zu');
	// Echo springt nach den zwei Takten zurück an den Anfang (Teil A, Takt 1, mit Anlauf)
	await expect(big).toHaveText('Jetzt du', { timeout: 12_000 });
	const beat = Number(await page.locator('.lane canvas').getAttribute('data-beat'));
	expect(beat).toBeLessThan(4);
	await page.getByRole('button', { name: 'Anhalten' }).click();
});
