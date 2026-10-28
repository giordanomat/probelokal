// Nachbau von Supabase für die Abläufe im Browser: Anfragen der App an das Supabase-Projekt
// (Adresse aus wrangler.jsonc) fängt Playwright ab und beantwortet sie hier. So berührt kein Test
// das echte Projekt.
// - Auth: Code per »Mail« (hier nur gemerkt, `mails`), Code oder Link prüfen, Sitzung, Abmelden.
// - Datenbank: nur Funktionsaufrufe (`/rest/v1/rpc/<name>`, so ruft die App die Datenbank auf).
//   Sie laufen in PGlite mit allen Migrationen und RLS-Regeln (supabase/tests/db.ts), als die Person
//   aus dem Zugangs-Token.
// Nachgebaut ist nur, was die App braucht; Antworten und Fehler sind dem echten Verhalten
// nachempfunden, nicht gegen Supabase geprüft.

import type { BrowserContext, Page, Route } from '@playwright/test';
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

export class FakeSupabase {
	readonly mails: Mail[] = [];
	private users = new Map<string, string>(); // E-Mail → id

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

	/** Abfangen für eine Seite oder einen ganzen Browser-Kontext. */
	async attach(target: Page | BrowserContext) {
		await target.route(`${SUPABASE_URL}/**`, (route) => this.handle(route));
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
		try {
			const rows = await this.db.as<Record<string, unknown>>(
				sub ? { id: sub } : 'anon',
				sql,
				keys.map((k) => args[k])
			);
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
