// Konto und Guugge über die Datenbank-Funktionen (supabase/migrations/20261028150000 und
// 20261028170000). Die Oberfläche ruft nur Funktionen auf, nie Tabellen direkt: Wer was darf,
// steht so an genau einem Ort, in der Datenbank. Fehler kommen als AccountError mit deutschem Text.

import type { SupabaseClient } from '@supabase/supabase-js';
import type { ExamVia } from '../exams/exams';
import type { Hint, HintKind } from '../hints/hints';

export type Role = 'leitung' | 'registerchef' | 'mitglied';
export type Register = 'trp' | 'pos' | 'tief' | 'perc';

export interface MyGuugge {
	id: string;
	name: string;
	role: Role;
	voice: string | null;
	register: Register | null;
	rangliste_opt_in: boolean;
	rangliste_enabled: boolean;
}

export interface MyAccount {
	display_name: string;
	guuggen: MyGuugge[];
}

export interface Member {
	user_id: string;
	display_name: string;
	role: Role;
	voice: string | null;
}

export const ROLE_LABELS: Record<Role, string> = {
	leitung: 'Leitung',
	registerchef: 'Registerchef',
	mitglied: 'Mitglied'
};

export class AccountError extends Error {}

interface ErrorLike {
	code?: string;
	message?: string;
	status?: number;
	name?: string;
}

/** Fehler von Supabase (PostgREST oder Auth) in einen Satz für die Oberfläche übersetzen. */
export function accountErrorText(err: unknown): string {
	const e = (err ?? {}) as ErrorLike;
	const msg = e.message ?? '';
	if (e.name === 'AuthRetryableFetchError' || /fetch|network|load failed/i.test(msg)) {
		return 'Keine Verbindung. Versuch es nochmal, sobald du online bist.';
	}
	if (e.status === 429 || /rate limit|too many/i.test(msg)) {
		return 'Zu viele Versuche. Warte ein paar Minuten und versuch es dann nochmal.';
	}
	if (e.code === 'otp_expired' || /expired|invalid.*(otp|token)|token.*invalid/i.test(msg)) {
		return 'Der Code stimmt nicht oder ist abgelaufen.';
	}
	// Funktion fehlt: Migration noch nicht angewendet
	if (e.code === 'PGRST202' || e.code === '42883') {
		return 'Konten sind noch nicht eingerichtet. Versuch es später nochmal.';
	}
	// Eigene Meldungen der Datenbank-Funktionen (raise exception … using errcode)
	if (e.code === '42501' || e.code === '22023' || e.code === 'P0002') return msg;
	if (e.code === '23514') return 'Das ist zu lang oder leer.';
	return 'Das hat nicht geklappt. Versuch es nochmal.';
}

async function call<T>(sb: SupabaseClient, fn: string, args?: Record<string, unknown>): Promise<T> {
	let res;
	try {
		res = await sb.rpc(fn, args);
	} catch (err) {
		throw new AccountError(accountErrorText(err), { cause: err });
	}
	if (res.error) throw new AccountError(accountErrorText(res.error), { cause: res.error });
	return res.data as T;
}

export const myAccount = (sb: SupabaseClient) => call<MyAccount>(sb, 'my_account');

export const setMyName = (sb: SupabaseClient, name: string) =>
	call<void>(sb, 'set_my_name', { p_name: name });

export const createGuugge = (sb: SupabaseClient, name: string) =>
	call<string>(sb, 'create_guugge', { p_name: name });

export const guuggeMembers = (sb: SupabaseClient, guugge: string) =>
	call<Member[]>(sb, 'guugge_members', { p_guugge: guugge });

export const createInvite = (sb: SupabaseClient, guugge: string, role: Role, days = 14) =>
	call<string>(sb, 'create_invite', { p_guugge: guugge, p_role: role, p_days: days });

export const revokeInvites = (sb: SupabaseClient, guugge: string) =>
	call<void>(sb, 'revoke_invites', { p_guugge: guugge });

export const acceptInvite = (sb: SupabaseClient, token: string) =>
	call<string>(sb, 'accept_invite', { p_token: token });

export const setMyVoice = (sb: SupabaseClient, guugge: string, voice: string) =>
	call<void>(sb, 'set_my_voice', { p_guugge: guugge, p_voice: voice });

export const setRanglisteOptIn = (sb: SupabaseClient, guugge: string, on: boolean) =>
	call<void>(sb, 'set_rangliste_opt_in', { p_guugge: guugge, p_on: on });

export const setRanglisteEnabled = (sb: SupabaseClient, guugge: string, on: boolean) =>
	call<void>(sb, 'set_rangliste_enabled', { p_guugge: guugge, p_on: on });

export const setMemberRole = (sb: SupabaseClient, guugge: string, user: string, role: Role) =>
	call<void>(sb, 'set_member_role', { p_guugge: guugge, p_user: user, p_role: role });

export const removeMember = (sb: SupabaseClient, guugge: string, user: string) =>
	call<void>(sb, 'remove_member', { p_guugge: guugge, p_user: user });

export interface StoredPlan {
	start: string;
	perf: string;
	gp_weekday: number;
	rp_weekday: number | null;
	minutes_per_week: number;
	updated_at: string;
}

export interface StageRow {
	voice: string;
	section: number;
	stage: number;
	rhythm_only: number[];
}

export const getPlan = (sb: SupabaseClient, guugge: string, slug: string) =>
	call<StoredPlan | null>(sb, 'get_plan', { p_guugge: guugge, p_slug: slug });

export const setPlan = (
	sb: SupabaseClient,
	guugge: string,
	slug: string,
	p: Omit<StoredPlan, 'updated_at'>,
	due: Record<string, string[]>
) =>
	call<void>(sb, 'set_plan', {
		p_guugge: guugge,
		p_slug: slug,
		p_start: p.start,
		p_perf: p.perf,
		p_gp_weekday: p.gp_weekday,
		p_rp_weekday: p.rp_weekday,
		p_minutes: p.minutes_per_week,
		p_due: due
	});

export const myStages = (sb: SupabaseClient, guugge: string, slug: string) =>
	call<StageRow[]>(sb, 'my_stages', { p_guugge: guugge, p_slug: slug });

export interface ExamResult {
	passed: boolean;
	score: number;
	stage: number;
	section: number;
	points: number;
	reasons: string[];
	/** Punkte für das Wochenziel (0 oder 25) */
	week_goal: number;
}

export interface MyPoints {
	points: number;
	week_points: number;
	days_this_week: number;
}

export const startExam = (
	sb: SupabaseClient,
	guugge: string,
	slug: string,
	section: number,
	stage: number,
	via: ExamVia
) =>
	call<string>(sb, 'start_exam', {
		p_guugge: guugge,
		p_slug: slug,
		p_section: section,
		p_stage: stage,
		p_via: via
	});

export const finishExam = (sb: SupabaseClient, attempt: string, score: number) =>
	call<ExamResult>(sb, 'finish_exam', { p_attempt: attempt, p_score: score });

export const myPoints = (sb: SupabaseClient, guugge: string) =>
	call<MyPoints>(sb, 'my_points', { p_guugge: guugge });

/** Punkte in der eigenen Guugge mit den meisten (für Bahn-Looks und Schränz-Groove) */
export const myBestPoints = (sb: SupabaseClient) => call<number>(sb, 'my_best_points');

export interface BoardRow {
	user_id: string;
	display_name: string;
	voice: string | null;
	points: number;
	week_points: number;
}

export interface RegisterRow {
	register: Register;
	persons: number;
	/** Durchschnittlich erreichte Etappe pro Teil (Index in sections, ab 1) */
	avg_stage_by_section: Record<string, number> | null;
	practiced_this_week: number;
}

export interface GuuggeSettings {
	rangliste_enabled: boolean;
	level_rewards: Record<string, string>;
}

export interface PointsEntry {
	points: number;
	reason: string;
	created_at: string;
}

export const leaderboard = (sb: SupabaseClient, guugge: string) =>
	call<BoardRow[]>(sb, 'leaderboard', { g: guugge });

export const leitungOverview = (sb: SupabaseClient, guugge: string, slug: string) =>
	call<RegisterRow[]>(sb, 'leitung_overview', { p_guugge: guugge, p_slug: slug });

export const guuggeSettings = (sb: SupabaseClient, guugge: string) =>
	call<GuuggeSettings | null>(sb, 'guugge_settings', { p_guugge: guugge });

export const setLevelRewards = (
	sb: SupabaseClient,
	guugge: string,
	rewards: Record<string, string>
) => call<void>(sb, 'set_level_rewards', { p_guugge: guugge, p_rewards: rewards });

export const myPointsLog = (sb: SupabaseClient, guugge: string) =>
	call<PointsEntry[]>(sb, 'my_points_log', { p_guugge: guugge });

export interface HintInput {
	from: number;
	to: number;
	target: string;
	kind: HintKind;
	dyn: string | null;
	body: string | null;
}

export const listHints = (sb: SupabaseClient, guugge: string, slug: string) =>
	call<Hint[]>(sb, 'list_hints', { p_guugge: guugge, p_slug: slug });

export const addHint = (sb: SupabaseClient, guugge: string, slug: string, h: HintInput) =>
	call<string>(sb, 'add_hint', {
		p_guugge: guugge,
		p_slug: slug,
		p_from: h.from,
		p_to: h.to,
		p_target: h.target,
		p_kind: h.kind,
		p_dyn: h.dyn,
		p_body: h.body
	});

export const deleteHint = (sb: SupabaseClient, hint: string) =>
	call<void>(sb, 'delete_hint', { p_hint: hint });

export const markHintsRead = (sb: SupabaseClient, ids: string[]) =>
	call<number>(sb, 'mark_hints_read', { p_ids: ids });

export interface PassResult {
	points: number;
	/** Heute schon 15 Durchgänge mit Punkten */
	capped: boolean;
	week_goal: number;
}

export const startPass = (
	sb: SupabaseClient,
	slug: string,
	from: number,
	to: number,
	tempo: number
) => call<string>(sb, 'start_pass', { p_slug: slug, p_from: from, p_to: to, p_tempo: tempo });

export const finishPass = (sb: SupabaseClient, attempt: string, pct: number, judged: number) =>
	call<PassResult>(sb, 'finish_pass', { p_attempt: attempt, p_pct: pct, p_judged: judged });
