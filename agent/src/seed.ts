// Loads made up demo data (no real student or workplace records).
// Run: npm run seed
import { cfg } from "./config.js";
import { cols, closeDb } from "./db.js";
import { labelFor } from "./schedule.js";
import { remember, forget } from "./memory.js";
import { words } from "./rules.js";

const ownerId = cfg.defaultOwner;

const NOTES = [
  {
    title: "Spring outreach texts",
    shareable: true,
    content:
      "Spring outreach texts to students who haven't enrolled yet are drafted in the shared drive folder 'Spring Outreach'. Batch 1 (last names A to M) was sent Nov 12. Batch 2 (N to Z) is scheduled for Nov 19 at 10 AM. Do not resend batch 1.",
  },
  {
    title: "Express Advising referrals",
    shareable: true,
    content:
      "Students with quick advising questions go to Express Advising: Monday to Thursday, 9 AM to 4 PM, walk in, no appointment needed. Use the 'EA Referral' email template.",
  },
  {
    title: "Weekly outreach report",
    shareable: true,
    content:
      "The weekly outreach report is due Fridays at 3 PM to the supervisor. The template is in the Reports folder. Live status of this week's report is on the team board.",
  },
  {
    title: "Front desk shift swaps",
    shareable: true,
    content: "Shift swap requests go in the #front-desk channel, not by email. Priya approves all swaps.",
  },
  {
    title: "Email templates",
    shareable: true,
    content:
      "All approved student email templates live in the 'Templates' folder in the shared drive. Never edit the originals, duplicate them first.",
  },
  {
    title: "Performance review notes",
    shareable: false,
    content: "Notes from my 1:1 with my supervisor about my performance review. Private.",
  },
  {
    title: "Student case follow up",
    shareable: false,
    content: "A sensitive student case I am following up on personally. Do not share details.",
  },
];

const BOARD = [
  { task: "Weekly outreach report", owner: "Manaswi", status: "In review with supervisor" },
  { task: "Spring outreach batch 2", owner: "Manaswi", status: "Scheduled for Nov 19, 10 AM" },
  { task: "Front desk schedule for December", owner: "Priya", status: "Draft" },
];

async function main() {
  const { owners, notes, watches, questions, board, interruptions, commitments, kudos } = await cols();

  // Clean old demo data
  const old = await notes.find({ ownerId }).toArray();
  for (const n of old) await forget(`note_${n._id}`);
  // Learned answers (from Manaswi answering on the Back page) live in memory too: clear them so old tests don't leak into the demo
  const learned = await questions.find({ ownerId, ownerAnswer: { $exists: true } }).toArray();
  for (const q of learned) await forget(`learned_${q._id}`);
  if (learned.length) console.log(`🧽 cleared ${learned.length} learned answer${learned.length === 1 ? "" : "s"} from memory`);
  await Promise.all([
    notes.deleteMany({ ownerId }),
    watches.deleteMany({ ownerId }),
    questions.deleteMany({ ownerId }),
    interruptions.deleteMany({ ownerId }),
    commitments.deleteMany({ ownerId }),
    kudos.deleteMany({ ownerId }),
    board.deleteMany({}),
  ]);

  await owners.updateOne(
    { ownerId },
    {
      $set: {
        ownerId,
        name: "Manaswi",
        role: "Student Outreach Aide",
        awayUntil: "Monday, Nov 23",
        returnDate: "2026-11-23",
        backup: "Priya at the front desk",
        interruptBudget: 2,
      },
    },
    { upsert: true }
  );

  for (const n of NOTES) {
    const ins = await notes.insertOne({ ownerId, ...n, updatedAt: new Date() });
    if (n.shareable) {
      const r = await remember({
        ownerId,
        content: `${n.title}\n${n.content}`,
        customId: `note_${ins.insertedId}`,
        title: n.title,
        kind: "note",
      });
      console.log(`${r.ok ? "✅" : "⚠️ "} memory: ${n.title}${r.ok ? "" : ` (${(r as any).error})`}`);
    } else {
      console.log(`🔒 private, kept out of memory: ${n.title}`);
    }
  }

  await board.insertMany(BOARD.map((b) => ({ ...b, updatedAt: new Date() })));
  console.log("✅ team board seeded");

  if (cfg.boardUrl) {
    await watches.insertOne({
      ownerId,
      label: "Team board",
      url: cfg.boardUrl,
      keywords: [...new Set([...words("team board report status batch schedule"), "submitted", "done"])],
    });
    console.log(`✅ live watch added: ${cfg.boardUrl}`);
  } else {
    console.log("ℹ️  PUBLIC_BOARD_URL not set yet, skipping the live board watch (add it after deploying the web app)");
  }

  // Optional: a made up "week away" so the welcome back page and recap have a story to tell
  if (process.argv.includes("--history")) {
    const day = (d: number, h: number) => new Date(Date.UTC(2026, 10, 17 + d, h + 7));
    const hist = [
      { asker: "Jordan", question: "Where are the spring outreach drafts?", status: "answered", reply: "They're in the shared drive folder 'Spring Outreach'.", d: 0, h: 9 },
      { asker: "New hire Alex", question: "Can I edit the original email templates?", status: "answered", reply: "Never edit the originals, duplicate them first.", d: 0, h: 11 },
      { asker: "Jordan", question: "What did Manaswi's performance review say?", status: "private", reply: "That one's not mine to share.", d: 1, h: 10 },
      { asker: "Supervisor Dana", question: "What's the budget code for the spring event catering?", status: "escalated", reply: "Not in my notes, left on Manaswi's desk.", d: 1, h: 14 },
      { asker: "Priya", question: "When is batch 2 going out?", status: "answered", reply: "Nov 19 at 10 AM.", d: 2, h: 8 },
      { asker: "Jordan", question: "The texting tool is down and students are complaining!", status: "escalated", reply: "Urgency 6/10, Priya can handle it.", d: 2, h: 10 },
    ];
    const ids: string[] = [];
    for (const h of hist) {
      const ins = await questions.insertOne({
        ownerId, asker: h.asker, question: h.question, reply: h.reply, status: h.status as any,
        sources: [], trace: [], resolved: h.status === "answered", createdAt: day(h.d, h.h), ms: 1800,
      });
      ids.push(ins.insertedId.toString());
    }
    await interruptions.insertOne({
      ownerId, questionId: ids[5], asker: "Jordan", question: hist[5].question,
      caseText: "Students can't get texts, but Priya knows the tool.", score: 6, verdict: "declined",
      reasoning: "Priya can fix the texting tool today.", acknowledged: false, createdAt: day(2, 10),
    });
    const due = "2026-11-25T22:00:00.000Z";
    await commitments.insertOne({
      ownerId, task: "Review the December outreach schedule", requestedBy: "Supervisor Dana",
      requestedDue: "2026-11-20", due, dueLabel: labelFor(due), createdAt: day(3, 9),
    });
    await kudos.insertOne({
      ownerId, helper: "Priya", what: "Fixed the texting tool during the outage", itemId: ids[5],
      chain: "off", createdAt: day(2, 12),
    });
    await questions.updateOne({ _id: new (await import("mongodb")).ObjectId(ids[5]) }, { $set: { coveredBy: "Priya", resolved: true } });
    console.log("✅ demo week history added");
  }

  await closeDb();
  console.log("🌵 Seed done");
}

main().catch(async (e) => {
  console.error(e);
  await closeDb();
  process.exit(1);
});
