"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import Mascot from "@/components/Mascot";
import Icon from "@/components/Icon";
import { setRole, type Role } from "@/lib/role";

const ROLES: { role: Role; icon: string; title: string; text: string; go: string; cta: string }[] = [
  { role: "owner", icon: "plane", title: "I'm Alice", text: "I'm going on vacation. Set up my fort, then catch up when I'm back.", go: "/setup", cta: "Continue as Alice" },
  { role: "coworker", icon: "users", title: "I'm a coworker", text: "Alice is away. I need an answer, a deadline, or to help out.", go: "/ask/alice", cta: "Continue as coworker" },
];

export default function StartPage() {
  const router = useRouter();
  const [askCode, setAskCode] = useState(false);
  const [code, setCode] = useState("");
  const [codeError, setCodeError] = useState("");
  const [checking, setChecking] = useState(false);

  // Alice's pages are protected: ask for the passcode when one is set
  async function pick(r: (typeof ROLES)[number]) {
    if (r.role === "owner") {
      const st = await fetch("/api/owner-login").then((x) => x.json()).catch(() => ({ owner: false, required: true }));
      if (st.required && !st.owner) {
        setAskCode(true);
        return;
      }
    }
    setRole(r.role);
    router.push(r.go);
  }

  async function signIn(e: React.FormEvent) {
    e.preventDefault();
    setChecking(true);
    setCodeError("");
    const res = await fetch("/api/owner-login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ passcode: code }),
    });
    setChecking(false);
    if (!res.ok) {
      setCodeError((await res.json().catch(() => ({}))).error || "That didn't work.");
      return;
    }
    setRole("owner");
    router.push("/setup");
  }
  return (
    <section className="start">
      <div className="start-head">
        <Mascot mood="waving" size={150} showProp={false} />
        <div>
          <h1>Who are you?</h1>
          <p className="lead">Pick a side to try the demo.</p>
        </div>
      </div>
      <div className="roles">
        {ROLES.map((r) => (
          <button key={r.role} className={`role ${r.role}`} onClick={() => pick(r)}>
            <span className="role-icon"><Icon name={r.icon} size={36} /></span>
            <h2>{r.title}</h2>
            <p>{r.text}</p>
            <span className="btn btn-arrow btn-arrow-right">{r.cta} <Icon name="arrowRight" size={22} stroke={3} /></span>
          </button>
        ))}
      </div>
      {askCode && (
        <form className="card owner-code" onSubmit={signIn}>
          <h2>Alice&apos;s view is locked</h2>
          <p>It shows private notes and settings, so it needs the owner passcode.</p>
          <div className="row">
            <input type="password" autoFocus value={code} onChange={(e) => setCode(e.target.value)} placeholder="Owner passcode" aria-label="Owner passcode" />
            <button className="btn" disabled={!code || checking}>{checking ? "Checking…" : "Unlock"}</button>
          </div>
          {codeError && <p className="error">{codeError}</p>}
        </form>
      )}
      <p className="demo-note">
        <b>Demo:</b> Alice is our sample user. In real use, everyone sets up their own fort and gets their own link.
      </p>
    </section>
  );
}
