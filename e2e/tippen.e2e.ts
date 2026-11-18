import { expect, test, type Page } from '@playwright/test';
import { fakeAudio } from './audio';
import { closeSheet, openMore, ready } from './practice';

// Tippen abgleichen (Entwurf Matthias 18.11.2026). Die Klicks laufen über Web Audio im Browser;
// »getippt« wird hier von einem Skript in der Seite, sobald der Zähler weiterspringt (also kurz
// nach jedem Klick). Echte Finger auf echten Geräten prüft das nicht.

async function tapAlong(page: Page) {
	await page.evaluate(
		() =>
			new Promise<void>((done) => {
				const pad = document.querySelector('[data-testid="tippen-feld"]')!;
				let last = '';
				const check = () => {
					const t = pad.textContent ?? '';
					if (t.includes('von 12') && t !== last) {
						last = t;
						pad.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true }));
					}
					if (document.querySelector('dialog[open] [role="status"]')) done();
					else requestAnimationFrame(check);
				};
				requestAnimationFrame(check);
			})
	);
}

test('Tippen abgleichen: Hinweis im Rhythmus, mittippen, Wert bleibt; ohne Tipps nochmals', async ({
	page
}) => {
	test.setTimeout(60_000);
	await fakeAudio(page);
	await page.goto('/ueben');
	await ready(page);

	// Reiter Rhythmus: Hinweis, solange nicht abgeglichen
	await page.getByRole('button', { name: 'Rhythmus', exact: true }).click();
	await expect(page.getByTestId('tippen-hinweis')).toBeVisible();

	// Ohne Tipps: zu wenige
	await openMore(page);
	await page.getByRole('button', { name: 'Tippen abgleichen' }).click();
	const sheet = page.getByRole('dialog', { name: 'Tippen abgleichen' });
	await expect(sheet.getByRole('heading', { name: 'Tippe mit dem Klick' })).toBeVisible();
	await expect(sheet.getByRole('status')).toContainText('Zu wenige Tipps erkannt.', {
		timeout: 15_000
	});

	// Nochmals, jetzt im Takt
	await sheet.getByRole('button', { name: 'Nochmals' }).click();
	await tapAlong(page);
	await expect(sheet.getByRole('heading')).toHaveText(
		/^Du tippst (\d+ ms (nach|vor) dem Klick|genau auf den Klick)\.$/
	);
	const saved = await page.evaluate(() => Number(localStorage.getItem('probelokal.tippen')));
	expect(Math.abs(saved)).toBeLessThan(0.1);
	await sheet.getByRole('button', { name: 'Fertig' }).last().click();
	await expect(sheet).toBeHidden();

	// Nach dem Neuladen noch da
	await page.reload();
	await ready(page);
	await openMore(page);
	await expect(page.getByTestId('tippen-stand')).toContainText(
		'Wird beim Rhythmus herausgerechnet.'
	);
	await closeSheet(page);
	await page.getByRole('button', { name: 'Rhythmus', exact: true }).click();
	await expect(page.getByTestId('modus-hinweis')).toBeVisible();
	await expect(page.getByTestId('tippen-hinweis')).toHaveCount(0);
});
