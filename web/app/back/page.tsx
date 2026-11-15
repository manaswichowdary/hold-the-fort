"use client";
import { useRef, useState } from "react";
import { useLive } from "@/lib/useLive";
import Mascot from "@/components/Mascot";
import RecapPlayer, { type Scene } from "@/components/RecapPlayer";
import Icon from "@/components/Icon";
import { api, STATUS_LABEL, timeAgo, type Commitment, type Interruption, type LiveStats, type Owner, type Question } from "@/lib/api";
import Sep from "@/components/Sep";

type Postcard = {
  owner: Owner;
  stats: { total: number; answered: number; private: number; waiting: number; interrupted: number; protectedFrom: number; rescheduled: number; kudos: number };
  message: string;
};

const ORDER: Record<string, number> = { urgent: 0, case_needed: 1, private: 2, escalated: 3, deadline: 4, answered: 5 };

export default function BackPage() {
  const [card, setCard] = useState<Postcard | null>(null);
  const [qs, setQs] = useState<Question[]>([]);
  const [deadlines, setDeadlines] = useState<Commitment[]>([]);
  const [ints, setInts] = useState<Interruption[]>([]);
  const [crew, setCrew] = useState<{ helper: string; count: number }[]>([]);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [scenes, setScenes] = useState<Scene[] | null>(null);
  const [loadingRecap, setLoadingRecap] = useState(false);
  const [error, setError] = useState("");
  const [flash, setFlash] = useState("");

  const [stats, setStats] = useState<LiveStats | null>(null);
  const noteFor = useRef(""); // which numbers Sage's note was written for
  const noteAt = useRef(0);

  // Lists and numbers refresh live; Sage's note is rewritten only when something changed (it uses AI)
  async function load() {
    try {
      const [st, q, c, i, cv] = await Promise.all([
        api<LiveStats>("stats"),
        api<Question[]>("questions"),
        api<Commitment[]>("commitments"),
        api<Interruption[]>("interruptions"),
        api<{ leaderboard: { helper: string; count: number }[] }>("cover"),
      ]);
      setStats(st);
      setQs(q);
      setDeadlines(c);
      setInts(i);
      setCrew(cv.leaderboard);
      setError("");
      const key = `${st.total}-${st.waiting}-${st.interrupted}-${st.protectedFrom}-${st.rescheduled}-${st.kudos}`;
      if (key !== noteFor.current && Date.now() - noteAt.current > 30000) {
        noteFor.current = key;
        noteAt.current = Date.now();
        api<Postcard>("postcard").then(setCard).catch(() => {});
      }
    } catch (e: any) {
      setError(e.message);
    }
  }
  useLive(load, 4000);

  async function playRecap() {
    setLoadingRecap(true);
    try {
      setScenes((await api<{ scenes: Scene[] }>("recap")).scenes);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoadingRecap(false);
    }
  }

  async function resolve(q: Question) {
    const r = await api<{ memory: any }>(`questions/${q._id}/resolve`, { body: { answer: (answers[q._id] || "").trim() } });
    setFlash(q.status === "private" ? "Answered privately" : r.memory?.ok ? "Answered. Sage will remember this." : "Done");
    setTimeout(() => setFlash(""), 2500);
    load();
  }

  const handled = qs
    .filter((q) => q.status === "answered" && !q.ownerAnswer)
    .sort((a, b) => (a.fyi ? 0 : 1) - (b.fyi ? 0 : 1) || +new Date(b.createdAt) - +new Date(a.createdAt));
  const waiting = qs.filter((q) => !q.resolved && q.status !== "case_needed").sort((a, b) => (ORDER[a.status] ?? 9) - (ORDER[b.status] ?? 9));

  return (
    <>
      {scenes && <RecapPlayer scenes={scenes} onClose={() => setScenes(null)} />}
      {error && <div className="error">{error}</div>}

      <section className="back-hero">
        <div>
          <h1>Welcome back, {card?.owner.name || "friend"}.</h1>
          <p className="lead">Here&apos;s your week in one minute.</p>
          <button className="btn big" onClick={playRecap} disabled={loadingRecap}>
            <Icon name="play" size={20} /> {loadingRecap ? "Preparing…" : "Play my recap"}
          </button>
        </div>
        <Mascot mood={loadingRecap ? "working" : "narrating"} size={200} />
      </section>

      {stats && (
        <div className="stats">
          <div className="stat"><b>{stats.answered}</b><span>handled</span></div>
          <div className="stat"><b>{stats.protectedFrom}</b><span>shielded</span></div>
          <div className="stat"><b>{stats.rescheduled}</b><span>rescheduled</span></div>
          <div className="stat"><b>{stats.waiting}</b><span>waiting</span></div>
          <div className="stat"><b>{stats.tokensLeft}/{stats.budget}</b><span>shield passes left</span></div>
        </div>
      )}

      <div className="postcard">
        <h2>A note from Sage</h2>
        <p className="msg-body">{card ? card.message : "Writing your note…"}</p>
      </div>

      <div className="grid2" style={{ marginTop: 28 }}>
        <div className="stack-col">
          <div className="card">
            <h2 className="card-title">Waiting for you <span className="count">{waiting.length}</span>{flash && <span className="toast inline">{flash}</span>}</h2>
            {!waiting.length && <p className="hint">Nothing waiting.</p>}
            {waiting.map((q) => (
              <div key={q._id} className={`inbox-item ${q.status === "urgent" ? "urgent" : ""}`}>
                <div className="row">
                  <span className={STATUS_LABEL[q.status].cls}>{STATUS_LABEL[q.status].text}</span>
                  <span className="meta-line">{q.asker} <Sep /> {timeAgo(q.createdAt)}</span>
                </div>
                <p className="task-text">{q.question}</p>
                <div className="row">
                  <input style={{ flex: 1, minWidth: 200 }} value={answers[q._id] || ""} onChange={(e) => setAnswers({ ...answers, [q._id]: e.target.value })} placeholder="Your answer" />
                  <button className="btn small" onClick={() => resolve(q)}>Answer</button>
                </div>
              </div>
            ))}
          </div>
          <div className="card">
            <h2 className="card-title"><Icon name="check" size={24} /> Sage handled these <span className="count">{handled.length}</span></h2>
            <p className="hint">Answered for you. Nothing to do, just so you know.</p>
            {!handled.length && <p className="hint">Nothing yet.</p>}
            {handled.slice(0, 12).map((q) => (
              <div key={q._id} className="inbox-item">
                <div className="row">
                  <span className={q.fyi ? "badge desk" : "badge ok"}>{q.fyi ? "For your info" : "Answered"}</span>
                  <span className="meta-line">{q.asker} <Sep /> {timeAgo(q.createdAt)}</span>
                </div>
                <p className="task-text">{q.fyi || q.question}</p>
              </div>
            ))}
          </div>
        </div>

        <div className="stack-col">
          <div className="card">
            <h2 className="card-title"><Icon name="calendar" size={24} /> Smart Reschedule</h2>
            {!deadlines.length && <p className="hint">Nothing rescheduled.</p>}
            {deadlines.map((d) => (
              <div key={d._id} className="task-row">
                <div>
                  <p className="task-text">{d.task}</p>
                  <span className="meta-line">For {d.requestedBy}</span>
                </div>
                <span className="date-chip">{d.dueLabel}</span>
              </div>
            ))}
          </div>
          <div className="card">
            <h2 className="card-title"><Icon name="shield" size={24} /> Vacation Shield</h2>
            {!ints.length && <p className="hint">No one tried to interrupt you.</p>}
            {ints.map((i) => (
              <div key={i._id} className="task-row">
                <div>
                  <p className="task-text">{i.question}</p>
                  <span className="meta-line">{i.asker} <Sep /> {i.reasoning}</span>
                </div>
                <span className={`badge ${i.verdict === "interrupted" || i.verdict === "break_glass" ? "urgent" : "ok"}`}>{i.verdict === "break_glass" ? "Emergency" : i.verdict === "interrupted" ? "Got through" : "Blocked"}</span>
              </div>
            ))}
          </div>
          <div className="card">
            <h2 className="card-title"><Icon name="star" size={24} /> Who covered for you</h2>
            {!crew.length && <p className="hint">No one needed to.</p>}
            {crew.map((c) => (
              <div key={c.helper} className="leader">
                <span className="leader-name">{c.helper}</span>
                <span className="spacer" />
                <span className="leader-count">{c.count} ★</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </>
  );
}
