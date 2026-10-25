<script lang="ts">
	import '@fontsource/figtree/latin-400.css';
	import '@fontsource/figtree/latin-600.css';
	import '@fontsource/figtree/latin-700.css';
	import '@fontsource/ibm-plex-mono/latin-500.css';
	import '#lib/styles/tokens.css';
	import Lockup from '#lib/brand/Lockup.svelte';
	import ThemeSwitch from '#lib/theme/ThemeSwitch.svelte';
	import { resolve } from '$app/paths';
	import type { LayoutProps } from './$types';

	let { children }: LayoutProps = $props();
</script>

<div class="wrap">
	<header class="topbar">
		<a href={resolve('/')} class="home"><Lockup /></a>
		<ThemeSwitch />
	</header>

	<main>
		{@render children()}
	</main>
</div>

<style>
	.wrap {
		max-width: 1040px;
		margin: 0 auto;
		padding-left: max(16px, env(safe-area-inset-left, 0px));
		padding-right: max(16px, env(safe-area-inset-right, 0px));
		padding-top: max(14px, env(safe-area-inset-top, 0px));
		padding-bottom: max(24px, env(safe-area-inset-bottom, 0px));
		display: flex;
		flex-direction: column;
		gap: 18px;
	}
	.topbar {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 12px;
		flex-wrap: wrap;
	}
	.home {
		color: inherit;
		text-decoration: none;
		border-radius: 8px;
	}
</style>
