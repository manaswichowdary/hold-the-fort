import { cfg } from "./config.js";

const BASE = "https://generativelanguage.googleapis.com/v1beta/models";

// Busy or retired models are skipped automatically, newest first.
function modelChain(): string[] {
  return [...new Set([cfg.geminiModel, ...cfg.geminiFallbacks].filter(Boolean))];
}

// Errors worth trying the next model for: busy, rate limited, server error, or model not available
const RETRYABLE = new Set([404, 429, 500, 502, 503, 504]);

async function callOnce(model: string, system: string, user: string, json: boolean, timeoutMs: number) {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    const res = await fetch(`${BASE}/${model}:generateContent`, {
      method: "POST",
      signal: ctrl.signal,
      headers: { "Content-Type": "application/json", "x-goog-api-key": cfg.geminiKey },
      body: JSON.stringify({
        systemInstruction: { parts: [{ text: system }] },
        contents: [{ role: "user", parts: [{ text: user }] }],
        generationConfig: {
          temperature: 0.3,
          ...(json ? { responseMimeType: "application/json" } : {}),
        },
      }),
    });
    if (!res.ok) {
      const body = (await res.text()).slice(0, 200);
      return { ok: false as const, status: res.status, error: `${model} ${res.status}: ${body}` };
    }
    const data: any = await res.json();
    const text = data?.candidates?.[0]?.content?.parts?.map((p: any) => p.text || "").join("") || "";
    if (!text) return { ok: false as const, status: 500, error: `${model} returned an empty answer` };
    return { ok: true as const, text, model };
  } catch (e: any) {
    const timedOut = e?.name === "AbortError";
    return { ok: false as const, status: timedOut ? 504 : 500, error: `${model} ${timedOut ? "timed out" : e.message}` };
  } finally {
    clearTimeout(timer);
  }
}

async function call(system: string, user: string, json: boolean, budgetMs = 18000): Promise<string> {
  const started = Date.now();
  const errors: string[] = [];
  for (const model of modelChain()) {
    const left = budgetMs - (Date.now() - started);
    if (left < 2500) break;
    const r = await callOnce(model, system, user, json, Math.min(9000, left));
    if (r.ok) {
      if (errors.length) console.log(`Gemini: used ${r.model} after: ${errors.join(" | ")}`);
      return r.text;
    }
    errors.push(r.error);
    if (!RETRYABLE.has(r.status)) break; // bad key or bad request: trying other models won't help
  }
  throw new Error(`All Gemini models failed: ${errors.join(" | ")}`.slice(0, 600));
}

export async function geminiJSON<T>(system: string, user: string): Promise<T> {
  const text = await call(system, user, true);
  const cleaned = text.replace(/^```(json)?/i, "").replace(/```$/, "").trim();
  return JSON.parse(cleaned) as T;
}

export async function geminiText(system: string, user: string): Promise<string> {
  return call(system, user, false);
}
