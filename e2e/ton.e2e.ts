import { expect, test, type Page } from '@playwright/test';
import { fakeAudio } from './audio';

// Ton in /ueben mit synthetischem Audio: /audio/… wird abgefangen und liefert ein WAV mit
// Sinuston (Band 220 Hz, eigene Stimme 440 Hz). Ob die echte Weiterleitung auf Supabase samt
// CORS funktioniert, prüft das nicht (siehe docs/05, M1).

// Versatz der Einzelspuren und Sekunden pro Schlag von Bad Touch (src/lib/titles/bad-touch.ts)
const OFFSET = (3 * 4 * 60) / 115;
const SPB = 60 / 115;

const media = (page: Page, stem: 'band' | 'own') =>
	page.locator(`audio[data-stem="${stem}"]`).evaluate((el: HTMLAudioElement) => ({
		t: el.currentTime,
		paused: el.paused,
		rate: el.playbackRate,
		pitch: el.preservesPitch,
		src: el.src
	}));

const canvasBeat = (page: Page) =>
	page.locator('.lane canvas').getAttribute('data-beat').then(Number);

test('Band ist die Uhr der Bahn, eigene Stimme läuft mit, Tempo und Stimme wechseln', async ({
	page
}) => {
	const errors: string[] = [];
	page.on('pageerror', (e) => errors.push(e.message));
	const requested = await fakeAudio(page);
	await page.goto('/ueben');

	await expect(page.getByRole('button', { name: 'Laut' })).toBeEnabled();
	await expect(page.getByTestId('ton-hinweis')).toHaveCount(0);
	expect(requested).toContain('minus_trp1.mp3');
	expect((await media(page, 'band')).src).toMatch(/minus_trp1\.mp3$/);
	expect((await media(page, 'own')).src).toMatch(/\/trp1\.mp3$/);

	// Start bei Teil A mit einem Takt Anlauf: Band steht am Versatz (Takt 0)
	await expect.poll(async () => (await media(page, 'band')).t).toBeCloseTo(OFFSET, 1);

	await page.getByRole('button', { name: 'Abspielen' }).click();
	await expect.poll(async () => (await media(page, 'band')).t).toBeGreaterThan(OFFSET + 1);
	const band = await media(page, 'band');
	const own = await media(page, 'own');
	expect(band.paused).toBe(false);
	expect(own.paused).toBe(false);
	expect(Math.abs(own.t - band.t)).toBeLessThan(0.1);
	// Bahn folgt der Band (ein Animations-Takt Spiel)
	const beat = await canvasBeat(page);
	const t = (await media(page, 'band')).t;
	expect(Math.abs(beat - (t - OFFSET) / SPB)).toBeLessThan(0.5);

	// Tempo auf beiden Spuren, Tonhöhe bleibt
	await page.getByLabel('Tempo').fill('80');
	for (const s of ['band', 'own'] as const) {
		const m = await media(page, s);
		expect(m.rate).toBeCloseTo(0.8, 5);
		expect(m.pitch).toBe(true);
	}

	// Anhalten hält beide Spuren an
	await page.getByRole('button', { name: 'Anhalten' }).click();
	expect((await media(page, 'band')).paused).toBe(true);
	expect((await media(page, 'own')).paused).toBe(true);

	// Stimme wechseln lädt die Spuren der neuen Stimme an derselben Stelle
	const before = (await media(page, 'band')).t;
	await page.getByRole('button', { name: 'Pos 1' }).click();
	await expect.poll(async () => (await media(page, 'band')).src).toMatch(/minus_pos1\.mp3$/);
	await expect.poll(async () => (await media(page, 'band')).t).toBeCloseTo(before, 1);
	expect((await media(page, 'own')).src).toMatch(/\/pos1\.mp3$/);
	expect((await media(page, 'band')).rate).toBeCloseTo(0.8, 5);

	// Lautstärke meiner Stimme bleibt pro Gerät
	await page.getByRole('button', { name: 'Leise' }).click();
	await page.reload();
	await expect(page.getByRole('button', { name: 'Leise' })).toHaveAttribute('aria-pressed', 'true');

	expect(errors).toEqual([]);
});

test('ohne Testzugang: Hinweis mit Weg zum Code, Bahn läuft ohne Ton', async ({ page }) => {
	await page.goto('/ueben');
	await expect(page.getByTestId('ton-hinweis')).toContainText('Testzugang');
	await expect(page.getByRole('link', { name: 'Code eingeben' })).toHaveAttribute(
		'href',
		'/zugang'
	);
	await expect(page.getByRole('button', { name: 'Laut' })).toBeDisabled();
	await page.getByRole('button', { name: 'Abspielen' }).click();
	await expect.poll(() => canvasBeat(page)).toBeGreaterThan(1);
});

test('Aufnahme fehlt im Storage: Hinweis, Bahn läuft ohne Ton', async ({ page }) => {
	await page.route('**/audio/**', (route) => route.fulfill({ status: 404, body: 'fehlt' }));
	await page.goto('/ueben');
	await expect(page.getByTestId('ton-hinweis')).toContainText('noch nicht hochgeladen');
});

test('Spur lässt sich nicht laden: zurück auf die eigene Uhr', async ({ page }) => {
	// Vorabprüfung klappt, die Datei selbst ist kaputt
	await page.route('**/audio/**', (route) =>
		route.fulfill({ status: 200, contentType: 'audio/wav', body: 'kein audio' })
	);
	await page.goto('/ueben');
	await expect(page.getByTestId('ton-hinweis')).toContainText('nicht erreichbar');
	await page.getByRole('button', { name: 'Abspielen' }).click();
	await expect.poll(() => canvasBeat(page)).toBeGreaterThan(1);
});
