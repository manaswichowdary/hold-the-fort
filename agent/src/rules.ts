// Plain rules, no AI. These decisions must never be wrong, so they are code, not a model.
import type { Note } from "./db.js";

// Only phrases that clearly mean "something is on fire". Softer cases are caught by Sage's own
// triage ("might be urgent") and still go through the Shield interview, so these can stay narrow.
const URGENT = [
  "urgent", "asap", "emergency", "outage", "is down", "went down", "is broken", "stopped working",
  "data breach", "security breach", "security incident", "legal action", "lawsuit", "deadline today", "right now",
];

// Personal topics that never get answered. Phrases, not single words, so work questions
// like "Express Advising health hours" or "the event promotion flyer" are not locked by mistake.
const SENSITIVE = [
  "salary", "pay raise", "get a raise", "her raise", "compensation", "performance review", "review score",
  "her promotion", "promotion decision", "fired", "layoff", "medical", "health condition", "health issue",
  "sick leave", "is she sick", "diagnosis", "password", "credentials", "login details", "home address",
  "personal phone", "personal number", "ssn", "social security", "bank account", "bank details",
];

const STOP = new Set(["the", "and", "for", "with", "about", "from", "that", "this", "what", "when", "where", "notes", "note", "my"]);

function has(text: string, phrase: string) {
  const escaped = phrase.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return new RegExp(`\\b${escaped}\\b`, "i").test(text);
}

export function words(s: string): string[] {
  return s
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .split(/\s+/)
    .filter((w) => w.length > 2 && !STOP.has(w));
}

export type RuleResult = { kind: "urgent" | "private"; reason: string } | null;

export function checkRules(question: string, privateNotes: Note[]): RuleResult {
  const hitUrgent = URGENT.find((p) => has(question, p));
  if (hitUrgent) return { kind: "urgent", reason: `mentions "${hitUrgent}"` };

  const hitSensitive = SENSITIVE.find((p) => has(question, p));
  if (hitSensitive) return { kind: "private", reason: `sensitive topic: "${hitSensitive}"` };

  const qWords = new Set(words(question));
  for (const n of privateNotes) {
    const titleWords = words(n.title);
    const overlap = titleWords.filter((w) => qWords.has(w));
    if (titleWords.length && overlap.length >= Math.min(2, titleWords.length)) {
      return { kind: "private", reason: `matches a private note: "${n.title}"` };
    }
  }
  return null;
}

// Local keyword search over shareable notes. Backup for when memory search is still indexing.
export function localSearch(question: string, notes: Note[], limit = 3): Note[] {
  const q = new Set(words(question));
  return notes
    .map((n) => ({ n, score: words(`${n.title} ${n.content}`).filter((w) => q.has(w)).length }))
    .filter((x) => x.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, limit)
    .map((x) => x.n);
}
