<script lang="ts">
	import { resolve } from '$app/paths';
	import type { PageProps } from './$types';

	let { data, form }: PageProps = $props();
</script>

<svelte:head>
	<title>Testzugang · giordanomat PROBELOKAL</title>
	<meta name="robots" content="noindex" />
</svelte:head>

<section class="card">
	<p class="label">Testzugang</p>
	<h1>Hoi! Hast du einen Code?</h1>
	{#if !data.enabled}
		<p>Der Testzugang ist gerade geschlossen.</p>
	{:else if data.active}
		<p>Dein Gerät hat schon Zugang.</p>
		<p><a class="go" href={resolve('/ueben')}>Weiter zum Üben →</a></p>
	{:else}
		<p>Mit dem Code hörst du beim Üben die Band und deine eigene Stimme. Er gilt pro Gerät.</p>
		<form class="form" method="POST">
			<label class="field">
				Code
				<input
					name="code"
					autocomplete="off"
					autocapitalize="off"
					spellcheck="false"
					required
					aria-invalid={form?.wrong ? 'true' : undefined}
				/>
			</label>
			<button class="btn" type="submit">Freischalten</button>
		</form>
		{#if form?.wrong}
			<p class="err" role="alert">Der Code stimmt nicht. Frag bei Matthias nach.</p>
		{/if}
	{/if}
</section>
