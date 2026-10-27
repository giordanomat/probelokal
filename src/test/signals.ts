// Synthetische Signale für Tests der Tonerkennung (Sägezahn = obertonreich wie Blech).

export function sawtooth(hz: number, length: number, amp = 0.3, sr = 48000): Float32Array {
	const out = new Float32Array(length);
	for (let i = 0; i < length; i++) {
		const phase = (i * hz) / sr;
		out[i] = amp * 2 * (phase - Math.floor(phase + 0.5));
	}
	return out;
}

export function noise(length: number, amp: number, seed = 1): Float32Array {
	const out = new Float32Array(length);
	let s = seed;
	for (let i = 0; i < length; i++) {
		s = (s * 1664525 + 1013904223) % 4294967296;
		out[i] = amp * (s / 4294967296 - 0.5) * 2;
	}
	return out;
}
