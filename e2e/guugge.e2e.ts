import { expect, test } from '@playwright/test';
import { FakeSupabase } from './fake-supabase';

// Konten und Guuggen (M2) gegen den Supabase-Nachbau: echte Migrationen und RLS-Regeln in PGlite,
// Auth und Aufrufe nachgebaut (e2e/fake-supabase.ts). Ob das echte Supabase gleich antwortet
// (Mailvorlage, Fehlertexte), prüft das nicht.

test('Leitung legt eine Guugge an und lädt ein, ein Mitglied tritt per Link bei', async ({
	page,
	browser,
	baseURL
}) => {
	const fake = await FakeSupabase.create();
	await fake.attach(page.context());

	// Anmelden mit Code; ein falscher Code wird abgewiesen
	await page.goto('/ueben');
	await page.getByRole('link', { name: 'Meine Guugge' }).click();
	await expect(page.getByRole('heading', { name: 'Melde dich an.' })).toBeVisible();
	await page.getByRole('link', { name: 'Anmelden →' }).click();
	await page.getByLabel('E-Mail').fill('Lea@Test.ch');
	await page.getByRole('button', { name: 'Code schicken' }).click();
	await expect(page.getByRole('heading', { name: 'Schau in deine Mails.' })).toBeVisible();
	const { code } = fake.lastMail('lea@test.ch');
	await page.getByLabel('Code').fill(code === '000000' ? '111111' : '000000');
	await page.getByRole('button', { name: 'Anmelden' }).click();
	await expect(page.getByRole('alert')).toHaveText('Der Code stimmt nicht oder ist abgelaufen.');
	await page.getByLabel('Code').fill(code);
	await page.getByRole('button', { name: 'Anmelden' }).click();
	await expect(page).toHaveURL(/\/guugge$/);
	await expect(page.getByRole('heading', { name: 'Noch in keiner Guugge.' })).toBeVisible();

	// Name und neue Guugge
	await page.getByLabel('Name', { exact: true }).fill('Lea');
	await page.getByRole('button', { name: 'Speichern' }).click();
	await expect(page.getByRole('status')).toHaveText('Gespeichert.');
	await page.getByLabel('Name der Guugge').fill('Schuegu');
	await page.getByRole('button', { name: 'Anlegen' }).click();
	await expect(page).toHaveURL(/\/guugge\/[0-9a-f-]{36}$/);
	await expect(page.getByRole('heading', { name: 'Schuegu' })).toBeVisible();
	await expect(page.locator('.card .label').first()).toHaveText('Leitung');

	// Einladungslink: Schlüssel hinter dem #
	await page.getByRole('button', { name: 'Einladungslink erstellen' }).click();
	const link = await page.getByLabel('Einladungslink').inputValue();
	expect(link).toMatch(/\/einladung#[0-9a-f]{64}$/);

	// Mitglied auf einem anderen Gerät: Link öffnen, anmelden über den Link in der Mail
	const other = await browser.newContext({ baseURL });
	await fake.attach(other);
	const p2 = await other.newPage();
	await p2.goto(new URL(link).pathname + new URL(link).hash);
	await expect(
		p2.getByRole('heading', { name: 'Du bist in eine Guugge eingeladen.' })
	).toBeVisible();
	// Schlüssel nicht mehr in der Adresse
	await expect(p2).toHaveURL(/\/einladung$/);
	await p2.getByRole('link', { name: 'Anmelden →' }).click();
	await p2.getByLabel('E-Mail').fill('toni@test.ch');
	await p2.getByRole('button', { name: 'Code schicken' }).click();
	await expect(p2.getByRole('heading', { name: 'Schau in deine Mails.' })).toBeVisible();
	await p2.goto(`/anmelden?token_hash=${fake.lastMail('toni@test.ch').tokenHash}&type=email`);
	await expect(p2).toHaveURL(/\/guugge\/[0-9a-f-]{36}$/);
	await expect(p2.getByRole('heading', { name: 'Schuegu' })).toBeVisible();
	await expect(p2.locator('.card .label').first()).toHaveText('Mitglied');
	await expect(p2.getByRole('button', { name: 'Einladungslink erstellen' })).toHaveCount(0);

	// Stimme
	await expect(p2.getByText('Wähl deine Stimme')).toBeVisible();
	await p2.getByRole('button', { name: 'Trompete 2' }).click();
	await expect(p2.getByRole('status')).toHaveText('Stimme gespeichert.');
	await expect(p2.getByRole('button', { name: 'Trompete 2' })).toHaveAttribute(
		'aria-pressed',
		'true'
	);
	await expect(p2.getByRole('link', { name: 'Punkte und Rangliste →' })).toBeVisible();

	// Leitung sieht das neue Mitglied mit Stimme und macht es zum Registerchef
	await page.reload();
	const member = page.getByRole('listitem').filter({ hasText: 'Ohne Namen' });
	await expect(member).toContainText('Trp 2');
	await page.getByLabel('Rolle von Ohne Namen').selectOption('registerchef');
	await expect(page.getByRole('status')).toHaveText('Rolle geändert.');
	await p2.reload();
	await expect(p2.locator('.card .label').first()).toHaveText('Registerchef');

	// Austreten
	p2.once('dialog', (d) => d.accept());
	await p2.getByRole('button', { name: 'Austreten' }).click();
	await expect(p2).toHaveURL(/\/guugge$/);
	await expect(p2.getByRole('heading', { name: 'Noch in keiner Guugge.' })).toBeVisible();

	// Zurückgezogener Link gilt nicht mehr
	page.once('dialog', (d) => d.accept());
	await page.getByRole('button', { name: 'Alle Einladungslinks zurückziehen' }).click();
	await expect(page.getByRole('status')).toHaveText('Alle Einladungslinks gelten nicht mehr.');
	await p2.goto(new URL(link).pathname + new URL(link).hash);
	await expect(p2.getByRole('alert')).toContainText('Diese Einladung gilt nicht mehr.');
	await other.close();
});
