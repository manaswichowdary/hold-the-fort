import type { Mood } from "@/components/Mascot";

export const OWNER = process.env.NEXT_PUBLIC_OWNER_ID || "alice";

export type Source = { kind: "note" | "learned" | "live"; title: string; detail?: string; url?: string; date?: string };
export type Step = { icon: string; label: string };
export type Status = "answered" | "escalated" | "urgent" | "private" | "case_needed" | "deadline";
export type Proposal = { task: string; requestedDue?: string | null; proposed: string; proposedLabel: string };
export type Owner = {
  ownerId: string;
  name: string;
  role: string;
  awayUntil: string;
  returnDate: string;
  backup: string;
  interruptBudget: number;
  agentName?: string;
  tokensLeft?: number;
};
export type Note = { _id: string; title: string; content: string; shareable: boolean; updatedAt: string };
export type Watch = { _id: string; label: string; url: string; keywords: string[] };
export type Question = {
  _id: string;
  asker: string;
  question: string;
  reply: string;
  status: Status;
  reason?: string;
  sources: Source[];
  trace?: Step[];
  proposal?: Proposal;
  conflict?: string;
  fyi?: string;
  resolved: boolean;
  ownerAnswer?: string;
  coveredBy?: string;
  createdAt: string;
  ms: number;
};
export type Interruption = {
  _id: string;
  asker: string;
  question: string;
  caseText: string;
  score: number;
  verdict: "interrupted" | "break_glass" | "declined" | "no_tokens";
  reasoning: string;
  acknowledged: boolean;
  createdAt: string;
};
export type Turn = { from: "sage" | "them"; text: string };
export type InterviewResult =
  | { type: "ask"; question: string; round: number; max: number }
  | { type: "verdict"; reply: string; score: number; verdict: "interrupted" | "break_glass" | "declined" | "no_tokens"; tokensLeft: number; trace: Step[]; pushed?: string };
export type Commitment = { _id: string; task: string; requestedBy: string; requestedDue?: string | null; due: string; dueLabel: string };
export type Kudos = { _id: string; helper: string; what: string; chain: "pending" | "confirmed" | "failed" | "off"; signature?: string; explorer?: string; createdAt: string };

export async function api<T = any>(path: string, opts: { method?: string; body?: unknown } = {}): Promise<T> {
  const sep = path.includes("?") ? "&" : "?";
  const res = await fetch(`/api/agent/${path}${sep}ownerId=${OWNER}`, {
    method: opts.method || (opts.body ? "POST" : "GET"),
    headers: { "Content-Type": "application/json" },
    body: opts.body ? JSON.stringify({ ownerId: OWNER, ...(opts.body as object) }) : undefined,
    cache: "no-store",
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || `Request failed (${res.status})`);
  return data as T;
}

export const STATUS_LABEL: Record<Status, { text: string; cls: string }> = {
  answered: { text: "Answered", cls: "badge ok" },
  escalated: { text: "Left on desk", cls: "badge desk" },
  urgent: { text: "Urgent", cls: "badge urgent" },
  private: { text: "Locked", cls: "badge locked" },
  case_needed: { text: "Vacation Shield", cls: "badge urgent" },
  deadline: { text: "Smart Reschedule", cls: "badge plan" },
};

export const STATUS_MOOD: Record<Status, Mood> = {
  answered: "success",
  escalated: "thinking",
  urgent: "urgent",
  private: "locked",
  case_needed: "urgent",
  deadline: "working",
};

export function timeAgo(iso?: string) {
  if (!iso) return "";
  const diff = Date.now() - new Date(iso).getTime();
  // Demo week dates can be in the future: show the day instead of "just now"
  if (diff < -60_000) return new Date(iso).toLocaleDateString(undefined, { weekday: "short", month: "short", day: "numeric" });
  const s = Math.max(1, Math.round(diff / 1000));
  if (s < 60) return "just now";
  const m = Math.round(s / 60);
  if (m < 60) return `${m} min ago`;
  const h = Math.round(m / 60);
  if (h < 24) return `${h} hr ago`;
  return new Date(iso).toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

// Renders **bold** from agent replies without allowing HTML
export function boldParts(text: string): { t: string; b: boolean }[] {
  return text.split(/(\*\*[^*]+\*\*)/g).filter(Boolean).map((p) => (p.startsWith("**") ? { t: p.slice(2, -2), b: true } : { t: p, b: false }));
}

// Live numbers for every page (cheap, no AI)
export type LiveStats = {
  total: number; answered: number; private: number; waiting: number; interrupted: number;
  protectedFrom: number; fyi: number; rescheduled: number; kudos: number; tokensLeft: number; budget: number;
};
