"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { useLive } from "@/lib/useLive";

type Item = { _id: string; task: string; status: string };

export default function BoardEditor({ items }: { items: Item[] }) {
  const router = useRouter();
  const [id, setId] = useState(items[0]?._id || "");
  const [status, setStatus] = useState("");
  const [busy, setBusy] = useState(false);
  // Keep the table live while nobody is typing an update
  useLive(() => {
    if (!status && !busy) router.refresh();
  }, 8000);

  async function save() {
    if (!id || !status.trim()) return;
    setBusy(true);
    await fetch("/api/agent/board", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id, status }),
    });
    setStatus("");
    setBusy(false);
    router.refresh();
  }

  if (!items.length) return null;
  return (
    <div className="card" style={{ marginTop: 20 }}>
      <h3 style={{ marginTop: 0 }}>Update a status</h3>
      <div className="row">
        <select value={id} onChange={(e) => setId(e.target.value)} style={{ maxWidth: 320 }}>
          {items.map((i) => (
            <option key={i._id} value={i._id}>{i.task}</option>
          ))}
        </select>
        <input style={{ flex: 1, minWidth: 200 }} value={status} onChange={(e) => setStatus(e.target.value)} placeholder="Submitted to supervisor ✅" />
        <button className="btn" onClick={save} disabled={busy}>Update</button>
      </div>
    </div>
  );
}
