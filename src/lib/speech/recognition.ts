"use client";

import { useCallback, useEffect, useRef, useState } from "react";

import type { CopyLang } from "@/lib/walk/discovery-copy";

/**
 * Speech to text through the browser's Web Speech API. Free, no key. In Chrome the audio is processed by the
 * browser vendor's recognition service (not by Traike or our AI), so it only starts on a tap.
 */

interface RecognitionResultLike {
  isFinal: boolean;
  0: { transcript: string };
}
interface RecognitionEventLike {
  resultIndex: number;
  results: ArrayLike<RecognitionResultLike>;
}
interface RecognitionLike {
  lang: string;
  interimResults: boolean;
  continuous: boolean;
  onresult: ((e: RecognitionEventLike) => void) | null;
  onend: (() => void) | null;
  onerror: (() => void) | null;
  start(): void;
  stop(): void;
}
type RecognitionCtor = new () => RecognitionLike;

const HEBREW = /[֐-׿]/;

/** Hebrew letters in what was typed so far, or a Hebrew browser, mean Hebrew; anything else is English. */
export function recognitionLang(typed: string, browserLang: string): CopyLang {
  return HEBREW.test(typed) || /^(he|iw)/i.test(browserLang) ? "he" : "en";
}

export function textLang(text: string): CopyLang {
  return HEBREW.test(text) ? "he" : "en";
}

function ctor(): RecognitionCtor | null {
  if (typeof window === "undefined") return null;
  const w = window as unknown as { SpeechRecognition?: RecognitionCtor; webkitSpeechRecognition?: RecognitionCtor };
  return w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null;
}

/** `onText` gets the transcript so far (interim then final) each time it changes. */
export function useSpeechInput(onText: (transcript: string) => void, lang: () => CopyLang) {
  const [listening, setListening] = useState(false);
  const [supported, setSupported] = useState(false);
  const rec = useRef<RecognitionLike | null>(null);
  const onTextRef = useRef(onText);
  useEffect(() => {
    onTextRef.current = onText;
  });
  useEffect(() => {
    setSupported(ctor() !== null);
    return () => rec.current?.stop();
  }, []);

  const stop = useCallback(() => rec.current?.stop(), []);
  const start = useCallback(() => {
    const Ctor = ctor();
    if (!Ctor) return;
    const r = new Ctor();
    r.lang = lang() === "he" ? "he-IL" : "en-US";
    r.interimResults = true;
    r.continuous = false;
    r.onresult = (e) => {
      let t = "";
      for (let i = 0; i < e.results.length; i += 1) t += e.results[i][0].transcript;
      onTextRef.current(t.trim());
    };
    r.onend = () => setListening(false);
    r.onerror = () => setListening(false);
    rec.current = r;
    setListening(true);
    try {
      r.start();
    } catch {
      setListening(false);
    }
  }, [lang]);

  return { supported, listening, start, stop };
}
