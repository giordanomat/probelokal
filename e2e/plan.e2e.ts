import { expect, test } from '@playwright/test';
import { addDays, todayInZurich } from '../src/lib/plan/dates';
import { FakeSupabase } from './fake-supabase';

// Gesamtplan und »Mein Plan« gegen den Supabase-Nachbau (e2e/fake-supabase.ts). Der Plan beginnt
// drei Wochen vor heute, damit Etappen überfällig sind, egal an welchem Tag der Test läuft.

test('Leitung legt den Gesamtplan an, Mitglied sieht ihn und seinen Stand', async ({
	page,
	browser,
	baseURL
}) => {
	const fake = await FakeSupabase.create();
	await fake.attach(page.context());
	const start = addDays(todayInZurich(), -21);
	const perf = addDays(start, 112);

	await fake.signIn(page, 'lea@test.ch');
	await page.getByLabel('Name der Guugge').fill('Schuegu');
	await page.getByRole('button', { name: 'Anlegen' }).click();
	await expect(page).toHaveURL(/\/guugge\/[0-9a-f-]{36}$/);
	const guugge = page.url().split('/').at(-1)!;

	// Ohne Stimme: Hinweis; Gesamtplan noch leer, die Leitung sieht das Formular
	await page.getByRole('link', { name: 'Plan ansehen →' }).click();
	await expect(page.getByRole('heading', { name: 'Wähl zuerst deine Stimme.' })).toBeVisible();
	await page.getByRole('button', { name: 'Gesamtplan' }).click();
	await expect(page.getByRole('heading', { name: 'Plan anlegen' })).toBeVisible();

	// Unsinniger Plan wird abgewiesen
	await page.getByLabel('Start').fill(start);
	await page.getByLabel('Auftritt').fill(start);
	await page.getByRole('button', { name: 'Plan speichern' }).click();
	await expect(page.getByRole('alert')).toHaveText('Der Auftritt muss nach dem Start liegen.');

	await page.getByLabel('Auftritt').fill(perf);
	await page.getByLabel('Gesamtprobe').selectOption('Mittwoch');
	await page.getByLabel('Registerprobe').selectOption('Montag');
	await page.getByLabel('Einzeln üben pro Woche (Minuten)').fill('60');
	await page.getByRole('button', { name: 'Plan speichern' }).click();
	await expect(page.getByRole('status')).toHaveText(
		'Gespeichert. Alle in der Guugge sehen den Plan.'
	);
	await expect(page.getByRole('heading', { name: 'Meilensteine' })).toBeVisible();
	await expect(page.getByText(/^Auftrittsreif bis/)).toBeVisible();
	await expect(page.getByText('· diese Woche')).toBeVisible();
	await page.getByRole('button', { name: /^Alle \d+ Wochen zeigen$/ }).click();
	await expect(page.getByRole('heading', { name: /^Woche 1 · Lernen/ })).toBeVisible();

	// Mitglied: Trompete 1, sieht den Plan nur lesend und den eigenen Stand
	const [{ create_invite: token }] = await fake.db.as<{ create_invite: string }>(
		{ id: await fake.idOf('lea@test.ch') },
		`select create_invite($1)`,
		[guugge]
	);
	const toni = { id: await fake.idOf('toni@test.ch') };
	await fake.db.as(toni, `select accept_invite($1)`, [token]);
	await fake.db.as(toni, `select set_my_voice($1, 'trp1')`, [guugge]);

	const other = await browser.newContext({ baseURL });
	await fake.attach(other);
	const p2 = await other.newPage();
	await fake.signIn(p2, 'toni@test.ch');
	await p2.goto(`/guugge/${guugge}/plan`);
	await expect(p2.locator('.card .label').nth(1)).toHaveText('Trompete 1');
	await expect(p2.getByRole('heading', { name: /Etappen? hinterher$/ })).toBeVisible();
	const first = p2.getByRole('listitem').filter({ hasText: 'Teil A · Etappe 1: Gehört' });
	await expect(first).toContainText('überfällig seit');
	await expect(p2.getByText('0 % bis auftrittsreif')).toBeVisible();
	await p2.getByRole('button', { name: 'Gesamtplan' }).click();
	await expect(p2.getByRole('heading', { name: 'Meilensteine' })).toBeVisible();
	await expect(p2.getByRole('heading', { name: /Plan (anlegen|ändern)/ })).toHaveCount(0);
	await other.close();
});
