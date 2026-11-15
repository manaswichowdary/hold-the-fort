// Owner sign in for Alice's pages. Server side only.
// The passcode lives in OWNER_PASSCODE; the browser only ever holds a hashed cookie.
import { createHash } from "node:crypto";
import type { NextRequest } from "next/server";

export const OWNER_COOKIE = "fort_owner";

export function passcodeSet() {
  return Boolean(process.env.OWNER_PASSCODE);
}

export function ownerToken() {
  return createHash("sha256").update(`${process.env.OWNER_PASSCODE || ""}|hold-the-fort|${process.env.AGENT_AUTH || ""}`).digest("hex");
}

// Owner when the cookie matches. With no passcode set: allowed locally, never in production.
export function isOwnerRequest(req: NextRequest) {
  if (!passcodeSet()) return process.env.NODE_ENV !== "production";
  return req.cookies.get(OWNER_COOKIE)?.value === ownerToken();
}
