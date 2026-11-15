import { mock, test } from "node:test";
import assert from "node:assert/strict";

const A = new URL("../src/", import.meta.url).pathname;
const store = { qs: [{ _id: "q1", ownerId: "manaswi", asker: "Jen", question: "Texting tool is down!", status: "case_needed" }], ints: [], pushes: [] };
const fakeCols = async () => ({
  owners: { findOne: async () => ({ ownerId: "manaswi", name: "Alice", role: "Aide", awayUntil: "Nov 23", returnDate: "2026-11-23", backup: "Jen", interruptBudget: 2 }) },
  questions: { findOne: async () => store.qs[0], updateOne: async () => {} },
  interruptions: { countDocuments: async () => store.ints.filter((i) => i.verdict === "interrupted").length, insertOne: async (d) => store.ints.push(d) },
});
let script = [];
mock.module(A + "db.ts", { namedExports: { cols: fakeCols, ObjectId: class { constructor(x) { this.x = x; } } } });
mock.module(A + "gemini.ts", { namedExports: { geminiJSON: async () => { const x = script.shift(); if (x instanceof Error) throw x; return x; }, geminiText: async () => "" } });
mock.module(A + "memory.ts", { namedExports: { recall: async () => ({ hits: [] }), remember: async () => ({}) } });
mock.module(A + "tinyfish.ts", { namedExports: { readLivePage: async () => ({ ok: false }) } });
mock.module(A + "notify.ts", { namedExports: { pushToPhone: async (o) => { store.pushes.push(o); return { ok: true }; }, pushEnabled: () => true } });

const { interview } = await import(A + "brain.ts");

test("asks first, then rules approve a real emergency and push the phone", async () => {
  store.ints = []; store.pushes = [];
  script = [{ action: "ask", question: "What breaks and when?" }];
  let r = await interview("manaswi", "q1", [{ from: "them", text: "tool is down" }]);
  assert.equal(r.type, "ask"); assert.equal(r.round, 1);
  script = [{ action: "decide", score: 9, reasoning: "Students can't get texts today.", harm_before_return: true, backup_reachable: false }];
  r = await interview("manaswi", "q1", [{ from: "them", text: "tool is down" }, { from: "sage", text: "What breaks?" }, { from: "them", text: "no texts to 3000 students today; Jen has no admin" }]);
  assert.equal(r.type, "verdict"); assert.equal(r.verdict, "interrupted"); assert.equal(r.tokensLeft, 1);
  assert.equal(store.pushes.length, 1);
});

test("high score alone is NOT enough: backup reachable means declined, no push", async () => {
  store.ints = []; store.pushes = [];
  script = [{ action: "decide", score: 9, reasoning: "Big deal.", harm_before_return: true, backup_reachable: true }];
  const r = await interview("manaswi", "q1", [{ from: "them", text: "x" }, { from: "sage", text: "a" }, { from: "them", text: "y" }, { from: "sage", text: "b" }, { from: "them", text: "z" }, { from: "sage", text: "c" }, { from: "them", text: "w" }]);
  assert.equal(r.verdict, "declined"); assert.equal(store.pushes.length, 0);
});

test("never asks more than 3 questions", async () => {
  script = [{ action: "ask", question: "More?" }, { action: "decide", score: 4, reasoning: "ok", harm_before_return: false, backup_reachable: true }];
  const t = [{ from: "them", text: "a" }, { from: "sage", text: "1" }, { from: "them", text: "b" }, { from: "sage", text: "2" }, { from: "them", text: "c" }, { from: "sage", text: "3" }, { from: "them", text: "d" }];
  const r = await interview("manaswi", "q1", t);
  assert.equal(r.type, "verdict");
});

test("no passes left: an 8/10 is not enough, no push", async () => {
  store.ints = [{ verdict: "interrupted" }, { verdict: "interrupted" }]; store.pushes = [];
  script = [{ action: "decide", score: 8, reasoning: "Important.", harm_before_return: true, backup_reachable: false }];
  const r = await interview("manaswi", "q1", [{ from: "them", text: "a" }, { from: "sage", text: "1" }, { from: "them", text: "b" }, { from: "sage", text: "2" }, { from: "them", text: "c" }, { from: "sage", text: "3" }, { from: "them", text: "d" }]);
  assert.equal(r.verdict, "no_tokens"); assert.equal(store.pushes.length, 0); assert.equal(r.tokensLeft, 0);
});

test("no passes left: a true 10/10 emergency still breaks the glass and pushes", async () => {
  store.ints = [{ verdict: "interrupted" }, { verdict: "interrupted" }]; store.pushes = [];
  script = [{ action: "decide", score: 10, reasoning: "Every student text is failing today.", harm_before_return: true, backup_reachable: false }];
  const r = await interview("manaswi", "q1", [{ from: "them", text: "a" }, { from: "sage", text: "1" }, { from: "them", text: "b" }, { from: "sage", text: "2" }, { from: "them", text: "c" }, { from: "sage", text: "3" }, { from: "them", text: "d" }]);
  assert.equal(r.verdict, "break_glass"); assert.equal(store.pushes.length, 1); assert.equal(r.tokensLeft, 0);
});

test("AI down: plays safe, declines, no crash", async () => {
  store.ints = []; store.pushes = [];
  script = [new Error("down")];
  const r = await interview("manaswi", "q1", [{ from: "them", text: "urgent" }]);
  assert.equal(r.type, "verdict"); assert.equal(r.verdict, "declined");
});

test("ics file is valid shape", async () => {
  const { buildIcs } = await import(A + "schedule.ts");
  const ics = buildIcs({ _id: "abc", task: "Send report, final; v2", requestedBy: "Jen", due: "2026-11-24T22:00:00.000Z" }, "Alice");
  assert.match(ics, /BEGIN:VCALENDAR/); assert.match(ics, /DTSTART:20261124T220000Z/); assert.ok(ics.includes("report" + String.fromCharCode(92) + ", final" + String.fromCharCode(92) + "; v2")); assert.ok(ics.includes("\r\n"));
});
