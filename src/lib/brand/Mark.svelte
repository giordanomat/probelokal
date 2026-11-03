<!-- Zeichen »Probelokal«: drei versetzte Balken auf schwarzer Scheibe (CLAUDE.md »Gestaltung«).
     Grösse über CSS des umgebenden Elements (width/height des svg). -->
<script lang="ts">
	let { class: cls = '' }: { class?: string } = $props();
</script>

<svg class={cls} viewBox="0 0 200 200" aria-hidden="true">
	<circle cx="100" cy="100" r="100" fill="#141619" />
	<circle cx="100" cy="100" r="97" fill="none" stroke="var(--disc-ring)" stroke-width="3" />
	<rect x="40" y="54" width="92" height="26" rx="13" fill="#F5C242" />
	<rect x="68" y="88" width="94" height="26" rx="13" fill="#E0473C" />
	<rect x="38" y="122" width="114" height="26" rx="13" fill="#6EACDA" />
</svg>
