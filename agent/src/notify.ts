// Real phone push, using ntfy.sh (free, no account). Install the "ntfy" app, subscribe to your topic.
// Sage only calls this after the RULES say a coworker earned a shield pass.
import { cfg } from "./config.js";

export function pushEnabled() {
  return Boolean(cfg.ntfyTopic);
}

export type PushResult = { ok: boolean; skipped?: string; error?: string };

export async function pushToPhone(opts: {
  title: string;
  message: string;
  urgent?: boolean;
  click?: string;
}): Promise<PushResult> {
  if (!cfg.ntfyTopic) return { ok: false, skipped: "NTFY_TOPIC is not set" };
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), 6000);
  try {
    // JSON publishing keeps emoji and any language intact
    const res = await fetch(cfg.ntfyServer, {
      method: "POST",
      signal: ctrl.signal,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        topic: cfg.ntfyTopic,
        title: opts.title.slice(0, 120),
        message: opts.message.slice(0, 900),
        priority: opts.urgent ? 5 : 3,
        tags: opts.urgent ? ["rotating_light", "cactus"] : ["cactus"],
        ...(opts.click ? { click: opts.click } : {}),
      }),
    });
    if (!res.ok) return { ok: false, error: `ntfy ${res.status}` };
    return { ok: true };
  } catch (e: any) {
    return { ok: false, error: e?.name === "AbortError" ? "ntfy timed out" : e.message };
  } finally {
    clearTimeout(timer);
  }
}
