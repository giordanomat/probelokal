<script lang="ts">
	import { resolve } from '$app/paths';
	import type { PageProps } from './$types';

	let { data, form }: PageProps = $props();
</script>

<svelte:head>
	<title>Testzugang · Probelokal</title>
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
		<form method="POST">
			<label>
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
			<button type="submit">Freischalten</button>
		</form>
		{#if form?.wrong}
			<p class="err" role="alert">Der Code stimmt nicht. Frag bei Matthias nach.</p>
		{/if}
	{/if}
</section>

<style>
	.card {
		background: var(--surface);
		border: 1px solid var(--line);
		border-radius: 16px;
		padding: 20px;
		display: flex;
		flex-direction: column;
		gap: 10px;
		max-width: 520px;
	}
	h1 {
		margin: 0;
		font-size: clamp(22px, 5vw, 28px);
		letter-spacing: -0.02em;
	}
	p {
		margin: 0;
	}
	form {
		display: flex;
		flex-wrap: wrap;
		gap: 10px;
		align-items: flex-end;
	}
	label {
		display: flex;
		flex-direction: column;
		gap: 4px;
		font-weight: 600;
		font-size: 14px;
		flex: 1 1 200px;
	}
	input {
		font: 600 16px var(--font-body);
		color: var(--ink);
		background: var(--bg);
		border: 1px solid var(--line);
		border-radius: 10px;
		min-height: 44px;
		padding: 0 12px;
	}
	button {
		appearance: none;
		border: 0;
		border-radius: 999px;
		background: var(--ink);
		color: var(--bg);
		font: 700 15px var(--font-body);
		min-height: 44px;
		padding: 0 18px;
		cursor: pointer;
	}
	.err {
		color: var(--rot);
		font-weight: 600;
	}
	.go {
		font-weight: 700;
		color: var(--akzent);
	}
</style>
