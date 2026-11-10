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
	await expect(p2.getByRole('link', { name: /^Stimme: Trp 1/ })).toBeVisible();
	await expect(p2.getByText(/Etappen? hinterher · 0 von \d+ Etappen$/)).toBeVisible();
	// Heute dran: die fälligste Etappe, überfällig, mit Prüfung und »Erst üben« am richtigen Teil
	const today = p2.getByTestId('heute');
	await expect(today.getByRole('heading')).toHaveText('Teil A · Etappe 1: Gehört');
	await expect(today).toContainText('überfällig seit');
	await expect(today.getByRole('link', { name: 'Erst üben' })).toHaveAttribute(
		'href',
		'/ueben?stimme=trp1&takt=1'
	);
	await expect(today.getByRole('link', { name: /^Prüfung starten/ })).toHaveAttribute(
		'href',
		`/guugge/${guugge}/pruefung?teil=1&etappe=1`
	);
	// Countdown ohne Prozent
	await expect(p2.getByRole('heading', { name: /^\d+ Tage$/ })).toBeVisible();
	await expect(p2.getByText(/% bis auftrittsreif/)).toHaveCount(0);
	// Karte des Stücks: Teil antippen zeigt seine Etappen
	await p2.getByRole('button', { name: 'Teil B: noch offen' }).click();
	const sheet = p2.getByRole('dialog', { name: /^Teil B · Takt 9–12/ });
	await expect(sheet.getByRole('listitem')).toHaveCount(5);
	await expect(sheet.getByRole('link', { name: 'Teil B üben' })).toHaveAttribute(
		'href',
		'/ueben?stimme=trp1&takt=9'
	);
	await sheet.getByRole('button', { name: 'Fertig' }).click();
	// Pausen der Trompete 1 (Teil J–M) sind markiert
	await expect(p2.getByRole('button', { name: 'Teil J: Pause für dich' })).toBeVisible();
	await p2.getByRole('button', { name: 'Gesamtplan' }).click();
	await expect(p2.getByRole('heading', { name: 'Meilensteine' })).toBeVisible();
	await expect(p2.getByRole('heading', { name: /Plan (anlegen|ändern)/ })).toHaveCount(0);

	// Vom Plan direkt üben, mit der Stimme aus der Guugge
	await p2.getByRole('button', { name: 'Mein Plan' }).click();
	await p2.getByRole('link', { name: 'Stück üben →' }).click();
	await expect(p2).toHaveURL(/\/ueben\?stimme=trp1$/);
	await expect(p2.getByRole('button', { name: /^Stimme:/ })).toHaveText(/Trp 1/);
	await other.close();
});
