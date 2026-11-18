import { expect, test } from '@playwright/test';
import { FakeSupabase } from './fake-supabase';

// Konto löschen (Entwurf Matthias 18.11.2026) gegen den Supabase-Nachbau: die echte
// Datenbank-Funktion in PGlite, Abmelden nachgebaut. Ob das echte Supabase den Eintrag in
// auth.users löschen lässt, prüft das nicht (Testprotokoll M2, Abschnitt 10).

test('Konto löschen: einzige Leitung gesperrt, Mitglied löscht sich und das Gerät vergisst alles', async ({
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

	// Leitung: einzige Leitung mit einem Mitglied, also gesperrt, mit Weg in die Guugge
	await fake.signIn(page, 'lea@test.ch');
	await page.goto('/guugge');
	await page.getByRole('button', { name: 'Löschen …' }).click();
	const sheet = page.getByRole('dialog', { name: 'Konto löschen' });
	await expect(sheet.getByText('Zuerst die Leitung abgeben')).toBeVisible();
	await expect(sheet.getByLabel('Zum Bestätigen »löschen« eintippen')).toBeDisabled();
	await expect(sheet.getByRole('button', { name: 'Konto löschen' })).toBeDisabled();
	await expect(sheet.getByRole('link', { name: 'Zu Schuegu →' })).toHaveAttribute(
		'href',
		`/guugge/${g}`
	);

	// Mitglied: »löschen« eintippen, danach abgemeldet, Gerät aufgeräumt, Konto weg
	const other = await browser.newContext({ baseURL });
	await fake.attach(other);
	const p2 = await other.newPage();
	await fake.signIn(p2, 'toni@test.ch');
	await p2.evaluate(() => {
		localStorage.setItem('probelokal.theme', 'light');
		localStorage.setItem('probelokal.bau.bad-touch-2-0.trp1', '[]');
		localStorage.setItem('fremd', '1');
	});
	await p2.goto('/guugge');
	await p2.getByRole('button', { name: 'Löschen …' }).click();
	const s2 = p2.getByRole('dialog', { name: 'Konto löschen' });
	await expect(s2.getByText('Zuerst die Leitung abgeben')).toHaveCount(0);
	const del = s2.getByRole('button', { name: 'Konto löschen' });
	await expect(del).toBeDisabled();
	await s2.getByLabel('Zum Bestätigen »löschen« eintippen').fill('ja');
	await expect(del).toBeDisabled();
	await s2.getByLabel('Zum Bestätigen »löschen« eintippen').fill('löschen');
	await del.click();
	await expect(p2.getByRole('heading', { name: 'Dein Konto ist gelöscht.' })).toBeVisible();
	await expect(s2).toHaveCount(0);
	expect(
		await p2.evaluate(() =>
			Object.keys(localStorage).filter((k) => k.startsWith('probelokal.') || k.startsWith('sb-'))
		)
	).toEqual([]);
	expect(await p2.evaluate(() => localStorage.getItem('fremd'))).toBe('1');
	expect(await fake.db.owner(`select 1 from auth.users where id = $1`, [toni.id])).toEqual([]);

	// Die Guugge der Leitung bleibt, ohne Toni; Toni kann neu anfangen (leeres Konto)
	expect(
		await fake.db.owner(`select count(*)::int as n from memberships where guugge_id = $1`, [g])
	).toEqual([{ n: 1 }]);
	await fake.signIn(p2, 'toni@test.ch');
	await expect(p2.getByRole('heading', { name: 'Noch in keiner Guugge.' })).toBeVisible();
	await other.close();
});
