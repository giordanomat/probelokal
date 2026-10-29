import { expect, test, type Page } from '@playwright/test';
import { BAD_TOUCH, BAD_TOUCH_NOTES } from '../src/lib/titles/bad-touch';
import { buildTrack } from '../src/lib/music/track';
import { fingeringLabel } from '../src/lib/music/fingering';
import { durationName } from '../src/lib/music/notation';
import { gripItems, sectionNotes } from '../src/lib/exams/exams';
import { FakeSupabase } from './fake-supabase';

// Etappen 1 und 2 für Trompete 1, Teil A, gegen den Supabase-Nachbau: Die Datenbank (PGlite mit
// allen Migrationen) prüft Reihenfolge und Dauer und vergibt die Punkte.

const A = BAD_TOUCH.sections[1];
const notes = buildTrack(BAD_TOUCH_NOTES.parts.find((p) => p.id === 'P1')!.notes, 'valve').notes;
const own = sectionNotes(notes, A);

/** Lea mit Trompete 1 in einer neuen Guugge; Etappen 1 und 2 für Teil C (T. 13–16) bestanden. */
async function readyForLane(page: Page) {
	const fake = await FakeSupabase.create();
	await fake.attach(page.context());
	const lea = { id: await fake.idOf('lea@test.ch') };
	const [{ create_guugge: g }] = await fake.db.as<{ create_guugge: string }>(
		lea,
		`select create_guugge('Schuegu')`
	);
	await fake.db.as(lea, `select set_my_voice($1, 'trp1')`, [g]);
	const [{ id: t }] = await fake.db.owner<{ id: string }>(
		`select id from titles where slug = 'bad-touch-2-0'`
	);
	for (const [k, via] of [
		[1, 'quiz'],
		[2, 'grip']
	] as const) {
		await fake.db.as(
			'service',
			`insert into exam_results (user_id, guugge_id, title_id, voice, section, stage, score, via, passed)
			 values ($1, $2, $3, 'trp1', 3, $4, 1, $5, true)`,
			[lea.id, g, t, k, via]
		);
	}
	return { fake, g };
}

test('Quiz und Griffe: bestanden, Punkte, Rang steigt; Reihenfolge wird eingehalten', async ({
	page
}) => {
	const fake = await FakeSupabase.create();
	await fake.attach(page.context());
	const lea = { id: await fake.idOf('lea@test.ch') };
	const [{ create_guugge: g }] = await fake.db.as<{ create_guugge: string }>(
		lea,
		`select create_guugge('Schuegu')`
	);
	await fake.db.as(lea, `select set_my_voice($1, 'trp1')`, [g]);
	await fake.signIn(page, 'lea@test.ch');

	// Etappe 2 vor Etappe 1 geht nicht
	await page.goto(`/guugge/${g}/pruefung?teil=1&etappe=2`);
	await expect(page.getByText('Zuerst Etappe 1 für Teil A.')).toBeVisible();

	// Vom Plan aus zur Prüfung
	await page.goto(`/guugge/${g}/plan`);
	await page.getByRole('link', { name: 'Prüfung Teil A, Etappe 1' }).click();
	await expect(page.getByRole('heading', { name: 'Etappe 1: Gehört' })).toBeVisible();
	await page.getByRole('button', { name: 'Los' }).click();

	const first = own[0];
	const highest = own.reduce((a, b) => (b.m > a.m ? b : a));
	const answers = [
		fingeringLabel(first.fing, 'valve'),
		highest.name,
		String(A.to - A.from + 1),
		durationName(first.d)
	];
	for (const a of answers) {
		await page.getByRole('button', { name: a, exact: true }).click();
		await expect(page.getByRole('status')).toHaveText('Richtig.');
	}
	await expect(page.getByRole('heading', { name: 'Bestanden' })).toBeVisible();
	await expect(page.getByText('100 %')).toBeVisible();
	await expect(page.getByText('+60 Punkte · Etappe bestanden · mit Glanz')).toBeVisible();

	// Etappe 2: ein Ton absichtlich falsch, der Rest richtig
	await page.getByRole('link', { name: 'Weiter zu Etappe 2' }).click();
	await expect(page.getByRole('heading', { name: 'Etappe 2: Griffe sitzen' })).toBeVisible();
	await page.getByRole('button', { name: 'Los' }).click();
	const items = gripItems(notes, A);
	expect(items.length).toBeGreaterThanOrEqual(5);
	for (const [i, n] of items.entries()) {
		await expect(page.getByText(`Ton ${i + 1} von ${items.length}`)).toBeVisible();
		const fing = i === 0 ? (n.fing === '123' ? '0' : '123') : n.fing;
		for (const v of fing === '0' ? [] : fing.split('')) {
			await page.getByRole('button', { name: v, exact: true }).click();
		}
		await page.getByRole('button', { name: 'Prüfen' }).click();
		await expect(page.getByRole('status')).toHaveText(
			i === 0 ? `Richtig wäre: ${fingeringLabel(n.fing, 'valve')}.` : 'Richtig.'
		);
	}
	const pct = Math.round(((items.length - 1) / items.length) * 100);
	await expect(page.getByText(`${pct} %`)).toBeVisible();
	await expect(page.getByRole('heading', { name: 'Bestanden' })).toBeVisible();
	await expect(page.getByText('+40 Punkte · Etappe bestanden')).toBeVisible();

	// Zurück im Plan: Stand und Rang
	await page.getByRole('link', { name: 'Zurück zum Plan' }).click();
	await expect(page.getByRole('heading', { name: 'Level 2 · Lehrling' })).toBeVisible();
	await expect(page.getByText(/^100 Punkte · diese Woche 100/)).toBeVisible();
	await expect(
		page.locator('.sec').filter({ hasText: 'Teil A' }).getByText('Griffe sitzen')
	).toBeVisible();
	// Etappe 3 läuft auf der Bahn
	await page.getByRole('link', { name: 'Prüfung Teil A, Etappe 3' }).click();
	await expect(page.getByRole('link', { name: 'Vorspielen mit Mikrofon' })).toHaveAttribute(
		'href',
		`/ueben?pruefung=${g}&teil=1&etappe=3&art=mic`
	);
	await expect(page.getByText('Rhythmus tippen zählt bei dieser Etappe voll.')).toBeVisible();
});

test('Etappe 3 auf der Bahn: Einstellungen fest, Ergebnis über den ganzen Teil an den Server', async ({
	page
}) => {
	test.setTimeout(60_000);
	const { fake, g } = await readyForLane(page);
	await fake.signIn(page, 'lea@test.ch');
	await page.goto(`/guugge/${g}/pruefung?teil=3&etappe=3`);
	await page.getByRole('link', { name: 'Ohne Mikrofon: Rhythmus tippen' }).click();

	const bar = page.getByTestId('pruefung');
	await expect(bar).toContainText('Prüfung · Teil C · Etappe 3: 80 % Tempo · Rhythmus tippen');
	await expect(page.getByLabel('Tempo')).toHaveValue('80');
	await expect(page.getByLabel('Tempo')).toBeDisabled();
	await expect(page.getByRole('button', { name: 'Schleife' })).toBeDisabled();
	await expect(page.getByRole('group', { name: 'Stimme' })).toHaveCount(0);
	await expect(page.getByRole('button', { name: 'Tippen', exact: true })).toBeVisible();

	// Ohne einen Tipp: alles verpasst, 0 %, der Server bekommt das Ergebnis
	await page.getByRole('button', { name: 'Abspielen' }).click();
	await expect(bar).toContainText('Läuft');
	const result = page.getByTestId('pruefung-ergebnis');
	await expect(result).toContainText('0 %', { timeout: 25_000 });
	await expect(result).toContainText('Noch nicht ganz');
	await expect(result).toContainText('im Echo bei 70 %');
	await expect(result.getByRole('link', { name: 'Nochmals' })).toHaveAttribute(
		'href',
		`/guugge/${g}/pruefung?teil=3&etappe=3`
	);
	await expect(page).toHaveURL(/\/ueben$/);
	await expect(page.getByTestId('pruefung')).toHaveCount(0);
	await expect(page.getByLabel('Tempo')).toBeEnabled();

	const rows = await fake.db.owner<{ stage: number; via: string; passed: boolean; score: string }>(
		`select stage, via, passed, score::text from exam_results where section = 3 and stage = 3`
	);
	expect(rows).toEqual([{ stage: 3, via: 'rhythm', passed: false, score: '0' }]);
});

test('Etappe 3 mit Mithören: Mikrofon startet mit »Abspielen«, Ergebnis geht als »mic« an den Server', async ({
	page
}) => {
	// Das künstliche Mikrofon spielt dauernd notiert A4 (e2e/global-setup.ts); das Ergebnis selbst
	// sagt darum nichts über die Tonerkennung, geprüft wird der Ablauf.
	test.setTimeout(60_000);
	const { fake, g } = await readyForLane(page);
	await fake.signIn(page, 'lea@test.ch');
	await page.goto(`/ueben?pruefung=${g}&teil=3&etappe=3&art=mic`);
	const bar = page.getByTestId('pruefung');
	await expect(bar).toContainText('Etappe 3: 80 % Tempo · Mithören');
	await expect(page.getByTestId('mithoeren')).toHaveCount(0);
	await page.getByRole('button', { name: 'Abspielen' }).click();
	await expect(page.getByTestId('mithoeren')).toBeVisible();
	await expect(page.getByTestId('pruefung-ergebnis')).toContainText(/\d+ %/, { timeout: 25_000 });
	await expect(page.getByTestId('mithoeren')).toHaveCount(0);
	const rows = await fake.db.owner<{ via: string; score: string }>(
		`select via, score::text from exam_results where section = 3 and stage = 3`
	);
	expect(rows).toHaveLength(1);
	expect(rows[0].via).toBe('mic');
	expect(Number(rows[0].score)).toBeGreaterThanOrEqual(0);
	expect(Number(rows[0].score)).toBeLessThanOrEqual(1);
});
