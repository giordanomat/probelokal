<script lang="ts">
	// Wechsel zwischen den Übe-Bereichen (wie die Reiter im Prototyp: Stück · Einblasen).
	import { resolve } from '$app/paths';
	import { page } from '$app/state';

	const items = [
		{ href: resolve('/ueben'), label: 'Stück üben' },
		{ href: resolve('/einblasen'), label: 'Einblasen' }
	];
</script>

<nav class="seg" aria-label="Übe-Bereich">
	{#each items as it (it.href)}
		<a href={it.href} aria-current={page.url.pathname === it.href ? 'page' : undefined}
			>{it.label}</a
		>
	{/each}
</nav>

<style>
	a {
		box-sizing: border-box;
		display: inline-flex;
		align-items: center;
		border: 1px solid var(--line);
		background: var(--surface);
		color: var(--ink);
		font: 600 14px/1.2 var(--font-body);
		border-radius: 999px;
		min-height: 40px;
		padding: 6px 14px;
		text-decoration: none;
	}
	a[aria-current='page'] {
		background: var(--chip-on-bg);
		color: var(--chip-on-fg);
		border-color: var(--chip-on-bg);
	}
</style>
