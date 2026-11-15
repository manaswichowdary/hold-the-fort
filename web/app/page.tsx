"use client";
import Link from "next/link";
import { useEffect, useState } from "react";
import Mascot, { type Mood } from "@/components/Mascot";
import DemoPlayer from "@/components/DemoPlayer";
import StoryReel from "@/components/StoryReel";
import QrCard from "@/components/QrCard";
import Icon from "@/components/Icon";
import { FEATURES } from "@/lib/features";
import Sep from "@/components/Sep";

const LINES: { mood: Mood; text: string }[] = [
  { mood: "waving", text: "Hi! I'm holding the fort for Manaswi." },
  { mood: "sleeping", text: "She's on a beach. I've got this." },
  { mood: "thinking", text: "Batch 2 goes out Nov 19. Checked just now." },
  { mood: "locked", text: "Her salary? Nice try." },
  { mood: "working", text: "Not Friday. I booked Wednesday." },
  { mood: "urgent", text: "Is it really an emergency?" },
  { mood: "success", text: "Priya covered the outage. Star earned!" },
];

// How it works: one real question followed through all four steps
const STEPS = [
  {
    icon: "ask",
    title: "A coworker asks",
    text: "They message Sage instead of texting you on vacation.",
    example: "Jordan: “When does batch 2 of the spring texts go out?”",
  },
  {
    icon: "rules",
    title: "Rules check first",
    text: "Private or urgent? Plain code decides, never AI.",
    example: "Not private, not urgent. Safe for Sage to answer.",
  },
  {
    icon: "memory",
    title: "Sage finds the answer",
    text: "From your notes, its memory, and live pages.",
    example: "Found in your note “Spring outreach texts” and the live team board.",
  },
  {
    icon: "check",
    title: "Answered or protected",
    text: "It replies with a source, reschedules, or shields you.",
    example: "“Nov 19 at 10 AM.” Sent with its source. Your phone stays silent.",
  },
];
const STEP_MS = 3200;

export default function Home() {
  const [k, setK] = useState(0);
  const [step, setStep] = useState(0);
  const [hold, setHold] = useState(false);
  const [demo, setDemo] = useState<string | null>(null);

  useEffect(() => {
    const t = setInterval(() => setK((x) => (x + 1) % LINES.length), 3000);
    if (new URLSearchParams(window.location.search).get("demo")) setDemo(FEATURES[0].key);
    return () => clearInterval(t);
  }, []);

  // Walk through the four steps on a loop, pausing while the mouse is on one
  useEffect(() => {
    if (hold) return;
    const t = setInterval(() => setStep((x) => (x + 1) % STEPS.length), STEP_MS);
    return () => clearInterval(t);
  }, [hold]);

  function closeDemo() {
    setDemo(null);
    if (window.location.search) window.history.replaceState(null, "", "/");
  }

  return (
    <>
      {demo && <DemoPlayer start={demo} onClose={closeDemo} />}

      <section className="hero">
        <div className="hero-copy">
          <span className="hero-badge">
            <span className="duty-dot" aria-hidden="true" />
            Your vacation bodyguard
          </span>
          <h1>
            Go on vacation.
            <br />
            <em>We&apos;ll hold the fort.</em>
          </h1>
          <p className="lead">
            Sage answers routine questions, protects your time off, handles what can wait, and catches you up when you
            return.
          </p>
          <div className="row cta-row">
            <Link href="/start" className="btn big">Try it live</Link>
            <a href="#about" className="btn big ghost btn-arrow">
              See a real week <Icon name="arrowDown" size={22} stroke={3} />
            </a>
          </div>
          <QrCard />
        </div>
        <div className="hero-art">
          <div className="bubble-hero" key={k}>
            <span className="bubble-who">Sage <Sep /> on duty</span>
            <span className="bubble-line">{LINES[k].text}</span>
          </div>
          <div className="hero-disc">
            <Mascot mood={LINES[k].mood} size={520} />
          </div>
        </div>
      </section>

      <section id="about" className="section">
        <span className="tag">About</span>
        <h2 className="section-title">Time off should mean time off.</h2>
        <p className="lead section-lead">
          Hold the Fort is a personal away agent. Before you leave, you hand Sage your notes. While you&apos;re gone,
          Sage answers your coworkers, blocks fake emergencies, moves deadlines to when you&apos;re back, and keeps
          private things private. Here is one real week.
        </p>
        <StoryReel />
      </section>

      <section id="features" className="section">
        <div className="section-head">
          <div>
            <span className="tag">Features</span>
            <h2 className="section-title">Everything Sage does while you&apos;re away</h2>
          </div>
          <button className="btn" onClick={() => setDemo(FEATURES[0].key)}>
            <Icon name="play" size={18} /> Tour all six
          </button>
        </div>
        <div className="features">
          {FEATURES.map((f, i) => (
            <button key={f.key} className="card feature" style={{ animationDelay: `${i * 70}ms` }} onClick={() => setDemo(f.key)} aria-label={`Watch the ${f.name} demo`}>
              <div className="feature-top">
                <span className="feature-icon"><Icon name={f.icon} size={26} /></span>
                <span className="feature-play" aria-hidden="true"><Icon name="play" size={16} /></span>
              </div>
              <div className="feature-art">
                <Mascot mood={f.mood} size={130} showProp={false} />
              </div>
              <h3>{f.name}</h3>
              <p>{f.short}</p>
            </button>
          ))}
        </div>
      </section>

      <section id="how" className="section">
        <span className="tag">How it works</span>
        <h2 className="section-title">Four steps, every time someone needs you</h2>
        <p className="lead section-lead">Follow one real question from Jordan through Sage.</p>
        <div className="hiw" onMouseLeave={() => setHold(false)}>
          <div className="hiw-track" aria-hidden="true">
            <i style={{ width: `${(step / (STEPS.length - 1)) * 100}%` }} />
          </div>
          {STEPS.map((s, i) => (
            <div
              key={s.title}
              className={`hiw-step ${i === step ? "on" : ""} ${i < step ? "done" : ""}`}
              onMouseEnter={() => { setStep(i); setHold(true); }}
            >
              <div className="hiw-node">
                <Icon name={s.icon} size={28} />
                <span>{i + 1}</span>
              </div>
              <div className="hiw-card">
                <h3>{s.title}</h3>
                <p>{s.text}</p>
                <div className="hiw-example">{s.example}</div>
              </div>
            </div>
          ))}
        </div>
      </section>

      <section id="privacy" className="section">
        <span className="tag">Privacy</span>
        <h2 className="section-title">AI suggests. Rules decide.</h2>
        <div className="split">
          <div className="card info">
            <span className="info-icon ai"><Icon name="sparkle" size={30} /></span>
            <div>
              <h3>Where AI helps</h3>
              <p>Understanding questions, finding the right note, reading live pages, judging how urgent something is, and writing replies and your recap.</p>
            </div>
          </div>
          <div className="card info">
            <span className="info-icon rules"><Icon name="gavel" size={30} /></span>
            <div>
              <h3>Where rules decide</h3>
              <p>What&apos;s private, when you can be interrupted, how many shield passes you have, and every deadline date. Private notes never reach the AI.</p>
            </div>
          </div>
        </div>
      </section>
    </>
  );
}
