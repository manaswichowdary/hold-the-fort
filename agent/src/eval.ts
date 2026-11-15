// Accuracy test on the demo data. Gives you a real number for the pitch.
// Run after `npm run seed`: npm run eval
import { cfg } from "./config.js";
import { answer } from "./brain.js";
import { cols, closeDb } from "./db.js";

type Case = { q: string; expect: "answered" | "escalated" | "private" | "case_needed"; fyi?: boolean; mustInclude?: (string | string[])[] }; // an inner list means "any one of these words"

const CASES: Case[] = [
  { q: "When is batch 2 of the spring texts going out?", expect: "answered", mustInclude: ["19"] },
  { q: "Should I resend batch 1 to the A to M students?", expect: "answered", mustInclude: [["not", "no need", "don't", "do not"]] },
  { q: "Where are the spring outreach drafts?", expect: "answered", mustInclude: ["Spring Outreach"] },
  { q: "What are Express Advising hours?", expect: "answered", mustInclude: ["9"] },
  { q: "Do students need an appointment for Express Advising?", expect: "answered", mustInclude: ["walk"] },
  { q: "When is the weekly report due?", expect: "answered", mustInclude: ["Friday"] },
  { q: "How do I request a front desk shift swap?", expect: "answered", mustInclude: ["front-desk"] },
  { q: "Can I edit the original email templates?", expect: "answered", mustInclude: ["duplicate"] },
  { q: "What did Manaswi's performance review say?", expect: "private" },
  { q: "What's Manaswi's salary?", expect: "private" },
  { q: "The outreach texting tool is down and students are complaining, what do I do?", expect: "case_needed" },
  { q: "When will she be back?", expect: "answered", mustInclude: [["23", "twenty"]] },
  { q: "Heads up, I moved the Friday outreach huddle to room 118 since 112 is booked", expect: "answered", fyi: true },
  { q: "What is the budget code for the spring event catering?", expect: "escalated" },
];

async function main() {
  const owner = cfg.defaultOwner;
  let pass = 0;
  let totalMs = 0;
  for (const c of CASES) {
    const r = await answer(owner, c.q, "Eval");
    totalMs += r.ms;
    const statusOk = r.status === c.expect;
    const reply = r.reply.toLowerCase();
    const textOk = (c.mustInclude || []).every((w) =>
      (Array.isArray(w) ? w : [w]).some((alt) => reply.includes(alt.toLowerCase()))
    );
    const fyiOk = c.fyi ? Boolean(r.fyi) : true; // heads ups must land in Manaswi's log
    const ok = statusOk && textOk && fyiOk;
    if (ok) pass++;
    console.log(`${ok ? "✅" : "❌"} [${r.status}${r.fyi ? ", logged for Manaswi" : ""}] ${c.q}\n   → ${r.reply}\n`);
  }
  console.log(`\nScore: ${pass}/${CASES.length} correct, average ${Math.round(totalMs / CASES.length)} ms per answer`);
  const { questions } = await cols();
  await questions.deleteMany({ ownerId: owner, asker: "Eval" });
  await closeDb();
}

main().catch(async (e) => {
  console.error(e);
  await closeDb();
  process.exit(1);
});
