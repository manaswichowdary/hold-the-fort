// Server side proxy to the agent (local or on Maritime). Keeps the agent URL and secret off the browser.
// Only the routes a coworker needs are open. Alice's routes need the owner sign in.
import { NextRequest } from "next/server";
import { isOwnerRequest } from "@/lib/ownerAuth";

export const dynamic = "force-dynamic";

const AGENT_URL = (process.env.AGENT_URL || "http://localhost:8787").replace(/\/$/, "");
const ID = "[a-f0-9]{24}";

// Anyone (coworkers, judges with the QR code)
const PUBLIC: [string, RegExp][] = [
  ["GET", /^owner$/],
  ["GET", /^stats$/],
  ["GET", /^board$/],
  ["POST", /^board$/],
  ["GET", /^cover$/],
  ["POST", /^cover$/],
  ["POST", /^chat$/],
  ["POST", /^case$/],
  ["POST", /^interview$/],
  ["POST", /^speak$/],
  ["POST", /^speak-stream$/],
  ["POST", /^commitments$/],
  ["GET", new RegExp(`^commitments/${ID}/ics$`)],
];

// Alice only
const OWNER: [string, RegExp][] = [
  ["POST", /^owner$/],
  ["GET", /^notes$/],
  ["POST", /^notes$/],
  ["DELETE", new RegExp(`^notes/${ID}$`)],
  ["GET", /^watches$/],
  ["POST", /^watches$/],
  ["DELETE", new RegExp(`^watches/${ID}$`)],
  ["POST", /^notify\/test$/],
  ["GET", /^interruptions$/],
  ["POST", new RegExp(`^interruptions/${ID}/ack$`)],
  ["GET", /^commitments$/],
  ["GET", /^wallet$/],
  ["GET", /^questions$/],
  ["POST", new RegExp(`^questions/${ID}/resolve$`)],
  ["GET", /^postcard$/],
  ["GET", /^recap$/],
];

const matches = (list: [string, RegExp][], method: string, path: string) => list.some(([m, re]) => m === method && re.test(path));

async function forward(req: NextRequest, ctx: { params: Promise<{ path: string[] }> }) {
  const { path } = await ctx.params;
  const p = path.join("/");
  const owner = isOwnerRequest(req);

  if (!matches(PUBLIC, req.method, p)) {
    if (!matches(OWNER, req.method, p)) return Response.json({ error: "Not found" }, { status: 404 });
    if (!owner) return Response.json({ error: "This is Alice's view. Sign in as Alice on the Who are you? page." }, { status: 401 });
  }

  const target = `${AGENT_URL}/${p}${req.nextUrl.search}`;
  const headers: Record<string, string> = { "Content-Type": "application/json", "x-fort-role": owner ? "owner" : "coworker" };
  if (process.env.AGENT_AUTH) headers.Authorization = process.env.AGENT_AUTH;
  const ip = (req.headers.get("x-forwarded-for") || "").split(",")[0].trim() || req.headers.get("x-real-ip") || "";
  if (ip) headers["x-client-ip"] = ip;

  try {
    const res = await fetch(target, {
      method: req.method,
      headers,
      body: ["GET", "HEAD"].includes(req.method) ? undefined : await req.text(),
      cache: "no-store",
    });
    // Streamed voice passes straight through piece by piece; everything else is read in full (binary safe)
    const streaming = p === "speak-stream" && res.ok && res.body;
    const body = streaming ? res.body : await res.arrayBuffer();
    return new Response(body, {
      status: res.status,
      headers: {
        "Content-Type": res.headers.get("content-type") || "application/json",
        ...(res.headers.get("content-disposition") ? { "Content-Disposition": res.headers.get("content-disposition")! } : {}),
        ...(res.headers.get("retry-after") ? { "Retry-After": res.headers.get("retry-after")! } : {}),
        ...(res.headers.get("x-audio-rate") ? { "X-Audio-Rate": res.headers.get("x-audio-rate")!, "Cache-Control": "no-store" } : {}),
      },
    });
  } catch (e: any) {
    return Response.json({ error: `Can't reach the agent. Is it running? (${e.message})` }, { status: 502 });
  }
}

export { forward as GET, forward as POST, forward as DELETE, forward as PUT };
