// Who may call what. Plain code, no AI.
// - The website proxy talks to the agent with a shared secret (AGENT_AUTH).
// - The proxy tells the agent whether the caller signed in as the owner (x-fort-role: owner).
//   The agent only believes that header when the secret is right, so nobody can fake it.
// - Busy routes are rate limited per visitor, so nobody can burn the Gemini quota.
import type { NextFunction, Request, Response } from "express";
import { cfg } from "./config.js";

// Routes that stay open without the secret: health checks, and /chat for hosts that test agents directly
const OPEN = new Set(["GET /health", "POST /chat"]);

function hasSecret(req: Request) {
  return !cfg.agentAuth || req.headers.authorization === cfg.agentAuth;
}

export function requireSecret(req: Request, res: Response, next: NextFunction) {
  if (OPEN.has(`${req.method} ${req.path}`) || hasSecret(req)) return next();
  res.status(401).json({ error: "missing or wrong agent secret" });
}

// Owner only when the secret is right AND the proxy vouched for the owner sign in.
// Locally with no AGENT_AUTH set, everything counts as the owner so development stays easy.
export function isOwner(req: Request) {
  if (!cfg.agentAuth) return true;
  return hasSecret(req) && req.headers["x-fort-role"] === "owner";
}

export function ownerOnly(req: Request, res: Response, next: NextFunction) {
  if (isOwner(req)) return next();
  res.status(403).json({ error: "This is Manaswi's view. Sign in as the owner first." });
}

// The visitor's address, as passed on by the proxy (or the direct caller)
export function clientIp(req: Request) {
  const fwd = String(req.headers["x-client-ip"] || req.headers["x-forwarded-for"] || "").split(",")[0].trim();
  return fwd || req.ip || "unknown";
}

// Simple sliding window limiter kept in memory
const hits = new Map<string, number[]>();
export function rateLimit(name: string, perMinute: number, perHour: number) {
  return (req: Request, res: Response, next: NextFunction) => {
    if (isOwner(req) && cfg.agentAuth) return next(); // the owner is never limited
    const key = `${name}|${clientIp(req)}`;
    const now = Date.now();
    const list = (hits.get(key) || []).filter((t) => now - t < 3600_000);
    const lastMinute = list.filter((t) => now - t < 60_000).length;
    if (lastMinute >= perMinute || list.length >= perHour) {
      res.setHeader("Retry-After", lastMinute >= perMinute ? "60" : "3600");
      return res.status(429).json({ error: "Slow down a little. Sage needs a breather, try again in a minute." });
    }
    list.push(now);
    hits.set(key, list);
    if (hits.size > 5000) hits.delete(hits.keys().next().value as string);
    next();
  };
}
