import { expect, test } from '@playwright/test';
import { FakeSupabase } from './fake-supabase';

// Rangliste (nur eingeschaltet und nur mit Opt-in) und Übersicht der Leitung (nur Register mit
// mindestens drei Personen) gegen den Supabase-Nachbau mit den echten Regeln in PGlite.

test('Rangliste mit Opt-in, Belohnungen der Guugge, Übersicht der Leitung ohne Einzelwerte', async ({
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
	const [{ id: t }] = await fake.db.owner<{ id: string }>(
		`select id from titles where slug = 'bad-touch-2-0'`
	);
	// Drei Trompeten mit Namen und Punkten, eine Posaune (Register zu klein für die Übersicht)
	const members: [string, string, string, number][] = [
		['toni@test.ch', 'Toni', 'trp1', 40],
		['tina@test.ch', 'Tina', 'trp2', 100],
		['tom@test.ch', 'Tom', 'trp1', 0],
		['pia@test.ch', 'Pia', 'pos1', 60]
	];
	for (const [email, name, voice, pts] of members) {
		const u = { id: await fake.idOf(email) };
		await fake.db.as(u, `select accept_invite($1)`, [token]);
		await fake.db.as(u, `select set_my_voice($1, $2)`, [g, voice]);
		await fake.db.as(u, `select set_my_name($1)`, [name]);
		if (pts) {
			await fake.db.as(
				'service',
				`insert into points_ledger (user_id, guugge_id, points, reason) values ($1, $2, $3, 'Etappe')`,
				[u.id, g, pts]
			);
			await fake.db.as(
				'service',
				`insert into exam_results (user_id, guugge_id, title_id, voice, section, stage, score, via, passed)
				 values ($1, $2, $3, $4, 1, 1, 1, 'quiz', true)`,
				[u.id, g, t, voice]
			);
		}
	}
	// Toni und Tina machen mit, Tom und Pia nicht
	for (const email of ['toni@test.ch', 'tina@test.ch']) {
		await fake.db.as({ id: await fake.idOf(email) }, `select set_rangliste_opt_in($1, true)`, [g]);
	}

	// Leitung: Rangliste einschalten, Belohnung festlegen
	await fake.signIn(page, 'lea@test.ch');
	await page.goto(`/guugge/${g}`);
	await page.getByRole('link', { name: 'Punkte und Rangliste →' }).click();
	await expect(page.getByText('Die Rangliste ist für die Guugge ausgeschaltet.')).toBeVisible();
	await page.getByLabel('Rangliste für die Guugge einschalten').check();
	await expect(page.getByRole('button', { name: 'Diese Woche' })).toBeVisible();
	const board = page.locator('ol.board');
	await expect(board.getByRole('listitem')).toHaveCount(2);
	await expect(board.getByRole('listitem').first()).toContainText('Tina');
	await expect(board.getByRole('listitem').first()).toContainText('Trompete 2 · Level 2 Lehrling');
	await expect(board).not.toContainText('Tom');
	await expect(board).not.toContainText('Pia');
	await page.getByLabel('Level 2 · Lehrling').fill('Getränk nach der Probe');
	await page.getByRole('button', { name: 'Belohnungen speichern' }).click();
	await expect(page.getByRole('status')).toHaveText('Belohnungen gespeichert.');

	// Übersicht der Leitung im Gesamtplan: Trompeten ja (drei Personen), Posaunen nein
	await page.goto(`/guugge/${g}/plan`);
	await page.getByRole('button', { name: 'Gesamtplan' }).click();
	await expect(page.getByRole('heading', { name: 'Übersicht der Register' })).toBeVisible();
	const regs = page.locator('.regs');
	await expect(regs).toContainText('Trompeten');
	await expect(regs).toContainText('0 von 3 haben diese Woche geübt');
	await expect(regs).not.toContainText('Posaunen');
	await expect(page.locator('table.heat')).not.toContainText('Toni');

	// Mitglied ohne Opt-in sieht die Rangliste, aber sich selbst nicht; Belohnung der Guugge sichtbar
	const other = await browser.newContext({ baseURL });
	await fake.attach(other);
	const p2 = await other.newPage();
	await fake.signIn(p2, 'tom@test.ch');
	await p2.goto(`/guugge/${g}/rangliste`);
	await expect(p2.getByText('Du erscheinst nicht.')).toBeVisible();
	await expect(p2.locator('ol.board').getByRole('listitem')).toHaveCount(2);
	await expect(p2.getByText('Von deiner Guugge: Getränk nach der Probe')).toBeVisible();
	await expect(p2.getByRole('heading', { name: 'Für die Leitung' })).toHaveCount(0);
	// Übersicht der Register sieht nur die Leitung
	await p2.goto(`/guugge/${g}/plan`);
	await p2.getByRole('button', { name: 'Gesamtplan' }).click();
	await expect(p2.getByRole('heading', { name: 'Übersicht der Register' })).toHaveCount(0);
	await other.close();
});
