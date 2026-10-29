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
	'signups'
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
