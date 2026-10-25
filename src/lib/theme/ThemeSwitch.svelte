<script lang="ts">
	import { onMount } from 'svelte';
	import { applyTheme, loadTheme, saveTheme, type Theme } from './theme';

	// Startwert wie das Inline-Skript in app.html; nach dem Einhängen aus dem Speicher.
	let theme = $state<Theme>('dark');

	onMount(() => {
		theme = loadTheme(localStorage);
	});

	function choose(t: Theme) {
		theme = t;
		applyTheme(document, t);
		saveTheme(localStorage, t);
	}
</script>

<div class="theme" role="group" aria-label="Darstellung">
	<button type="button" aria-pressed={theme === 'dark'} onclick={() => choose('dark')}>
		<svg viewBox="0 0 24 24" aria-hidden="true"
			><path d="M21 14.5A8.5 8.5 0 0 1 9.5 3a8.5 8.5 0 1 0 11.5 11.5z" /></svg
		>Dunkel
	</button>
	<button type="button" aria-pressed={theme === 'light'} onclick={() => choose('light')}>
		<svg viewBox="0 0 24 24" aria-hidden="true"
			><circle cx="12" cy="12" r="5" /><path
				d="M11 1h2v3h-2zM11 20h2v3h-2zM1 11h3v2H1zM20 11h3v2h-3zM4.2 2.8l2.1 2.1-1.4 1.4-2.1-2.1zM17.7 16.3l2.1 2.1-1.4 1.4-2.1-2.1zM2.8 19.8l2.1-2.1 1.4 1.4-2.1 2.1zM16.3 6.3l2.1-2.1 1.4 1.4-2.1 2.1z"
			/></svg
		>Hell
	</button>
</div>

<style>
	.theme {
		display: flex;
		border: 1px solid var(--line);
		border-radius: 999px;
		overflow: hidden;
		background: var(--surface);
	}
	button {
		appearance: none;
		border: 0;
		background: none;
		color: var(--ink);
		font: 600 13px var(--font-body);
		padding: 7px 12px;
		cursor: pointer;
		min-height: 36px;
		display: inline-flex;
		align-items: center;
		gap: 6px;
	}
	svg {
		width: 14px;
		height: 14px;
		fill: currentColor;
	}
	button[aria-pressed='true'] {
		background: var(--chip-on-bg);
		color: var(--chip-on-fg);
	}
</style>
