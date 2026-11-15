import { test } from "node:test";
import assert from "node:assert/strict";

const { checkRules } = await import(new URL("../src/rules.ts", import.meta.url).pathname);

test("work questions with old trigger words are NOT locked or flagged", () => {
  for (const q of [
    "What are the Express Advising health hours?",
    "Where is the promotion flyer for the spring event?",
    "Is the bank holiday on Monday?",
    "Can you order a legal pad for the front desk?",
    "Should I raise this at the team meeting?",
  ]) assert.equal(checkRules(q, []), null, q);
});

test("personal topics are still locked", () => {
  for (const q of ["What's Alice's salary?", "What did her performance review say?", "Is she sick?", "What's her home address?"])
    assert.equal(checkRules(q, [])?.kind, "private", q);
});

test("clear emergencies still start the Shield", () => {
  for (const q of ["The texting tool is down!", "We have an outage", "This is urgent", "The portal stopped working"])
    assert.equal(checkRules(q, [])?.kind, "urgent", q);
});

test("a question matching a private note title is locked", () => {
  const notes = [{ title: "Student case follow up", content: "", shareable: false }];
  assert.equal(checkRules("Any update on the student case follow up?", notes)?.kind, "private");
});
