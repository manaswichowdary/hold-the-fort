"use client";
import { useEffect, useState } from "react";
import Mascot from "@/components/Mascot";
import Icon from "@/components/Icon";
import { api, OWNER, type Note, type Owner, type Watch } from "@/lib/api";

const EMPTY_OWNER: Owner = { ownerId: OWNER, name: "", role: "", awayUntil: "", returnDate: "", backup: "", interruptBudget: 2 };
const EMPTY_NOTE = { id: "", title: "", content: "", shareable: true };

export default function SetupPage() {
  const [owner, setOwner] = useState<Owner>(EMPTY_OWNER);
  const [notes, setNotes] = useState<Note[]>([]);
  const [watches, setWatches] = useState<Watch[]>([]);
  const [draft, setDraft] = useState(EMPTY_NOTE);
  const [watch, setWatch] = useState({ label: "", url: "" });
  const [msg, setMsg] = useState("");
  const [error, setError] = useState("");
  const [origin, setOrigin] = useState("");
  const [copied, setCopied] = useState(false);

  async function load() {
    try {
      const [o, n, w] = await Promise.all([api<Owner>("owner"), api<Note[]>("notes"), api<Watch[]>("watches")]);
      setOwner(o);
      setNotes(n);
      setWatches(w);
    } catch (e: any) {
      setError(e.message);
    }
  }
  useEffect(() => {
    setOrigin(window.location.origin);
    load();
  }, []);

  const flash = (t: string) => {
    setMsg(t);
    setTimeout(() => setMsg(""), 2500);
  };

  async function saveOwner() {
    await api("owner", { body: owner });
    flash("Saved");
  }
  async function saveNote() {
    if (!draft.title.trim() || !draft.content.trim()) return;
    await api("notes", { body: draft });
    setDraft(EMPTY_NOTE);
    flash(draft.shareable ? "Note saved" : "Private note saved");
    load();
  }
  async function removeNote(id: string) {
    await api(`notes/${id}`, { method: "DELETE" });
    load();
  }
  async function addWatch() {
    if (!watch.label || !watch.url) return;
    await api("watches", { body: watch });
    setWatch({ label: "", url: "" });
    load();
  }

  const oooText = `I'm out until ${owner.awayUntil || "…"}. For questions about my work, ask my fort: ${origin}/ask/${OWNER}`;
  async function copy() {
    try {
      await navigator.clipboard.writeText(oooText);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      setError("Couldn't copy. Select the text and copy it instead.");
    }
  }

  return (
    <>
      <div className="page-head">
        <Mascot mood="working" size={96} showProp={false} />
        <div>
          <h1>Before I leave</h1>
          <p className="lead">Tell Sage what it needs to know while you&apos;re away.</p>
        </div>
        <span className="spacer" />
        {msg && <span className="toast">{msg}</span>}
      </div>
      {error && <div className="error">{error}</div>}

      <div className="grid2">
        <div className="stack-col">
          <div className="card">
            <h2 className="card-title">Away details</h2>
            <div className="form-grid">
              <div className="field"><label>Name</label><input value={owner.name} onChange={(e) => setOwner({ ...owner, name: e.target.value })} /></div>
              <div className="field"><label>Role</label><input value={owner.role} onChange={(e) => setOwner({ ...owner, role: e.target.value })} /></div>
              <div className="field"><label>Back on</label><input value={owner.awayUntil} onChange={(e) => setOwner({ ...owner, awayUntil: e.target.value })} placeholder="Monday, Nov 23" /></div>
              <div className="field"><label>Return date</label><input type="date" value={owner.returnDate || ""} onChange={(e) => setOwner({ ...owner, returnDate: e.target.value })} /></div>
              <div className="field"><label>Backup person</label><input value={owner.backup} onChange={(e) => setOwner({ ...owner, backup: e.target.value })} /></div>
              <div className="field"><label>Shield passes</label><input type="number" min={0} max={10} value={owner.interruptBudget ?? 2} onChange={(e) => setOwner({ ...owner, interruptBudget: Number(e.target.value) })} /></div>
            </div>
            <button className="btn" onClick={saveOwner}>Save</button>
          </div>

          <div className="card">
            <h2 className="card-title">Out of office message</h2>
            <div className="copy-box">
              <p>{oooText}</p>
              <button className="btn small" onClick={copy}><Icon name="copy" size={18} /> {copied ? "Copied" : "Copy"}</button>
            </div>
          </div>

          <div className="card">
            <h2 className="card-title">Live pages</h2>
            <p className="hint">Sage reads these live, so status answers are always current.</p>
            {watches.map((w) => (
              <div key={w._id} className="list-row">
                <Icon name="globe" size={22} />
                <b>{w.label}</b>
                <span className="spacer" />
                <a href={w.url} target="_blank" rel="noreferrer" className="link">Open</a>
              </div>
            ))}
            <div className="form-grid">
              <div className="field"><label>Name</label><input value={watch.label} onChange={(e) => setWatch({ ...watch, label: e.target.value })} placeholder="Team board" /></div>
              <div className="field"><label>Link</label><input value={watch.url} onChange={(e) => setWatch({ ...watch, url: e.target.value })} placeholder="https://…" /></div>
            </div>
            <button className="btn ghost" onClick={addWatch}>Add page</button>
          </div>
        </div>

        <div className="stack-col">
          <div className="card">
            <h2 className="card-title">{draft.id ? "Edit note" : "Add a note"}</h2>
            <div className="field"><label>Topic</label><input value={draft.title} onChange={(e) => setDraft({ ...draft, title: e.target.value })} placeholder="Weekly report" /></div>
            <div className="field"><label>Details</label><textarea rows={4} value={draft.content} onChange={(e) => setDraft({ ...draft, content: e.target.value })} placeholder="Due Fridays at 3 PM. Template is in the Reports folder." /></div>
            <div className="row">
              <div className="toggle">
                <button className={draft.shareable ? "on" : ""} onClick={() => setDraft({ ...draft, shareable: true })}>Shared</button>
                <button className={!draft.shareable ? "on" : ""} onClick={() => setDraft({ ...draft, shareable: false })}><Icon name="lock" size={16} /> Private</button>
              </div>
              <span className="spacer" />
              {draft.id && <button className="btn ghost small" onClick={() => setDraft(EMPTY_NOTE)}>Cancel</button>}
              <button className="btn" onClick={saveNote}>{draft.id ? "Update" : "Add note"}</button>
            </div>
          </div>

          <div className="card">
            <h2 className="card-title">My notes <span className="count">{notes.length}</span></h2>
            {!notes.length && <p className="hint">No notes yet.</p>}
            <div className="accordion">
              {notes.map((n) => (
                <details key={n._id}>
                  <summary>
                    <span className={`pill ${n.shareable ? "shared" : "private"}`}>{n.shareable ? "Shared" : "Private"}</span>
                    <span className="acc-title">{n.title}</span>
                    <span className="chev" aria-hidden>▾</span>
                  </summary>
                  <div className="acc-body">
                    <p>{n.content}</p>
                    <div className="row">
                      <button className="btn small ghost" onClick={() => setDraft({ id: n._id, title: n.title, content: n.content, shareable: n.shareable })}>Edit</button>
                      <button className="btn small ghost" onClick={() => removeNote(n._id)}>Delete</button>
                    </div>
                  </div>
                </details>
              ))}
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
