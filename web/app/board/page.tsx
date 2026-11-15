// Public team board. Rendered on the server so TinyFish can read it as a real web page.
import BoardEditor from "./BoardEditor";

export const dynamic = "force-dynamic";

type Item = { _id: string; task: string; owner: string; status: string; updatedAt: string };

async function getBoard(): Promise<{ items: Item[]; error?: string }> {
  const base = (process.env.AGENT_URL || "http://localhost:8787").replace(/\/$/, "");
  try {
    const res = await fetch(`${base}/board`, {
      cache: "no-store",
      headers: process.env.AGENT_AUTH ? { Authorization: process.env.AGENT_AUTH } : undefined,
    });
    if (!res.ok) return { items: [], error: `Agent returned ${res.status}` };
    return { items: await res.json() };
  } catch (e: any) {
    return { items: [], error: e.message };
  }
}

export default async function BoardPage() {
  const { items, error } = await getBoard();
  return (
    <>
      <h1 style={{ marginBottom: 4 }}>Team board</h1>
      <p className="lead" style={{ marginTop: 0 }}>Live status of current work. Sage reads this page to answer status questions. Updated {new Date().toLocaleString("en-US", { timeZone: "America/Phoenix" })}.</p>
      {error && <div className="error" style={{ marginBottom: 16 }}>Couldn&apos;t load the board: {error}</div>}
      <table className="board">
        <thead>
          <tr><th>Task</th><th>Owner</th><th>Status</th><th>Updated</th></tr>
        </thead>
        <tbody>
          {items.map((i) => (
            <tr key={i._id}>
              <td><b>{i.task}</b></td>
              <td>{i.owner}</td>
              <td>{i.status}</td>
              <td className="muted">{new Date(i.updatedAt).toLocaleString("en-US", { timeZone: "America/Phoenix" })}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <BoardEditor items={items.map(({ _id, task, status }) => ({ _id, task, status }))} />
    </>
  );
}
