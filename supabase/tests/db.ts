// Testdatenbank: PGlite (Postgres als WebAssembly im Testprozess) mit nachgebautem Supabase-Rahmen
// (supabase-stub.sql) und allen Migrationen aus supabase/migrations in Namensreihenfolge – so, wie
// die Supabase-CLI sie anwendet. Abfragen laufen als anon, als angemeldete Person oder als
// Service-Rolle; die Einrichtung (Konten, Ergebnisse) als Eigentümer.

import { PGlite } from '@electric-sql/pglite';
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

const ROOT = join(import.meta.dirname, '..');

export type Actor = 'anon' | 'service' | { id: string };

export interface TestDb {
	pg: PGlite;
	/** Neues Konto (wie eine Anmeldung bei Supabase Auth), gibt die id zurück. */
	user(email: string, name?: string): Promise<string>;
	/** Abfrage als Rolle bzw. Person; Fehler werden geworfen. */
	as<T = Record<string, unknown>>(actor: Actor, sql: string, params?: unknown[]): Promise<T[]>;
	/** Abfrage als Eigentümer (umgeht RLS), für Einrichtung und Kontrolle. */
	owner<T = Record<string, unknown>>(sql: string, params?: unknown[]): Promise<T[]>;
}

export function migrationFiles(): string[] {
	return readdirSync(join(ROOT, 'migrations'))
		.filter((f) => f.endsWith('.sql'))
		.sort();
}

export async function createTestDb(): Promise<TestDb> {
	const pg = new PGlite();
	await pg.exec(readFileSync(join(ROOT, 'tests', 'supabase-stub.sql'), 'utf8'));
	for (const f of migrationFiles()) {
		try {
			await pg.exec(readFileSync(join(ROOT, 'migrations', f), 'utf8'));
		} catch (e) {
			throw new Error(`Migration ${f}: ${(e as Error).message}`, { cause: e });
		}
	}

	const owner = async <T>(sql: string, params: unknown[] = []) =>
		(await pg.query<T>(sql, params)).rows;

	const as = async <T>(actor: Actor, sql: string, params: unknown[] = []) => {
		const role = actor === 'anon' ? 'anon' : actor === 'service' ? 'service_role' : 'authenticated';
		const sub = typeof actor === 'object' ? actor.id : '';
		await pg.query(`select set_config('request.jwt.claim.sub', $1, false)`, [sub]);
		await pg.exec(`set role ${role}`);
		try {
			return (await pg.query<T>(sql, params)).rows;
		} finally {
			await pg.exec('reset role');
			await pg.query(`select set_config('request.jwt.claim.sub', '', false)`);
		}
	};

	const user = async (email: string, name = '') => {
		const [row] = await owner<{ id: string }>(
			`insert into auth.users (email, raw_user_meta_data) values ($1, jsonb_build_object('display_name', $2::text)) returning id`,
			[email, name]
		);
		return row.id;
	};

	return { pg, user, as, owner };
}
