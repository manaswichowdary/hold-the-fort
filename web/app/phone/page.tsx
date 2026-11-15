"use client";
import { useEffect, useRef, useState } from "react";
import Mascot from "@/components/Mascot";
import { api, timeAgo, type Interruption, type Owner } from "@/lib/api";
import Sep from "@/components/Sep";

export default function PhonePage() {
  const [owner, setOwner] = useState<Owner | null>(null);
  const [items, setItems] = useState<Interruption[]>([]);
  // Start empty and set the time after load, so server and browser HTML match
  const [now, setNow] = useState<Date | null>(null);
  const seen = useRef<Set<string>>(new Set());
  const first = useRef(true);

  async function load() {
    try {
      const [o, list] = await Promise.all([api<Owner>("owner"), api<Interruption[]>("interruptions")]);
      setOwner(o);
      const fresh = list.filter((i) => (i.verdict === "interrupted" || i.verdict === "break_glass") && !i.acknowledged && !seen.current.has(i._id));
      if (fresh.length && !first.current && "vibrate" in navigator) navigator.vibrate([200, 100, 200]);
      list.forEach((i) => seen.current.add(i._id));
      first.current = false;
      setItems(list);
    } catch {
      /* keep the lock screen calm */
    }
  }
  useEffect(() => {
    load();
    const poll = setInterval(load, 3000);
    setNow(new Date());
    const clock = setInterval(() => setNow(new Date()), 1000);
    return () => {
      clearInterval(poll);
      clearInterval(clock);
    };
  }, []);

  async function ack(id: string) {
    await api(`interruptions/${id}/ack`, { method: "POST", body: {} });
    load();
  }

  const urgent = items.filter((i) => (i.verdict === "interrupted" || i.verdict === "break_glass") && !i.acknowledged);
  const blocked = items.filter((i) => i.verdict !== "interrupted" && i.verdict !== "break_glass").length;

  return (
    <div className="phone-layout">
      <div className="phone-explain">
        <h1>My phone</h1>
        <p className="lead">This is your phone while you&apos;re on vacation.</p>
        <ul className="plain-list">
          <li><b>Quiet by default.</b> Sage handles everyday questions.</li>
          <li><b>Buzzes only for emergencies.</b> A coworker must make their case, and it has to score 8/10 or higher.</li>
          <li><b>Each buzz uses a shield pass.</b> You choose how many you allow.</li>
          <li><b>Out of passes?</b> Only a true emergency (9 or 10 out of 10, real harm, no one else can fix it) still buzzes.</li>
        </ul>
        <div className="mini-stats">
          <div><b>{blocked}</b><span>blocked</span></div>
          <div><b>{urgent.length}</b><span>waiting</span></div>
          <div><b>{owner?.tokensLeft ?? "–"}</b><span>passes left</span></div>
        </div>
        <p className="hint">Tip: open this page on your actual phone during the demo.</p>
      </div>

      <div className="phone">
        <div className="notch" />
        <div className="lock-time">{now ? now.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" }) : " "}</div>
        <div className="lock-date">{now ? now.toLocaleDateString([], { weekday: "long", month: "long", day: "numeric" }) : " "}</div>
        {urgent.length === 0 ? (
          <div className="phone-calm">
            <Mascot mood="sleeping" size={130} showProp={false} />
            <p><b>You&apos;re off.</b><br />Sage is holding the fort.</p>
          </div>
        ) : (
          urgent.map((i) => (
            <div key={i._id} className="notif slide-in">
              <div className="notif-head"><span>HOLD THE FORT</span><span>{timeAgo(i.createdAt)}</span></div>
              <b>Urgent from {i.asker} <Sep /> {i.score}/10</b>
              <p>{i.question}</p>
              <button onClick={() => ack(i._id)}>I&apos;ll handle it</button>
            </div>
          ))
        )}
        <div className="home-bar" />
      </div>
    </div>
  );
}
