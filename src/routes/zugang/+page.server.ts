import { fail, redirect } from '@sveltejs/kit';
import { TEST_ACCESS_CODE } from '$app/env/private';
import {
	ACCESS_COOKIE,
	ACCESS_MAX_AGE,
	accessToken,
	codeMatches,
	hasAccess
} from '#lib/server/test-access.ts';
import type { Actions, PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ cookies }) => ({
	enabled: !!TEST_ACCESS_CODE,
	active: await hasAccess(cookies.get(ACCESS_COOKIE), TEST_ACCESS_CODE)
});

export const actions: Actions = {
	default: async ({ request, cookies }) => {
		const code = String((await request.formData()).get('code') ?? '');
		if (!(await codeMatches(code, TEST_ACCESS_CODE))) return fail(400, { wrong: true });
		cookies.set(ACCESS_COOKIE, await accessToken(code), {
			path: '/',
			httpOnly: true,
			sameSite: 'lax',
			maxAge: ACCESS_MAX_AGE
		});
		redirect(303, '/ueben');
	}
};
