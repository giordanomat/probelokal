import { readFileSync } from 'node:fs';
import { expect, test } from '@playwright/test';
import { FakeSupabase } from './fake-supabase';

// Hinweise der Leitung gegen den Supabase-Nachbau: eintragen, für wen sie gelten, »neu« bis
// gelesen, »Hinhören« springt in »Stück üben« an die Stelle, Bahn und Noten zeigen sie.
// Die MusicXML liefert wie in noten.e2e.ts eine abgefangene Route aus dem Prototyp.
const XML = readFileSync(new URL('../prototype/v7/badtouch.xml', import.meta.url));

test('Leitung trägt einen Hinweis ein, Trompete sieht ihn neu, hört hin, Bahn und Noten zeigen ihn', async ({
	page,
	browser,
	baseURL
}) => {
	const fake = await FakeSupabase.create();
	await fake.attach(page.context());
	const lea = { id: await fake.idOf('lea@test.ch') };
	const [{ create_guugge: g }] = await fake.db.as<{ create_guugge: string }>(
		lea,
		`select create_guugge('Schuegu')`
	);
	const [{ create_invite: token }] = await fake.db.as<{ create_invite: string }>(
		lea,
		`select create_invite($1)`,
		[g]
	);
	const toni = { id: await fake.idOf('toni@test.ch') };
	await fake.db.as(toni, `select accept_invite($1)`, [token]);
	await fake.db.as(toni, `select set_my_voice($1, 'trp1')`, [g]);
	// Ein Hinweis nur für die Posaunen
	await fake.db.as(lea, `select add_hint($1, 'bad-touch-2-0', 17, 20, 'pos', 'atem', null, null)`, [
		g
	]);

	// Leitung trägt Dynamik für die Trompeten ein
	await fake.signIn(page, 'lea@test.ch');
	await page.goto(`/guugge/${g}`);
	await page.getByRole('link', { name: 'Hinweise ansehen →' }).click();
	await page.getByLabel('Ab Takt').fill('9');
	await page.getByLabel('Bis Takt').fill('12');
	await page.getByLabel('Für').selectOption('Trompeten');
	await page.getByLabel('Art').selectOption('Dynamik');
	await page.getByLabel('Stärke').selectOption('pp');
	await page.getByLabel('Text (freiwillig)').fill('Trompeten zurück');
	await page.getByRole('button', { name: 'Hinweis speichern' }).click();
	await expect(page.getByRole('status')).toContainText('Gespeichert.');
	const list = page.locator('ul.list');
	await expect(list.getByRole('listitem')).toHaveCount(2);
	await expect(list).toContainText('T. 9–12 · pp');
	await expect(list).toContainText('Trompeten · pp – sehr leise. Trompeten zurück');
	await expect(list).not.toContainText('neu');

	// Trompete: ein neuer Hinweis (der für die Posaunen zählt nicht)
	const other = await browser.newContext({ baseURL });
	await fake.attach(other);
	const p2 = await other.newPage();
	await p2.route('**/audio/**/score.musicxml', (route) =>
		route.fulfill({ status: 200, contentType: 'application/xml', body: XML })
	);
	await fake.signIn(p2, 'toni@test.ch');
	await p2.goto(`/guugge/${g}`);
	await expect(p2.getByRole('heading', { name: /Hinweise der Leitung\s*1 neu/ })).toBeVisible();
	await p2.getByRole('link', { name: 'Hinweise ansehen →' }).click();
	const mine = p2.locator('ul.list');
	await expect(mine.getByRole('listitem')).toHaveCount(1);
	await expect(mine).toContainText('neu');
	await p2.getByRole('button', { name: 'Alle', exact: true }).click();
	await expect(mine.getByRole('listitem')).toHaveCount(2);
	await expect(p2.getByRole('button', { name: 'Löschen' })).toHaveCount(0);
	await p2.getByRole('button', { name: 'Für Trompete 1' }).click();

	// Hinhören: »Stück üben« an Takt 9 (ein Takt Anlauf), die Bahn zeigt den Hinweis
	await mine.getByRole('link', { name: 'Hinhören' }).click();
	await expect(p2).toHaveURL(/\/ueben\?takt=9$/);
	await expect(p2.locator('.transport .pos')).toContainText('Takt 8');
	await expect(p2.locator('.transport .pos')).toContainText('Teil B');
	await expect(p2.locator('.lane canvas')).toHaveAttribute('data-hints', '1');
	// Notenansicht: dasselbe Band über den Takten, Text nur einmal
	await p2.getByRole('button', { name: 'Noten', exact: true }).click();
	const score = p2.getByTestId('noten');
	await expect(score.locator('svg').first()).toBeVisible({ timeout: 20_000 });
	await expect(score.getByTestId('noten-band')).toHaveText('pp');
	await p2.getByRole('button', { name: 'Bahn', exact: true }).click();
	// Andere Stimme gewählt: der Trompeten-Hinweis gilt nicht mehr
	await p2.getByRole('button', { name: 'Pos 1' }).click();
	await expect(p2.locator('.lane canvas')).toHaveAttribute('data-hints', '1');
	await p2.getByRole('button', { name: 'Euph' }).click();
	await expect(p2.locator('.lane canvas')).toHaveAttribute('data-hints', '0');

	// Gelesen
	await p2.goto(`/guugge/${g}/hinweise`);
	await expect(p2.locator('ul.list')).not.toContainText('neu');
	await other.close();

	// Leitung löscht den Posaunen-Hinweis
	page.once('dialog', (d) => d.accept());
	await page.getByRole('button', { name: 'Hinweis T. 17–20 löschen' }).click();
	await expect(page.getByRole('status')).toHaveText('Hinweis gelöscht.');
	await expect(list.getByRole('listitem')).toHaveCount(1);
});

test('ohne Neuladen: neuer und gelöschter Hinweis erscheinen bei der Trompete sofort', async ({
	page,
	browser,
	baseURL
}) => {
	test.setTimeout(60_000);
	const fake = await FakeSupabase.create();
	await fake.attach(page.context());
	const lea = { id: await fake.idOf('lea@test.ch') };
	const [{ create_guugge: g }] = await fake.db.as<{ create_guugge: string }>(
		lea,
		`select create_guugge('Schuegu')`
	);
	const [{ create_invite: token }] = await fake.db.as<{ create_invite: string }>(
		lea,
		`select create_invite($1)`,
		[g]
	);
	const toni = { id: await fake.idOf('toni@test.ch') };
	await fake.db.as(toni, `select accept_invite($1)`, [token]);
	await fake.db.as(toni, `select set_my_voice($1, 'trp1')`, [g]);

	// Trompete hat Hinweis-Seite und »Stück üben« offen
	const other = await browser.newContext({ baseURL });
	await fake.attach(other);
	const list = await other.newPage();
	await fake.signIn(list, 'toni@test.ch');
	await list.goto(`/guugge/${g}/hinweise`);
	await expect(list.getByText('Noch keine Hinweise für Trompete 1.')).toBeVisible();
	const lane = await other.newPage();
	await lane.goto('/ueben');
	await expect(lane.locator('.lane canvas')).toHaveAttribute('data-hints', '0');

	// Leitung trägt ein
	await fake.signIn(page, 'lea@test.ch');
	await page.goto(`/guugge/${g}/hinweise`);
	await page.getByLabel('Ab Takt').fill('13');
	await page.getByLabel('Bis Takt').fill('16');
	await page.getByLabel('Art').selectOption('Atmen');
	await page.getByRole('button', { name: 'Hinweis speichern' }).click();
	await expect(page.getByRole('status')).toContainText('Gespeichert.');

	await expect(list.locator('ul.list li')).toHaveCount(1);
	await expect(list.locator('ul.list')).toContainText('T. 13–16');
	await expect(list.locator('ul.list')).toContainText('neu');
	await expect(lane.locator('.lane canvas')).toHaveAttribute('data-hints', '1');

	// Leitung löscht
	page.once('dialog', (d) => d.accept());
	await page.getByRole('button', { name: 'Hinweis T. 13–16 löschen' }).click();
	await expect(page.getByRole('status')).toHaveText('Hinweis gelöscht.');
	await expect(list.getByText('Noch keine Hinweise für Trompete 1.')).toBeVisible();
	await expect(lane.locator('.lane canvas')).toHaveAttribute('data-hints', '0');
	await other.close();
});
