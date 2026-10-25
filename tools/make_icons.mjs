// App-Symbole für Home-Bildschirm und Browser aus dem giordanomat-Zeichen erzeugen.
// Aufruf (im Repository): node tools/make_icons.mjs
// Schreibt static/favicon.svg und static/icons/*.png. Braucht Playwright (Chromium) aus devDependencies.
//
// Varianten:
// - icon-192/512 (»any«): Papier-Quadrat mit runden Ecken, schwarze Scheibe – wie 06_app-symbol.svg
// - icon-maskable-512: Papier randlos, Scheibe in der Schutzzone (Radius 37 % < 40 %), Android schneidet zu
// - apple-touch-icon (180): Papier randlos, iOS rundet selbst; keine Transparenz
// - favicon.svg / favicon-32: Scheibe mit hellem Ring, damit sie auf dunklen Tabs sichtbar bleibt
import { chromium } from 'playwright';
import { mkdirSync, writeFileSync } from 'node:fs';

const BARS =
	'<rect x="40" y="54" width="92" height="26" rx="13" fill="#F5C242"/>' +
	'<rect x="68" y="88" width="94" height="26" rx="13" fill="#E0473C"/>' +
	'<rect x="38" y="122" width="114" height="26" rx="13" fill="#6EACDA"/>';

/** Scheibe mit Balken um (512, 512) mit Radius r im 1024er-Raster. */
const disc = (r) => {
	const s = r / 100;
	const t = 512 - 100 * s;
	return `<circle cx="512" cy="512" r="${r}" fill="#141619"/><g transform="translate(${t} ${t}) scale(${s})">${BARS}</g>`;
};

const square = (rx, r) =>
	`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1024 1024"><rect width="1024" height="1024" rx="${rx}" fill="#F2EFE9"/>${disc(r)}</svg>`;

const favicon =
	'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 200 200"><circle cx="100" cy="100" r="100" fill="#F2EFE9"/><circle cx="100" cy="100" r="94" fill="#141619"/>' +
	BARS +
	'</svg>';

const OUT = [
	['icons/icon-192.png', 192, square(225, 430)],
	['icons/icon-512.png', 512, square(225, 430)],
	['icons/icon-maskable-512.png', 512, square(0, 380)],
	['icons/apple-touch-icon.png', 180, square(0, 430)],
	['icons/favicon-32.png', 32, favicon]
];

mkdirSync('static/icons', { recursive: true });
writeFileSync('static/favicon.svg', favicon + '\n');

const browser = await chromium.launch();
const page = await browser.newPage();
for (const [path, size, svg] of OUT) {
	await page.setViewportSize({ width: size, height: size });
	await page.setContent(
		`<html><body style="margin:0;background:transparent">${svg.replace('<svg ', `<svg width="${size}" height="${size}" `)}</body></html>`
	);
	await page.locator('svg').screenshot({ path: `static/${path}`, omitBackground: true });
	console.log(`static/${path} (${size}×${size})`);
}
await browser.close();
