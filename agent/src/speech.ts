// Sage's voice: Gemini speech models turn a reply into natural sounding audio (WAV).
// If every model is busy, Sage stays quiet (the reply still shows on screen).
import { createHash } from "node:crypto";
import { cfg } from "./config.js";
import { POLLY_RATE, pollyEnabled, pollyStream } from "./polly.js";

const BASE = "https://generativelanguage.googleapis.com/v1beta/models";

// Only Sage's words are sent: any spoken direction risks being read out loud.
// One voice everywhere (cfg.ttsVoice), the one used in sage-reply.wav.

// Words that sound wrong when read literally
export function prepForSpeech(text: string): string {
  const MONTHS: Record<string, string> = { Jan: "January", Feb: "February", Mar: "March", Apr: "April", Jun: "June", Jul: "July", Aug: "August", Sep: "September", Sept: "September", Oct: "October", Nov: "November", Dec: "December" };
  return text
    .replace(/\*\*|__|`/g, "")
    .replace(/[\p{Extended_Pictographic}\u{FE0F}\u{200D}]/gu, "")
    .replace(/\b(\d+)\/10\b/g, "$1 out of 10")
    .replace(/\b(Jan|Feb|Mar|Apr|Jun|Jul|Aug|Sept?|Oct|Nov|Dec)\.?(?=\s+\d)/g, (m, mo) => MONTHS[mo] || m)
    .replace(/\s*·\s*/g, ", ")
    .replace(/\s*—\s*/g, ", ")
    .replace(/\s+/g, " ")
    .trim();
}

// Raw 16 bit PCM needs a WAV header before a browser can play it
function pcmToWav(pcm: Buffer, rate = 24000): Buffer {
  const h = Buffer.alloc(44);
  h.write("RIFF", 0);
  h.writeUInt32LE(36 + pcm.length, 4);
  h.write("WAVE", 8);
  h.write("fmt ", 12);
  h.writeUInt32LE(16, 16);
  h.writeUInt16LE(1, 20);
  h.writeUInt16LE(1, 22);
  h.writeUInt32LE(rate, 24);
  h.writeUInt32LE(rate * 2, 28);
  h.writeUInt16LE(2, 32);
  h.writeUInt16LE(16, 34);
  h.write("data", 36);
  h.writeUInt32LE(pcm.length, 40);
  return Buffer.concat([h, pcm]);
}

// Small memory cache so repeated lines (greetings, interview questions) play instantly
const cache = new Map<string, Buffer>();
const busyUntil = new Map<string, number>(); // model -> time it may be tried again
function remember(key: string, wav: Buffer) {
  cache.set(key, wav);
  if (cache.size > 80) cache.delete(cache.keys().next().value as string);
}

export async function synthesize(rawText: string): Promise<{ ok: true; wav: Buffer; model: string } | { ok: false; error: string; restSec?: number }> {
  const text = prepForSpeech(rawText).slice(0, 900);
  if (!text) return { ok: false, error: "nothing to say" };
  const allResting = cfg.ttsModels.every((m) => (busyUntil.get(m) || 0) > Date.now());
  if (allResting) {
    const next = Math.min(...cfg.ttsModels.map((m) => busyUntil.get(m) || 0));
    return { ok: false, error: "every voice model is resting (free plan limit)", restSec: Math.ceil((next - Date.now()) / 1000) };
  }
  if (!cfg.geminiKey) return { ok: false, error: "no Gemini key" };
  const key = createHash("sha1").update(`${cfg.ttsVoice}|${text}`).digest("hex");
  const hit = cache.get(key);
  if (hit) return { ok: true, wav: hit, model: "cache" };

  const errors: string[] = [];
  const t0 = Date.now();
  // Skip models that said "too many requests" recently, so busy ones don't slow every reply
  const now = Date.now();
  const ready = cfg.ttsModels.filter((m) => (busyUntil.get(m) || 0) <= now);
  for (const model of ready) {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), 12000);
    try {
      const res = await fetch(`${BASE}/${model}:generateContent`, {
        method: "POST",
        signal: ctrl.signal,
        headers: { "Content-Type": "application/json", "x-goog-api-key": cfg.geminiKey },
        body: JSON.stringify({
          contents: [{ parts: [{ text }] }],
          generationConfig: {
            responseModalities: ["AUDIO"],
            speechConfig: { voiceConfig: { prebuiltVoiceConfig: { voiceName: cfg.ttsVoice } } },
          },
        }),
      });
      if (!res.ok) {
        errors.push(`${model} ${res.status}`);
        // Busy or out of quota: rest this model for 2 minutes (or what Google asks for)
        if (res.status === 429 || res.status === 503) {
          // Google says how long to wait ("41s" for the per minute limit, hours for the daily one)
          let wait = 60000;
          try {
            const body: any = await res.json();
            const d = body?.error?.details?.find((x: any) => x.retryDelay)?.retryDelay;
            if (d) wait = Math.max(5000, parseFloat(d) * 1000);
          } catch {
            /* keep the default */
          }
          busyUntil.set(model, Date.now() + wait);
        }
        continue;
      }
      const data: any = await res.json();
      const part = data?.candidates?.[0]?.content?.parts?.find((p: any) => p.inlineData)?.inlineData;
      if (!part?.data) {
        errors.push(`${model} sent no audio`);
        continue;
      }
      const bytes = Buffer.from(part.data, "base64");
      const mime = String(part.mimeType || "");
      const rate = Number(/rate=(\d+)/.exec(mime)?.[1] || 24000);
      const wav = mime.includes("wav") ? bytes : pcmToWav(bytes, rate);
      remember(key, wav);
      console.log(`🔊 voice ${model} ${Date.now() - t0}ms${errors.length ? ` (after: ${errors.join(", ")})` : ""}`);
      return { ok: true, wav, model };
    } catch (e: any) {
      errors.push(`${model} ${e?.name === "AbortError" ? "timed out" : e.message}`);
    } finally {
      clearTimeout(timer);
    }
  }
  const next = Math.min(...cfg.ttsModels.map((m) => busyUntil.get(m) || 0));
  const restSec = next > Date.now() ? Math.ceil((next - Date.now()) / 1000) : 0;
  return { ok: false, error: errors.join("; "), restSec };
}

// ---------- Streaming: Sage starts talking ~1 second after asking, while the rest is still being made ----------
// Calls `onStart(rate)` once before the first audio, then `onPcm` with raw 16 bit mono PCM pieces.
export async function streamSpeech(
  rawText: string,
  onStart: (rate: number) => void,
  onPcm: (pcm: Buffer) => void
): Promise<{ ok: true; model: string } | { ok: false; error: string; restSec?: number }> {
  const text = prepForSpeech(rawText).slice(0, 900);
  if (!text) return { ok: false, error: "nothing to say" };
  if (!cfg.geminiKey) return { ok: false, error: "no Gemini key" };

  // Already said this line before (in this same voice): send it in one go, no new call
  const voiceName = pollyEnabled() ? `polly-${cfg.pollyEngine}-${cfg.pollyVoice}` : cfg.ttsVoice;
  const key = createHash("sha1").update(`${voiceName}|${text}`).digest("hex");
  const hit = cache.get(key);
  if (hit) {
    onStart(hit.readUInt32LE(24));
    onPcm(hit.subarray(44));
    return { ok: true, model: "cache" };
  }

  // Amazon Polly first when AWS keys are set: one voice, no daily clip limit, starts almost instantly
  if (pollyEnabled()) {
    const t0 = Date.now();
    let started = false;
    let firstMs = 0;
    const all: Buffer[] = [];
    try {
      await pollyStream(text, (pcm) => {
        if (!started) {
          started = true;
          firstMs = Date.now() - t0;
          onStart(POLLY_RATE);
        }
        all.push(pcm);
        onPcm(pcm);
      });
      if (started) {
        remember(key, pcmToWav(Buffer.concat(all), POLLY_RATE));
        console.log(`🔊 voice (Polly ${cfg.pollyVoice}): first sound ${firstMs}ms, done ${Date.now() - t0}ms`);
        return { ok: true, model: `polly-${cfg.pollyVoice}` };
      }
      return { ok: false, error: "Polly sent no audio" };
    } catch (e: any) {
      console.log(`🔇 Polly failed: ${e?.name || ""} ${e?.message || e}`);
      // Polly stays the only voice: if it fails, Sage is quiet for this line rather than switching voices
      return { ok: false, error: `Polly: ${e?.message || e}`, restSec: 30 };
    }
  }

  const errors: string[] = [];
  const t0 = Date.now();
  const ready = cfg.ttsModels.filter((m) => (busyUntil.get(m) || 0) <= Date.now());
  for (const model of ready) {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), 20000);
    try {
      const res = await fetch(`${BASE}/${model}:streamGenerateContent?alt=sse`, {
        method: "POST",
        signal: ctrl.signal,
        headers: { "Content-Type": "application/json", "x-goog-api-key": cfg.geminiKey },
        body: JSON.stringify({
          contents: [{ parts: [{ text }] }],
          generationConfig: {
            responseModalities: ["AUDIO"],
            speechConfig: { voiceConfig: { prebuiltVoiceConfig: { voiceName: cfg.ttsVoice } } },
          },
        }),
      });
      if (!res.ok || !res.body) {
        errors.push(`${model} ${res.status}`);
        if (res.status === 429 || res.status === 503) {
          let wait = 60000;
          try {
            const body: any = await res.json();
            const d = body?.error?.details?.find((x: any) => x.retryDelay)?.retryDelay;
            if (d) wait = Math.max(5000, parseFloat(d) * 1000);
          } catch {
            /* keep the default */
          }
          busyUntil.set(model, Date.now() + wait);
        }
        continue;
      }

      // Read Server Sent Events: each "data:" line carries a base64 piece of audio
      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buf = "";
      let started = false;
      let firstMs = 0;
      const all: Buffer[] = [];
      let rate = 24000;
      for (;;) {
        const { value, done } = await reader.read();
        if (done) break;
        buf += decoder.decode(value, { stream: true });
        let nl: number;
        while ((nl = buf.indexOf("\n")) >= 0) {
          const line = buf.slice(0, nl).trim();
          buf = buf.slice(nl + 1);
          if (!line.startsWith("data:")) continue;
          let d: any;
          try {
            d = JSON.parse(line.slice(5));
          } catch {
            continue;
          }
          for (const p of d?.candidates?.[0]?.content?.parts || []) {
            if (!p.inlineData?.data) continue;
            let pcm = Buffer.from(p.inlineData.data, "base64");
            const mime = String(p.inlineData.mimeType || "");
            if (pcm.subarray(0, 4).toString() === "RIFF") pcm = pcm.subarray(44); // a WAV piece: keep only the sound
            if (!started) {
              rate = Number(/rate=(\d+)/.exec(mime)?.[1] || 24000);
              onStart(rate);
              started = true;
              firstMs = Date.now() - t0;
            }
            all.push(pcm);
            onPcm(pcm);
          }
        }
      }
      if (!started) {
        errors.push(`${model} sent no audio`);
        continue;
      }
      remember(key, pcmToWav(Buffer.concat(all), rate));
      console.log(`🔊 voice (streamed) ${model}: first sound ${firstMs}ms, done ${Date.now() - t0}ms${errors.length ? ` (after: ${errors.join(", ")})` : ""}`);
      return { ok: true, model };
    } catch (e: any) {
      errors.push(`${model} ${e?.name === "AbortError" ? "timed out" : e.message}`);
    } finally {
      clearTimeout(timer);
    }
  }
  const next = Math.min(...cfg.ttsModels.map((m) => busyUntil.get(m) || 0));
  const restSec = next > Date.now() ? Math.ceil((next - Date.now()) / 1000) : 0;
  return { ok: false, error: errors.join("; ") || "every voice model is resting (free plan limit)", restSec };
}
