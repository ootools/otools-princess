export interface AudioSettings {
  musicOn: boolean;
  sfxOn: boolean;
  musicVol: number;
  sfxVol: number;
}

export const AUDIO_SAVE_KEY: string;
export const DEFAULT_AUDIO_SETTINGS: Readonly<AudioSettings>;
export const MELODIES: { id: string; name: string; bpm: number; notes: { m: number; d: number }[] }[];
export const SFX_RECIPES: Record<string, unknown[]>;
export const SFX_NAMES: string[];

export function normalizeAudioSettings(raw: unknown): AudioSettings;
export function midiToFreq(m: number): number;
export function sfxForAction(action: string): string;

export class AudioEngine {
  constructor(settings?: unknown);
  settings: AudioSettings;
  play(name: string): void;
  applySettings(next: unknown): void;
  startMusic(): void;
  stopMusic(): void;
  unlock(): void;
  dispose(): void;
}

export function createAudioEngine(settings?: unknown): AudioEngine;
export function saveAudioSettings(settings: unknown): AudioSettings;
