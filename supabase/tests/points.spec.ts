// Etappenprüfungen und Punkte auf dem Server (Migration 20261029120000): Regeln gleich wie in
// src/lib/game/points.ts und src/lib/exams/exams.ts, Ablauf start_exam → finish_exam mit Prüfung
// von Reihenfolge, Dauer und Wertebereich.

import { beforeAll, describe, expect, it } from 'vitest';
import { examAward, passAward } from '../../src/lib/game/points';
import { passMark } from '../../src/lib/exams/exams';
import { createTestDb } from './db';
import { DENIED, fixture, type Fixture } from './fixture';

describe('Punkteregeln: SQL = TypeScript', () => {
	it('alle Kombinationen von Etappe, Vorstand, Ergebnis, Art und Fälligkeit', { timeout: 30_000 }, async () => {
		const db = await createTestDb();
		const rows = await db.owner<{
			stage: number;
			prev: number;
			score: string;
			via: 'quiz' | 'grip' | 'mic' | 'rhythm';
			on_time: boolean;
			mark: string;
			award: { points: number; reasons: string[] };
		}>(
			`select s as stage, p as prev, sc::text as score, v as via, o as on_time,
			        exam_pass_mark(s)::text as mark,
			        exam_points(s, p, sc, sc >= exam_pass_mark(s), v::exam_via, o) as award
			 from generate_series(1, 5) s, generate_series(0, 5) p,
			      unnest(array[0.5, 0.74, 0.75, 0.79, 0.8, 0.94, 0.95, 1.0]) sc,
			      unnest(array['quiz', 'grip', 'mic', 'rhythm']) v, unnest(array[false, true]) o`
		);
		expect(rows).toHaveLength(5 * 6 * 8 * 4 * 2);
		for (const r of rows) {
			const score = Number(r.score);
			expect(Number(r.mark), `Grenze Etappe ${r.stage}`).toBe(passMark(r.stage));
			const ts = examAward({
				stage: r.stage,
				previous: r.prev,
				score,
				passed: score >= passMark(r.stage),
				via: r.via,
				onTime: r.on_time
			});
			expect(r.award, JSON.stringify(r)).toEqual(ts);
		}
	});
});

describe('Prüfung starten und abschliessen', () => {
	let f: Fixture;
	const toni = () => f.trp[0];
	const start = (who: { id: string }, section: number, stage: number, via: string) =>
		f.db
			.as<{ id: string }>(who, `select start_exam($1, 'test-titel', $2, $3, $4) as id`, [
				f.guugge,
				section,
				stage,
				via
			])
			.then((r) => r[0].id);
	const finish = (who: { id: string }, attempt: string, score: number) =>
		f.db
			.as<{ r: Record<string, unknown> }>(who, `select finish_exam($1, $2) as r`, [attempt, score])
			.then((r) => r[0].r);
	const age = (attempt: string, seconds: number) =>
		f.db.owner(`update exam_attempts set started_at = now() - make_interval(secs => $2) where id = $1`, [
			attempt,
			seconds
		]);

	beforeAll(async () => {
		f = await fixture();
	});

	it('ohne Stimme, in falscher Reihenfolge, mit falscher Art oder fremdem Teil: abgewiesen', async () => {
		await expect(start(f.leitung, 1, 1, 'quiz')).rejects.toThrow('Wähl zuerst deine Stimme.');
		await expect(start(f.fremd, 1, 1, 'quiz')).rejects.toThrow('Du bist nicht in dieser Guugge.');
		await expect(start(toni(), 1, 2, 'grip')).rejects.toThrow('Zuerst Etappe 1.');
		await expect(start(toni(), 1, 1, 'mic')).rejects.toThrow('passt nicht zur Etappe');
		await expect(start(toni(), 1, 3, 'quiz')).rejects.toThrow('passt nicht zur Etappe');
		await expect(start(toni(), 0, 1, 'quiz')).rejects.toThrow('Diesen Teil gibt es nicht.');
		await expect(start(toni(), 4, 1, 'quiz')).rejects.toThrow('Diesen Teil gibt es nicht.');
	});

	it('zu schnell abgegeben gilt nicht; danach zählt das Ergebnis mit Punkten und Übetag', async () => {
		const a = await start(toni(), 1, 1, 'quiz');
		await expect(finish(toni(), a, 1)).rejects.toThrow('Das ging schneller');
		await age(a, 10);
		await expect(finish(toni(), a, 1.2)).rejects.toThrow('Ungültiges Ergebnis.');
		expect(await finish(toni(), a, 1)).toMatchObject({
			passed: true,
			stage: 1,
			section: 1,
			points: 60,
			reasons: ['Etappe bestanden', 'mit Glanz']
		});
		await expect(finish(toni(), a, 1)).rejects.toThrow('schon abgeschlossen');
		expect(
			await f.db.as(toni(), `select section, stage from my_stages($1, 'test-titel')`, [f.guugge])
		).toEqual([{ section: 1, stage: 1 }]);
		const [{ my_points: pts }] = await f.db.as<{ my_points: Record<string, number> }>(
			toni(),
			`select my_points($1)`,
			[f.guugge]
		);
		expect(pts).toEqual({ points: 60, week_points: 60, days_this_week: 1 });
	});

	it('Wiederholen gibt keine Punkte; nicht bestanden auch nicht', async () => {
		const a = await start(toni(), 1, 1, 'quiz');
		await age(a, 10);
		expect(await finish(toni(), a, 1)).toMatchObject({ passed: true, points: 0, reasons: [] });
		const b = await start(toni(), 1, 2, 'grip');
		await age(b, 10);
		expect(await finish(toni(), b, 0.7)).toMatchObject({ passed: false, points: 0 });
	});

	it('fremde oder abgelaufene Prüfungen lassen sich nicht abschliessen', async () => {
		const a = await start(toni(), 1, 2, 'grip');
		await age(a, 10);
		await expect(finish(f.trp[1], a, 1)).rejects.toThrow('Diese Prüfung gibt es nicht.');
		await age(a, 3 * 3600);
		await expect(finish(toni(), a, 1)).rejects.toThrow('abgelaufen');
	});

	it('auf der Bahn: mindestens 90 % der Spieldauer, rechtzeitig laut Plan gibt +15', async () => {
		// Teil A: Etappe 2 morgen fällig, alle anderen gestern
		const [{ y, t }] = await f.db.owner<{ y: string; t: string }>(
			`select (today_zurich() - 1)::text as y, (today_zurich() + 1)::text as t`
		);
		await f.db.as(
			f.leitung,
			`select set_plan($1, 'test-titel', '2026-11-02', '2027-02-20', 3, null, 60, $2)`,
			[f.guugge, JSON.stringify({ 1: [y, t, y, y, y] })]
		);
		const g = await start(toni(), 1, 2, 'grip');
		await age(g, 10);
		expect(await finish(toni(), g, 0.9)).toMatchObject({
			passed: true,
			points: 55,
			reasons: ['Etappe bestanden', 'rechtzeitig']
		});
		// Teil A: 8 Takte bei 115 BPM und 80 % Tempo dauern 20,9 s; nötig sind 90 % = 18,8 s
		const lane = await start(toni(), 1, 3, 'rhythm');
		await age(lane, 15);
		await expect(finish(toni(), lane, 0.9)).rejects.toThrow('Das ging schneller');
		await age(lane, 20);
		expect(await finish(toni(), lane, 0.9)).toMatchObject({ passed: true, points: 40 });
	});

	it('Wochenziel am dritten Übetag der Woche, einmal', async () => {
		const p = f.trp[1];
		await f.db.as(
			'service',
			`insert into practice_days (user_id, day)
			 select $1, d::date from generate_series(date_trunc('week', today_zurich()), date_trunc('week', today_zurich()) + interval '6 days', interval '1 day') d
			 where d::date <> today_zurich() limit 2`,
			[p.id]
		);
		const a = await start(p, 1, 1, 'quiz');
		await age(a, 10);
		// Etappe 1 war gestern fällig (Plan aus dem Test davor): ohne Bonus
		expect(await finish(p, a, 0.8)).toMatchObject({ passed: true, points: 40, week_goal: 25 });
		const b = await start(p, 1, 2, 'grip');
		await age(b, 10);
		expect(await finish(p, b, 0.8)).toMatchObject({ points: 55, week_goal: 0 });
		const [{ my_points: pts }] = await f.db.as<{ my_points: Record<string, number> }>(
			p,
			`select my_points($1)`,
			[f.guugge]
		);
		expect(pts.points).toBe(40 + 25 + 55);
	});

	it('Versuche liest kein Client; Punkte schreibt nur der Server', async () => {
		await expect(f.db.as(toni(), `select * from exam_attempts`)).rejects.toThrow(DENIED);
		await expect(
			f.db.as(toni(), `select note_practice_day($1, $2)`, [toni().id, f.guugge])
		).rejects.toThrow(DENIED);
		await expect(f.db.as('anon', `select start_exam($1, 'test-titel', 1, 1, 'quiz')`, [f.guugge])).rejects.toThrow(
			DENIED
		);
	});
});

describe('Bewertete Durchgänge', () => {
	let f: Fixture;
	const startPass = (who: { id: string }, from: number, to: number, tempo: number) =>
		f.db
			.as<{ id: string }>(who, `select start_pass('test-titel', $1, $2, $3) as id`, [
				from,
				to,
				tempo
			])
			.then((r) => r[0].id);
	const finishPass = (who: { id: string }, a: string, pct: number, judged: number) =>
		f.db
			.as<{ r: Record<string, unknown> }>(who, `select finish_pass($1, $2, $3) as r`, [
				a,
				pct,
				judged
			])
			.then((r) => r[0].r);
	const age = (a: string, s: number) =>
		f.db.owner(`update pass_attempts set started_at = now() - make_interval(secs => $2) where id = $1`, [
			a,
			s
		]);
	beforeAll(async () => {
		f = await fixture();
	});

	it('Punkteregel: SQL = TypeScript für alle Prozente und Tempi', async () => {
		const rows = await f.db.owner<{ pct: number; tempo: number; p: number }>(
			`select pct, tempo, pass_points(pct, tempo) as p
			 from generate_series(0, 100) pct, generate_series(50, 100, 5) tempo`
		);
		expect(rows).toHaveLength(101 * 11);
		for (const r of rows) expect(r.p, `${r.pct} % bei ${r.tempo} %`).toBe(passAward(r.pct, r.tempo));
	});

	it('Takte und Tempo werden geprüft, zu schnell gilt nicht', async () => {
		await expect(startPass(f.trp[0], 5, 4, 100)).rejects.toThrow('Diese Takte gibt es nicht.');
		await expect(startPass(f.trp[0], 1, 96, 100)).rejects.toThrow('Diese Takte gibt es nicht.');
		await expect(startPass(f.trp[0], 1, 8, 40)).rejects.toThrow('Tempo 50 bis 100');
		// T. 1–8 bei 115 BPM dauern 16,7 s; nötig sind 90 % = 15 s
		const a = await startPass(f.trp[0], 1, 8, 100);
		await age(a, 10);
		await expect(finishPass(f.trp[0], a, 90, 20)).rejects.toThrow('Das ging schneller');
		await age(a, 20);
		await expect(finishPass(f.trp[0], a, 101, 20)).rejects.toThrow('Ungültiges Ergebnis.');
		expect(await finishPass(f.trp[0], a, 90, 20)).toEqual({
			points: 14,
			capped: false,
			week_goal: 0
		});
		await expect(finishPass(f.trp[0], a, 90, 20)).rejects.toThrow('schon abgeschlossen');
		const [{ my_points: p }] = await f.db.as<{ my_points: Record<string, number> }>(
			f.trp[0],
			`select my_points($1)`,
			[f.guugge]
		);
		expect(p).toMatchObject({ points: 14, days_this_week: 1 });
	});

	it('unter 3 bewerteten Tönen keine Punkte; höchstens 15 Durchgänge pro Tag', async () => {
		const p = f.trp[1];
		const a = await startPass(p, 1, 8, 80);
		await age(a, 30);
		expect(await finishPass(p, a, 100, 2)).toMatchObject({ points: 0, capped: false });
		// Nichts getroffen: kein Übetag (sonst gäbe Nichtstun das Wochenziel)
		const z = await startPass(p, 1, 8, 80);
		await age(z, 30);
		await finishPass(p, z, 0, 12);
		expect(
			await f.db.owner(`select count(*)::int as n from practice_days where user_id = $1`, [p.id])
		).toEqual([{ n: 0 }]);
		for (let i = 0; i < 15; i++) {
			await f.db.as(
				'service',
				`insert into points_ledger (user_id, guugge_id, points, reason) values ($1, $2, 5, 'Durchgang T. 1–8 · 50 %')`,
				[p.id, f.guugge]
			);
		}
		const b = await startPass(p, 1, 8, 80);
		await age(b, 30);
		expect(await finishPass(p, b, 100, 20)).toMatchObject({ points: 0, capped: true });
	});

	it('Punkte gehen an die eigene Guugge, Versuche liest kein Client', async () => {
		const a = await startPass(f.fremd, 1, 8, 100);
		await age(a, 20);
		expect(await finishPass(f.fremd, a, 60, 10)).toMatchObject({ points: 9 });
		expect(
			await f.db.owner(`select guugge_id, points from points_ledger where user_id = $1`, [
				f.fremd.id
			])
		).toEqual([{ guugge_id: f.fremdGuugge, points: 9 }]);
		await expect(f.db.as(f.fremd, `select * from pass_attempts`)).rejects.toThrow(DENIED);
		await expect(finishPass(f.trp[0], a, 60, 10)).rejects.toThrow('Diesen Durchgang gibt es nicht.');
	});
});
