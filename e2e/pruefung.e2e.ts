import { expect, test } from '@playwright/test';
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
	// Etappe 3 kommt noch auf die Bahn
	await page.getByRole('link', { name: 'Prüfung Teil A, Etappe 3' }).click();
	await expect(page.getByText(/prüfst du bald direkt auf der Bahn/)).toBeVisible();
});
