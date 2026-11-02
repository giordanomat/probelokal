<script lang="ts">
	// Einladungslink `/einladung#<schlüssel>`. Ohne Anmeldung wartet der Schlüssel im Speicher des
	// Geräts, bis die Anmeldung durch ist (src/lib/account/invite.ts).
	import { onMount } from 'svelte';
	import { goto, replaceState } from '$app/navigation';
	import { resolve } from '$app/paths';
	import { getSupabase } from '#lib/supabase/client.ts';
	import { auth, watchAuth } from '#lib/account/auth.svelte.ts';
	import { acceptInvite } from '#lib/account/api.ts';
	import {
		deviceStore,
		hasPendingInvite,
		savePendingInvite,
		takePendingInvite,
		tokenFromHash
	} from '#lib/account/invite.ts';

	const sb = getSupabase();

	let hasToken = $state<boolean | null>(null);
	let error = $state('');
	let joining = false;
	// Falls der Speicher gesperrt ist (privates Surfen), hält die Seite den Schlüssel selbst
	let fromLink: string | null = null;

	onMount(() => {
		fromLink = tokenFromHash(location.hash);
		if (fromLink) {
			savePendingInvite(deviceStore(), fromLink);
			// Schlüssel nicht im Verlauf stehen lassen
			replaceState(resolve('/einladung'), {});
		}
		hasToken = !!fromLink || hasPendingInvite(deviceStore());
		watchAuth(sb);
	});

	$effect(() => {
		if (sb && auth.ready && auth.user && hasToken && !joining) void join();
	});

	async function join() {
		if (!sb) return;
		joining = true;
		const token = takePendingInvite(deviceStore()) ?? fromLink;
		if (!token) {
			hasToken = false;
			return;
		}
		try {
			const id = await acceptInvite(sb, token);
			await goto(resolve('/guugge/[id]', { id }), { replaceState: true });
		} catch (e) {
			error = (e as Error).message;
		}
	}
</script>

<svelte:head>
	<title>Einladung · giordanomat PROBELOKAL</title>
	<meta name="robots" content="noindex" />
</svelte:head>

<section class="card">
	<p class="label">Einladung</p>
	{#if !sb}
		<h1>Hier gibt es noch keine Konten.</h1>
	{:else if error}
		<h1>Das hat nicht geklappt.</h1>
		<p class="err" role="alert">{error}</p>
		<p><a class="go" href={resolve('/guugge')}>Zu meinen Guuggen →</a></p>
	{:else if hasToken === false}
		<h1>Hier fehlt der Einladungslink.</h1>
		<p>Öffne den ganzen Link, den du von deiner Leitung bekommen hast.</p>
	{:else if hasToken === null || !auth.ready || auth.user}
		<p class="hint">Einen Moment …</p>
	{:else}
		<h1>Du bist in eine Guugge eingeladen.</h1>
		<p>Melde dich an, dann bist du dabei. Ein Konto entsteht dabei von selbst.</p>
		<p><a class="go" href={resolve('/anmelden')}>Anmelden →</a></p>
	{/if}
</section>
