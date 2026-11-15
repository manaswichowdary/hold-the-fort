"use client";
import { useEffect, useRef, useState } from "react";
import { useLive } from "@/lib/useLive";
import Link from "next/link";
import Mascot, { type Mood } from "@/components/Mascot";
import { canListen, canSpeak, listen, speak, stopSpeaking, unlockVoice, type Listener, type SpeechStyle } from "@/lib/voice";
import Sep from "@/components/Sep";
import {
  api,
  OWNER,
  boldParts,
  STATUS_LABEL,
  STATUS_MOOD,
  timeAgo,
  type InterviewResult,
  type LiveStats,
  type Owner,
  type Proposal,
  type Source,
  type Status,
  type Step,
  type Turn,
} from "@/lib/api";

type Msg = {
  id?: string;
  from: "me" | "agent";
  text: string;
  status?: Status;
  sources?: Source[];
  trace?: Step[];
  proposal?: Proposal;
  ms?: number;
  done?: boolean; // proposal accepted or case submitted
  question?: string;
  conflict?: string;
  pushed?: string;
  ics?: string; // commitment id, for the calendar download
  round?: number;
  max?: number;
  openTrace?: boolean;
};

type Interview = { questionId: string; turns: Turn[]; round?: number };

const SUGGESTIONS = [
  "When is batch 2 of the spring texts going out?",
  "Can Alice send me the weekly report by Wednesday?",
  "What are Express Advising hours?",
  "What did Alice's performance review say?",
  "The texting tool is down and students are complaining!",
];

const WORKING_STEPS: Step[] = [
  { icon: "🛡️", label: "Checking the rules" },
  { icon: "🧠", label: "Searching memory" },
  { icon: "🌐", label: "Checking live pages" },
  { icon: "✍️", label: "Writing a reply" },
];

function Rich({ text }: { text: string }) {
  return (
    <>
      {boldParts(text).map((p, i) => (p.b ? <b key={i}>{p.t}</b> : <span key={i}>{p.t}</span>))}
    </>
  );
}

export default function AskPage() {
  const [owner, setOwner] = useState<Owner | null>(null);
  const [asker, setAsker] = useState("");
  const [input, setInput] = useState("");
  const [msgs, setMsgs] = useState<Msg[]>([]);
  const [busy, setBusy] = useState(false);
  const [step, setStep] = useState(0);
  const [mood, setMood] = useState<Mood>("waving");
  const [tokens, setTokens] = useState<number | null>(null);
  const [error, setError] = useState("");
  const [iv, setIv] = useState<Interview | null>(null);
  const [voiceOn, setVoiceOn] = useState(false);
  const [micOk, setMicOk] = useState(false);
  const [speakOk, setSpeakOk] = useState(false);
  const [listening, setListening] = useState(false);
  const [speaking, setSpeaking] = useState(false);
  const [voiceRestUntil, setVoiceRestUntil] = useState(0); // free plan voice limit: when it comes back
  const [interim, setInterim] = useState("");
  const endRef = useRef<HTMLDivElement>(null);
  const agent = owner?.agentName || "Sage";

  // Refs so voice callbacks always see the latest values
  const ivRef = useRef<Interview | null>(null);
  const busyRef = useRef(false);
  const voiceRef = useRef(false);
  const listenerRef = useRef<Listener | null>(null);
  const sendRef = useRef<(t: string) => void>(() => {});
  const setIvBoth = (v: Interview | null) => {
    ivRef.current = v;
    setIv(v);
  };
  const setBusyBoth = (v: boolean) => {
    busyRef.current = v;
    setBusy(v);
  };

  useEffect(() => {
    setMicOk(canListen());
    setSpeakOk(canSpeak());
    return () => {
      stopSpeaking();
      listenerRef.current?.stop();
    };
  }, []);

  function say(text: string, after?: () => void, style: SpeechStyle = "reply") {
    if (!voiceRef.current || !canSpeak()) {
      after?.();
      return;
    }
    speak(text, {
      style,
      onResting: (sec) => setVoiceRestUntil(Date.now() + sec * 1000),
      onStart: () => {
        setVoiceRestUntil(0);
        setSpeaking(true);
      },
      onEnd: () => {
        setSpeaking(false);
        after?.();
      },
    });
  }

  function startListening() {
    if (voiceRef.current) unlockVoice();
    if (listenerRef.current || busyRef.current) return;
    stopSpeaking();
    setSpeaking(false);
    setError("");
    setInterim("");
    const l = listen({
      onInterim: setInterim,
      onFinal: (t) => {
        setInterim("");
        sendRef.current(t);
      },
      onEnd: () => {
        listenerRef.current = null;
        setListening(false);
        setInterim("");
      },
      onError: (m) => setError(m),
    });
    if (l) {
      listenerRef.current = l;
      setListening(true);
    }
  }

  function toggleVoice() {
    const next = !voiceRef.current;
    voiceRef.current = next;
    setVoiceOn(next);
    if (!next) {
      stopSpeaking();
      setSpeaking(false);
      listenerRef.current?.stop();
    } else {
      unlockVoice();
      say(`Voice is on. Tap the mic and talk to me.`);
    }
  }

  // Shield passes stay live, even if Alice or another coworker changes them in another tab
  useLive(() => api<LiveStats>("stats").then((st) => setTokens(st.tokensLeft)).catch(() => {}), 4000);

  const listenIfVoice = () => {
    if (voiceRef.current && ivRef.current) startListening();
  };

  useEffect(() => {
    api<Owner>("owner")
      .then((o) => {
        setOwner(o);
        setTokens(o.tokensLeft ?? null);
        setMsgs([
          {
            from: "agent",
            text: `Hey! I'm ${o.agentName || "Sage"}, holding the fort for ${o.name} until ${o.awayUntil}. Ask me about their work, ask them for something, or tell me if something's on fire. 🏰`,
          },
        ]);
      })
      .catch((e) => setError(e.message));
  }, []);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [msgs, busy, step, iv, interim]);

  // Animated "what I'm doing" steps while waiting
  useEffect(() => {
    if (!busy) return;
    setStep(0);
    const t = setInterval(() => setStep((s) => Math.min(s + 1, WORKING_STEPS.length - 1)), 650);
    return () => clearInterval(t);
  }, [busy]);

  async function send(text: string) {
    if (voiceRef.current) unlockVoice(); // keeps Safari happy: this click re-arms the player
    const q = text.trim();
    if (!q || busyRef.current) return;
    setInput("");
    setError("");
    stopSpeaking();
    setSpeaking(false);
    if (ivRef.current) return answerInterview(q);
    setMsgs((m) => [...m, { from: "me", text: q }]);
    setBusyBoth(true);
    setMood("thinking");
    try {
      const r = await api<{
        reply: string;
        status: Status;
        sources: Source[];
        trace: Step[];
        proposal?: Proposal;
        conflict?: string;
        ms: number;
        questionId: string;
        tokensLeft: number;
      }>("chat", { body: { message: q, asker: asker || "A teammate" } });
      setTokens(r.tokensLeft);
      setMood(STATUS_MOOD[r.status]);
      setMsgs((m) => [
        ...m,
        { id: r.questionId, from: "agent", text: r.reply, status: r.status, sources: r.sources, trace: r.trace, proposal: r.proposal, conflict: r.conflict, ms: r.ms, question: q },
      ]);
      // Sounds urgent and a shield pass is available: Sage starts the interview
      if (r.status === "case_needed") setIvBoth({ questionId: r.questionId, turns: [] });
      say(r.reply, listenIfVoice, r.status === "case_needed" || r.status === "urgent" ? "urgent" : "reply");
    } catch (e: any) {
      setError(e.message);
      setMood("idle");
    } finally {
      setBusyBoth(false);
    }
  }
  sendRef.current = send;

  async function answerInterview(q: string) {
    const cur = ivRef.current;
    if (!cur) return;
    const turns: Turn[] = [...cur.turns, { from: "them", text: q }];
    setMsgs((m) => [...m, { from: "me", text: q }]);
    setBusyBoth(true);
    setMood("thinking");
    try {
      const r = await api<InterviewResult>("interview", { body: { questionId: cur.questionId, turns } });
      if (r.type === "ask") {
        setIvBoth({ questionId: cur.questionId, turns: [...turns, { from: "sage", text: r.question }], round: r.round });
        setMsgs((m) => [...m, { from: "agent", text: r.question, status: "case_needed", round: r.round, max: r.max }]);
        setMood("urgent");
        say(r.question, listenIfVoice, "question");
      } else {
        setIvBoth(null);
        setTokens(r.tokensLeft);
        setMsgs((m) => [
          ...m.map((x) => (x.id === cur.questionId ? { ...x, done: true } : x)),
          { from: "agent", text: r.reply, status: (r.verdict === "interrupted" || r.verdict === "break_glass") ? "urgent" : "escalated", trace: r.trace, openTrace: true, pushed: r.pushed, done: true },
        ]);
        setMood((r.verdict === "interrupted" || r.verdict === "break_glass") ? "urgent" : "locked");
        say(r.reply);
      }
    } catch (e: any) {
      setError(e.message);
      setMood("idle");
    } finally {
      setBusyBoth(false);
    }
  }

  function startInterview(m: Msg) {
    if (!m.id) return;
    setMsgs((all) => [
      ...all.map((x) => (x === m ? { ...x, done: true } : x)),
      { from: "agent", text: "Okay, tell me why it can't wait. I'll ask a couple of quick questions, then decide.", status: "case_needed" },
    ]);
    setIvBoth({ questionId: m.id, turns: [] });
    setMood("urgent");
    say("Okay, tell me why it can't wait. I'll ask a couple of quick questions, then decide.", listenIfVoice, "question");
  }

  function cancelInterview() {
    listenerRef.current?.stop();
    stopSpeaking();
    setSpeaking(false);
    setIvBoth(null);
    setMsgs((m) => [...m, { from: "agent", text: `No problem. I've left it on ${owner?.name}'s desk for when they're back.`, status: "escalated" }]);
    setMood("idle");
  }

  async function acceptDeadline(m: Msg) {
    if (!m.proposal || !m.id) return;
    setMood("working");
    const r = await api<{ dueLabel: string; id?: string }>("commitments", {
      body: { questionId: m.id, task: m.proposal.task, due: m.proposal.proposed, requestedDue: m.proposal.requestedDue, requestedBy: asker || "A teammate" },
    });
    const text = `✅ Locked in: "${m.proposal.task}" is on ${owner?.name}'s calendar for ${r.dueLabel}. I'll remind them the day they're back.`;
    setMsgs((all) => [
      ...all.map((x) => (x === m ? { ...x, done: true } : x)),
      { from: "agent", text, status: "answered", ics: r.id },
    ]);
    setMood("success");
    say(text);
  }

  return (
    <div className="chat-wrap">
      <aside className="card away-card">
        <Mascot mood={speaking ? "narrating" : listening ? "thinking" : busy ? (step >= 2 ? "working" : "thinking") : mood} size={170} className={speaking ? "talking" : listening ? "listening" : ""} />
        <h2 className="serif">{owner ? `${owner.name} is away` : "Opening the fort…"}</h2>
        {owner && (
          <>
            <div className="muted">{owner.role}</div>
            <div className="away-pill">Back {owner.awayUntil}</div>
            <div className="token-row" title="Vacation Shield passes">
              {Array.from({ length: owner.interruptBudget }).map((_, i) => (
                <span key={i} className={`token ${tokens !== null && i < tokens ? "on" : "off"}`}>🛡️</span>
              ))}
              <span className="muted">
                {tokens === 0 ? "Passes used up: only true emergencies get through" : <>{tokens ?? "…"} shield pass{tokens === 1 ? "" : "es"} left</>}
              </span>
            </div>
            <p className="muted" style={{ marginTop: 12 }}>
              Backup: <b>{owner.backup}</b>
            </p>
          </>
        )}
        <div className="field" style={{ textAlign: "left", marginTop: 14 }}>
          <label>Your name</label>
          <input value={asker} onChange={(e) => setAsker(e.target.value)} placeholder={`So ${agent} knows who asked`} />
        </div>
        <Link href="/cover" className="btn ghost small" style={{ width: "100%", justifyContent: "center" }}>
          Cover something, earn a star
        </Link>
      </aside>

      <section className="card chat">
        <div className="chat-head">
          <span className="dot" />
          <b>{agent}</b>
          <span className="muted"><Sep /> holding the fort</span>
          {(speaking || listening) && (
            <span className="wave" aria-label={speaking ? "Sage is talking" : "Sage is listening"}>
              <i /><i /><i /><i /><i />
            </span>
          )}
          {voiceOn && voiceRestUntil > Date.now() && (
            <span className="voice-rest" role="status">
              Free voice limit reached. Replies are text only for about {Math.max(1, Math.round((voiceRestUntil - Date.now()) / 60000))} min.
            </span>
          )}
          {speakOk && (
            <button type="button" className={`voice-toggle ${voiceOn ? "on" : ""}`} onClick={toggleVoice} aria-pressed={voiceOn}>
              {voiceOn ? (voiceRestUntil > Date.now() ? "🔇 Voice resting" : "🔊 Voice on") : "🔈 Voice off"}
            </button>
          )}
        </div>
        <div className="messages">
          {msgs.map((m, i) => (
            <div key={i} className={`msg pop ${m.from === "me" ? "me" : "agent-msg"}`}>
              {m.from === "agent" && (
                <div className="avatar">
                  <Mascot mood={m.status ? STATUS_MOOD[m.status] : "idle"} size={40} showProp={false} />
                </div>
              )}
              <div style={{ minWidth: 0 }}>
                <div className="text"><Rich text={m.text} /></div>

                {m.from === "agent" && m.status === "deadline" && m.proposal && !m.done && (
                  <div className="action-card">
                    <div className="row">
                      <span>📅</span>
                      <b>{m.proposal.task}</b>
                    </div>
                    <div className="muted" style={{ margin: "4px 0 10px" }}>
                      {m.proposal.requestedDue ? <>Asked for {m.proposal.requestedDue} <Sep /> </> : ""}New slot: {m.proposal.proposedLabel}
                    </div>
                    <div className="row">
                      <button className="btn small green" onClick={() => acceptDeadline(m)}>Lock it in</button>
                      <button className="btn small ghost" onClick={() => setMsgs((all) => all.map((x) => (x === m ? { ...x, done: true } : x)))}>No thanks</button>
                    </div>
                  </div>
                )}

                {m.from === "agent" && m.status === "escalated" && m.id && !m.done && !iv && (tokens ?? 1) > 0 && (
                  <button className="linkish" onClick={() => startInterview(m)}>🚨 This can&apos;t wait</button>
                )}

                {m.ics && (
                  <a className="btn small ghost" style={{ marginTop: 8 }} href={`/api/agent/commitments/${m.ics}/ics?ownerId=${OWNER}`} download="deadline.ics">
                    📅 Add to my calendar
                  </a>
                )}

                {m.from === "agent" && m.status && (
                  <div className="meta">
                    <span className={STATUS_LABEL[m.status].cls}>{STATUS_LABEL[m.status].text}</span>
                    {m.sources?.map((s, j) =>
                      s.kind === "live" ? (
                        <a key={j} className="chip live" href={s.url} target="_blank" rel="noreferrer">🌐 {s.title} <Sep /> checked just now</a>
                      ) : (
                        <span key={j} className={`chip ${s.kind === "learned" ? "learned" : ""}`}>
                          {s.kind === "learned" ? "🧠" : "📝"} {s.title}
                          {s.date ? <> <Sep /> {timeAgo(s.date)}</> : ""}
                        </span>
                      )
                    )}
                    {m.round ? <span className="muted">Question {m.round} of {m.max}</span> : null}
                    {m.conflict && <span className="chip warn" title={m.conflict}>⚠️ {m.conflict}</span>}
                    {m.pushed === "sent" && <span className="chip live">📲 Phone pinged</span>}
                    {m.pushed && m.pushed.startsWith("failed") && <span className="chip warn">📵 Phone push failed</span>}
                    {m.ms ? <span className="muted">{(m.ms / 1000).toFixed(1)}s</span> : null}
                  </div>
                )}

                {m.trace && m.trace.length > 0 && (
                  <details className="trace" open={m.openTrace}>
                    <summary>{m.openTrace ? "How the rules decided" : "How I did it"}</summary>
                    <ol>
                      {m.trace.map((t, j) => (
                        <li key={j} style={{ animationDelay: `${j * 90}ms` }}>
                          <span>{t.icon}</span> {t.label}
                        </li>
                      ))}
                    </ol>
                  </details>
                )}
              </div>
            </div>
          ))}

          {busy && (
            <div className="msg agent-msg pop">
              <div className="avatar"><Mascot mood="working" size={40} showProp={false} /></div>
              <div className="text working-steps">
                {WORKING_STEPS.map((s, i) => (
                  <div key={i} className={`wstep ${i < step ? "done" : i === step ? "now" : ""}`}>
                    <span>{i < step ? "✅" : s.icon}</span> {s.label}{i === step ? "…" : ""}
                  </div>
                ))}
              </div>
            </div>
          )}

          <div ref={endRef} />
        </div>

        {iv && !busy && (
          <div className="iv-banner">
            <span>🛡️ Vacation Shield interview{iv.round ? <> <Sep /> question {iv.round} of 3</> : ""}</span>
            <button type="button" onClick={cancelInterview}>Cancel</button>
          </div>
        )}
        {(listening || interim) && <div className="voice-line">🎙️ {interim || "Listening…"}</div>}
        {msgs.length <= 1 && (
          <div className="suggest">
            {SUGGESTIONS.map((s) => (
              <button key={s} onClick={() => send(s)}>{s}</button>
            ))}
          </div>
        )}
        {error && <div className="error" style={{ margin: "0 14px 10px" }}>{error}</div>}
        <form
          className="composer"
          onSubmit={(e) => {
            e.preventDefault();
            send(input);
          }}
        >
          <input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder={iv ? `Answer ${agent}…` : `Ask ${agent} anything about ${owner?.name || "their"} work…`}
          />
          {micOk && (
            <button
              type="button"
              className={`btn ghost mic ${listening ? "live" : ""}`}
              disabled={busy}
              onClick={() => (listening ? listenerRef.current?.stop() : startListening())}
              aria-label={listening ? "Stop listening" : "Talk to Sage"}
              title={listening ? "Stop" : "Talk to Sage"}
            >
              🎙️
            </button>
          )}
          <button className="btn" disabled={busy || !input.trim()}>Send</button>
        </form>
      </section>
    </div>
  );
}
