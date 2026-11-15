"use client";
// A short cinematic story on the home page: Alice's real week, before and after Sage.
import { useEffect, useRef, useState } from "react";
import Mascot, { type Mood } from "./Mascot";
import Icon from "./Icon";
import Sep, { dots } from "./Sep";

type Scene = { kicker: string; title: string; text: string; mood: Mood | null; visual: string };

const SCENES: Scene[] = [
  {
    kicker: "Scene 1 · A normal Tuesday",
    title: "Alice is the person everyone asks.",
    text: "As a student outreach aide at ASU, she answers questions all day: where the drafts live, when texts go out, how advising works.",
    mood: null,
    visual: "desk",
  },
  {
    kicker: "Scene 2 · The problem",
    title: "Then she goes on vacation.",
    text: "The questions don't stop. Twelve unread before lunch, one marked URGENT. So she answers work messages from the beach.",
    mood: null,
    visual: "beach",
  },
  {
    kicker: "Scene 3 · Enter Sage",
    title: "Sage holds the fort.",
    text: "Coworkers ask Sage instead. It answers from her notes and live pages, shows the source, and never guesses.",
    mood: "thinking",
    visual: "answer",
  },
  {
    kicker: "Scene 4 · The Vacation Shield",
    title: "Is it really an emergency?",
    text: "Sage interviews anyone who claims one. If Jen can fix it today, Alice's phone stays quiet.",
    mood: "urgent",
    visual: "shield",
  },
  {
    kicker: "Scene 5 · Smart Reschedule",
    title: "Deadlines move, not vacations.",
    text: "A report due Wednesday? Sage books the first real slot after she's back and adds it to her calendar.",
    mood: "working",
    visual: "deadline",
  },
  {
    kicker: "Scene 6 · Welcome back",
    title: "Previously on Alice's week…",
    text: "She comes home to a one minute recap, a short waiting list, and a thank you star for Jen.",
    mood: "success",
    visual: "recap",
  },
];

const SCENE_MS = 6500;

function Visual({ kind }: { kind: string }) {
  if (kind === "desk")
    return (
      <div className="rv-card">
        <div className="rv-head"><Icon name="chat" size={18} /> Alice&apos;s inbox <Sep /> Tuesday</div>
        {[
          ["Jen", "Where are the spring outreach drafts?"],
          ["Jordan", "Do students need an appointment for Express Advising?"],
          ["Dana", "Is the weekly report still due Friday?"],
        ].map(([who, q], i) => (
          <div key={q} className="rv-msg" style={{ animationDelay: `${0.3 + i * 0.7}s` }}>
            <b>{who}</b><span>{q}</span><em><Icon name="check" size={16} /> answered by Alice</em>
          </div>
        ))}
      </div>
    );
  if (kind === "beach")
    return (
      <div className="rv-phone">
        <div className="rv-phone-time">10:04</div>
        <div className="rv-phone-date">Wednesday, Nov 18 <Sep /> Out of office 🏖️</div>
        {[
          ["Jordan", "When does batch 2 go out?"],
          ["Dana", "Can you send the report by Wednesday?"],
          ["Alex", "Quick one, where's the template?"],
          ["Jordan", "URGENT: texting tool is down!!"],
        ].map(([who, q], i) => (
          <div key={q} className={`rv-notif ${q.startsWith("URGENT") ? "hot" : ""}`} style={{ animationDelay: `${0.4 + i * 0.8}s` }}>
            <b>{who}</b><span>{q}</span>
          </div>
        ))}
        <div className="rv-unread" style={{ animationDelay: "3.8s" }}>12 unread</div>
      </div>
    );
  if (kind === "answer")
    return (
      <div className="rv-card">
        <div className="rv-head"><Icon name="ask" size={18} /> Jordan asks Sage</div>
        <div className="rv-bubble them" style={{ animationDelay: ".3s" }}>When does batch 2 of the spring texts go out?</div>
        <div className="rv-bubble sage" style={{ animationDelay: "1.6s" }}>Nov 19 at 10 AM, last names N to Z. Checked just now.</div>
        <div className="rv-chips" style={{ animationDelay: "2.8s" }}>
          <span><Icon name="memory" size={14} /> Note: Spring outreach texts</span>
          <span><Icon name="globe" size={14} /> Live team board</span>
        </div>
        <div className="rv-quiet" style={{ animationDelay: "3.8s" }}><Icon name="phone" size={16} /> Alice&apos;s phone: silent</div>
      </div>
    );
  if (kind === "shield")
    return (
      <div className="rv-card">
        <div className="rv-head"><Icon name="shield" size={18} /> Vacation Shield interview</div>
        <div className="rv-bubble them" style={{ animationDelay: ".3s" }}>URGENT: the texting tool is down!</div>
        <div className="rv-bubble sage" style={{ animationDelay: "1.3s" }}>Can Jen handle it before Monday?</div>
        <div className="rv-bubble them" style={{ animationDelay: "2.3s" }}>Yes, she can restart it today.</div>
        <div className="rv-meter" style={{ animationDelay: "3.2s" }}>
          <span>Urgency</span><div><i style={{ width: "20%" }} /></div><b>2/10</b>
        </div>
        <div className="rv-quiet" style={{ animationDelay: "4s" }}><Icon name="check" size={16} /> Declined. Phone stays quiet, 2 passes left.</div>
      </div>
    );
  if (kind === "deadline")
    return (
      <div className="rv-card">
        <div className="rv-head"><Icon name="calendar" size={18} /> Dana asks for the weekly report</div>
        <div className="rv-cal">
          <div className="rv-day struck" style={{ animationDelay: ".4s" }}><small>Wed</small><b>18</b><span>she&apos;s away</span></div>
          <div className="rv-day muted" style={{ animationDelay: ".8s" }}><small>Mon</small><b>23</b><span>catch up day</span></div>
          <div className="rv-day pick" style={{ animationDelay: "1.6s" }}><small>Tue</small><b>24</b><span>3 PM ✓</span></div>
        </div>
        <div className="rv-quiet" style={{ animationDelay: "2.8s" }}><Icon name="calendar" size={16} /> Added to her calendar</div>
      </div>
    );
  return (
    <div className="rv-card">
      <div className="rv-head"><Icon name="tv" size={18} /> Catch Me Up</div>
      <div className="rv-stats">
        {[
          ["8", "questions handled"],
          ["2", "fake emergencies blocked"],
          ["1", "deadline moved"],
          ["0", "work texts on the beach"],
        ].map(([n, l], i) => (
          <div key={l} style={{ animationDelay: `${0.3 + i * 0.5}s` }}><b>{n}</b><span>{l}</span></div>
        ))}
      </div>
      <div className="rv-quiet" style={{ animationDelay: "2.6s" }}><Icon name="star" size={16} /> Thank you star for Jen</div>
    </div>
  );
}

export default function StoryReel() {
  const [i, setI] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [seen, setSeen] = useState(false);
  const box = useRef<HTMLDivElement>(null);

  // Start playing the first time the reel scrolls into view
  useEffect(() => {
    const el = box.current;
    if (!el || seen) return;
    const obs = new IntersectionObserver(([e]) => {
      if (e.isIntersecting) {
        setSeen(true);
        setPlaying(true);
      }
    }, { threshold: 0.4 });
    obs.observe(el);
    return () => obs.disconnect();
  }, [seen]);

  useEffect(() => {
    if (!playing) return;
    const t = setTimeout(() => {
      if (i === SCENES.length - 1) setPlaying(false);
      else setI(i + 1);
    }, SCENE_MS);
    return () => clearTimeout(t);
  }, [i, playing]);

  const s = SCENES[i];
  const ended = !playing && i === SCENES.length - 1 && seen;

  function toggle() {
    if (ended) {
      setI(0);
      setPlaying(true);
    } else setPlaying(!playing);
  }

  return (
    <div className="reel" ref={box}>
      <div className="reel-stage">
        <div className="reel-bar top" />
        <div className="reel-body" key={i}>
          <div className="reel-copy">
            <span className="reel-kicker">{dots(s.kicker)}</span>
            <h3>{s.title}</h3>
            <p>{s.text}</p>
          </div>
          <div className="reel-visual">
            {s.mood && (
              <div className="reel-mascot">
                <Mascot mood={s.mood} size={150} showProp={false} />
              </div>
            )}
            <Visual kind={s.visual} />
          </div>
        </div>
        <div className="reel-bar bottom" />
      </div>

      <div className="reel-controls">
        <button className="reel-play" onClick={toggle} aria-label={playing ? "Pause story" : "Play story"}>
          {playing ? "❚❚" : <Icon name="play" size={16} />}
          <span>{playing ? "Pause" : ended ? "Replay" : "Play"}</span>
        </button>
        <div className="reel-dots">
          {SCENES.map((sc, k) => (
            <button
              key={sc.kicker}
              className={`reel-dot ${k === i ? "on" : ""} ${k < i ? "done" : ""}`}
              onClick={() => { setI(k); setSeen(true); }}
              aria-label={sc.kicker}
            >
              {k === i && playing && <i style={{ animationDuration: `${SCENE_MS}ms` }} />}
            </button>
          ))}
        </div>
        <span className="reel-count">{i + 1} / {SCENES.length}</span>
      </div>
    </div>
  );
}
