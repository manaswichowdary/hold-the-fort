"use client";
// Animated walkthrough of each feature (a scripted demo, clearly labeled as one).
import { useEffect, useRef, useState } from "react";
import Mascot, { type Mood } from "./Mascot";
import { FEATURES, type Feature } from "@/lib/features";
import Icon from "./Icon";

const SPEED = { coworker: 1500, agent: 2300, result: 3200 };

export default function DemoPlayer({ start, onClose }: { start: string; onClose: () => void }) {
  const [fIndex, setFIndex] = useState(Math.max(0, FEATURES.findIndex((f) => f.key === start)));
  const [shown, setShown] = useState(0);
  const [typing, setTyping] = useState(false);
  const [playing, setPlaying] = useState(true);
  const endRef = useRef<HTMLDivElement>(null);
  const feature: Feature = FEATURES[fIndex];
  const done = shown >= feature.demo.length;

  useEffect(() => {
    setShown(0);
  }, [fIndex]);

  useEffect(() => {
    if (!playing || done) return;
    const next = feature.demo[shown];
    setTyping(next.who === "agent");
    const t = setTimeout(() => {
      setTyping(false);
      setShown((s) => s + 1);
    }, shown === 0 ? 700 : SPEED[next.who]);
    return () => clearTimeout(t);
  }, [shown, playing, done, feature]);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [shown, typing]);

  const lastAgent = [...feature.demo.slice(0, shown)].reverse().find((l) => l.who !== "coworker") as
    | { mood: Mood }
    | undefined;
  const mood: Mood = typing ? "thinking" : lastAgent?.mood || feature.mood;

  return (
    <div className="tv-overlay" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className={`demo accent-${feature.accent}`}>
        <div className="demo-tabs">
          {FEATURES.map((f, i) => (
            <button key={f.key} className={i === fIndex ? "on" : ""} onClick={() => setFIndex(i)}>
              {f.emoji} {f.name}
            </button>
          ))}
        </div>

        <div className="demo-stage">
          <div className="demo-side">
            <span className="demo-label">DEMO</span>
            <Mascot mood={mood} size={190} />
            <h3>{feature.emoji} {feature.name}</h3>
            <p>{feature.short}</p>
          </div>

          <div className="demo-chat">
            {feature.demo.slice(0, shown).map((l, i) =>
              l.who === "coworker" ? (
                <div key={i} className="d-msg me pop">
                  <span className="d-name">{l.name}</span>
                  <div className="d-text">{l.text}</div>
                </div>
              ) : l.who === "agent" ? (
                <div key={i} className="d-msg them pop">
                  <span className="d-name">Sage</span>
                  <div className="d-text">{l.text}</div>
                  {l.steps && (
                    <div className="d-steps">
                      {l.steps.map((s, j) => (
                        <span key={j} className="d-step" style={{ animationDelay: `${j * 250}ms` }}>{s}</span>
                      ))}
                    </div>
                  )}
                </div>
              ) : (
                <div key={i} className="d-result pop">
                  <b>✨ {l.title}</b>
                  <span>{l.text}</span>
                </div>
              )
            )}
            {typing && (
              <div className="d-msg them">
                <span className="d-name">Sage</span>
                <div className="d-text typing"><span /><span /><span /></div>
              </div>
            )}
            <div ref={endRef} />
          </div>
        </div>

        <div className="tv-controls">
          <div className="dots">
            {feature.demo.map((_, k) => (
              <span key={k} className={k < shown ? "past" : k === shown ? "on" : ""} />
            ))}
          </div>
          {!done && <button onClick={() => setPlaying((p) => !p)}>{playing ? "⏸ Pause" : "▶ Play"}</button>}
          {done && <button onClick={() => setShown(0)}>↺ Replay</button>}
          {done && fIndex < FEATURES.length - 1 && <button onClick={() => setFIndex((i) => i + 1)}>Next: {FEATURES[fIndex + 1].name} <Icon name="arrowRight" size={20} stroke={3} /></button>}
          <button onClick={onClose}>✕</button>
        </div>
      </div>
    </div>
  );
}
