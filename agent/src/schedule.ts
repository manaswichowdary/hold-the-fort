// Deadline negotiator math. Plain code: dates must never be made up by a model.
import type { Commitment } from "./db.js";

const MAX_PER_DAY = 2;

function isWeekend(d: Date) {
  const day = d.getUTCDay();
  return day === 0 || day === 6;
}

function addBusinessDays(d: Date, n: number) {
  const out = new Date(d);
  let added = 0;
  while (added < n) {
    out.setUTCDate(out.getUTCDate() + 1);
    if (!isWeekend(out)) added++;
  }
  return out;
}

export function labelFor(iso: string) {
  const d = new Date(iso);
  const day = d.toLocaleDateString("en-US", { weekday: "long", month: "short", day: "numeric", timeZone: "UTC" });
  return `${day} by 3 PM`;
}

/**
 * First realistic slot after the owner returns:
 * return day is for catching up, so start the next business day,
 * and never book more than MAX_PER_DAY things on one day.
 */
export function proposeDeadline(returnDate: string, existing: Commitment[]): { iso: string; label: string } {
  // 22:00 UTC is 3 PM in Arizona (no daylight saving), matching the "by 3 PM" label
  let day = new Date(`${returnDate}T22:00:00Z`);
  if (isNaN(day.getTime())) day = new Date(Date.now() + 7 * 864e5);
  while (isWeekend(day)) day.setUTCDate(day.getUTCDate() + 1);
  day = addBusinessDays(day, 1);

  for (let i = 0; i < 30; i++) {
    const key = day.toISOString().slice(0, 10);
    const count = existing.filter((c) => c.due.slice(0, 10) === key).length;
    if (count < MAX_PER_DAY) break;
    day = addBusinessDays(day, 1);
  }
  const iso = day.toISOString();
  return { iso, label: labelFor(iso) };
}

// Calendar invite (.ics) for a booked deadline. Plain code, no AI.
const icsDate = (d: Date) => d.toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "");
const icsText = (t: string) => t.replace(/\\/g, "\\\\").replace(/;/g, "\\;").replace(/,/g, "\\,").replace(/\n/g, "\\n");

export function buildIcs(c: { _id?: unknown; task: string; requestedBy: string; due: string }, ownerName: string) {
  const start = new Date(c.due);
  const end = new Date(start.getTime() + 60 * 60 * 1000);
  const uid = `${String(c._id || Date.now())}@holdthefort`;
  return [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//Hold the Fort//Sage//EN",
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH",
    "BEGIN:VEVENT",
    `UID:${uid}`,
    `DTSTAMP:${icsDate(new Date())}`,
    `DTSTART:${icsDate(start)}`,
    `DTEND:${icsDate(end)}`,
    `SUMMARY:${icsText(`Due: ${c.task}`)}`,
    `DESCRIPTION:${icsText(`Booked by Sage for ${ownerName}. Requested by ${c.requestedBy}.`)}`,
    "BEGIN:VALARM",
    "TRIGGER:-PT1H",
    "ACTION:DISPLAY",
    "DESCRIPTION:Deadline in one hour",
    "END:VALARM",
    "END:VEVENT",
    "END:VCALENDAR",
    "",
  ].join("\r\n");
}
