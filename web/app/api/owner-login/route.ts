// Manaswi signs in with a passcode; the browser gets a hashed, http only cookie.
import { NextRequest } from "next/server";
import { timingSafeEqual } from "node:crypto";
import { OWNER_COOKIE, isOwnerRequest, ownerToken, passcodeSet } from "@/lib/ownerAuth";

export const dynamic = "force-dynamic";

// Simple brake on guessing: a few tries per minute per visitor
const tries = new Map<string, number[]>();

export async function GET(req: NextRequest) {
  return Response.json({ owner: isOwnerRequest(req), required: passcodeSet() });
}

export async function POST(req: NextRequest) {
  if (!passcodeSet()) return Response.json({ owner: true, required: false });
  const ip = (req.headers.get("x-forwarded-for") || "").split(",")[0].trim() || "local";
  const now = Date.now();
  const recent = (tries.get(ip) || []).filter((t) => now - t < 60_000);
  if (recent.length >= 5) return Response.json({ error: "Too many tries. Wait a minute." }, { status: 429 });
  tries.set(ip, [...recent, now]);

  const { passcode } = await req.json().catch(() => ({ passcode: "" }));
  const given = Buffer.from(String(passcode || ""));
  const real = Buffer.from(String(process.env.OWNER_PASSCODE));
  const ok = given.length === real.length && timingSafeEqual(given, real);
  if (!ok) return Response.json({ error: "That passcode isn't right." }, { status: 401 });

  const res = Response.json({ owner: true, required: true });
  res.headers.append(
    "Set-Cookie",
    `${OWNER_COOKIE}=${ownerToken()}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${60 * 60 * 24 * 7}${process.env.NODE_ENV === "production" ? "; Secure" : ""}`
  );
  return res;
}

export async function DELETE() {
  const res = Response.json({ owner: false });
  res.headers.append("Set-Cookie", `${OWNER_COOKIE}=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0`);
  return res;
}
