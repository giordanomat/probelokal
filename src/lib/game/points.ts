// Punkte und Ränge, portiert aus prototype/v7 (LEVELS, PTS, finishExam, passPoints, capOk,
// noteActivity). Punkte nur für nachgewiesene Leistung, nicht für Zeit, keine täglichen Serien
// (docs/01). Im Produkt rechnet der Server mit diesen Regeln (Edge Functions, docs/02); im
// Browser dienen sie nur der Anzeige. Namen und Werte sind Vorschläge.

export interface Level {
	n: number;
	name: string;
	min: number;
	reward?: string;
	unlock?: 'fasnacht' | 'groove' | 'gold' | 'goldname';
}

export const LEVELS: readonly Level[] = [
	{ n: 1, name: 'Schnupperi', min: 0 },
	{
		n: 2,
		name: 'Lehrling',
		min: 100,
		reward: 'Bahn-Look »Fasnacht«: jeder Griff hat seine eigene Farbe',
		unlock: 'fasnacht'
	},
	{
		n: 3,
		name: 'Schränzer',
		min: 250,
		reward: 'Bonusübung »Schränz-Groove« beim Einblasen',
		unlock: 'groove'
	},
	{ n: 4, name: 'Gassenhauer', min: 500, reward: 'Bahn-Look »Gold«', unlock: 'gold' },
	{
		n: 5,
		name: 'Bühnenfuchs',
		min: 850,
		reward: 'Goldener Name in der Rangliste',
		unlock: 'goldname'
	},
	{ n: 6, name: 'Guuggen-Ass', min: 1300, reward: 'Abzeichen »Guuggen-Ass«' },
	{ n: 7, name: 'Fasnachtslegende', min: 1900, reward: 'Abzeichen »Fasnachtslegende«' }
];

export const POINTS = {
	exercise: 5,
	examPass: 40,
	examGlanz: 20,
	examEarly: 15,
	weekGoal: 25
} as const;

/** Höchstens so viele Punkte-Vergaben pro Tag (Übungen 6, bewertete Durchgänge 15). */
export const DAILY_CAP = { exercise: 6, pass: 15 } as const;

/** Wochenziel: an so vielen verschiedenen Tagen einer Woche geübt. */
export const WEEK_GOAL_DAYS = 3;

export function levelOf(points: number): Level {
	let level = LEVELS[0];
	for (const l of LEVELS) if (points >= l.min) level = l;
	return level;
}

export function nextLevel(points: number): Level | null {
	return LEVELS.find((l) => l.min > points) ?? null;
}

export function hasUnlock(points: number, unlock: NonNullable<Level['unlock']>): boolean {
	const n = levelOf(points).n;
	return LEVELS.some((l) => l.unlock === unlock && l.n <= n);
}

export interface ExamAward {
	points: number;
	reasons: string[];
}

/**
 * Punkte für eine Etappe. Nur beim ersten Bestehen der nächsten Etappe (Wiederholen gibt nichts):
 * 40, +20 ab 95 %, +15 bis zur Fälligkeit; Etappe 4/5 ohne Mikrofon (Rhythmus tippen) halbiert.
 */
export function examAward(e: {
	stage: number;
	/** bisher höchste bestandene Etappe in diesem Teil */
	previous: number;
	score: number;
	passed: boolean;
	via: 'quiz' | 'grip' | 'mic' | 'rhythm';
	/** bis zur Fälligkeit laut Plan (false ohne Plan) */
	onTime: boolean;
}): ExamAward {
	if (!e.passed || e.stage !== e.previous + 1) return { points: 0, reasons: [] };
	let points: number = POINTS.examPass;
	const reasons = ['Etappe bestanden'];
	if (e.score >= 0.95) {
		points += POINTS.examGlanz;
		reasons.push('mit Glanz');
	}
	if (e.onTime) {
		points += POINTS.examEarly;
		reasons.push('rechtzeitig');
	}
	if (e.via === 'rhythm' && e.stage >= 4) {
		points = Math.round(points / 2);
		reasons.push('ohne Mikrofon: halbe Punkte');
	}
	return { points, reasons };
}

/**
 * Bewerteter Durchgang (ausserhalb von Prüfungen): ab 50 % ein Punkt pro 10 %, höchstens 10,
 * im Originaltempo × 1,5 (also bis 15). Unter 50 % nichts.
 */
export function passAward(pct: number, tempo: number): number {
	if (pct < 50) return 0;
	return Math.round(Math.min(10, Math.round(pct / 10)) * (tempo >= 100 ? 1.5 : 1));
}

/** ISO-Woche wie im Prototyp, z. B. '2026-44' (Woche beginnt Montag). */
export function isoWeek(day: string): string {
	const [y, m, d] = day.split('-').map(Number);
	const x = new Date(Date.UTC(y, m - 1, d));
	const wd = x.getUTCDay() || 7;
	x.setUTCDate(x.getUTCDate() + 4 - wd);
	const jan1 = Date.UTC(x.getUTCFullYear(), 0, 1);
	return `${x.getUTCFullYear()}-${Math.ceil(((x.getTime() - jan1) / 86_400_000 + 1) / 7)}`;
}

/** Erreicht dieser Übetag das Wochenziel? Nur genau am dritten Tag der Woche (einmal pro Woche). */
export function reachesWeekGoal(practiceDays: readonly string[], day: string): boolean {
	const week = isoWeek(day);
	const before = new Set(practiceDays.filter((d) => d !== day && isoWeek(d) === week));
	return !practiceDays.includes(day) && before.size === WEEK_GOAL_DAYS - 1;
}
