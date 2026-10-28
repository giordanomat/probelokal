// Anmeldung mit Code aus der E-Mail (Supabase Auth, OTP). In der Mail steht ein Code und ein Link
// (Vorlage in docs/02 »Anmelden«). Der Code ist der Hauptweg: Auf dem iPhone öffnet ein Link aus
// Mail die Seite in Safari, und eine App auf dem Home-Bildschirm hat einen eigenen Speicher. Wer
// den Link antippt, wäre in Safari angemeldet, in der App aber nicht. Der Link geht trotzdem
// (`?token_hash=…`) und meldet in dem Browser an, in dem er aufgeht.
// Die Sitzung liegt im Speicher des Browsers (supabase-js, localStorage), pro Gerät.

import type { Session, SupabaseClient, User } from '@supabase/supabase-js';
import { accountErrorText, AccountError } from './api.ts';

export const auth = $state<{ ready: boolean; user: User | null }>({ ready: false, user: null });

let started = false;

/** Sitzung beobachten; einmal pro Seite aufrufen. */
export function watchAuth(sb: SupabaseClient | null) {
	if (started) return;
	started = true;
	if (!sb) {
		auth.ready = true;
		return;
	}
	const set = (s: Session | null) => {
		auth.user = s?.user ?? null;
		auth.ready = true;
	};
	sb.auth.onAuthStateChange((_event, session) => set(session));
	void sb.auth.getSession().then(({ data }) => set(data.session));
}

async function check<T extends { error: unknown }>(p: Promise<T>): Promise<T> {
	let res: T;
	try {
		res = await p;
	} catch (err) {
		throw new AccountError(accountErrorText(err), { cause: err });
	}
	if (res.error) throw new AccountError(accountErrorText(res.error), { cause: res.error });
	return res;
}

/** Schickt eine Mail mit Code und Link. Neue Adressen bekommen dabei ein Konto. */
export async function sendCode(sb: SupabaseClient, email: string, linkTo: string) {
	await check(
		sb.auth.signInWithOtp({
			email: email.trim().toLowerCase(),
			options: { shouldCreateUser: true, emailRedirectTo: linkTo }
		})
	);
}

export async function verifyCode(sb: SupabaseClient, email: string, code: string) {
	await check(
		sb.auth.verifyOtp({ email: email.trim().toLowerCase(), token: code.trim(), type: 'email' })
	);
}

/** Link aus der Mail: `/anmelden?token_hash=…&type=email`. */
export async function verifyLink(sb: SupabaseClient, tokenHash: string, type: string | null) {
	const t = type === 'magiclink' || type === 'signup' ? type : 'email';
	await check(sb.auth.verifyOtp({ token_hash: tokenHash, type: t }));
}

export async function signOut(sb: SupabaseClient) {
	await check(sb.auth.signOut());
}
