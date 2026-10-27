// Übe-Uhr: Position in Sekunden der Aufnahme (Originaltempo), läuft mit dem gewählten Tempo.
// FreeClock treibt die Bahn ohne Ton (kein Testzugang, Aufnahme fehlt). Mit Ton liefert die
// Band-Spur die Position (StemPlayer in src/lib/audio/stems.ts, gleiche Schnittstelle).

export interface PracticeClock {
	/** Sekunden in der Aufnahme */
	time(): number;
	readonly playing: boolean;
	rate: number;
	play(): void;
	pause(): void;
	seek(seconds: number): void;
}

export class FreeClock implements PracticeClock {
	private base = 0;
	private startedAt = 0;
	private _playing = false;
	private _rate = 1;

	constructor(private readonly now: () => number = () => performance.now() / 1000) {}

	get playing() {
		return this._playing;
	}

	time(): number {
		return this._playing ? this.base + (this.now() - this.startedAt) * this._rate : this.base;
	}

	get rate() {
		return this._rate;
	}

	set rate(r: number) {
		this.base = this.time();
		this.startedAt = this.now();
		this._rate = r;
	}

	play() {
		if (this._playing) return;
		this.startedAt = this.now();
		this._playing = true;
	}

	pause() {
		if (!this._playing) return;
		this.base = this.time();
		this._playing = false;
	}

	seek(seconds: number) {
		this.base = Math.max(0, seconds);
		this.startedAt = this.now();
	}
}
