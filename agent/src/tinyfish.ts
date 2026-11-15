// TinyFish Fetch: reads a live web page (renders JavaScript) and returns clean markdown,
// so the fort answers "what's the status right now" instead of guessing from old notes.
import { cfg } from "./config.js";

export async function readLivePage(url: string, timeoutMs = 9000): Promise<{ ok: boolean; text: string; error?: string }> {
  if (!cfg.tinyfishKey) return { ok: false, text: "", error: "no key" };
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    const res = await fetch("https://api.fetch.tinyfish.ai", {
      method: "POST",
      signal: ctrl.signal,
      headers: { "Content-Type": "application/json", "X-API-Key": cfg.tinyfishKey },
      body: JSON.stringify({ urls: [url], format: "markdown", ttl: 0 }),
    });
    if (!res.ok) return { ok: false, text: "", error: `${res.status} ${(await res.text()).slice(0, 200)}` };
    const data: any = await res.json();
    const page = data?.results?.[0];
    const text = page?.text || page?.content || page?.markdown || "";
    if (!text) return { ok: false, text: "", error: JSON.stringify(data?.errors || "empty").slice(0, 200) };
    return { ok: true, text: String(text).slice(0, 6000) };
  } catch (e: any) {
    return { ok: false, text: "", error: e.name === "AbortError" ? "timed out" : e.message };
  } finally {
    clearTimeout(timer);
  }
}
