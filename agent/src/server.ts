import express from "express";
import cors from "cors";
import { cfg, missingKeys } from "./config.js";
import { streamSpeech, synthesize } from "./speech.js";
import { isOwner, ownerOnly, rateLimit, requireSecret } from "./security.js";
import { cols, ObjectId, type Note } from "./db.js";
import { answer, gatherWeek, getOwner, interview, learnFromOwner, makeCase, postcard, recap, tokensLeft, type Turn } from "./brain.js";
import { pushEnabled, pushToPhone } from "./notify.js";
import { remember, forget } from "./memory.js";
import { words } from "./rules.js";
import { buildIcs, labelFor } from "./schedule.js";
import { explorerUrl, solanaEnabled, walletInfo, writeKudos } from "./solana.js";

const app = express();
app.use(cors());
app.use(express.json({ limit: "1mb" }));
app.set("trust proxy", true);
app.use(requireSecret);

const ownerOf = (req: express.Request) =>
  String(req.body?.ownerId || req.query.ownerId || cfg.defaultOwner).toLowerCase();

const wrap =
  (fn: (req: express.Request, res: express.Response) => Promise<unknown>) =>
  (req: express.Request, res: express.Response) =>
    fn(req, res).catch((e) => {
      console.error(e);
      res.status(500).json({ error: e.message || "Something broke" });
    });

// ---------- Maritime contract ----------
app.get("/health", (_req, res) => {
  res.json({ ok: true, agent: cfg.agentName, missing: missingKeys(), solana: solanaEnabled(), phonePush: pushEnabled() });
});

app.post(
  "/chat",
  rateLimit("chat", 40, 600), wrap(async (req, res) => {
    const b = req.body || {};
    const message: string = String(b.message ?? b.prompt ?? b.input ?? b.text ?? "").trim();
    if (!message) return res.status(400).json({ error: "message is required" });
    const asker = String(b.asker || b.user || "A teammate").slice(0, 60);
    const result = await answer(ownerOf(req), message.slice(0, 1000), asker);
    res.json({ ...result, response: result.reply, text: result.reply });
  })
);

// ---------- Owner ----------
app.get("/owner", wrap(async (req, res) => {
  const ownerId = ownerOf(req);
  const owner = await getOwner(ownerId);
  res.json({ ...owner, agentName: cfg.agentName, tokensLeft: await tokensLeft(ownerId, owner) });
}));
app.post(
  "/owner",
  ownerOnly, wrap(async (req, res) => {
    const { owners } = await cols();
    const ownerId = ownerOf(req);
    const { name, role, awayUntil, returnDate, backup } = req.body;
    const interruptBudget = Math.max(0, Math.min(10, Number(req.body.interruptBudget ?? 2)));
    await owners.updateOne(
      { ownerId },
      { $set: { ownerId, name, role, awayUntil, returnDate, backup, interruptBudget } },
      { upsert: true }
    );
    res.json(await getOwner(ownerId));
  })
);

// ---------- Notes ----------
app.get("/notes", wrap(async (req, res) => {
  const { notes } = await cols();
  // Locked notes never leave the fort: only the signed in owner sees them
  const filter = isOwner(req) ? { ownerId: ownerOf(req) } : { ownerId: ownerOf(req), shareable: true };
  res.json(await notes.find(filter).sort({ updatedAt: -1 }).toArray());
}));
app.post(
  "/notes",
  ownerOnly, wrap(async (req, res) => {
    const { notes } = await cols();
    const ownerId = ownerOf(req);
    const { id, title, content } = req.body;
    const shareable = Boolean(req.body.shareable);
    if (!title || !content) return res.status(400).json({ error: "title and content are required" });
    const doc: Note = { ownerId, title, content, shareable, updatedAt: new Date() };
    let noteId: string;
    if (id) {
      await notes.updateOne({ _id: new ObjectId(id), ownerId }, { $set: doc });
      noteId = id;
    } else {
      noteId = (await notes.insertOne(doc)).insertedId.toString();
    }
    const customId = `note_${noteId}`;
    const memory = shareable
      ? await remember({ ownerId, content: `${title}\n${content}`, customId, title, kind: "note" })
      : (await forget(customId), { ok: true, skipped: "private notes stay out of memory" });
    res.json({ id: noteId, memory });
  })
);
app.delete("/notes/:id", ownerOnly, wrap(async (req, res) => {
  const { notes } = await cols();
  await notes.deleteOne({ _id: new ObjectId(req.params.id) });
  await forget(`note_${req.params.id}`);
  res.json({ ok: true });
}));

// ---------- Live pages (TinyFish) ----------
app.get("/watches", ownerOnly, wrap(async (req, res) => {
  const { watches } = await cols();
  res.json(await watches.find({ ownerId: ownerOf(req) }).toArray());
}));
app.post(
  "/watches",
  ownerOnly, wrap(async (req, res) => {
    const { watches } = await cols();
    const { label, url } = req.body;
    if (!label || !url) return res.status(400).json({ error: "label and url are required" });
    const extra: string[] = Array.isArray(req.body.keywords) ? req.body.keywords : [];
    const ins = await watches.insertOne({
      ownerId: ownerOf(req),
      label,
      url,
      keywords: [...new Set([...words(label), ...extra.map((k) => k.toLowerCase())])],
    });
    res.json({ id: ins.insertedId.toString() });
  })
);
app.delete("/watches/:id", ownerOnly, wrap(async (req, res) => {
  const { watches } = await cols();
  await watches.deleteOne({ _id: new ObjectId(req.params.id) });
  res.json({ ok: true });
}));

// ---------- Interruption budget ----------
app.post(
  "/case",
  rateLimit("interview", 30, 200), wrap(async (req, res) => {
    const { questionId, caseText } = req.body;
    if (!questionId || !String(caseText || "").trim()) return res.status(400).json({ error: "questionId and caseText are required" });
    res.json(await makeCase(ownerOf(req), questionId, String(caseText).slice(0, 800)));
  })
);
// Sage interviews the coworker. The client sends the conversation so far; the server answers with the
// next question or the final verdict (decided by rules, see brain.ts).
app.post(
  "/interview",
  rateLimit("interview", 30, 200), wrap(async (req, res) => {
    const { questionId } = req.body;
    const raw = Array.isArray(req.body.turns) ? req.body.turns : [];
    const turns: Turn[] = raw
      .slice(0, 12)
      .map((t: any) => ({ from: t?.from === "sage" ? "sage" : "them", text: String(t?.text || "").slice(0, 600) }))
      .filter((t: Turn) => t.text.trim());
    if (!questionId || !turns.some((t) => t.from === "them")) return res.status(400).json({ error: "questionId and at least one answer are required" });
    res.json(await interview(ownerOf(req), questionId, turns));
  })
);
// Sage speaks: natural voice audio for a line of text (WAV)
app.post("/speak", rateLimit("speak", 60, 1200), wrap(async (req, res) => {
  const text = String(req.body?.text || "").slice(0, 1200);
  if (!text.trim()) return res.status(400).json({ error: "text is required" });
  const r = await synthesize(text);
  if (!r.ok) return res.status(503).json({ error: r.error, restSec: r.restSec ?? 0 });
  res.setHeader("Content-Type", "audio/wav");
  res.setHeader("Cache-Control", "no-store");
  res.send(r.wav);
}));
// Sage speaks, streamed: raw audio pieces arrive as they are made, so playback starts in about a second
app.post("/speak-stream", rateLimit("speak", 60, 1200), wrap(async (req, res) => {
  const text = String(req.body?.text || "").slice(0, 1200);
  if (!text.trim()) return res.status(400).json({ error: "text is required" });
  let sent = false;
  const r = await streamSpeech(
    text,
    (rate) => {
      sent = true;
      res.status(200);
      res.setHeader("Content-Type", `audio/L16; rate=${rate}; channels=1`);
      res.setHeader("X-Audio-Rate", String(rate));
      res.setHeader("Cache-Control", "no-store");
      res.flushHeaders();
    },
    (pcm) => res.write(pcm)
  );
  if (sent) return res.end();
  res.status(503).json({ error: r.ok ? "no audio" : r.error, restSec: r.ok ? 0 : r.restSec ?? 0 });
}));
// Quick check that your phone gets the push
app.post("/notify/test", ownerOnly, wrap(async (req, res) => {
  const owner = await getOwner(ownerOf(req));
  const r = await pushToPhone({ title: `${cfg.agentName} here`, message: `Test push. If you see this, ${owner.name}'s phone is wired up.`, urgent: true });
  res.json(r);
}));
app.get("/interruptions", ownerOnly, wrap(async (req, res) => {
  const { interruptions } = await cols();
  res.json(await interruptions.find({ ownerId: ownerOf(req) }).sort({ createdAt: -1 }).limit(50).toArray());
}));
app.post("/interruptions/:id/ack", ownerOnly, wrap(async (req, res) => {
  const { interruptions } = await cols();
  await interruptions.updateOne({ _id: new ObjectId(req.params.id) }, { $set: { acknowledged: true } });
  res.json({ ok: true });
}));

// ---------- Deadline negotiator ----------
app.get("/commitments", ownerOnly, wrap(async (req, res) => {
  const { commitments } = await cols();
  res.json(await commitments.find({ ownerId: ownerOf(req) }).sort({ due: 1 }).toArray());
}));
app.post(
  "/commitments",
  rateLimit("write", 20, 200), wrap(async (req, res) => {
    const { commitments, questions } = await cols();
    const ownerId = ownerOf(req);
    const { questionId, task, due, requestedDue, requestedBy } = req.body;
    if (!task || !due) return res.status(400).json({ error: "task and due are required" });
    await commitments.insertOne({
      ownerId,
      task,
      requestedBy: requestedBy || "A teammate",
      requestedDue: requestedDue || null,
      due,
      dueLabel: labelFor(due),
      createdAt: new Date(),
    });
    if (questionId) await questions.updateOne({ _id: new ObjectId(questionId) }, { $set: { resolved: true } });
    const saved = await commitments.findOne({ ownerId, task, due }, { sort: { createdAt: -1 } });
    res.json({ ok: true, dueLabel: labelFor(due), id: saved?._id?.toString() });
  })
);
app.get(
  "/commitments/:id/ics",
  wrap(async (req, res) => {
    const { commitments } = await cols();
    const c = await commitments.findOne({ _id: new ObjectId(req.params.id) });
    if (!c) return res.status(404).json({ error: "not found" });
    const owner = await getOwner(c.ownerId);
    res.setHeader("Content-Type", "text/calendar; charset=utf-8");
    res.setHeader("Content-Disposition", 'attachment; filename="deadline.ics"');
    res.send(buildIcs(c, owner.name));
  })
);

// ---------- Coverage karma ----------
app.get(
  "/cover",
  wrap(async (req, res) => {
    const { questions, kudos } = await cols();
    const ownerId = ownerOf(req);
    const open = await questions
      .find({ ownerId, resolved: false, status: { $in: ["escalated", "urgent", "case_needed"] }, coveredBy: { $exists: false } })
      .sort({ createdAt: -1 })
      .limit(30)
      .toArray();
    const all = await kudos.find({ ownerId }).sort({ createdAt: -1 }).toArray();
    const board: Record<string, number> = {};
    for (const k of all) board[k.helper] = (board[k.helper] || 0) + 1;
    res.json({
      open,
      kudos: all.map((k) => ({ ...k, explorer: k.signature ? explorerUrl(k.signature) : undefined })),
      leaderboard: Object.entries(board).map(([helper, count]) => ({ helper, count })).sort((a, b) => b.count - a.count),
      solana: solanaEnabled(),
    });
  })
);
app.post(
  "/cover",
  rateLimit("write", 20, 200), wrap(async (req, res) => {
    const { questions, kudos } = await cols();
    const ownerId = ownerOf(req);
    const owner = await getOwner(ownerId);
    const helper = String(req.body.helper || "").trim().slice(0, 40);
    const what = String(req.body.what || "").trim().slice(0, 140);
    const { itemId } = req.body;
    if (!helper || !what) return res.status(400).json({ error: "helper and what are required" });
    if (itemId) {
      await questions.updateOne({ _id: new ObjectId(itemId) }, { $set: { coveredBy: helper, resolved: true } });
    }
    const ins = await kudos.insertOne({
      ownerId,
      helper,
      what,
      itemId,
      chain: solanaEnabled() ? "pending" : "off",
      createdAt: new Date(),
    });
    res.json({ ok: true, id: ins.insertedId.toString() });

    // Write to Solana in the background, so the coworker never waits on the chain
    if (solanaEnabled()) {
      const memo = `Hold the Fort kudos: ${helper} covered "${what}" for ${owner.name} (${new Date().toISOString().slice(0, 10)})`;
      const r = await writeKudos(memo);
      await kudos.updateOne(
        { _id: ins.insertedId },
        { $set: r.ok ? { chain: "confirmed", signature: r.signature } : { chain: "failed", chainError: r.error } }
      );
    }
  })
);
app.get("/wallet", ownerOnly, wrap(async (_req, res) => res.json(await walletInfo())));

// ---------- Desk, postcard, recap ----------
app.get("/questions", ownerOnly, wrap(async (req, res) => {
  const { questions } = await cols();
  res.json(await questions.find({ ownerId: ownerOf(req) }).sort({ createdAt: -1 }).limit(100).toArray());
}));
app.post(
  "/questions/:id/resolve",
  ownerOnly, wrap(async (req, res) => {
    const { questions } = await cols();
    const q = await questions.findOne({ _id: new ObjectId(req.params.id) });
    if (!q) return res.status(404).json({ error: "not found" });
    const ownerAnswer = String(req.body.answer || "").trim();
    let memory: unknown = { skipped: "no answer given" };
    if (ownerAnswer && q.status !== "private") {
      memory = await learnFromOwner(q.ownerId, q.question, ownerAnswer, req.params.id);
    }
    await questions.updateOne({ _id: q._id }, { $set: { resolved: true, ownerAnswer } });
    res.json({ ok: true, memory });
  })
);
app.get("/postcard", ownerOnly, wrap(async (req, res) => res.json(await postcard(ownerOf(req)))));
// Live numbers for every page (no AI call, cheap to poll)
app.get("/stats", wrap(async (req, res) => {
  const ownerId = ownerOf(req);
  const owner = await getOwner(ownerId);
  const { stats } = await gatherWeek(ownerId);
  res.json({ ...stats, tokensLeft: await tokensLeft(ownerId, owner), budget: owner.interruptBudget });
}));
app.get("/recap", ownerOnly, wrap(async (req, res) => res.json(await recap(ownerOf(req)))));

// ---------- Public team board (TinyFish reads it live) ----------
app.get("/board", wrap(async (_req, res) => {
  const { board } = await cols();
  res.json(await board.find().sort({ updatedAt: -1 }).toArray());
}));
app.post(
  "/board",
  rateLimit("write", 20, 200), wrap(async (req, res) => {
    const { board } = await cols();
    const { id, task, owner, status } = req.body;
    if (id) await board.updateOne({ _id: new ObjectId(id) }, { $set: { status, updatedAt: new Date() } });
    else await board.insertOne({ task, owner, status, updatedAt: new Date() });
    res.json({ ok: true });
  })
);

if (!cfg.agentAuth) console.log("⚠️  AGENT_AUTH is not set: fine locally, but set it before deploying so only your website can call the agent.");
app.listen(cfg.port, () => {
  const missing = missingKeys();
  console.log(`🌵 Hold the Fort agent (${cfg.agentName}) listening on port ${cfg.port}`);
  if (missing.length) console.log(`⚠️  Missing in .env: ${missing.join(", ")}`);
  if (!solanaEnabled()) console.log("ℹ️  Solana kudos off (run `npm run wallet` to set it up)");
  if (!pushEnabled()) console.log("ℹ️  Phone push off (set NTFY_TOPIC in .env)");
});
