// supermemory: the part of the agent that learns the owner's job.
// Notes and every answer the owner gives after returning are stored here,
// one container per owner, so the fort gets smarter every time.
import { cfg } from "./config.js";

const BASE = "https://api.supermemory.ai";

export type MemoryHit = { text: string; title: string; kind: "note" | "learned"; date?: string; score?: number };

function headers() {
  return { "Content-Type": "application/json", Authorization: `Bearer ${cfg.supermemoryKey}` };
}

export function containerFor(ownerId: string) {
  return `fort_${ownerId}`;
}

export async function remember(opts: {
  ownerId: string;
  content: string;
  customId: string; // same id = newer version replaces the old one
  title: string;
  kind: "note" | "learned";
}) {
  if (!cfg.supermemoryKey) return { ok: false, error: "no key" };
  try {
    const res = await fetch(`${BASE}/v3/documents`, {
      method: "POST",
      headers: headers(),
      body: JSON.stringify({
        content: opts.content,
        containerTag: containerFor(opts.ownerId),
        customId: opts.customId,
        metadata: { title: opts.title, kind: opts.kind, savedAt: new Date().toISOString() },
      }),
    });
    if (!res.ok) return { ok: false, error: `${res.status} ${(await res.text()).slice(0, 200)}` };
    return { ok: true };
  } catch (e: any) {
    return { ok: false, error: e.message };
  }
}

export async function forget(customId: string) {
  if (!cfg.supermemoryKey) return;
  try {
    await fetch(`${BASE}/v3/documents/${encodeURIComponent(customId)}`, { method: "DELETE", headers: headers() });
  } catch {
    /* best effort */
  }
}

function pickText(r: any): string {
  if (typeof r?.memory === "string") return r.memory;
  if (typeof r?.chunk === "string") return r.chunk;
  if (typeof r?.content === "string") return r.content;
  if (Array.isArray(r?.chunks)) return r.chunks.map((c: any) => c?.content || "").join("\n");
  return "";
}

function toHit(r: any): MemoryHit | null {
  const text = pickText(r).trim();
  if (!text) return null;
  const meta = r?.metadata || r?.documentMetadata || {};
  return {
    text,
    title: meta.title || r?.title || "Saved note",
    kind: meta.kind === "learned" ? "learned" : "note",
    date: meta.savedAt || r?.updatedAt,
    score: r?.similarity ?? r?.score,
  };
}

export async function recall(ownerId: string, q: string, limit = 5): Promise<{ hits: MemoryHit[]; error?: string }> {
  if (!cfg.supermemoryKey) return { hits: [], error: "no key" };
  const tag = containerFor(ownerId);
  const attempts: Array<[string, any]> = [
    ["/v4/search", { q, containerTag: tag, limit, searchMode: "hybrid" }],
    ["/v3/search", { q, containerTags: [tag], limit }],
  ];
  let lastErr = "";
  for (const [path, body] of attempts) {
    try {
      const res = await fetch(`${BASE}${path}`, { method: "POST", headers: headers(), body: JSON.stringify(body) });
      if (!res.ok) {
        lastErr = `${path} ${res.status}`;
        continue;
      }
      const data: any = await res.json();
      const rows: any[] = data?.results || data?.memories || data?.documents || [];
      const hits = rows.map(toHit).filter(Boolean) as MemoryHit[];
      return { hits };
    } catch (e: any) {
      lastErr = e.message;
    }
  }
  return { hits: [], error: lastErr };
}
