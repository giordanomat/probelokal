// Bedienung von »Stück üben« seit dem Umbau 03.11.2026: Seltenes liegt im Blatt »Mehr«, die Stimme
// im Blatt hinter dem Stimme-Knopf oben rechts. Die Blätter sind <dialog>; solange eines offen ist,
// lässt sich der Rest der Seite nicht bedienen.
import type { Page } from '@playwright/test';

/** Erst klicken, wenn die Seite eingehängt ist: Ein Klick davor geht ins Leere (in CI gesehen,
 * angemeldet direkt nach reload). */
export async function ready(page: Page) {
	await page.locator('.practice[data-ready]').waitFor();
}

export async function openMore(page: Page) {
	await ready(page);
	await page.getByRole('button', { name: 'Mehr', exact: true }).click();
	await page.getByRole('dialog', { name: 'Mehr' }).waitFor();
}

export async function closeSheet(page: Page) {
	await page.getByRole('button', { name: 'Fertig' }).click();
	await page.getByRole('dialog').waitFor({ state: 'hidden' });
}

/** Stimme über das Blatt wählen, z. B. »Pos 1« (das Blatt schliesst sich dabei). */
export async function chooseVoice(page: Page, short: string) {
	await ready(page);
	await page.getByRole('button', { name: /^Stimme:/ }).click();
	await page
		.getByRole('dialog', { name: 'Deine Stimme' })
		.getByRole('button', { name: short })
		.click();
}

/** Ansicht Bahn oder Noten (im Blatt »Mehr«), danach Blatt zu. */
export async function chooseView(page: Page, view: 'Bahn' | 'Noten') {
	await openMore(page);
	await page.getByRole('button', { name: view, exact: true }).click();
	await closeSheet(page);
}
