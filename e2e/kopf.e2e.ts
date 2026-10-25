import { expect, test } from '@playwright/test';

test('Kopf mit giordanomat PROBELOKAL ist sichtbar', async ({ page }) => {
	await page.goto('/');
	await expect(page.getByRole('img', { name: 'giordanomat PROBELOKAL' })).toBeVisible();
	await expect(page.locator('html')).toHaveAttribute('lang', 'de-CH');
	await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
});

test('Darstellung ist dunkel und lässt sich pro Gerät auf hell umstellen', async ({ page }) => {
	await page.goto('/');
	const html = page.locator('html');
	await expect(html).toHaveAttribute('data-theme', 'dark');
	const bgDark = await page.evaluate(() => getComputedStyle(document.body).backgroundColor);
	expect(bgDark).toBe('rgb(20, 22, 25)');

	await page.getByRole('button', { name: 'Hell' }).click();
	await expect(html).toHaveAttribute('data-theme', 'light');
	await expect(page.getByRole('button', { name: 'Hell' })).toHaveAttribute('aria-pressed', 'true');
	await expect(page.locator('meta[name="theme-color"]')).toHaveAttribute('content', '#F2EFE9');

	await page.reload();
	await expect(html).toHaveAttribute('data-theme', 'light');
	await expect(page.getByRole('button', { name: 'Hell' })).toHaveAttribute('aria-pressed', 'true');
	const bgLight = await page.evaluate(() => getComputedStyle(document.body).backgroundColor);
	expect(bgLight).toBe('rgb(242, 239, 233)');
});

test('App lässt sich zum Home-Bildschirm hinzufügen (Manifest, Symbole, Service Worker)', async ({
	page,
	request
}) => {
	await page.goto('/');
	const manifestHref = await page.locator('link[rel="manifest"]').getAttribute('href');
	expect(manifestHref).toBeTruthy();
	const manifest = await (await request.get(new URL(manifestHref!, page.url()).href)).json();
	expect(manifest.display).toBe('standalone');
	expect(manifest.start_url).toBe('/');

	const icons: { src: string }[] = manifest.icons;
	const touch = await page.locator('link[rel="apple-touch-icon"]').getAttribute('href');
	for (const src of [...icons.map((i) => i.src), touch!]) {
		const res = await request.get(new URL(src, page.url()).href);
		expect(res.status(), src).toBe(200);
		expect(res.headers()['content-type'], src).toContain('image/png');
	}

	await expect
		.poll(() => page.evaluate(async () => (await navigator.serviceWorker.ready).active?.state))
		.toBe('activated');
});

test('Gerüst lädt nach dem ersten Besuch auch ohne Netz', async ({ page, context }) => {
	await page.goto('/');
	await expect
		.poll(() => page.evaluate(async () => (await navigator.serviceWorker.ready).active?.state))
		.toBe('activated');
	// zweiter Aufruf unter Kontrolle des Service Workers, damit die Seite im Cache liegt
	await page.reload();
	await context.setOffline(true);
	await page.reload();
	await expect(page.getByRole('img', { name: 'giordanomat PROBELOKAL' })).toBeVisible();
	await context.setOffline(false);
});
