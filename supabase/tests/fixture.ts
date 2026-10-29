// Testguugge für die Datenbank-Tests: Leitung, drei Trompeten (davon ein Registerchef), zwei
// Posaunen, eine fremde Person mit eigener Guugge und ein Testtitel mit drei Teilen.

import { createTestDb, type TestDb } from './db';

export const DENIED = /permission denied|row-level security/;

export interface Fixture {
	db: TestDb;
	guugge: string;
	title: string;
	leitung: { id: string };
	trp: { id: string }[];
	pos: { id: string }[];
	chef: { id: string };
	fremd: { id: string };
	fremdGuugge: string;
}

/** Guugge mit Leitung, drei Trompeten (davon ein Registerchef), zwei Posaunen; daneben eine fremde Guugge. */
export async function fixture(): Promise<Fixture> {
	const db = await createTestDb();
	const leitung = { id: await db.user('leitung@test.ch', 'Lea Leitung') };
	const trp = [
		{ id: await db.user('t1@test.ch', 'Toni') },
		{ id: await db.user('t2@test.ch', 'Tina') },
		{ id: await db.user('t3@test.ch', 'Tom') }
	];
	const pos = [{ id: await db.user('p1@test.ch', 'Paul') }, { id: await db.user('p2@test.ch', 'Pia') }];
	const chef = trp[0];
	const fremd = { id: await db.user('fremd@test.ch', 'Fritz Fremd') };

	const [{ create_guugge: guugge }] = await db.as<{ create_guugge: string }>(
		leitung,
		`select create_guugge('Schuegu')`
	);
	const [{ create_invite: token }] = await db.as<{ create_invite: string }>(
		leitung,
		`select create_invite($1)`,
		[guugge]
	);
	for (const [p, voice] of [
		[trp[0], 'trp1'],
		[trp[1], 'trp2'],
		[trp[2], 'trp1'],
		[pos[0], 'pos1'],
		[pos[1], 'pos2']
	] as const) {
		await db.as(p, `select accept_invite($1)`, [token]);
		await db.as(p, `select set_my_voice($1, $2)`, [guugge, voice]);
	}
	await db.as(leitung, `select set_member_role($1, $2, 'registerchef')`, [guugge, chef.id]);
	const [{ create_guugge: fremdGuugge }] = await db.as<{ create_guugge: string }>(
		fremd,
		`select create_guugge('Andere Guugge')`
	);

	const [{ id: title }] = await db.owner<{ id: string }>(
		`insert into titles (slug, name, version, bpm, bars, sections, voices, published)
		 values ('test-titel', 'Testtitel', 'Test', 115, 96,
		   '[{"from":1,"to":8,"name":"A"},{"from":9,"to":16,"name":"B"},{"from":17,"to":24,"name":"C"}]', '[]', true)
		 returning id`
	);
	return { db, guugge, title, leitung, trp, pos, chef, fremd, fremdGuugge };
}

/** Ergebnis und Punkte direkt mit der Service-Rolle schreiben (ohne start_exam/finish_exam). */
export async function passed(f: Fixture, user: string, section: number, stage: number) {
	await f.db.as(
		'service',
		`insert into exam_results (user_id, guugge_id, title_id, voice, section, stage, score, via, passed)
		 values ($1, $2, $3, 'trp1', $4, $5, 0.9, 'mic', true)`,
		[user, f.guugge, f.title, section, stage]
	);
	await f.db.as(
		'service',
		`insert into points_ledger (user_id, guugge_id, points, reason) values ($1, $2, 40, 'etappe')`,
		[user, f.guugge]
	);
}

