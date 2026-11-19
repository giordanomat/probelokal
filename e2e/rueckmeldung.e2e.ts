import { expect, test } from '@playwright/test';
import { FakeSupabase } from './fake-supabase';
import { openMore, ready } from './practice';

// Rückmeldung (Entwurf Matthias 19.11.2026) gegen den Supabase-Nachbau mit der echten
// Datenbank-Funktion in PGlite.

test('Rückmeldung: ohne Konto Hinweis, mit Konto aus »Stück üben« und »Meine Guuggen«', async ({
	page
}) => {
	const fake = await FakeSupabase.create();
	await fake.attach(page.context());

	// ohne Konto
	await page.goto('/ueben');
	await ready(page);
	await openMore(page);
	await page.getByRole('button', { name: 'Rückmeldung geben →' }).click();
	const sheet = page.getByRole('dialog', { name: 'Rückmeldung' });
	await expect(sheet.getByRole('heading', { name: 'Melde dich an' })).toBeVisible();
	await sheet.getByRole('button', { name: 'Fertig' }).click();

	// mit Konto, aus »Stück üben«: Idee mit Stelle und Gerät, ohne Antwort
	await fake.signIn(page, 'toni@test.ch');
	await page.goto('/ueben');
	await ready(page);
	await openMore(page);
	await page.getByRole('button', { name: 'Rückmeldung geben →' }).click();
	await expect(sheet.getByRole('heading', { name: 'Was ist dir aufgefallen?' })).toBeVisible();
	await expect(sheet).toContainText(/Stück üben · Teil .+ · Takt \d+ · Trp 1 · /);
	const send = sheet.getByRole('button', { name: 'Schicken' });
	await expect(send).toBeDisabled();
	await sheet.getByRole('button', { name: 'Idee' }).click();
	await sheet.getByLabel('Deine Rückmeldung').fill('Metronom zum Einzählen lauter?');
	await send.click();
	await expect(sheet.getByRole('status')).toContainText('Danke! Wir lesen alles.');

	// aus »Meine Guuggen«: Fehler, ohne Stelle, mit Antwort
	await page.goto('/guugge');
	await page.getByRole('button', { name: 'Schreiben →' }).click();
	const s2 = page.getByRole('dialog', { name: 'Rückmeldung' });
	await s2.getByLabel('Deine Rückmeldung').fill('Einladung kam nicht an.');
	await s2.getByLabel(/Wo ich gerade war/).uncheck();
	await s2.getByLabel('Ihr dürft mir per Mail antworten').check();
	await s2.getByRole('button', { name: 'Schicken' }).click();
	await expect(s2.getByRole('status')).toContainText('Wir melden uns per Mail bei dir.');

	const rows = await fake.db.owner<{
		kind: string;
		body: string;
		context: Record<string, string> | null;
		email: string | null;
	}>(`select kind, body, context, email from feedback order by created_at`);
	expect(rows).toHaveLength(2);
	expect(rows[0]).toMatchObject({
		kind: 'idee',
		body: 'Metronom zum Einzählen lauter?',
		email: null
	});
	expect(rows[0].context).toMatchObject({ page: 'Stück üben', voice: 'Trp 1' });
	expect(rows[0].context!.device).toBeTruthy();
	expect(rows[1]).toEqual({
		kind: 'fehler',
		body: 'Einladung kam nicht an.',
		context: null,
		email: 'toni@test.ch'
	});
});
