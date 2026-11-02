// Nachbau von Supabase für die Abläufe im Browser: Anfragen der App an das Supabase-Projekt
// (Adresse aus wrangler.jsonc) fängt Playwright ab und beantwortet sie hier. So berührt kein Test
// das echte Projekt.
// - Auth: Code per »Mail« (hier nur gemerkt, `mails`), Code oder Link prüfen, Sitzung, Abmelden.
// - Datenbank: nur Funktionsaufrufe (`/rest/v1/rpc/<name>`, so ruft die App die Datenbank auf).
//   Sie laufen in PGlite mit allen Migrationen und RLS-Regeln (supabase/tests/db.ts), als die Person
//   aus dem Zugangs-Token.
// - Realtime (Postgres Changes) für Hinweise: WebSocket nach dem Protokoll von realtime-js 2.x
//   (JSON-Arrays [join_ref, ref, topic, event, payload]). Nach jedem Funktionsaufruf vergleicht der
//   Nachbau die Tabelle hints und meldet neue Zeilen an Abos mit passendem Filter, wenn die Person
//   sie nach RLS lesen darf, und gelöschte (nur die ID) an Abos ohne Filter, wie in der
//   Supabase-Doku beschrieben (»Delete events are not filterable«).
// Nachgebaut ist nur, was die App braucht; Antworten und Fehler sind dem echten Verhalten
// nachempfunden, nicht gegen Supabase geprüft.

import {
	expect,
	type BrowserContext,
	type Page,
	type Route,
	type WebSocketRoute
} from '@playwright/test';
import { readFileSync } from 'node:fs';
import { randomBytes, randomInt } from 'node:crypto';
import { createTestDb, type TestDb } from '../supabase/tests/db';

const SUPABASE_URL = /"PUBLIC_SUPABASE_URL":\s*"([^"]+)"/.exec(
	readFileSync(new URL('../wrangler.jsonc', import.meta.url), 'utf8')
)![1];

const CORS = {
	'access-control-allow-origin': '*',
	'access-control-allow-headers': '*',
	'access-control-allow-methods': 'GET, POST, PATCH, DELETE, OPTIONS'
};

export interface Mail {
	email: string;
	code: string;
	tokenHash: string;
}

const b64url = (o: unknown) => Buffer.from(JSON.stringify(o)).toString('base64url');

function jwt(sub: string, email: string) {
	const exp = Math.floor(Date.now() / 1000) + 3600;
	return `${b64url({ alg: 'HS256', typ: 'JWT' })}.${b64url({ sub, email, role: 'authenticated', aud: 'authenticated', exp })}.test`;
}

function subOf(auth: string | undefined): string | null {
	const token = auth?.replace(/^Bearer /, '') ?? '';
	const parts = token.split('.');
	if (parts.length !== 3) return null;
	try {
		return JSON.parse(Buffer.from(parts[1], 'base64url').toString()).sub ?? null;
	} catch {
		return null;
	}
}

interface PgBinding {
	id: number;
	event: string;
	schema: string;
	table: string;
	filter?: string;
}

interface Channel {
	ws: WebSocketRoute;
	topic: string;
	joinRef: string;
	sub: string | null;
	bindings: PgBinding[];
}

type HintRow = { id: string; guugge_id: string } & Record<string, unknown>;

/** Passt die Zeile zum Filter »guugge_id=eq.x« bzw. »guugge_id=in.(x,y)«? */
function matches(filter: string | undefined, row: Record<string, unknown>): boolean {
	if (!filter) return true;
	const m = /^([a-z_]+)=(eq|in)\.(.+)$/.exec(filter);
	if (!m) return false;
	const value = String(row[m[1]]);
	return m[2] === 'eq'
		? value === m[3]
		: m[3]
				.replace(/^\(|\)$/g, '')
				.split(',')
				.includes(value);
}

export class FakeSupabase {
	readonly mails: Mail[] = [];
	private users = new Map<string, string>(); // E-Mail → id
	private channels = new Set<Channel>();
	private nextBinding = 1;

	private constructor(readonly db: TestDb) {}

	static async create() {
		return new FakeSupabase(await createTestDb());
	}

	/** Letzte »Mail« an diese Adresse. */
	lastMail(email: string): Mail {
		const m = this.mails.filter((x) => x.email === email).at(-1);
		if (!m) throw new Error(`Keine Mail an ${email}`);
		return m;
	}

	/** Konto-ID zu einer Adresse (legt das Konto an, wenn es fehlt). */
	idOf(email: string): Promise<string> {
		return this.userFor(email.toLowerCase());
	}

	/** Anmelden über die Oberfläche mit dem Code aus der »Mail«. */
	async signIn(page: Page, email: string) {
		await page.goto('/anmelden');
		await page.getByLabel('E-Mail').fill(email);
		await page.getByRole('button', { name: 'Code schicken' }).click();
		await expect(page.getByRole('heading', { name: 'Schau in deine Mails.' })).toBeVisible();
		await page.getByLabel('Code').fill(this.lastMail(email.toLowerCase()).code);
		await page.getByRole('button', { name: 'Anmelden' }).click();
		await expect(page).not.toHaveURL(/\/anmelden/);
	}

	/** Abfangen für eine Seite oder einen ganzen Browser-Kontext. */
	async attach(target: Page | BrowserContext) {
		await target.route(`${SUPABASE_URL}/**`, (route) => this.handle(route));
		await target.routeWebSocket(/\/realtime\/v1\/websocket/, (ws) => this.realtime(ws));
	}

	/** Realtime-Verbindung eines Browsers (nur Postgres Changes, keine Broadcasts) */
	private realtime(ws: WebSocketRoute) {
		ws.onMessage((raw) => {
			const [joinRef, ref, topic, event, payload] = JSON.parse(String(raw)) as [
				string | null,
				string | null,
				string,
				string,
				Record<string, unknown>
			];
			const reply = (response: unknown = {}) =>
				ws.send(JSON.stringify([joinRef, ref, topic, 'phx_reply', { status: 'ok', response }]));
			if (event === 'heartbeat') return reply();
			if (event === 'phx_join') {
				const config = (payload.config ?? {}) as { postgres_changes?: Omit<PgBinding, 'id'>[] };
				const bindings = (config.postgres_changes ?? []).map((b) => ({
					...b,
					id: this.nextBinding++
				}));
				this.channels.add({
					ws,
					topic,
					joinRef: joinRef ?? '',
					sub: subOf(`Bearer ${payload.access_token ?? ''}`),
					bindings
				});
				return reply({ postgres_changes: bindings });
			}
			if (event === 'phx_leave') {
				for (const c of this.channels)
					if (c.ws === ws && c.topic === topic) this.channels.delete(c);
				return reply();
			}
			if (event === 'access_token') {
				for (const c of this.channels)
					if (c.ws === ws) c.sub = subOf(`Bearer ${payload.access_token ?? ''}`);
			}
		});
		ws.onClose(() => {
			for (const c of this.channels) if (c.ws === ws) this.channels.delete(c);
		});
	}

	private hintRows() {
		return this.db.owner<HintRow>(`select * from hints`);
	}

	/** Änderungen an hints seit `before` an die passenden Abos melden */
	private async announceHints(before: HintRow[]) {
		const after = await this.hintRows();
		const had = new Set(before.map((h) => h.id));
		const has = new Set(after.map((h) => h.id));
		const changes = [
			...after.filter((h) => !had.has(h.id)).map((row) => ({ type: 'INSERT', row })),
			...before.filter((h) => !has.has(h.id)).map((row) => ({ type: 'DELETE', row }))
		];
		for (const { type, row } of changes) {
			for (const c of this.channels) {
				const ids: number[] = [];
				for (const b of c.bindings) {
					if (b.schema !== 'public' || b.table !== 'hints') continue;
					if (b.event !== '*' && b.event !== type) continue;
					if (type === 'DELETE' ? b.filter : !matches(b.filter, row)) continue;
					if (type === 'INSERT') {
						const seen = c.sub
							? await this.db.as({ id: c.sub }, `select 1 from hints where id = $1`, [row.id])
							: [];
						if (!seen.length) continue;
					}
					ids.push(b.id);
				}
				if (!ids.length) continue;
				c.ws.send(
					JSON.stringify([
						c.joinRef,
						null,
						c.topic,
						'postgres_changes',
						{
							ids,
							data: {
								type,
								schema: 'public',
								table: 'hints',
								commit_timestamp: new Date().toISOString(),
								columns: [
									{ name: 'id', type: 'uuid' },
									{ name: 'guugge_id', type: 'uuid' }
								],
								record: type === 'INSERT' ? row : {},
								old_record: type === 'DELETE' ? { id: row.id } : {},
								errors: null
							}
						}
					])
				);
			}
		}
	}

	private json(route: Route, status: number, body?: unknown) {
		return route.fulfill({
			status,
			headers: { ...CORS, 'content-type': 'application/json' },
			body: body === undefined ? '' : JSON.stringify(body)
		});
	}

	private async userFor(email: string) {
		let id = this.users.get(email);
		if (!id) {
			id = await this.db.user(email);
			this.users.set(email, id);
		}
		return id;
	}

	private session(id: string, email: string) {
		return {
			access_token: jwt(id, email),
			token_type: 'bearer',
			expires_in: 3600,
			expires_at: Math.floor(Date.now() / 1000) + 3600,
			refresh_token: `r-${id}`,
			user: {
				id,
				aud: 'authenticated',
				role: 'authenticated',
				email,
				app_metadata: { provider: 'email' },
				user_metadata: {},
				created_at: new Date().toISOString()
			}
		};
	}

	private async handle(route: Route) {
		const req = route.request();
		if (req.method() === 'OPTIONS') return route.fulfill({ status: 204, headers: CORS });
		const url = new URL(req.url());
		const path = url.pathname;
		const body = req.postData() ? JSON.parse(req.postData()!) : {};

		if (path === '/auth/v1/otp') {
			const email = String(body.email).toLowerCase();
			this.mails.push({
				email,
				code: String(randomInt(0, 1_000_000)).padStart(6, '0'),
				tokenHash: randomBytes(16).toString('hex')
			});
			return this.json(route, 200, {});
		}
		if (path === '/auth/v1/verify') {
			const mail = body.token_hash
				? this.mails.find((m) => m.tokenHash === body.token_hash)
				: this.mails.find(
						(m) => m.email === String(body.email).toLowerCase() && m.code === body.token
					);
			if (!mail) {
				return this.json(route, 403, {
					code: 'otp_expired',
					error_code: 'otp_expired',
					msg: 'Token has expired or is invalid'
				});
			}
			this.mails.splice(this.mails.indexOf(mail), 1);
			return this.json(route, 200, this.session(await this.userFor(mail.email), mail.email));
		}
		if (path === '/auth/v1/user') {
			const sub = subOf(req.headers()['authorization']);
			const email = [...this.users].find(([, id]) => id === sub)?.[0];
			if (!sub || !email) return this.json(route, 401, { msg: 'invalid JWT' });
			return this.json(route, 200, this.session(sub, email).user);
		}
		if (path === '/auth/v1/logout') return route.fulfill({ status: 204, headers: CORS });

		const rpc = /^\/rest\/v1\/rpc\/([a-z_]+)$/.exec(path);
		if (rpc) return this.rpc(route, rpc[1], body, req.headers()['authorization']);

		return this.json(route, 404, { message: `Nicht nachgebaut: ${req.method()} ${path}` });
	}

	private async rpc(route: Route, fn: string, args: Record<string, unknown>, auth?: string) {
		const [proc] = await this.db.owner<{ retset: boolean; ret: string }>(
			`select p.proretset as retset, format_type(p.prorettype, null) as ret
			 from pg_proc p join pg_namespace n on n.oid = p.pronamespace
			 where n.nspname = 'public' and p.proname = $1`,
			[fn]
		);
		if (!proc) {
			return this.json(route, 404, { code: 'PGRST202', message: `Could not find ${fn}` });
		}
		const keys = Object.keys(args).filter((k) => /^[a-z_]+$/.test(k));
		const named = keys.map((k, i) => `${k} => $${i + 1}`).join(', ');
		const sql = proc.retset
			? `select * from public.${fn}(${named})`
			: `select public.${fn}(${named}) as v`;
		const sub = subOf(auth);
		const before = this.channels.size ? await this.hintRows() : null;
		try {
			const rows = await this.db.as<Record<string, unknown>>(
				sub ? { id: sub } : 'anon',
				sql,
				keys.map((k) => args[k])
			);
			if (before) await this.announceHints(before);
			if (proc.ret === 'void') return route.fulfill({ status: 204, headers: CORS });
			return this.json(route, 200, proc.retset ? rows : (rows[0]?.v ?? null));
		} catch (e) {
			const err = e as { code?: string; message: string };
			return this.json(route, err.code === '42501' ? 403 : 400, {
				code: err.code,
				message: err.message,
				details: null,
				hint: null
			});
		}
	}
}
