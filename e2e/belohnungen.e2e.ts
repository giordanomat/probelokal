import { expect, test } from '@playwright/test';
import { FakeSupabase } from './fake-supabase';

// Belohnungen der Ränge: Bahn-Looks (»Stück üben«), Schränz-Groove (»Einblasen«) und Abzeichen
// (Rangliste). Looks und Groove gelten mit dem höchsten Rang über alle Guuggen (my_best_points),
// gemerkt auf dem Gerät. Wie die Farben auf der Bahn aussehen, prüft nur der Blick aufs Gerät.

test('ohne Konto: Looks und Schränz-Groove gesperrt', async ({ page }) => {
	await page.goto('/ueben');
	const look = page.getByLabel('Bahn-Look');
	await expect(look).toHaveValue('std');
	await expect(look.locator('option[value=fasnacht]')).toHaveJSProperty('disabled', true);
	await expect(look.locator('option[value=fasnacht]')).toHaveText('Fasnacht (ab Level 2)');
	await expect(look.locator('option[value=gold]')).toHaveText('Gold (ab Level 4)');

	await page.goto('/einblasen');
	const groove = page.getByRole('button', { name: /Schränz-Groove/ });
	await expect(groove).toContainText('ab Level 3');
	await groove.click();
	await expect(
		page.getByText('Schränz-Groove wird mit Level 3 (Schränzer) freigeschaltet')
	).toBeVisible();
	await expect(page.locator('.tip h2')).toHaveText('Lange Töne');
});

test('mit Punkten: Look wählen, Schränz-Groove üben, Abzeichen in der Rangliste', async ({
	page
}) => {
	test.setTimeout(60_000);
	const fake = await FakeSupabase.create();
	await fake.attach(page.context());
	const lea = { id: await fake.idOf('lea@test.ch') };
	const [{ create_guugge: g }] = await fake.db.as<{ create_guugge: string }>(
		lea,
		`select create_guugge('Schuegu')`
	);
	const [{ create_guugge: other }] = await fake.db.as<{ create_guugge: string }>(
		lea,
		`select create_guugge('Zweite Guugge')`
	);
	const give = (guugge: string, points: number) =>
		fake.db.as(
			'service',
			`insert into points_ledger (user_id, guugge_id, points, reason) values ($1, $2, $3, 'Etappe')`,
			[lea.id, guugge, points]
		);
	// Schuegu: Level 3 (Schränzer); in der zweiten Guugge weniger, zählt nicht dazu
	await give(g, 260);
	await give(other, 120);
	await fake.signIn(page, 'lea@test.ch');

	await page.goto('/ueben');
	const look = page.getByLabel('Bahn-Look');
	await expect(look.locator('option[value=fasnacht]')).toHaveJSProperty('disabled', false);
	await expect(look.locator('option[value=gold]')).toHaveJSProperty('disabled', true);
	await look.selectOption('fasnacht');
	const canvas = page.locator('.lane canvas').first();
	await expect(canvas).toHaveAttribute('data-look', 'fasnacht');
	// Die Wahl bleibt auf dem Gerät
	await page.reload();
	await expect(page.getByLabel('Bahn-Look')).toHaveValue('fasnacht');

	await page.goto('/einblasen');
	await expect(page.locator('.lane canvas')).toHaveAttribute('data-look', 'fasnacht');
	const groove = page.getByRole('button', { name: 'Schränz-Groove' });
	await expect(groove).not.toContainText('ab Level');
	await groove.click();
	await expect(groove).toHaveAttribute('aria-pressed', 'true');
	await expect(page.locator('.tip h2')).toHaveText('Schränz-Groove');

	// Abzeichen ab Level 6
	await give(g, 1100);
	await page.goto(`/guugge/${g}/rangliste`);
	await expect(page.getByRole('heading', { name: 'Level 6 · Guuggen-Ass' })).toBeVisible();
	await expect(page.getByLabel('Abzeichen')).toHaveText('Guuggen-Ass');
	await page.getByLabel('Rangliste für die Guugge einschalten').check();
	await page.getByLabel('Ich mache mit').check();
	await expect(page.locator('ol.board li').first()).toContainText('DuGuuggen-Ass');

	// Abmelden: der gemerkte Rang gehört zum Konto
	await page.goto('/guugge');
	await page.getByRole('button', { name: 'Abmelden' }).click();
	await page.goto('/ueben');
	await expect(page.getByLabel('Bahn-Look')).toHaveValue('std');
	await expect(page.locator('.lane canvas').first()).toHaveAttribute('data-look', 'std');
});
