import { tmpdir } from 'node:os';
import { join } from 'node:path';

/** Datei des künstlichen Mikrofons (siehe global-setup.ts und playwright.config.ts). */
export const FAKE_MIC_WAV = join(tmpdir(), 'probelokal-fake-mic.wav');
