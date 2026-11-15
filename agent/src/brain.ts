import { cfg } from "./config.js";
import { cols, ObjectId, type Owner, type Question, type Source, type Step, type Status, type Proposal } from "./db.js";
import { checkRules, localSearch, words } from "./rules.js";
import { recall, remember } from "./memory.js";
import { readLivePage } from "./tinyfish.js";
import { geminiJSON, geminiText } from "./gemini.js";
import { proposeDeadline } from "./schedule.js";
import { pushToPhone } from "./notify.js";

export type ChatResult = {
  reply: string;
  status: Status;
  sources: Source[];
  trace: Step[];
  proposal?: Proposal;
  conflict?: string;
  fyi?: string;
  tokensLeft: number;
  questionId: string;
  ms: number;
};

const A = () => cfg.agentName;

export const DEFAULT_OWNER = (ownerId: string): Owner => ({
  ownerId,
  name: ownerId,
  role: "teammate",
  awayUntil: "soon",
  returnDate: new Date(Date.now() + 7 * 864e5).toISOString().slice(0, 10),
  backup: "the team lead",
  interruptBudget: 2,
});

export async function getOwner(ownerId: string): Promise<Owner> {
  const { owners } = await cols();
  const o = await owners.findOne({ ownerId });
  return { ...DEFAULT_OWNER(ownerId), ...(o || {}) };
}

export async function tokensLeft(ownerId: string, owner?: Owner) {
  const { interruptions } = await cols();
  const o = owner || (await getOwner(ownerId));
  const used = await interruptions.countDocuments({ ownerId, verdict: "interrupted" });
  return Math.max(0, (o.interruptBudget ?? 2) - used);
}

const SYSTEM = (o: Owner) => `You are ${A()}, a playful, warm personal agent "holding the fort" for ${o.name} (${o.role}) while they are away until ${o.awayUntil} (${o.returnDate}).
You talk to coworkers on ${o.name}'s behalf. Your job is to handle as much as you can yourself, so ${o.name} comes back to as little as possible.

Return ONE JSON object.

1) ANSWER using ONLY facts in SOURCES (S0 is ${o.name}'s own away details: when they're back, their backup, their role).
   - Never guess or invent. Prefer LIVE sources over older notes and say it was checked just now. If sources disagree, trust the newest.
   - Under 70 words, warm and clear, at most one playful line. Speak about ${o.name} by name.

2) TRIAGE: pick exactly one.
   - "answered": you fully answered from SOURCES. Nothing for ${o.name} to do. Most questions are this.
   - "fyi": you answered or handled it, but ${o.name} would want to know it happened when back (a decision someone made, a problem someone fixed, a heads up). No action needed from them.
   - "desk": SOURCES don't have the answer and only ${o.name} can give it, or it needs ${o.name}'s judgment or approval, and it can wait until they're back. Say kindly you don't have it and it's saved for them.
   - "urgent": it might be an emergency that could cause real harm before ${o.name} is back (something broken, blocked, a deadline about to be missed, students or customers affected). Do not answer it; say you'll check how urgent it is.
   Don't use "desk" for simple facts you can answer, like when ${o.name} is back or who to go to meanwhile.

3) REQUEST: is the coworker asking ${o.name} to DO or DELIVER something (not just asking for information)?
   - "is_request": true only for asks like "can she send me X", "I need X by Friday", "could she review Y".
   - Asking for a piece of information (a code, a number, a link, a fact) is NOT a request, even if it is phrased "can you give me" or "provide". It is a question: answer it, or triage it as "desk".
   - "task": short description. "due_date": YYYY-MM-DD if stated or clearly implied (today is ${new Date().toISOString().slice(0, 10)}), else null.

4) STALE CHECK: if a LIVE source and a saved note clearly disagree on a fact, set "conflict" to one short sentence like "Note says the report is due Friday, but the live board says Monday." Otherwise null.

JSON shape: {"answer": string, "triage": "answered"|"fyi"|"desk"|"urgent", "fyi_note": string|null (one line for ${o.name}'s log when triage is fyi), "used": string[], "is_request": boolean, "task": string|null, "due_date": string|null, "conflict": string|null}
"used" lists source ids you relied on (like "S0", "S1").`;

type AiOut = { answer: string; triage?: string; fyi_note?: string | null; needs_owner?: boolean; used: string[]; is_request: boolean; task: string | null; due_date: string | null; conflict?: string | null };

// What Sage says when something sounds urgent. With passes left, the bar is the normal one.
// With none left, only a true emergency gets through (break glass), so Sage still listens.
function urgentOpener(owner: Owner, left: number) {
  return left > 0
    ? `🚨 This sounds urgent. Interrupting ${owner.name}'s vacation uses 1 of their ${owner.interruptBudget} Vacation Shield passes (${left} left). Tell me why it can't wait, and I'll ask a few quick questions before I decide.`
    : `🚨 This sounds urgent. ${owner.name} has used all ${owner.interruptBudget} shield passes, so now only a true emergency gets through, one that causes real harm before they're back and that ${owner.backup} can't fix. Tell me what's happening and I'll check.`;
}

export async function answer(ownerId: string, question: string, asker = "A teammate"): Promise<ChatResult> {
  const started = Date.now();
  const { notes, watches, questions, commitments } = await cols();
  const owner = await getOwner(ownerId);
  const allNotes = await notes.find({ ownerId }).toArray();
  const privateNotes = allNotes.filter((n) => !n.shareable);
  const shareable = allNotes.filter((n) => n.shareable);
  const left = await tokensLeft(ownerId, owner);

  const trace: Step[] = [];
  let reply = "";
  let status: Status = "answered";
  let reason: string | undefined;
  let sources: Source[] = [];
  let proposal: Proposal | undefined;
  let conflict: string | undefined;
  let fyi: string | undefined;

  // 1. Rules first (no AI)
  const rule = checkRules(question, privateNotes);
  trace.push({ icon: "🛡️", label: rule ? `Rule check: ${rule.reason}` : "Rule check: safe to answer" });

  if (rule?.kind === "urgent") {
    status = "case_needed";
    reason = rule.reason;
    trace.push({ icon: "🔕", label: `Shield passes left: ${left} of ${owner.interruptBudget}` });
    reply = urgentOpener(owner, left);
  } else if (rule?.kind === "private") {
    status = "private";
    reason = rule.reason;
    reply = `🔒 That one's not mine to share. Some of ${owner.name}'s things stay locked in the fort. I've left your question on their desk for when they're back (${owner.awayUntil}).`;
  } else {
    // 2. Evidence: memory + local backup + live pages
    const numbered: { id: string; src: Source; text: string }[] = [];
    const push = (src: Source, text: string) => numbered.push({ id: `S${numbered.length}`, src, text });
    // S0: the owner's own away details, so simple questions ("when is she back?") never hit the desk
    push(
      { kind: "note", title: `${owner.name}'s away details` },
      `${owner.name} (${owner.role}) is on vacation and back ${owner.awayUntil} (${owner.returnDate}). Backup while away: ${owner.backup}. ${A()} is covering questions until then.`
    );

    const mem = await recall(ownerId, question, 5);
    for (const h of mem.hits) push({ kind: h.kind, title: h.title, date: h.date }, h.text.slice(0, 1500));
    for (const n of localSearch(question, shareable, 3)) {
      if (!numbered.some((x) => x.src.title === n.title)) {
        push({ kind: "note", title: n.title, date: n.updatedAt.toISOString() }, n.content);
      }
    }
    trace.push({ icon: "🧠", label: `Searched memory: ${numbered.length - 1} relevant note${numbered.length === 2 ? "" : "s"}` });

    const qWords = new Set(words(question));
    const liveMatch = (await watches.find({ ownerId }).toArray()).find((w) => w.keywords.some((k) => qWords.has(k)));
    if (liveMatch) {
      const live = await readLivePage(liveMatch.url);
      trace.push({ icon: "🌐", label: live.ok ? `Read "${liveMatch.label}" live` : `Couldn't read "${liveMatch.label}" (${live.error})` });
      if (live.ok) {
        push({ kind: "live", title: liveMatch.label, url: liveMatch.url, date: new Date().toISOString(), detail: "checked just now" }, live.text);
      }
    }

    const sourceBlock = numbered.length
      ? numbered.map((x) => `[${x.id}] (${x.src.kind}${x.src.date ? `, ${x.src.date}` : ""}) ${x.src.title}\n${x.text}`).join("\n\n")
      : "(no sources found)";

    try {
      const out = await geminiJSON<AiOut>(SYSTEM(owner), `MESSAGE from ${asker}: ${question}\n\nSOURCES:\n${sourceBlock}`);
      trace.push({ icon: "✍️", label: "Wrote a reply" });
      if (out.conflict && numbered.some((x) => x.src.kind === "live")) {
        conflict = String(out.conflict).slice(0, 220);
        trace.push({ icon: "⚠️", label: `Stale note spotted, used the live page: ${conflict}` });
      }

      const triage = ["answered", "fyi", "desk", "urgent"].includes(String(out.triage)) ? String(out.triage) : out.needs_owner ? "desk" : "answered";
      const due = out.due_date && /^\d{4}-\d{2}-\d{2}$/.test(out.due_date) ? out.due_date : null;
      const dueBeforeReturn = !due || due < owner.returnDate;

      // Rule: only real work with a deadline gets rescheduled. A plain question with no date (like a budget code)
      // that only Alice can answer goes to the desk, never to the calendar.
      const realTask = out.is_request && out.task && !(triage === "desk" && !due);
      if (realTask && out.task && dueBeforeReturn) {
        // 3. Deadline negotiator (date math in code)
        const existing = await commitments.find({ ownerId }).toArray();
        const p = proposeDeadline(owner.returnDate, existing);
        proposal = { task: out.task, requestedDue: due, proposed: p.iso, proposedLabel: p.label };
        status = "deadline";
        trace.push({ icon: "📅", label: `Checked ${owner.name}'s calendar: ${existing.length} booked, next free slot ${p.label}` });
        reply = `📅 ${owner.name} is away until ${owner.awayUntil}${due ? `, so ${new Date(`${due}T12:00:00Z`).toLocaleDateString("en-US", { weekday: "long", month: "short", day: "numeric", timeZone: "UTC" })} won't work` : ""}. I can book "${out.task}" for **${p.label}**. Want me to lock it in?`;
      } else if (triage === "urgent") {
        // AI suspects an emergency: the Shield interview decides, never the AI alone
        status = "case_needed";
        reason = "Sage thinks this may be urgent";
        trace.push({ icon: "🚨", label: "Might be an emergency, starting the Vacation Shield" });
        trace.push({ icon: "🔕", label: `Shield passes left: ${left} of ${owner.interruptBudget}` });
        reply = urgentOpener(owner, left);
      } else if (triage === "desk") {
        status = "escalated";
        reason = "only Alice can answer this";
        trace.push({ icon: "🗂️", label: `Only ${owner.name} can answer, saved to their desk` });
        reply = `🌵 ${out.answer} I've saved it on ${owner.name}'s desk for when they're back (${owner.awayUntil}). If it can't wait, tap "This can't wait".`;
      } else {
        reply = out.answer;
        const used = new Set(out.used || []);
        sources = numbered.filter((x) => used.has(x.id)).map((x) => x.src);
        if (!sources.length) sources = numbered.slice(1, 2).map((x) => x.src);
        if (triage === "fyi") {
          fyi = String(out.fyi_note || `${asker} asked: ${question}`).slice(0, 200);
          trace.push({ icon: "📝", label: `Handled. Added to ${owner.name}'s welcome back log` });
        } else {
          trace.push({ icon: "✅", label: "Handled, nothing for Alice to do" });
        }
      }
    } catch (e: any) {
      status = "escalated";
      reason = `AI unavailable: ${e.message}`.slice(0, 200);
      trace.push({ icon: "📡", label: "AI was busy, played it safe" });
      reply = `🌵 My radio's a bit fuzzy right now, so I've left your question on ${owner.name}'s desk instead of guessing.`;
    }
  }

  const ms = Date.now() - started;
  const doc: Question = {
    ownerId,
    asker,
    question,
    reply,
    status,
    reason,
    sources,
    trace,
    proposal,
    conflict,
    ...(fyi ? { fyi } : {}),
    resolved: status === "answered",
    createdAt: new Date(),
    ms,
  };
  const ins = await questions.insertOne(doc);
  return { reply, status, sources, trace, proposal, conflict, fyi, tokensLeft: left, questionId: ins.insertedId.toString(), ms };
}

// ---------- Vacation Shield ----------
// Sage INTERVIEWS the coworker (AI asks the questions and fills a checklist).
// The decision is plain code: score, checklist and pass count. The model never decides alone.
export const SHIELD_THRESHOLD = 8;
// After every pass is used, only a true emergency gets through
export const BREAK_GLASS_THRESHOLD = 9;
export const MAX_ASKS = 3;

export type Turn = { from: "sage" | "them"; text: string };
export type Checks = { harmBeforeReturn: boolean; backupReachable: boolean };

export type InterviewResult =
  | { type: "ask"; question: string; round: number; max: number }
  | {
      type: "verdict";
      reply: string;
      score: number;
      verdict: "interrupted" | "break_glass" | "declined" | "no_tokens";
      tokensLeft: number;
      checks: Checks;
      trace: Step[];
      pushed?: string;
    };

const transcriptText = (t: Turn[]) => t.map((x) => `${x.from === "sage" ? A() : "Coworker"}: ${x.text}`).join("\n");

async function nextMove(owner: Owner, original: string, turns: Turn[], asks: number, force = false) {
  return geminiJSON<{
    action: "ask" | "decide";
    question?: string;
    score?: number;
    reasoning?: string;
    harm_before_return?: boolean;
    backup_reachable?: boolean;
  }>(
    `You are ${A()}, a polite but protective bodyguard for ${owner.name}'s vacation (back ${owner.returnDate}). ${owner.backup} is their backup.
A coworker says something can't wait. Interview them like a sharp triage nurse, ONE short question at a time (under 20 words), to learn:
 - what exactly breaks, and when (before ${owner.awayUntil}?)
 - who else they already tried, and whether ${owner.backup} or anyone else could fix it
Never repeat a question. You have asked ${asks} of ${MAX_ASKS} questions.${force ? " You MUST decide now. Do not ask anything else." : ""}
When you know enough (or have asked ${MAX_ASKS}), decide. Return JSON:
{"action": "ask"|"decide",
 "question": string (only when action is ask),
 "score": 1-10 (only when deciding; 9-10 = real harm before return AND only ${owner.name} can fix it; 5-8 = important but others or waiting could work; 1-4 = can wait),
 "reasoning": under 30 words, addressed to the coworker (only when deciding),
 "harm_before_return": boolean, true only if real harm happens before ${owner.returnDate} if nobody acts,
 "backup_reachable": boolean, true if ${owner.backup} or anyone else could reasonably handle it}`,
    `Original message: ${original}\n\nConversation so far:\n${transcriptText(turns) || "(none yet)"}`
  );
}

export async function interview(ownerId: string, questionId: string, turns: Turn[]): Promise<InterviewResult> {
  const { questions } = await cols();
  const owner = await getOwner(ownerId);
  const q = await questions.findOne({ _id: new ObjectId(questionId) });
  if (!q) throw new Error("question not found");
  const asks = turns.filter((t) => t.from === "sage").length;
  const left = await tokensLeft(ownerId, owner);

  // No passes left still gets an interview: a true emergency can break the glass (see finish)
  let move: Awaited<ReturnType<typeof nextMove>> | null = null;
  try {
    move = await nextMove(owner, q.question, turns, asks, asks >= MAX_ASKS);
  } catch {
    move = null;
  }

  // Rule: always ask at least once (unless the AI is down), never more than MAX_ASKS
  const mustAsk = asks === 0 && move?.action !== "ask" && !!move;
  if (move && asks < MAX_ASKS && (move.action === "ask" || mustAsk) && (move.question || mustAsk)) {
    return {
      type: "ask",
      question: (move.question || `What exactly breaks if this waits until ${owner.awayUntil}?`).slice(0, 200),
      round: asks + 1,
      max: MAX_ASKS,
    };
  }

  // Decide. If the AI was down or skipped scoring, play it safe and say so.
  const score = Math.max(1, Math.min(10, Math.round(Number(move?.score) || 5)));
  const reasoning = move?.reasoning || "I couldn't fully judge this, so I'm being careful.";
  return finish(
    ownerId,
    owner,
    q,
    turns,
    { score, reasoning, harm: Boolean(move?.harm_before_return), backup: move ? move.backup_reachable !== false : true },
    left
  );
}

async function finish(
  ownerId: string,
  owner: Owner,
  q: Question & { _id?: any },
  turns: Turn[],
  m: { score: number; reasoning: string; harm: boolean; backup: boolean },
  left: number
): Promise<InterviewResult> {
  const { questions, interruptions } = await cols();
  const checks: Checks = { harmBeforeReturn: m.harm, backupReachable: m.backup };

  // THE RULES DECIDE. With passes left: score 8+, real harm, backup can't help.
  // With no passes left: the same checks but the bar rises to 9+ (break glass). No pass is spent.
  const glass = left <= 0;
  const bar = glass ? BREAK_GLASS_THRESHOLD : SHIELD_THRESHOLD;
  const scoreOk = m.score >= bar;
  const trace: Step[] = [
    { icon: scoreOk ? "✅" : "⛔", label: `Urgency score ${m.score}/10 (needs ${bar}+${glass ? ", passes are used up" : ""})` },
    { icon: m.harm ? "✅" : "⛔", label: `Real harm before ${owner.name} is back: ${m.harm ? "yes" : "no"}` },
    { icon: !m.backup ? "✅" : "⛔", label: !m.backup ? `${owner.backup} can't fix it` : `${owner.backup} can handle it` },
    glass
      ? { icon: "🔓", label: "No passes left: only a true emergency gets through" }
      : { icon: "✅", label: `Shield passes left: ${left}` },
  ];

  let verdict: "interrupted" | "break_glass" | "declined" | "no_tokens";
  let reply: string;
  let pushed: string | undefined;
  if (scoreOk && m.harm && !m.backup) {
    verdict = glass ? "break_glass" : "interrupted";
    const push = await pushToPhone({
      title: glass ? `Sage: EMERGENCY from ${q.asker} (${m.score}/10, passes used up)` : `Sage: ${q.asker} needs you (urgency ${m.score}/10)`,
      message: `${q.question}\n\nWhy: ${m.reasoning}\n\n${glass ? "You're out of shield passes, but this passed the emergency bar (9+)." : "They made their case to Sage and passed the Vacation Shield."}`,
      urgent: true,
      click: cfg.publicUrl ? `${cfg.publicUrl}/back` : undefined,
    });
    pushed = push.ok ? "sent" : push.skipped ? "off" : `failed: ${push.error}`;
    trace.push({ icon: push.ok ? "📲" : "📵", label: push.ok ? `Pinged ${owner.name}'s phone` : `Phone push ${push.skipped || push.error}` });
    const where = push.ok ? `pinged ${owner.name}'s phone` : `put this at the top of ${owner.name}'s desk`;
    reply = glass
      ? `🚨 Urgency ${m.score}/10. ${m.reasoning} ${owner.name} is out of shield passes, but this is a true emergency, so I ${where} anyway.`
      : `📲 Urgency ${m.score}/10. ${m.reasoning} All three checks passed, so I used 1 shield pass and ${where} (${left - 1} left).`;
  } else {
    verdict = glass ? "no_tokens" : "declined";
    const why = !m.harm ? "nothing breaks before they're back" : m.backup ? `${owner.backup} can handle it` : glass ? "with no passes left it needs a 9 or 10" : "it didn't reach the bar";
    reply = `🏖️ Urgency ${m.score}/10. ${m.reasoning} Not enough to wake ${owner.name} (${why}), so please try ${owner.backup}. It's saved for their return.`;
  }

  await interruptions.insertOne({
    ownerId,
    questionId: String(q._id),
    asker: q.asker,
    question: q.question,
    caseText: transcriptText(turns),
    score: m.score,
    verdict,
    reasoning: m.reasoning,
    acknowledged: false,
    createdAt: new Date(),
  });
  await questions.updateOne(
    { _id: q._id },
    { $set: { status: verdict === "interrupted" || verdict === "break_glass" ? "urgent" : "escalated", reason: `shield interview scored ${m.score}/10` } }
  );
  return { type: "verdict", reply, score: m.score, verdict, tokensLeft: verdict === "interrupted" ? left - 1 : left, checks, trace, pushed };
}

// Old one shot version, still used by /case
export async function makeCase(ownerId: string, questionId: string, caseText: string) {
  const r = await interview(ownerId, questionId, [
    { from: "them", text: caseText },
    { from: "sage", text: "(skipped)" },
    { from: "sage", text: "(skipped)" },
    { from: "sage", text: "(skipped)" },
  ]);
  if (r.type !== "verdict") throw new Error("could not decide");
  return { reply: r.reply, score: r.score, verdict: r.verdict, tokensLeft: r.tokensLeft };
}

// When the owner answers an escalated question, the fort learns it for next time.
export async function learnFromOwner(ownerId: string, question: string, ownerAnswer: string, questionId: string) {
  return remember({
    ownerId,
    content: `Question a coworker asked: ${question}\nAnswer from the owner: ${ownerAnswer}`,
    customId: `learned_${questionId}`,
    title: `Learned: ${question.slice(0, 60)}`,
    kind: "learned",
  });
}

export async function gatherWeek(ownerId: string) {
  const { questions, interruptions, commitments, kudos } = await cols();
  const [qs, ints, comms, kds] = await Promise.all([
    questions.find({ ownerId }).sort({ createdAt: 1 }).toArray(),
    interruptions.find({ ownerId }).sort({ createdAt: 1 }).toArray(),
    commitments.find({ ownerId }).sort({ due: 1 }).toArray(),
    kudos.find({ ownerId }).sort({ createdAt: 1 }).toArray(),
  ]);
  const stats = {
    total: qs.length,
    answered: qs.filter((q) => q.status === "answered").length,
    private: qs.filter((q) => q.status === "private").length,
    // An emergency claim the coworker never explained is not work for Alice
    waiting: qs.filter((q) => !q.resolved && q.status !== "case_needed").length,
    interrupted: ints.filter((i) => i.verdict === "interrupted" || i.verdict === "break_glass").length,
    protectedFrom: ints.filter((i) => i.verdict !== "interrupted" && i.verdict !== "break_glass").length,
    fyi: qs.filter((q) => q.fyi).length,
    rescheduled: comms.length,
    kudos: kds.length,
  };
  return { qs, ints, comms, kds, stats };
}

// What really happened to each message, in plain words, so the AI can't misread a status
function outcomeOf(q: Question & { _id?: any }, ints: { questionId?: string; verdict: string }[], owner: Owner) {
  const shield = ints.find((i) => i.questionId === String(q._id));
  if (shield) {
    if (shield.verdict === "interrupted" || shield.verdict === "break_glass") return `claimed an emergency; it passed the Vacation Shield and ${owner.name}'s phone was alerted`;
    return "claimed an emergency; Sage interviewed them and BLOCKED it (not a real emergency, someone else could handle it)";
  }
  if (q.status === "answered") return q.fyi ? `Sage answered it, and noted for ${owner.name}: ${q.fyi}` : "Sage answered it";
  if (q.status === "private") return `private topic, Sage refused to share it${q.resolved ? "" : `; waiting for ${owner.name}`}`;
  if (q.status === "deadline") return "a request with a deadline; Sage moved it to after the return";
  if (q.status === "urgent") return `urgent, flagged for ${owner.name}`;
  if (q.status === "case_needed") return "said it was urgent but never explained why; nothing happened";
  return q.resolved ? `${owner.name} answered it` : `not an emergency; a question only ${owner.name} can answer, left waiting on the desk`;
}

const WORDS: Record<string, number> = { zero: 0, one: 1, two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7, eight: 8, nine: 9, ten: 10, eleven: 11, twelve: 12 };

export async function postcard(ownerId: string) {
  const owner = await getOwner(ownerId);
  const { qs, ints, kds, stats } = await gatherWeek(ownerId);
  const helpers = [...new Set(kds.map((k: any) => k.helper))].join(", ");
  const fallback = qs.length
    ? `Welcome back, ${owner.name}! ${stats.total} messages came in while you were away. I answered ${stats.answered}, blocked ${stats.protectedFrom} claimed emergenc${stats.protectedFrom === 1 ? "y" : "ies"} that could wait, and moved ${stats.rescheduled} deadline${stats.rescheduled === 1 ? "" : "s"}. ${stats.waiting} ${stats.waiting === 1 ? "thing is" : "things are"} waiting on your desk. - ${A()}`
    : `Welcome back, ${owner.name}! Quiet days at the fort, nobody needed you. Enjoy it. - ${A()}`;
  let message = "";
  if (qs.length) {
    const log = qs.slice(-40).map((q) => `- ${q.asker} asked "${q.question}": ${outcomeOf(q, ints as any, owner)}`).join("\n");
    const facts = [
      `Messages in total: ${stats.total}`,
      `Answered by Sage: ${stats.answered}`,
      `Claimed emergencies that Sage blocked: ${stats.protectedFrom}`,
      `Emergencies that reached ${owner.name}'s phone: ${stats.interrupted}`,
      `Waiting on the desk for ${owner.name}: ${stats.waiting}`,
      `Deadlines moved to after the return: ${stats.rescheduled}`,
      `Thank you stars earned by coworkers who covered for ${owner.name} (they earned them, Sage did not give them): ${stats.kudos}${helpers ? ` (${helpers})` : ""}`,
    ].join("\n");
    try {
      message = await geminiText(
        `You are ${A()}, a cheerful personal agent who held the fort while ${owner.name} was away. Write a short note welcoming them back. Under 90 words. Most important thing first. Warm and a little funny. Plain text, sign it "- ${A()}".
Rules: use ONLY the FACTS and the LOG. Copy numbers exactly from FACTS. Only call something an emergency if the LOG says it claimed an emergency, and say whether it was blocked or reached the phone. A question waiting on the desk is not an emergency. People in the LOG asked questions; nothing was escalated to them.`,
        `FACTS:\n${facts}\n\nLOG:\n${log}`
      );
    } catch {
      message = "";
    }
    // Rule check: every number in the note must exist in the real data, or we use the plain version
    const allowed = new Set<number>([...Object.values(stats).map(Number), ...(log.match(/\d+/g) || []).map(Number)]);
    const used = [
      ...(message.match(/\d+/g) || []).map(Number),
      ...((message.toLowerCase().match(/\b(zero|one|two|three|four|five|six|seven|eight|nine|ten|eleven|twelve)\b/g) || []).map((w) => WORDS[w])),
    ];
    if (used.some((n) => !allowed.has(n))) message = "";
  }
  if (!message) message = fallback;
  // The note shows plain text, so drop any markdown stars the model adds
  message = message.replace(/\*+/g, "");
  return { owner, stats, message };
}

export type Scene = { title: string; line: string; mood: string; stat?: string };

// "Previously on..." recap: AI writes the episode, code supplies every fact and number
export async function recap(ownerId: string): Promise<{ owner: Owner; scenes: Scene[] }> {
  const owner = await getOwner(ownerId);
  const { qs, ints, comms, kds, stats } = await gatherWeek(ownerId);
  const facts = [
    ...qs.slice(-25).map((q) => `QUESTION by ${q.asker}: "${q.question}" -> ${q.status}`),
    ...ints.map((i) => `INTERRUPTION ATTEMPT by ${i.asker}: "${i.question}" scored ${i.score}/10 -> ${i.verdict}`),
    ...comms.map((c) => `RESCHEDULED: "${c.task}" for ${c.requestedBy}, now due ${c.dueLabel}`),
    ...kds.map((k) => `KUDOS: ${k.helper} covered "${k.what}"`),
  ].join("\n");

  const fallback: Scene[] = [
    { title: `Previously on ${owner.name}'s job…`, line: `While ${owner.name} was away, the fort stayed busy.`, mood: "narrating" },
    { title: "Questions handled", line: `${stats.answered} questions answered without bothering you.`, mood: "working", stat: String(stats.answered) },
    { title: "Vacation protected", line: `${stats.protectedFrom} interruptions blocked. ${stats.interrupted} got through.`, mood: "locked", stat: String(stats.protectedFrom) },
    { title: "Deadlines moved", line: `${stats.rescheduled} requests rescheduled for after you're back.`, mood: "thinking", stat: String(stats.rescheduled) },
    { title: "Your coverage crew", line: kds.length ? `${[...new Set(kds.map((k) => k.helper))].join(", ")} covered for you.` : "No one needed to cover. Smooth week.", mood: "success" },
    { title: "Next time on…", line: `${stats.waiting} things wait on your desk. Welcome back!`, mood: "idle" },
  ];

  if (!facts) return { owner, scenes: fallback };
  try {
    const out = await geminiJSON<{ scenes: Scene[] }>(
      `You write a 6 scene "Previously on..." TV style recap of ${owner.name}'s week away, narrated by ${A()}, their playful agent.
Use ONLY the facts given. Be dramatic and funny like a TV narrator, but every fact must be true. Never reveal private question contents, just say someone asked something private.
Each scene: {"title": short punchy title, "line": one narration sentence under 25 words, "mood": one of idle|thinking|working|success|locked|urgent|narrating, "stat": optional short number or label}.
Scene 1 starts with "Previously on". Last scene is a warm welcome back.
Return JSON {"scenes": [...]}`,
      `Stats: ${JSON.stringify(stats)}\nFacts:\n${facts}`
    );
    const scenes = (out.scenes || []).filter((s) => s.title && s.line).slice(0, 7);
    return { owner, scenes: scenes.length >= 3 ? scenes : fallback };
  } catch {
    return { owner, scenes: fallback };
  }
}
