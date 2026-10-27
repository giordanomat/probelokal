<script lang="ts">
	// Bahn als Canvas. Zeichnet neu, sobald sich Szene, Grösse oder Darstellung ändern.
	import { onMount } from 'svelte';
	import { drawLane, readLaneColors, type LaneColors, type LaneScene } from './draw';
	import { beatAtX, computeGeometry, defaultLaneHeight } from './geometry';

	let {
		scene,
		zoom = 1,
		onpick,
		onpress
	}: {
		scene: LaneScene;
		zoom?: number;
		/** Antippen der Bahn: Schlag unter dem Finger */
		onpick?: (beat: number) => void;
		/** Finger oder Maus geht runter (Rhythmus tippen); true = verbraucht, kein onpick */
		onpress?: () => boolean;
	} = $props();

	let pressed = false;

	let wrap: HTMLDivElement;
	let canvas: HTMLCanvasElement;
	let width = $state(0);
	let colors = $state<LaneColors | null>(null);

	const geometry = $derived(
		width
			? computeGeometry(scene.track, {
					width,
					height: defaultLaneHeight(width),
					help: scene.help,
					kind: scene.kind,
					staff: scene.staff,
					zoom
				})
			: null
	);

	onMount(() => {
		const root = document.documentElement;
		const measure = () => (width = wrap.clientWidth);
		const recolor = () => (colors = readLaneColors(root));
		measure();
		recolor();
		const ro = new ResizeObserver(measure);
		ro.observe(wrap);
		const mo = new MutationObserver(recolor);
		mo.observe(root, { attributes: true, attributeFilter: ['data-theme'] });
		// Schriften kommen evtl. erst nach dem ersten Zeichnen
		document.fonts?.ready.then(recolor);
		return () => {
			ro.disconnect();
			mo.disconnect();
		};
	});

	$effect(() => {
		if (!geometry || !colors) return;
		const dpr = Math.min(2, window.devicePixelRatio || 1);
		const w = Math.round(geometry.width * dpr);
		const h = Math.round(geometry.height * dpr);
		if (canvas.width !== w) canvas.width = w;
		if (canvas.height !== h) canvas.height = h;
		canvas.style.height = geometry.height + 'px';
		const cx = canvas.getContext('2d');
		if (cx) drawLane(cx, geometry, scene, colors, dpr);
	});

	function press(e: PointerEvent) {
		pressed = onpress?.() ?? false;
		if (pressed) e.preventDefault();
	}

	function pick(e: MouseEvent) {
		if (pressed) {
			pressed = false;
			return;
		}
		if (!geometry || !onpick) return;
		const r = canvas.getBoundingClientRect();
		onpick(beatAtX(geometry, e.clientX - r.left, scene.beat));
	}
</script>

<!-- Antippen springt zu einem Takt; per Tastatur geht das über die Teil-Auswahl. -->
<div
	class="lane"
	bind:this={wrap}
	role="figure"
	aria-label="Bahn: Die Töne laufen von rechts zur roten Linie, unten die Griffe."
>
	<canvas
		bind:this={canvas}
		onpointerdown={press}
		onclick={pick}
		aria-hidden="true"
		data-beat={scene.beat.toFixed(2)}
	></canvas>
</div>

<style>
	.lane {
		position: relative;
		background: var(--surface);
		border: 1px solid var(--line);
		border-radius: 14px;
		overflow: hidden;
		touch-action: pan-y;
		user-select: none;
		-webkit-user-select: none;
	}
	canvas {
		display: block;
		width: 100%;
		height: 300px;
		cursor: pointer;
	}
</style>
