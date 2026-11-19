// Zugriffsregeln (RLS) und Funktionen pro Rolle: nicht angemeldet, fremde Person, Mitglied,
// Registerchef, Leitung, Service-Rolle (Server). Abnahme M2 in docs/05.

import { beforeAll, describe, expect, it } from 'vitest';
import { DENIED, fixture, passed, type Fixture } from './fixture';

const TABLES = [
	'profiles',
	'guuggen',
	'memberships',
	'invites',
	'titles',
	'title_assets',
	'licenses',
	'plans',
	'hints',
	'hint_reads',
	'exam_results',
	'points_ledger',
	'practice_days',
	'signups',
	'feedback'
];

describe('nicht angemeldet', () => {
	let f: Fixture;
	beforeAll(async () => {
		f = await fixture();
	});

	it('liest keine Tabelle', async () => {
		for (const t of TABLES) {
			await expect(f.db.as('anon', `select * from ${t}`), t).rejects.toThrow(DENIED);
		}
	});

	it('ruft keine Funktion des Probelokals auf, nur signup', async () => {
		for (const call of [
			`select create_guugge('X')`,
			`select accept_invite('x')`,
			`select guugge_members('${'0'.repeat(8)}-0000-0000-0000-000000000000')`
		]) {
			await expect(f.db.as('anon', call), call).rejects.toThrow(DENIED);
		}
		await f.db.as('anon', `select signup('neu@test.ch', true, 'test')`);
		expect(await f.db.owner(`select email from signups`)).toEqual([{ email: 'neu@test.ch' }]);
	});
});

describe('Profile', () => {
	let f: Fixture;
	beforeAll(async () => {
		f = await fixture();
	});

	it('entstehen beim Anmelden mit dem Namen aus den Metadaten', async () => {
		expect(await f.db.as(f.trp[1], `select display_name from profiles`)).toEqual([
			{ display_name: 'Tina' }
		]);
	});

	it('eigenen Namen ändern ja, fremde Profile weder lesen noch ändern', async () => {
		await f.db.as(f.trp[1], `update profiles set display_name = 'Tina T.'`);
		await f.db.as(f.trp[1], `update profiles set display_name = 'gehackt' where id = $1`, [
			f.trp[0].id
		]);
		const names = await f.db.owner<{ display_name: string }>(
			`select display_name from profiles where id in ($1, $2) order by display_name`,
			[f.trp[0].id, f.trp[1].id]
		);
		expect(names.map((n) => n.display_name)).toEqual(['Tina T.', 'Toni']);
		await expect(
			f.db.as(f.trp[1], `insert into profiles (id) values (gen_random_uuid())`)
		).rejects.toThrow(DENIED);
	});
});

describe('Guugge und Einladung', () => {
	let f: Fixture;
	beforeAll(async () => {
		f = await fixture();
	});

	it('wer anlegt, ist Leitung; Mitglieder sehen Namen, Rollen und Stimmen', async () => {
		const members = await f.db.as<{ display_name: string; role: string; voice: string | null }>(
			f.pos[0],
			`select display_name, role, voice from guugge_members($1)`,
			[f.guugge]
		);
		expect(members).toContainEqual({ display_name: 'Lea Leitung', role: 'leitung', voice: null });
		expect(members).toContainEqual({ display_name: 'Toni', role: 'registerchef', voice: 'trp1' });
		expect(members).toHaveLength(6);
		expect(await f.db.as(f.fremd, `select * from guugge_members($1)`, [f.guugge])).toEqual([]);
	});

	it('fremde Person sieht die Guugge nicht', async () => {
		expect(await f.db.as(f.fremd, `select name from guuggen`)).toEqual([
			{ name: 'Andere Guugge' }
		]);
	});

	it('Guugge direkt anlegen geht nicht, nur über create_guugge', async () => {
		await expect(f.db.as(f.fremd, `insert into guuggen (name) values ('X')`)).rejects.toThrow(
			DENIED
		);
	});

	it('nur die Leitung lädt ein; im Link steht der Schlüssel, gespeichert ist nur der Hash', async () => {
		await expect(
			f.db.as(f.pos[0], `select create_invite($1)`, [f.guugge])
		).rejects.toThrow('Nur die Leitung kann einladen.');
		await expect(
			f.db.as(f.chef, `select create_invite($1)`, [f.guugge])
		).rejects.toThrow('Nur die Leitung kann einladen.');
		const [{ create_invite: token }] = await f.db.as<{ create_invite: string }>(
			f.leitung,
			`select create_invite($1, 'mitglied', 7)`,
			[f.guugge]
		);
		expect(token).toMatch(/^[0-9a-f]{64}$/);
		const stored = await f.db.owner<{ token_hash: string }>(`select token_hash from invites`);
		expect(stored.map((s) => s.token_hash)).not.toContain(token);
		await expect(f.db.as(f.leitung, `select * from invites`)).rejects.toThrow(DENIED);
	});

	it('falscher oder abgelaufener Schlüssel: freundliche Meldung', async () => {
		const neu = { id: await f.db.user('neu@test.ch') };
		await expect(f.db.as(neu, `select accept_invite('falsch')`)).rejects.toThrow(
			'Diese Einladung gilt nicht mehr.'
		);
		const [{ create_invite: token }] = await f.db.as<{ create_invite: string }>(
			f.leitung,
			`select create_invite($1)`,
			[f.guugge]
		);
		await f.db.owner(`update invites set expires_at = now() - interval '1 minute'`);
		await expect(f.db.as(neu, `select accept_invite($1)`, [token])).rejects.toThrow(
			'Diese Einladung gilt nicht mehr.'
		);
	});

	it('wer schon dabei ist, behält beim Annehmen seine Rolle; Zurückziehen sperrt den Link', async () => {
		const [{ create_invite: token }] = await f.db.as<{ create_invite: string }>(
			f.leitung,
			`select create_invite($1, 'leitung')`,
			[f.guugge]
		);
		await f.db.as(f.leitung, `select accept_invite($1)`, [token]);
		await f.db.as(f.pos[1], `select accept_invite($1)`, [token]);
		const roles = await f.db.owner<{ role: string }>(
			`select role from memberships where guugge_id = $1 and user_id in ($2, $3) order by role`,
			[f.guugge, f.leitung.id, f.pos[1].id]
		);
		// pos[1] war Mitglied und wird nicht über einen Leitungs-Link befördert
		expect(roles.map((r) => r.role)).toEqual(['leitung', 'mitglied']);
		await f.db.as(f.leitung, `select revoke_invites($1)`, [f.guugge]);
		const neu = { id: await f.db.user('spaet@test.ch') };
		await expect(f.db.as(neu, `select accept_invite($1)`, [token])).rejects.toThrow(
			'Diese Einladung gilt nicht mehr.'
		);
	});
});

describe('Rollen, Stimme und Opt-in', () => {
	let f: Fixture;
	beforeAll(async () => {
		f = await fixture();
	});

	const roleOf = async (user: string) =>
		(
			await f.db.owner<{ role: string }>(
				`select role from memberships where guugge_id = $1 and user_id = $2`,
				[f.guugge, user]
			)
		)[0]?.role;

	it('Mitglied macht sich nicht selbst zur Leitung (Lücke aus 0001)', async () => {
		await expect(
			f.db.as(f.pos[0], `update memberships set role = 'leitung' where user_id = $1`, [
				f.pos[0].id
			])
		).rejects.toThrow(DENIED);
		await expect(
			f.db.as(f.pos[0], `select set_member_role($1, $2, 'leitung')`, [f.guugge, f.pos[0].id])
		).rejects.toThrow('Nur die Leitung kann Rollen ändern.');
		await expect(
			f.db.as(f.fremd, `insert into memberships (guugge_id, user_id, role) values ($1, $2, 'leitung')`, [
				f.guugge,
				f.fremd.id
			])
		).rejects.toThrow(DENIED);
		expect(await roleOf(f.pos[0].id)).toBe('mitglied');
		expect(await roleOf(f.fremd.id)).toBeUndefined();
	});

	it('Mitglied sieht nur die eigene Mitgliedschaft, die Leitung alle', async () => {
		expect(await f.db.as(f.pos[0], `select user_id from memberships`)).toEqual([
			{ user_id: f.pos[0].id }
		]);
		expect(
			await f.db.as(f.leitung, `select user_id from memberships where guugge_id = $1`, [f.guugge])
		).toHaveLength(6);
	});

	it('Stimme wählen setzt das Register; unbekannte Stimmen und fremde Guuggen gehen nicht', async () => {
		await f.db.as(f.pos[1], `select set_my_voice($1, 'euph')`, [f.guugge]);
		expect(
			await f.db.owner(`select voice, register from memberships where guugge_id = $1 and user_id = $2`, [
				f.guugge,
				f.pos[1].id
			])
		).toEqual([{ voice: 'euph', register: 'tief' }]);
		await f.db.as(f.pos[1], `select set_my_voice($1, 'pos2')`, [f.guugge]);
		await expect(
			f.db.as(f.pos[1], `select set_my_voice($1, 'blockflöte')`, [f.guugge])
		).rejects.toThrow('Unbekannte Stimme.');
		await expect(
			f.db.as(f.pos[1], `select set_my_voice($1, 'trp1')`, [f.fremdGuugge])
		).rejects.toThrow('Du bist nicht in dieser Guugge.');
	});

	it('Rangliste: Opt-in setzt nur die Person selbst', async () => {
		await f.db.as(f.trp[1], `select set_rangliste_opt_in($1, true)`, [f.guugge]);
		await expect(
			f.db.as(f.leitung, `update memberships set rangliste_opt_in = true where user_id = $1`, [
				f.trp[2].id
			])
		).rejects.toThrow(DENIED);
		const optIn = await f.db.owner<{ user_id: string }>(
			`select user_id from memberships where guugge_id = $1 and rangliste_opt_in`,
			[f.guugge]
		);
		expect(optIn).toEqual([{ user_id: f.trp[1].id }]);
	});

	it('die letzte Leitung bleibt; Leitung abgeben, dann austreten', async () => {
		await expect(
			f.db.as(f.leitung, `select set_member_role($1, $2, 'mitglied')`, [f.guugge, f.leitung.id])
		).rejects.toThrow('mindestens eine Leitung');
		await expect(
			f.db.as(f.leitung, `select remove_member($1, $2)`, [f.guugge, f.leitung.id])
		).rejects.toThrow('mindestens eine Leitung');
		await f.db.as(f.leitung, `select set_member_role($1, $2, 'leitung')`, [f.guugge, f.pos[0].id]);
		await f.db.as(f.leitung, `select remove_member($1, $2)`, [f.guugge, f.leitung.id]);
		expect(await roleOf(f.leitung.id)).toBeUndefined();
		expect(await roleOf(f.pos[0].id)).toBe('leitung');
	});

	it('Mitglied tritt selbst aus, entfernt aber niemand anderen', async () => {
		await expect(
			f.db.as(f.trp[2], `select remove_member($1, $2)`, [f.guugge, f.trp[1].id])
		).rejects.toThrow('Nur die Leitung kann Mitglieder entfernen.');
		await f.db.as(f.trp[2], `select remove_member($1, $2)`, [f.guugge, f.trp[2].id]);
		expect(await roleOf(f.trp[2].id)).toBeUndefined();
	});
});

describe('Fortschritt: Einzelwerte nur für die Person selbst', () => {
	let f: Fixture;
	beforeAll(async () => {
		f = await fixture();
		await passed(f, f.trp[0].id, 1, 2);
		await passed(f, f.trp[1].id, 1, 1);
		await f.db.as('service', `insert into practice_days (user_id, day) values ($1, current_date)`, [
			f.trp[0].id
		]);
	});

	it('Mitglied sieht eigene Etappen, Punkte und Übetage, keine fremden', async () => {
		for (const t of ['exam_results', 'points_ledger', 'practice_days']) {
			const rows = await f.db.as<{ user_id: string }>(f.trp[0], `select user_id from ${t}`);
			expect(rows.length, t).toBeGreaterThan(0);
			expect(new Set(rows.map((r) => r.user_id)), t).toEqual(new Set([f.trp[0].id]));
			expect(await f.db.as(f.trp[2], `select * from ${t}`), t).toEqual([]);
		}
	});

	it('Leitung und Registerchef lesen keine Einzelwerte', async () => {
		for (const who of [f.leitung, f.chef]) {
			const rows = await f.db.as<{ user_id: string }>(
				who,
				`select user_id from exam_results where user_id <> $1`,
				[who.id]
			);
			expect(rows).toEqual([]);
		}
	});

	it('ein Client schreibt weder Punkte noch Etappen noch Übetage', async () => {
		const me = f.trp[2];
		for (const sql of [
			`insert into points_ledger (user_id, guugge_id, points, reason) values ('${me.id}', '${f.guugge}', 1000, 'selbst')`,
			`insert into exam_results (user_id, guugge_id, title_id, voice, section, stage, score, via, passed)
			 values ('${me.id}', '${f.guugge}', '${f.title}', 'trp1', 0, 5, 1, 'mic', true)`,
			`insert into practice_days (user_id, day) values ('${me.id}', current_date)`,
			`update points_ledger set points = 1000`,
			`delete from exam_results`
		]) {
			await expect(f.db.as(me, sql), sql).rejects.toThrow(DENIED);
		}
		expect(await f.db.owner(`select * from points_ledger where user_id = $1`, [me.id])).toEqual([]);
	});
});

describe('Übersicht der Leitung: nur Aggregate, ab 3 Personen pro Register', () => {
	let f: Fixture;
	beforeAll(async () => {
		f = await fixture();
		// Teil A: Trompeten 2, 4 und nichts; Posaunen 5 und 5 (Register zu klein)
		await passed(f, f.trp[0].id, 1, 2);
		await passed(f, f.trp[1].id, 1, 4);
		await passed(f, f.pos[0].id, 1, 5);
		await passed(f, f.pos[1].id, 1, 5);
		await f.db.as('service', `insert into practice_days (user_id, day) values ($1, current_date)`, [
			f.trp[1].id
		]);
	});

	type Row = {
		register: string;
		persons: number;
		avg_stage_by_section: Record<string, number>;
		practiced_this_week: number;
	};

	it('Trompeten mit Schnitt über alle drei (auch ohne Ergebnis, Pause = 5), Posaunen gar nicht', async () => {
		const rows = await f.db.as<Row>(f.leitung, `select * from register_overview($1, $2)`, [
			f.guugge,
			f.title
		]);
		expect(rows).toEqual([
			{
				register: 'trp',
				persons: 3,
				// Teil C: Trompete 1 (zwei Personen) hat Pause und zählt wie erledigt
				avg_stage_by_section: { '1': 2, '2': 0, '3': 3.3 },
				practiced_this_week: 1
			}
		]);
	});

	it('nur für die Leitung', async () => {
		for (const who of [f.chef, f.pos[0], f.fremd]) {
			expect(
				await f.db.as(who, `select * from register_overview($1, $2)`, [f.guugge, f.title])
			).toEqual([]);
		}
	});
});

describe('Rangliste: nur eingeschaltet und nur mit Opt-in', () => {
	let f: Fixture;
	beforeAll(async () => {
		f = await fixture();
		await passed(f, f.trp[0].id, 1, 1);
		await passed(f, f.trp[1].id, 1, 1);
		await f.db.as(f.trp[1], `select set_rangliste_opt_in($1, true)`, [f.guugge]);
	});

	it('ausgeschaltet: leer, auch mit Opt-in', async () => {
		expect(await f.db.as(f.trp[1], `select * from leaderboard($1)`, [f.guugge])).toEqual([]);
	});

	it('eingeschaltet: nur wer mitmacht, und nur für Mitglieder', async () => {
		await f.db.as(f.leitung, `update guuggen set rangliste_enabled = true where id = $1`, [f.guugge]);
		const rows = await f.db.as<{ display_name: string; points: number }>(
			f.pos[0],
			`select display_name, points from leaderboard($1)`,
			[f.guugge]
		);
		expect(rows).toEqual([{ display_name: 'Tina', points: 40 }]);
		expect(await f.db.as(f.fremd, `select * from leaderboard($1)`, [f.guugge])).toEqual([]);
	});

	it('nur die Leitung schaltet sie ein', async () => {
		await f.db.as(f.pos[0], `update guuggen set rangliste_enabled = false where id = $1`, [f.guugge]);
		expect(
			await f.db.owner(`select rangliste_enabled from guuggen where id = $1`, [f.guugge])
		).toEqual([{ rangliste_enabled: true }]);
	});
});

describe('Hinweise, Pläne, Lizenzen', () => {
	let f: Fixture;
	let hint: string;
	beforeAll(async () => {
		f = await fixture();
		[{ id: hint }] = await f.db.as<{ id: string }>(
			f.leitung,
			`insert into hints (guugge_id, title_id, bar_from, bar_to, target, kind, dyn, created_by)
			 values ($1, $2, 9, 12, 'trp', 'dyn', 'pp', $3) returning id`,
			[f.guugge, f.title, f.leitung.id]
		);
	});

	it('Leitung schreibt Hinweise, Mitglieder lesen sie, Fremde sehen nichts', async () => {
		expect(await f.db.as(f.trp[1], `select dyn from hints`)).toEqual([{ dyn: 'pp' }]);
		expect(await f.db.as(f.fremd, `select * from hints`)).toEqual([]);
		await expect(
			f.db.as(
				f.trp[1],
				`insert into hints (guugge_id, title_id, bar_from, bar_to, target, kind) values ($1, $2, 1, 1, 'alle', 'text')`,
				[f.guugge, f.title]
			)
		).rejects.toThrow(DENIED);
	});

	it('gelesen markieren nur für Hinweise der eigenen Guugge', async () => {
		await f.db.as(f.trp[1], `insert into hint_reads (hint_id, user_id) values ($1, $2)`, [
			hint,
			f.trp[1].id
		]);
		await expect(
			f.db.as(f.fremd, `insert into hint_reads (hint_id, user_id) values ($1, $2)`, [hint, f.fremd.id])
		).rejects.toThrow(DENIED);
	});

	it('Plan: Mitglieder lesen, nur die Leitung schreibt', async () => {
		await f.db.as(
			f.leitung,
			`insert into plans (guugge_id, title_id, start_date, perf_date, gp_weekday) values ($1, $2, '2026-11-01', '2027-02-20', 3)`,
			[f.guugge, f.title]
		);
		expect(await f.db.as(f.trp[1], `select gp_weekday from plans`)).toEqual([{ gp_weekday: 3 }]);
		await f.db.as(f.trp[1], `update plans set gp_weekday = 5`);
		expect(await f.db.owner(`select gp_weekday from plans`)).toEqual([{ gp_weekday: 3 }]);
		expect(await f.db.as(f.fremd, `select * from plans`)).toEqual([]);
	});

	it('Noten und Audio nur mit Lizenz der eigenen Guugge; Lizenzen schreibt nur der Server', async () => {
		await f.db.owner(
			`insert into title_assets (title_id, kind, voice, storage_path) values ($1, 'minus', 'trp1', 'x/minus_trp1.mp3')`,
			[f.title]
		);
		expect(await f.db.as(f.trp[1], `select * from title_assets`)).toEqual([]);
		await expect(
			f.db.as(f.leitung, `insert into licenses (guugge_id, title_id) values ($1, $2)`, [
				f.guugge,
				f.title
			])
		).rejects.toThrow(DENIED);
		await f.db.as('service', `insert into licenses (guugge_id, title_id) values ($1, $2)`, [
			f.guugge,
			f.title
		]);
		expect(await f.db.as(f.trp[1], `select storage_path from title_assets`)).toEqual([
			{ storage_path: 'x/minus_trp1.mp3' }
		]);
		expect(await f.db.as(f.fremd, `select * from title_assets`)).toEqual([]);
	});
});

describe('Konto-Funktionen für die Oberfläche', () => {
	let f: Fixture;
	beforeAll(async () => {
		f = await fixture();
	});

	it('my_account: eigener Name und eigene Guuggen, keine fremden', async () => {
		const [{ my_account: acc }] = await f.db.as<{ my_account: unknown }>(
			f.trp[1],
			`select my_account()`
		);
		expect(acc).toEqual({
			display_name: 'Tina',
			guuggen: [
				{
					id: f.guugge,
					name: 'Schuegu',
					role: 'mitglied',
					voice: 'trp2',
					register: 'trp',
					rangliste_opt_in: false,
					rangliste_enabled: false
				}
			]
		});
		const [{ my_account: other }] = await f.db.as<{ my_account: { guuggen: { name: string }[] } }>(
			f.fremd,
			`select my_account()`
		);
		expect(other.guuggen.map((g) => g.name)).toEqual(['Andere Guugge']);
	});

	it('set_my_name ändert nur den eigenen Namen, höchstens 40 Zeichen', async () => {
		await f.db.as(f.trp[1], `select set_my_name('  Tina B.  ')`);
		expect(
			await f.db.owner(`select display_name from profiles where id = $1`, [f.trp[1].id])
		).toEqual([{ display_name: 'Tina B.' }]);
		await expect(
			f.db.as(f.trp[1], `select set_my_name($1)`, ['x'.repeat(41)])
		).rejects.toThrow(/profiles_display_name_len/);
	});

	it('Rangliste ein- und ausschalten nur durch die Leitung', async () => {
		await expect(
			f.db.as(f.chef, `select set_rangliste_enabled($1, true)`, [f.guugge])
		).rejects.toThrow('Nur die Leitung');
		await f.db.as(f.leitung, `select set_rangliste_enabled($1, true)`, [f.guugge]);
		expect(
			await f.db.owner(`select rangliste_enabled from guuggen where id = $1`, [f.guugge])
		).toEqual([{ rangliste_enabled: true }]);
	});

	it('nicht angemeldet: keine Konto-Funktionen', async () => {
		await expect(f.db.as('anon', `select my_account()`)).rejects.toThrow(DENIED);
	});
});

describe('Gesamtplan und eigener Stand', () => {
	let f: Fixture;
	const plan = (who: { id: string }, start: string, perf: string, gp = 3, rp: number | null = 1) =>
		f.db.as(who, `select set_plan($1, 'test-titel', $2, $3, $4, $5, 60)`, [
			f.guugge,
			start,
			perf,
			gp,
			rp
		]);
	beforeAll(async () => {
		f = await fixture();
	});

	it('nur die Leitung schreibt den Plan, alle Mitglieder lesen ihn', async () => {
		expect(
			await f.db.as<{ get_plan: unknown }>(f.trp[1], `select get_plan($1, 'test-titel')`, [
				f.guugge
			])
		).toEqual([{ get_plan: null }]);
		await expect(plan(f.chef, '2026-11-02', '2027-02-20')).rejects.toThrow(
			'Nur die Leitung kann den Plan ändern.'
		);
		await plan(f.leitung, '2026-11-02', '2027-02-20');
		await plan(f.leitung, '2026-11-02', '2027-02-27', 4, null);
		const [{ get_plan: p }] = await f.db.as<{ get_plan: Record<string, unknown> }>(
			f.pos[0],
			`select get_plan($1, 'test-titel')`,
			[f.guugge]
		);
		expect(p).toMatchObject({
			start: '2026-11-02',
			perf: '2027-02-27',
			gp_weekday: 4,
			rp_weekday: null,
			minutes_per_week: 60
		});
		await expect(
			f.db.as(f.fremd, `select get_plan($1, 'test-titel')`, [f.guugge])
		).rejects.toThrow('Du bist nicht in dieser Guugge.');
	});

	it('unsinnige Pläne werden abgewiesen', async () => {
		await expect(plan(f.leitung, '2026-11-02', '2026-11-02')).rejects.toThrow(
			'Der Auftritt muss nach dem Start liegen.'
		);
		await expect(plan(f.leitung, '2026-11-02', '2028-01-01')).rejects.toThrow(
			'höchstens ein Jahr'
		);
		await expect(plan(f.leitung, '2026-11-02', '2027-01-01', 7)).rejects.toThrow(
			'Unbekannter Wochentag.'
		);
		await expect(
			f.db.as(f.leitung, `select set_plan($1, 'gibts-nicht', '2026-11-02', '2027-01-01', 3, null, 0)`, [
				f.guugge
			])
		).rejects.toThrow('Diesen Titel gibt es nicht.');
	});

	it('eigener Stand: höchste bestandene Etappe, »ohne Mikrofon« markiert, nur die eigenen', async () => {
		const exam = (user: string, section: number, stage: number, via: string, ok = true) =>
			f.db.as(
				'service',
				`insert into exam_results (user_id, guugge_id, title_id, voice, section, stage, score, via, passed)
				 values ($1, $2, $3, 'trp1', $4, $5, 0.9, $6, $7)`,
				[user, f.guugge, f.title, section, stage, via, ok]
			);
		await exam(f.trp[0].id, 1, 1, 'quiz');
		await exam(f.trp[0].id, 1, 2, 'grip');
		await exam(f.trp[0].id, 1, 3, 'rhythm');
		await exam(f.trp[0].id, 1, 4, 'rhythm');
		await exam(f.trp[0].id, 1, 5, 'mic', false);
		await exam(f.trp[0].id, 2, 1, 'quiz');
		await exam(f.trp[1].id, 1, 1, 'quiz');
		const rows = await f.db.as(
			f.trp[0],
			`select voice, section, stage, rhythm_only from my_stages($1, 'test-titel') order by section`,
			[f.guugge]
		);
		expect(rows).toEqual([
			{ voice: 'trp1', section: 1, stage: 4, rhythm_only: [4] },
			{ voice: 'trp1', section: 2, stage: 1, rhythm_only: [] }
		]);
		await exam(f.trp[0].id, 1, 4, 'mic');
		const again = await f.db.as<{ rhythm_only: number[] }>(
			f.trp[0],
			`select rhythm_only from my_stages($1, 'test-titel') where section = 1`,
			[f.guugge]
		);
		expect(again).toEqual([{ rhythm_only: [] }]);
	});
});

describe('Belohnungen, Punkteliste, Übersicht über den Kurznamen', () => {
	let f: Fixture;
	beforeAll(async () => {
		f = await fixture();
		await passed(f, f.trp[0].id, 1, 1);
	});

	it('Belohnungen legt nur die Leitung fest, alle Mitglieder sehen sie', async () => {
		const rewards = { '2': 'Getränk nach der Probe', '5': 'Solo am Umzug' };
		await expect(
			f.db.as(f.chef, `select set_level_rewards($1, $2)`, [f.guugge, JSON.stringify(rewards)])
		).rejects.toThrow('Nur die Leitung');
		await f.db.as(f.leitung, `select set_level_rewards($1, $2)`, [
			f.guugge,
			JSON.stringify(rewards)
		]);
		const [{ guugge_settings: s }] = await f.db.as<{ guugge_settings: unknown }>(
			f.pos[1],
			`select guugge_settings($1)`,
			[f.guugge]
		);
		expect(s).toEqual({ rangliste_enabled: false, level_rewards: rewards });
		expect(
			await f.db.as(f.fremd, `select guugge_settings($1) as s`, [f.guugge])
		).toEqual([{ s: null }]);
		for (const bad of [{ '1': 'x' }, { '3': 'x'.repeat(81) }, { '4': 5 }]) {
			await expect(
				f.db.as(f.leitung, `select set_level_rewards($1, $2)`, [f.guugge, JSON.stringify(bad)])
			).rejects.toThrow('Level 2 bis 7');
		}
	});

	it('Punkteliste nur mit den eigenen Einträgen', async () => {
		expect(
			await f.db.as(f.trp[0], `select points, reason from my_points_log($1)`, [f.guugge])
		).toEqual([{ points: 40, reason: 'etappe' }]);
		expect(await f.db.as(f.trp[1], `select * from my_points_log($1)`, [f.guugge])).toEqual([]);
	});

	it('Übersicht über den Kurznamen, nur für die Leitung', async () => {
		const rows = await f.db.as<{ register: string }>(
			f.leitung,
			`select register from leitung_overview($1, 'test-titel')`,
			[f.guugge]
		);
		expect(rows).toEqual([{ register: 'trp' }]);
		expect(
			await f.db.as(f.chef, `select * from leitung_overview($1, 'test-titel')`, [f.guugge])
		).toEqual([]);
	});
});

describe('Hinweise der Leitung', () => {
	let f: Fixture;
	const add = (who: { id: string }, args: unknown[]) =>
		f.db
			.as<{ id: string }>(
				who,
				`select add_hint($1, 'test-titel', $2, $3, $4, $5, $6, $7) as id`,
				[f.guugge, ...args]
			)
			.then((r) => r[0].id);
	let ids: Record<string, string> = {};
	beforeAll(async () => {
		f = await fixture();
		ids = {
			alle: await add(f.leitung, [1, 4, 'alle', 'atem', null, null]),
			trp: await add(f.leitung, [9, 12, 'trp', 'dyn', 'pp', 'Trompeten zurück']),
			trp1: await add(f.leitung, [13, 13, 'trp1', 'text', null, 'Hier Solo']),
			pos: await add(f.leitung, [17, 20, 'pos', 'artik', null, 'kurz'])
		};
	});

	it('nur die Leitung trägt ein; unsinnige Hinweise werden abgewiesen', async () => {
		await expect(add(f.chef, [1, 1, 'alle', 'atem', null, null])).rejects.toThrow(
			'Nur die Leitung kann Hinweise eintragen.'
		);
		for (const [args, msg] of [
			[[0, 1, 'alle', 'atem', null, null], 'Takte von 1 bis 95'],
			[[5, 4, 'alle', 'atem', null, null], 'Takte von 1 bis 95'],
			[[1, 96, 'alle', 'atem', null, null], 'Takte von 1 bis 95'],
			[[1, 1, 'xyz', 'atem', null, null], 'Für wen ist der Hinweis?'],
			[[1, 1, 'alle', 'dyn', 'laut', null], 'Bitte eine Stärke wählen.'],
			[[1, 1, 'alle', 'artik', null, '  '], 'Bitte einen kurzen Text eingeben.'],
			[[1, 1, 'alle', 'text', null, 'x'.repeat(161)], 'zu lang']
		] as const) {
			await expect(add(f.leitung, [...args]), msg).rejects.toThrow(msg);
		}
	});

	it('Mitglieder sehen alle Hinweise der Guugge, Fremde keine; neu bis gelesen', async () => {
		const rows = await f.db.as<{ id: string; is_read: boolean }>(
			f.trp[0],
			`select id, is_read from list_hints($1, 'test-titel')`,
			[f.guugge]
		);
		expect(rows.map((r) => r.id)).toEqual([ids.alle, ids.trp, ids.trp1, ids.pos]);
		expect(rows.every((r) => !r.is_read)).toBe(true);
		const lead = await f.db.as<{ is_read: boolean }>(
			f.leitung,
			`select is_read from list_hints($1, 'test-titel')`,
			[f.guugge]
		);
		expect(lead.every((r) => r.is_read)).toBe(true);
		expect(
			await f.db.as(f.fremd, `select * from list_hints($1, 'test-titel')`, [f.guugge])
		).toEqual([]);
	});

	it('gelesen markieren nur in eigenen Guuggen', async () => {
		const [{ n }] = await f.db.as<{ n: number }>(f.trp[0], `select mark_hints_read($1) as n`, [
			[ids.trp, ids.trp1]
		]);
		expect(n).toBe(2);
		const read = await f.db.as<{ id: string }>(
			f.trp[0],
			`select id from list_hints($1, 'test-titel') where is_read`,
			[f.guugge]
		);
		expect(read.map((r) => r.id)).toEqual([ids.trp, ids.trp1]);
		const [{ n: none }] = await f.db.as<{ n: number }>(f.fremd, `select mark_hints_read($1) as n`, [
			[ids.alle]
		]);
		expect(none).toBe(0);
	});

	it('löschen nur durch die Leitung', async () => {
		await expect(f.db.as(f.trp[0], `select delete_hint($1)`, [ids.pos])).rejects.toThrow(
			'Diesen Hinweis kannst du nicht löschen.'
		);
		await f.db.as(f.leitung, `select delete_hint($1)`, [ids.pos]);
		expect(
			await f.db.as(f.pos[0], `select id from list_hints($1, 'test-titel')`, [f.guugge])
		).toEqual([{ id: ids.alle }, { id: ids.trp }, { id: ids.trp1 }]);
	});
});

describe('Hinweise ohne Neuladen (Realtime)', () => {
	it('Hinweise stehen in der Realtime-Publikation, Mitglieder dürfen sie lesen, andere nicht', async () => {
		const f = await fixture();
		expect(
			await f.db.owner(
				`select tablename from pg_publication_tables where pubname = 'supabase_realtime'`
			)
		).toEqual([{ tablename: 'hints' }]);
		// Realtime liefert neue Zeilen nur, wenn die Person sie nach RLS lesen darf
		const [{ add_hint: h }] = await f.db.as<{ add_hint: string }>(
			f.leitung,
			`select add_hint($1, 'test-titel', 1, 2, 'alle', 'atem', null, null)`,
			[f.guugge]
		);
		const sees = (who: { id: string }) =>
			f.db.as(who, `select id from hints where id = $1`, [h]).then((r) => r.length);
		expect(await sees(f.trp[1])).toBe(1);
		expect(await sees(f.fremd)).toBe(0);
	});
});

describe('Konto löschen (Entscheid Matthias 18.11.2026)', () => {
	const count = (f: Fixture, sql: string, params: unknown[]) =>
		f.db.owner<{ n: number }>(`select count(*)::int as n from ${sql}`, params).then((r) => r[0].n);

	it('nicht angemeldet: nichts zu löschen', async () => {
		const f = await fixture();
		await expect(f.db.as('anon', `select delete_my_account('löschen')`)).rejects.toThrow(DENIED);
		await expect(f.db.as('anon', `select my_account_deletion()`)).rejects.toThrow(DENIED);
	});

	it('ohne »löschen« passiert nichts', async () => {
		const f = await fixture();
		await expect(f.db.as(f.trp[1], `select delete_my_account('ja')`)).rejects.toThrow(
			'Zum Bestätigen »löschen« eintippen.'
		);
		expect(await count(f, 'auth.users where id = $1', [f.trp[1].id])).toBe(1);
	});

	it('Mitglied: Konto und alles Persönliche weg, die anderen bleiben unberührt', async () => {
		const f = await fixture();
		const me = f.trp[1].id;
		await passed(f, me, 1, 1);
		await passed(f, f.trp[0].id, 1, 1);
		await f.db.owner(`insert into practice_days (user_id, day) values ($1, current_date)`, [me]);
		await f.db.as('anon', `select signup('t2@test.ch', true)`);
		await f.db.as('anon', `select signup('andere@test.ch', true)`);
		const [{ add_hint: hint }] = await f.db.as<{ add_hint: string }>(
			f.leitung,
			`select add_hint($1, 'test-titel', 1, 2, 'alle', 'atem', null, null)`,
			[f.guugge]
		);
		await f.db.as(f.trp[1], `select mark_hints_read(array[$1]::uuid[])`, [hint]);

		expect(await f.db.as(f.trp[1], `select my_account_deletion() as d`)).toEqual([
			{ d: { blocking: [], alone: [], licensed: [] } }
		]);
		await f.db.as(f.trp[1], `select delete_my_account(' Löschen ')`);

		for (const t of [
			'auth.users where id = $1',
			'profiles where id = $1',
			'memberships where user_id = $1',
			'exam_results where user_id = $1',
			'points_ledger where user_id = $1',
			'practice_days where user_id = $1',
			'hint_reads where user_id = $1'
		]) {
			expect(await count(f, t, [me]), t).toBe(0);
		}
		expect(await count(f, `signups where email = $1`, ['t2@test.ch'])).toBe(0);
		expect(await count(f, `signups where email = $1`, ['andere@test.ch'])).toBe(1);
		// die anderen: Guugge, Mitglieder, Werte und Hinweis bleiben
		expect(await count(f, 'guuggen where id = $1', [f.guugge])).toBe(1);
		expect(await count(f, 'memberships where guugge_id = $1', [f.guugge])).toBe(5);
		expect(await count(f, 'exam_results where user_id = $1', [f.trp[0].id])).toBe(1);
		expect(await count(f, 'hints where id = $1', [hint])).toBe(1);
	});

	it('einzige Leitung mit anderen Mitgliedern: gesperrt, bis die Leitung abgegeben ist', async () => {
		const f = await fixture();
		expect(await f.db.as(f.leitung, `select my_account_deletion() as d`)).toEqual([
			{ d: { blocking: [{ id: f.guugge, name: 'Schuegu' }], alone: [], licensed: [] } }
		]);
		await expect(f.db.as(f.leitung, `select delete_my_account('löschen')`)).rejects.toThrow(
			'Gib zuerst die Leitung ab: »Schuegu«'
		);
		expect(await count(f, 'auth.users where id = $1', [f.leitung.id])).toBe(1);

		// Leitung abgeben, dann geht es; der Hinweis der Leitung bleibt ohne Verfasser
		const [{ add_hint: hint }] = await f.db.as<{ add_hint: string }>(
			f.leitung,
			`select add_hint($1, 'test-titel', 1, 2, 'alle', 'atem', null, null)`,
			[f.guugge]
		);
		await f.db.as(f.leitung, `select set_member_role($1, $2, 'leitung')`, [f.guugge, f.chef.id]);
		expect(await f.db.as(f.leitung, `select my_account_deletion() as d`)).toEqual([
			{ d: { blocking: [], alone: [], licensed: [] } }
		]);
		await f.db.as(f.leitung, `select delete_my_account('löschen')`);
		expect(await count(f, 'profiles where id = $1', [f.leitung.id])).toBe(0);
		expect(
			await f.db.owner(`select created_by from hints where id = $1`, [hint])
		).toEqual([{ created_by: null }]);
		expect(await count(f, 'guuggen where id = $1', [f.guugge])).toBe(1);
	});

	it('Guugge, in der man allein ist, geht mit; fremde Guuggen bleiben', async () => {
		const f = await fixture();
		expect(await f.db.as(f.fremd, `select my_account_deletion() as d`)).toEqual([
			{ d: { blocking: [], alone: [{ id: f.fremdGuugge, name: 'Andere Guugge' }], licensed: [] } }
		]);
		await f.db.as(f.fremd, `select delete_my_account('löschen')`);
		expect(await count(f, 'guuggen where id = $1', [f.fremdGuugge])).toBe(0);
		expect(await count(f, 'guuggen where id = $1', [f.guugge])).toBe(1);
	});

	it('Hilfsfunktionen sind von aussen nicht aufrufbar', async () => {
		const f = await fixture();
		await expect(
			f.db.as(f.trp[1], `select * from guuggen_blocking_deletion($1)`, [f.leitung.id])
		).rejects.toThrow(DENIED);
		await expect(
			f.db.as(f.trp[1], `select * from guuggen_alone($1)`, [f.fremd.id])
		).rejects.toThrow(DENIED);
	});
});

describe('Rangliste: Woche in Schweizer Zeit', () => {
	it('Montag 0:30 in Zürich zählt zur neuen Woche, Sonntag 23:30 zur alten', async () => {
		const f = await fixture();
		await f.db.owner(`update guuggen set rangliste_enabled = true where id = $1`, [f.guugge]);
		await f.db.as(f.trp[1], `select set_rangliste_opt_in($1, true)`, [f.guugge]);
		// Montag dieser Woche (Schweizer Kalender) als Ortszeit, in einen Zeitpunkt umgerechnet
		await f.db.owner(
			`with mo as (select date_trunc('week', public.today_zurich())::date as d)
			 insert into points_ledger (user_id, guugge_id, points, reason, created_at)
			select $1::uuid, $2::uuid, 10, 'neue Woche', ((mo.d + time '00:30') at time zone 'Europe/Zurich') from mo
			 union all
			 select $1::uuid, $2::uuid, 5, 'alte Woche', ((mo.d - 1 + time '23:30') at time zone 'Europe/Zurich') from mo`,
			[f.trp[1].id, f.guugge]
		);
		expect(
			await f.db.as(f.trp[1], `select points, week_points from leaderboard($1)`, [f.guugge])
		).toEqual([{ points: 15, week_points: 10 }]);
	});
});

describe('Austritt: Daten in dieser Guugge werden gelöscht (Entscheid Matthias 18.11.2026)', () => {
	const count = (f: Fixture, sql: string, params: unknown[]) =>
		f.db.owner<{ n: number }>(`select count(*)::int as n from ${sql}`, params).then((r) => r[0].n);

	it('Etappen, Versuche, Punkte und gelesene Hinweise dieser Guugge weg; anderes bleibt', async () => {
		const f = await fixture();
		const me = f.trp[1];
		// zusätzlich Mitglied der anderen Guugge, mit Punkten dort
		const [{ create_invite: token }] = await f.db.as<{ create_invite: string }>(
			f.fremd,
			`select create_invite($1)`,
			[f.fremdGuugge]
		);
		await f.db.as(me, `select accept_invite($1)`, [token]);
		await passed(f, me.id, 1, 1);
		await passed(f, f.trp[0].id, 1, 1);
		await f.db.as(
			'service',
			`insert into points_ledger (user_id, guugge_id, points, reason) values ($1, $2, 25, 'Wochenziel')`,
			[me.id, f.fremdGuugge]
		);
		await f.db.owner(`insert into practice_days (user_id, day) values ($1, current_date)`, [me.id]);
		await f.db.as(me, `select start_exam($1, 'test-titel', 1, 2, 'grip')`, [f.guugge]);
		const [{ add_hint: hint }] = await f.db.as<{ add_hint: string }>(
			f.leitung,
			`select add_hint($1, 'test-titel', 1, 2, 'alle', 'atem', null, null)`,
			[f.guugge]
		);
		await f.db.as(me, `select mark_hints_read(array[$1]::uuid[])`, [hint]);

		await f.db.as(me, `select remove_member($1, $2)`, [f.guugge, me.id]);

		for (const t of [
			'exam_results where user_id = $1 and guugge_id = $2',
			'exam_attempts where user_id = $1 and guugge_id = $2',
			'points_ledger where user_id = $1 and guugge_id = $2',
			'hint_reads r join hints h on h.id = r.hint_id where r.user_id = $1 and h.guugge_id = $2'
		]) {
			expect(await count(f, t, [me.id, f.guugge]), t).toBe(0);
		}
		// bleibt: Punkte in der anderen Guugge, Übetage (gehören zum Konto), Werte der anderen
		expect(await count(f, 'points_ledger where user_id = $1 and guugge_id = $2', [me.id, f.fremdGuugge])).toBe(1);
		expect(await count(f, 'practice_days where user_id = $1', [me.id])).toBe(1);
		expect(await count(f, 'exam_results where user_id = $1', [f.trp[0].id])).toBe(1);
		expect(await count(f, 'hints where id = $1', [hint])).toBe(1);
	});

	it('Entfernen durch die Leitung löscht dasselbe', async () => {
		const f = await fixture();
		await passed(f, f.pos[0].id, 1, 1);
		await f.db.as(f.leitung, `select remove_member($1, $2)`, [f.guugge, f.pos[0].id]);
		expect(await count(f, 'exam_results where user_id = $1', [f.pos[0].id])).toBe(0);
		expect(await count(f, 'points_ledger where user_id = $1', [f.pos[0].id])).toBe(0);
	});
});

describe('Guugge auflösen (Entscheid Matthias 18.11.2026)', () => {
	const count = (f: Fixture, sql: string, params: unknown[]) =>
		f.db.owner<{ n: number }>(`select count(*)::int as n from ${sql}`, params).then((r) => r[0].n);

	it('nur die Leitung, nur mit dem richtigen Namen', async () => {
		const f = await fixture();
		await expect(
			f.db.as(f.chef, `select dissolve_guugge($1, 'Schuegu')`, [f.guugge])
		).rejects.toThrow('Nur die Leitung kann die Guugge auflösen.');
		await expect(
			f.db.as(f.leitung, `select dissolve_guugge($1, 'Schuegi')`, [f.guugge])
		).rejects.toThrow('Zum Bestätigen den Namen der Guugge eintippen.');
		await expect(f.db.as('anon', `select dissolve_guugge($1, 'Schuegu')`, [f.guugge])).rejects.toThrow(
			DENIED
		);
		expect(await count(f, 'guuggen where id = $1', [f.guugge])).toBe(1);
	});

	it('alles der Guugge weg, Konten, andere Guuggen und Übetage bleiben', async () => {
		const f = await fixture();
		await passed(f, f.trp[1].id, 1, 1);
		await f.db.owner(`insert into practice_days (user_id, day) values ($1, current_date)`, [f.trp[1].id]);
		const [{ add_hint: hint }] = await f.db.as<{ add_hint: string }>(
			f.leitung,
			`select add_hint($1, 'test-titel', 1, 2, 'alle', 'atem', null, null)`,
			[f.guugge]
		);
		await f.db.as(f.trp[1], `select mark_hints_read(array[$1]::uuid[])`, [hint]);
		await f.db.as(f.leitung, `select create_invite($1)`, [f.guugge]);

		await f.db.as(f.leitung, `select dissolve_guugge($1, '  schuegu ')`, [f.guugge]);

		for (const t of [
			'guuggen where id = $1',
			'memberships where guugge_id = $1',
			'invites where guugge_id = $1',
			'hints where guugge_id = $1',
			'exam_results where guugge_id = $1',
			'points_ledger where guugge_id = $1'
		]) {
			expect(await count(f, t, [f.guugge]), t).toBe(0);
		}
		expect(await count(f, 'hint_reads where hint_id = $1', [hint])).toBe(0);
		expect(await count(f, 'profiles where id = $1', [f.trp[1].id])).toBe(1);
		expect(await count(f, 'practice_days where user_id = $1', [f.trp[1].id])).toBe(1);
		expect(await count(f, 'guuggen where id = $1', [f.fremdGuugge])).toBe(1);
	});

	it('mit gekauftem Arrangement gesperrt', async () => {
		const f = await fixture();
		await f.db.as('service', `insert into licenses (guugge_id, title_id) values ($1, $2)`, [
			f.guugge,
			f.title
		]);
		await expect(
			f.db.as(f.leitung, `select dissolve_guugge($1, 'Schuegu')`, [f.guugge])
		).rejects.toThrow('gekaufte Arrangements');
		expect(await count(f, 'guuggen where id = $1', [f.guugge])).toBe(1);
	});
});

describe('Rückmeldung (Entscheid Matthias 19.11.2026)', () => {
	const send = (f: Fixture, who: { id: string } | 'anon', body = 'Teil G rot', reply = false) =>
		f.db.as(who, `select send_feedback('fehler', $1, $2::jsonb, $3)`, [
			body,
			JSON.stringify({ page: 'Stück üben', where: 'Teil G · Takt 31', voice: 'Trp 1', device: 'iPhone · Safari 18' }),
			reply
		]);

	it('nur angemeldet; lesen kann niemand ausser der Service-Rolle', async () => {
		const f = await fixture();
		await expect(send(f, 'anon')).rejects.toThrow(DENIED);
		await send(f, f.trp[1]);
		for (const who of [f.trp[1], f.leitung, f.fremd]) {
			await expect(f.db.as(who, `select * from feedback`)).rejects.toThrow(DENIED);
		}
		const rows = await f.db.as<{ kind: string; body: string; context: unknown; email: string | null }>(
			'service',
			`select kind, body, context, email from feedback`
		);
		expect(rows).toEqual([
			{
				kind: 'fehler',
				body: 'Teil G rot',
				context: { page: 'Stück üben', where: 'Teil G · Takt 31', voice: 'Trp 1', device: 'iPhone · Safari 18' },
				email: null
			}
		]);
	});

	it('E-Mail nur, wenn antworten erlaubt ist', async () => {
		const f = await fixture();
		await send(f, f.trp[1], 'Bitte antworten', true);
		expect(await f.db.as('service', `select email, reply_ok from feedback`)).toEqual([
			{ email: 't2@test.ch', reply_ok: true }
		]);
	});

	it('leer oder zu lang abgewiesen; Kontext auf bekannte Felder gekürzt', async () => {
		const f = await fixture();
		await expect(send(f, f.trp[1], '   ')).rejects.toThrow('Schreib ein paar Worte.');
		await expect(send(f, f.trp[1], 'x'.repeat(2001))).rejects.toThrow('Das ist zu lang');
		await f.db.as(f.trp[1], `select send_feedback('idee', 'ok', $1::jsonb, false)`, [
			JSON.stringify({ page: 'p'.repeat(300), secret: 'nein', device: 42 })
		]);
		const [{ context }] = await f.db.as<{ context: Record<string, string> }>(
			'service',
			`select context from feedback`
		);
		expect(Object.keys(context)).toEqual(['page']);
		expect(context.page).toHaveLength(120);
	});

	it('höchstens 10 pro Person und Tag', async () => {
		const f = await fixture();
		for (let i = 0; i < 10; i++) await send(f, f.trp[1], `Nr. ${i}`);
		await expect(send(f, f.trp[1], 'Nr. 11')).rejects.toThrow('Für heute reicht es');
		await send(f, f.trp[0], 'andere Person geht');
	});

	it('geht mit dem Konto', async () => {
		const f = await fixture();
		await send(f, f.trp[1]);
		await f.db.as(f.trp[1], `select delete_my_account('löschen')`);
		expect(await f.db.as('service', `select count(*)::int as n from feedback`)).toEqual([{ n: 0 }]);
	});
});

describe('Konto löschen mit gekauftem Arrangement (Code-Durchsicht 19.11.2026)', () => {
	it('allein in einer Guugge mit Lizenz: gesperrt wie beim Auflösen', async () => {
		const f = await fixture();
		await f.db.as('service', `insert into licenses (guugge_id, title_id) values ($1, $2)`, [
			f.fremdGuugge,
			f.title
		]);
		expect(await f.db.as(f.fremd, `select my_account_deletion() as d`)).toEqual([
			{
				d: {
					blocking: [],
					alone: [{ id: f.fremdGuugge, name: 'Andere Guugge' }],
					licensed: [{ id: f.fremdGuugge, name: 'Andere Guugge' }]
				}
			}
		]);
		await expect(f.db.as(f.fremd, `select delete_my_account('löschen')`)).rejects.toThrow(
			'gekaufte Arrangements'
		);
		expect(
			await f.db.owner(`select count(*)::int as n from guuggen where id = $1`, [f.fremdGuugge])
		).toEqual([{ n: 1 }]);
	});
});
