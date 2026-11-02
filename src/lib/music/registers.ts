// Namen der Register (docs/01: Trompeten · Posaunen · Tiefes Blech, dazu Perkussion).

import type { Register } from './types';

export const REGISTER_LABELS: Record<Register, string> = {
	trp: 'Trompeten',
	pos: 'Posaunen',
	tief: 'Tiefes Blech',
	perc: 'Perkussion'
};
