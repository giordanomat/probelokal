// Kalendertage als 'JJJJ-MM-TT', gerechnet in UTC. So verschiebt keine Zeitzone und keine
// Sommerzeit einen Tag (der Prototyp rechnete mit Ortszeit 12 Uhr, das hier ist gleichwertig).

const DAY_MS = 86_400_000;

export type Day = string;

function ms(day: Day): number {
	const [y, m, d] = day.split('-').map(Number);
	return Date.UTC(y, m - 1, d);
}

function fromMs(t: number): Day {
	return new Date(t).toISOString().slice(0, 10);
}

export function addDays(day: Day, n: number): Day {
	return fromMs(ms(day) + n * DAY_MS);
}

/** Wochentag wie JavaScript `getDay()`: 0 = Sonntag … 6 = Samstag. */
export function weekdayOf(day: Day): number {
	return new Date(ms(day)).getUTCDay();
}

/** Montag der Woche, in der der Tag liegt. */
export function mondayOf(day: Day): Day {
	return addDays(day, -((weekdayOf(day) + 6) % 7));
}

export function daysBetween(a: Day, b: Day): number {
	return Math.round((ms(b) - ms(a)) / DAY_MS);
}

/** Heute in der Schweiz (nicht UTC): Ein Übetag endet um Mitternacht Ortszeit. */
export function todayInZurich(now = new Date()): Day {
	return new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Zurich' }).format(now);
}

/** Kurz wie im Prototyp: »5.11.« */
export function shortDate(day: Day): string {
	const [, m, d] = day.split('-').map(Number);
	return `${d}.${m}.`;
}

/** Mit Jahr: »20.2.2027« */
export function longDate(day: Day): string {
	return `${shortDate(day)}${day.slice(0, 4)}`;
}

/** Index wie `weekdayOf` (0 = Sonntag) */
export const WEEKDAYS = [
	'Sonntag',
	'Montag',
	'Dienstag',
	'Mittwoch',
	'Donnerstag',
	'Freitag',
	'Samstag'
] as const;
