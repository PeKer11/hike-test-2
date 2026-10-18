import type { CopyLang } from "@/lib/walk/discovery-copy";

/**
 * Opt-in spoken questions via the browser's Web Speech API. Off by default and
 * remembered per device. Nothing is sent anywhere: the browser speaks locally.
 * A Hebrew question is only spoken when a Hebrew voice exists; an English voice
 * reading Hebrew letters would be noise.
 */

export const TTS_STORAGE_KEY = "traike.voice";

export function readTtsOptIn(): boolean {
  try {
    return window.localStorage.getItem(TTS_STORAGE_KEY) === "1";
  } catch {
    return false;
  }
}

export function writeTtsOptIn(on: boolean): void {
  try {
    window.localStorage.setItem(TTS_STORAGE_KEY, on ? "1" : "0");
  } catch {
    // Private mode: the choice just lasts until the page is closed.
  }
}

export interface VoiceLike {
  lang: string;
}

export interface SynthLike {
  getVoices(): VoiceLike[];
  speak(utterance: unknown): void;
  cancel(): void;
}

const LOCALE: Record<CopyLang, string> = { en: "en-US", he: "he-IL" };

/** `iw` is the legacy code some engines still report for Hebrew. */
export function pickVoice<V extends VoiceLike>(voices: V[], lang: CopyLang): V | null {
  const want = lang === "he" ? ["he", "iw"] : ["en"];
  return (
    voices.find((v) => want.some((w) => v.lang.toLowerCase().replace("_", "-").startsWith(w))) ?? null
  );
}

export function getSynth(): SynthLike | null {
  if (typeof window === "undefined" || !("speechSynthesis" in window)) return null;
  return window.speechSynthesis as unknown as SynthLike;
}

export function ttsSupported(): boolean {
  return getSynth() !== null && typeof SpeechSynthesisUtterance !== "undefined";
}

/** Speaks `text` if the walker opted in, the browser can, and a matching voice exists. Returns whether it spoke. */
export function speak(
  text: string,
  lang: CopyLang,
  optedIn: boolean,
  synth: SynthLike | null = getSynth(),
  makeUtterance: (text: string) => { lang: string; voice: unknown } = (t) =>
    new SpeechSynthesisUtterance(t),
): boolean {
  if (!optedIn || !synth || text.trim() === "") return false;
  const voice = pickVoice(synth.getVoices(), lang);
  if (lang === "he" && !voice) return false;
  const u = makeUtterance(text);
  u.lang = LOCALE[lang];
  if (voice) u.voice = voice;
  synth.cancel();
  synth.speak(u);
  return true;
}

export function stopSpeaking(synth: SynthLike | null = getSynth()): void {
  synth?.cancel();
}
