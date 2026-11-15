"use client";
// Voice for Sage: the browser listens (speech recognition) and talks back (speech synthesis).
// Nothing to install. Works best in Chrome, Edge and Safari.

type Rec = {
  lang: string;
  interimResults: boolean;
  continuous: boolean;
  maxAlternatives: number;
  onresult: ((e: any) => void) | null;
  onerror: ((e: any) => void) | null;
  onend: (() => void) | null;
  start: () => void;
  stop: () => void;
  abort: () => void;
};

export function canListen(): boolean {
  if (typeof window === "undefined") return false;
  const w = window as any;
  return Boolean(w.SpeechRecognition || w.webkitSpeechRecognition);
}

export function canSpeak(): boolean {
  return typeof window !== "undefined" && Boolean((window as any).AudioContext || (window as any).webkitAudioContext);
}

// Emoji and markdown sound silly when read aloud
export function cleanForSpeech(text: string): string {
  return text
    .replace(/\*\*/g, "")
    .replace(/[\p{Extended_Pictographic}\u{FE0F}\u{200D}]/gu, "")
    .replace(/\s*·\s*/g, ", ")
    .replace(/\s+/g, " ")
    .replace(/(\d+)\/10/g, "$1 out of 10")
    .trim();
}

export type SpeechStyle = "reply" | "question" | "urgent" | "narrate";

// ---------- Natural voice (Gemini speech, through the agent) ----------
// Played through Web Audio: once unlocked by a click ("Voice on" or Send), it can play every
// later reply automatically, even ones that arrive seconds later. Safari needs this.
let ctx: AudioContext | null = null;
let source: AudioBufferSourceNode | null = null;
let queued: AudioBufferSourceNode[] = []; // streamed pieces waiting to play
let token = 0; // bumps on every new speak or stop, so stale audio never plays

function getCtx(): AudioContext | null {
  if (typeof window === "undefined") return null;
  if (!ctx) {
    const AC = (window as any).AudioContext || (window as any).webkitAudioContext;
    if (!AC) return null;
    ctx = new AC() as AudioContext;
  }
  return ctx;
}

// Call from a click. Resumes audio and plays a tiny silent sound so the browser trusts this page.
export function unlockVoice() {
  const c = getCtx();
  if (!c) return;
  if (c.state !== "running") c.resume().catch(() => {});
  try {
    const b = c.createBuffer(1, 1, 22050);
    const s = c.createBufferSource();
    s.buffer = b;
    s.connect(c.destination);
    s.start(0);
  } catch {
    /* ignore */
  }
}

export function stopSpeaking() {
  token++;
  if (source) {
    try {
      source.onended = null;
      source.stop();
    } catch {
      /* already stopped */
    }
    source = null;
  }
  for (const q of queued) {
    try {
      q.onended = null;
      q.stop();
    } catch {
      /* already stopped */
    }
  }
  queued = [];
  if (typeof window !== "undefined" && "speechSynthesis" in window) window.speechSynthesis.cancel();
}

// Plays Sage's voice while it is still being made: each piece is queued right after the last,
// so speech starts about a second after the reply instead of waiting for the whole clip.
async function streamAndPlay(text: string, my: number, onStart: () => void): Promise<{ played: boolean; restSec?: number }> {
  const c = getCtx();
  if (!c) return { played: false };
  let res: Response;
  try {
    res = await fetch("/api/agent/speak-stream", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text }),
    });
  } catch {
    return { played: false };
  }
  if (res.status === 503) {
    const j = await res.json().catch(() => ({}));
    return { played: false, restSec: Number(j.restSec) || 60 };
  }
  if (!res.ok || !res.body) return { played: false };
  if (c.state !== "running") await c.resume().catch(() => {});

  const rate = Number(res.headers.get("x-audio-rate")) || 24000;
  const reader = res.body.getReader();
  let leftover: Uint8Array | null = null; // half a sample carried to the next piece
  let pending: Float32Array[] = [];
  let pendingLen = 0;
  let nextAt = 0;
  let last: AudioBufferSourceNode | null = null;
  let started = false;

  const flush = () => {
    if (!pendingLen || my !== token) return;
    const buf = c.createBuffer(1, pendingLen, rate);
    const ch = buf.getChannelData(0);
    let o = 0;
    for (const part of pending) {
      ch.set(part, o);
      o += part.length;
    }
    pending = [];
    pendingLen = 0;
    const s = c.createBufferSource();
    s.buffer = buf;
    s.connect(c.destination);
    // A tiny head start on the first piece so later pieces never run dry
    nextAt = Math.max(nextAt, c.currentTime + (started ? 0.02 : 0.12));
    s.start(nextAt);
    nextAt += buf.duration;
    queued.push(s);
    last = s;
    if (!started) {
      started = true;
      onStart();
    }
  };

  for (;;) {
    const { value, done } = await reader.read();
    if (my !== token) {
      reader.cancel().catch(() => {});
      return { played: started };
    }
    if (done) break;
    let bytes: Uint8Array = value;
    if (leftover) {
      const joined = new Uint8Array(leftover.length + bytes.length);
      joined.set(leftover);
      joined.set(bytes, leftover.length);
      bytes = joined;
      leftover = null;
    }
    const even = bytes.length - (bytes.length % 2);
    if (even < bytes.length) leftover = bytes.slice(even);
    const view = new DataView(bytes.buffer, bytes.byteOffset, even);
    const f = new Float32Array(even / 2);
    for (let i = 0; i < f.length; i++) f[i] = view.getInt16(i * 2, true) / 32768;
    pending.push(f);
    pendingLen += f.length;
    // Play in short pieces (first one ~0.25s for a fast start, then ~0.5s)
    if (pendingLen >= rate * (started ? 0.5 : 0.25)) flush();
  }
  flush();
  if (!last) return { played: false };
  // Wait until the final piece finishes
  const end = last as AudioBufferSourceNode;
  await new Promise<void>((resolve) => {
    end.onended = () => resolve();
  });
  queued = queued.filter((q) => q !== end);
  return { played: true };
}

// Speaks only in Sage's one voice. If it can't load, Sage stays quiet (the reply is still on screen).
export async function speak(
  text: string,
  opts: { onStart?: () => void; onEnd?: () => void; onResting?: (restSec: number) => void; style?: SpeechStyle } = {}
) {
  const clean = cleanForSpeech(text);
  if (!clean) {
    opts.onEnd?.();
    return;
  }
  stopSpeaking();
  const my = token;
  const r = await streamAndPlay(clean, my, () => opts.onStart?.());
  if (my !== token) return;
  if (!r.played && r.restSec) opts.onResting?.(r.restSec);
  opts.onEnd?.();
}

export type Listener = { stop: () => void };

// Listens once. onInterim shows live words, onFinal gets the full sentence.
export function listen(opts: {
  onInterim?: (t: string) => void;
  onFinal: (t: string) => void;
  onEnd?: () => void;
  onError?: (msg: string) => void;
}): Listener | null {
  if (!canListen()) {
    opts.onError?.("This browser can't listen. Try Chrome or Safari.");
    return null;
  }
  const w = window as any;
  const rec: Rec = new (w.SpeechRecognition || w.webkitSpeechRecognition)();
  rec.lang = "en-US";
  rec.interimResults = true;
  rec.continuous = false;
  rec.maxAlternatives = 1;
  let finalText = "";
  let delivered = false;
  rec.onresult = (e: any) => {
    let interim = "";
    for (let i = e.resultIndex; i < e.results.length; i++) {
      const r = e.results[i];
      if (r.isFinal) finalText += r[0].transcript;
      else interim += r[0].transcript;
    }
    if (interim) opts.onInterim?.(interim);
  };
  rec.onerror = (e: any) => {
    const code = e?.error || "unknown";
    if (code === "not-allowed" || code === "service-not-allowed") opts.onError?.("Microphone is blocked. Allow it in the address bar, then try again.");
    else if (code !== "no-speech" && code !== "aborted") opts.onError?.(`Mic problem: ${code}`);
  };
  rec.onend = () => {
    if (!delivered && finalText.trim()) {
      delivered = true;
      opts.onFinal(finalText.trim());
    }
    opts.onEnd?.();
  };
  try {
    rec.start();
  } catch {
    opts.onError?.("Couldn't start the microphone.");
    return null;
  }
  return { stop: () => rec.stop() };
}
