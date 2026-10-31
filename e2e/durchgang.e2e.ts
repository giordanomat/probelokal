import { expect, test } from '@playwright/test';
import { FakeSupabase } from './fake-supabase';

// Punkte für bewertete Durchgänge: »Stück üben« meldet jeden Durchgang in der Schleife beim
// Server an und ab (start_pass, finish_pass). Ohne Tipp gibt es 0 % und keine Punkte; die
// Punkteregel selbst prüft supabase/tests/points.spec.ts.

test('Durchgang in der Schleife wird angemeldet, abgeschlossen und neu gestartet', async ({
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
	await fake.db.as(lea, `select set_my_voice($1, 'trp1')`, [g]);
	await fake.signIn(page, 'lea@test.ch');

	await page.goto('/ueben');
	await page.getByRole('button', { name: 'Rhythmus tippen' }).click();
	await page.getByLabel('Teil').selectOption({ label: 'Teil C · T. 13–16' });
	await page.getByRole('button', { name: 'Schleife' }).click();
	await page.getByRole('button', { name: 'Abspielen' }).click();
	await expect(page.getByTestId('ergebnis')).toContainText('Durchgang 1', { timeout: 25_000 });

	const attempts = () =>
		fake.db.owner<{ bar_from: number; bar_to: number; tempo: number; done: boolean }>(
			`select bar_from, bar_to, tempo, finished_at is not null as done from pass_attempts order by started_at`
		);
	await expect.poll(attempts).toEqual([
		{ bar_from: 13, bar_to: 16, tempo: 100, done: true },
		{ bar_from: 13, bar_to: 16, tempo: 100, done: false }
	]);
	await page.getByRole('button', { name: 'Anhalten' }).click();
	expect(
		await fake.db.owner(`select count(*)::int as n from points_ledger where user_id = $1`, [lea.id])
	).toEqual([{ n: 0 }]);
	// 0 % zählt nicht als Übetag
	expect(
		await fake.db.owner(`select count(*)::int as n from practice_days where user_id = $1`, [lea.id])
	).toEqual([{ n: 0 }]);
	await expect(page.getByTestId('durchgang-punkte')).toHaveCount(0);
});
