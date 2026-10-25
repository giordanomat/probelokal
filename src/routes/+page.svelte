<script lang="ts">
	import { resolve } from '$app/paths';
</script>

<svelte:head>
	<title>giordanomat PROBELOKAL</title>
	<meta
		name="description"
		content="Üben für Guuggenmusigen und Hobby-Brass: deine Stimme, deine Band, dein Plan."
	/>
</svelte:head>

<section class="hello">
	<p class="label">Im Aufbau</p>
	<h1>Hoi! Hier entsteht dein Probelokal.</h1>
	<p>
		Bald übst du hier deine Stimme mit der Band im Ohr, siehst Griff für Griff, was dran ist, und
		weisst, wo du im Plan deiner Guugge stehst.
	</p>
	<p><a class="go" href={resolve('/ueben')}>Bad Touch 2.0 auf der Bahn ansehen →</a></p>
</section>

<style>
	.hello {
		background: var(--surface);
		border: 1px solid var(--line);
		border-radius: 16px;
		padding: 20px;
		display: flex;
		flex-direction: column;
		gap: 8px;
	}
	h1 {
		font-size: clamp(22px, 5vw, 30px);
		line-height: 1.15;
		letter-spacing: -0.02em;
		margin: 0;
	}
	p {
		margin: 0;
		max-width: 60ch;
	}
	.go {
		display: inline-block;
		margin-top: 6px;
		font-weight: 700;
		color: var(--akzent);
		text-underline-offset: 3px;
	}
</style>
