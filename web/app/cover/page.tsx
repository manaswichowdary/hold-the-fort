"use client";
import { useEffect, useState } from "react";
import Mascot from "@/components/Mascot";
import Icon from "@/components/Icon";
import { api, timeAgo, type Kudos, type Owner, type Question } from "@/lib/api";
import Sep from "@/components/Sep";

type CoverData = { open: Question[]; kudos: Kudos[]; leaderboard: { helper: string; count: number }[]; solana: boolean };

export default function CoverPage() {
  const [owner, setOwner] = useState<Owner | null>(null);
  const [data, setData] = useState<CoverData | null>(null);
  const [helper, setHelper] = useState("");
  const [custom, setCustom] = useState("");
  const [flash, setFlash] = useState("");
  const [error, setError] = useState("");

  async function load() {
    try {
      const [o, d] = await Promise.all([api<Owner>("owner"), api<CoverData>("cover")]);
      setOwner(o);
      setData(d);
    } catch (e: any) {
      setError(e.message);
    }
  }
  useEffect(() => {
    load();
    const t = setInterval(load, 5000);
    return () => clearInterval(t);
  }, []);

  async function cover(what: string, itemId?: string) {
    if (!helper.trim()) return setError("Add your name first.");
    setError("");
    await api("cover", { body: { helper, what, itemId } });
    setFlash(`Thanks, ${helper}! Star earned.`);
    setTimeout(() => setFlash(""), 3000);
    setCustom("");
    load();
  }

  const name = owner?.name || "Alice";

  return (
    <>
      <div className="page-head">
        <Mascot mood={flash ? "success" : "working"} size={96} showProp={false} />
        <div>
          <h1>Thank You Stars</h1>
          <p className="lead">Cover something for {name} and earn a star.</p>
        </div>
        <span className="spacer" />
        {flash && <span className="toast">{flash}</span>}
      </div>
      {error && <div className="error">{error}</div>}

      <div className="grid2">
        <div className="stack-col">
          <div className="card">
            <div className="field"><label>Your name</label><input value={helper} onChange={(e) => setHelper(e.target.value)} placeholder="Jen" /></div>
            <h2 className="card-title">Needs someone <span className="count">{data?.open.length ?? 0}</span></h2>
            {!data?.open.length && <p className="hint">Nothing open right now.</p>}
            {data?.open.map((q) => (
              <div key={q._id} className="task-row">
                <div>
                  <p className="task-text">{q.question}</p>
                  <span className="meta-line">Asked by {q.asker} <Sep /> {timeAgo(q.createdAt)}</span>
                </div>
                <button className="btn small alt" onClick={() => cover(q.question, q._id)}>I&apos;ll cover it</button>
              </div>
            ))}
          </div>
          <div className="card">
            <h2 className="card-title">Covered something else?</h2>
            <div className="row">
              <input style={{ flex: 1 }} value={custom} onChange={(e) => setCustom(e.target.value)} placeholder="Took the Tuesday front desk shift" />
              <button className="btn" onClick={() => custom.trim() && cover(custom.trim())}>Log it</button>
            </div>
          </div>
        </div>

        <div className="stack-col">
          <div className="card">
            <h2 className="card-title"><Icon name="star" size={24} /> Star board</h2>
            {!data?.leaderboard.length && <p className="hint">No stars yet.</p>}
            {data?.leaderboard.map((l, i) => (
              <div key={l.helper} className="leader">
                <span className="rank">{i + 1}</span>
                <span className="leader-name">{l.helper}</span>
                <span className="spacer" />
                <span className="leader-count">{l.count} ★</span>
              </div>
            ))}
          </div>
          <div className="card">
            <h2 className="card-title">History</h2>
            {!data?.kudos.length && <p className="hint">Nothing yet.</p>}
            {data?.kudos.map((k) => (
              <div key={k._id} className="task-row">
                <div>
                  <p className="task-text"><b>{k.helper}</b> covered {k.what}</p>
                  <span className="meta-line">{timeAgo(k.createdAt)}</span>
                </div>
                {k.chain === "confirmed" && k.explorer && <a className="chip live" href={k.explorer} target="_blank" rel="noreferrer">On Solana</a>}
                {k.chain === "pending" && <span className="chip">Saving…</span>}
              </div>
            ))}
          </div>
        </div>
      </div>
    </>
  );
}
