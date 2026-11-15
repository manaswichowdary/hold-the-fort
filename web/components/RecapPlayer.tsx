"use client";
// "Previously on..." : plays the week as a narrated TV style episode.
import { useCallback, useEffect, useRef, useState } from "react";
import Mascot, { type Mood } from "./Mascot";
import { speak, stopSpeaking } from "@/lib/voice";

export type Scene = { title: string; line: string; mood: string; stat?: string };

const MOODS = ["idle", "waving", "thinking", "working", "success", "locked", "urgent", "sleeping", "narrating"];

export default function RecapPlayer({ scenes, onClose }: { scenes: Scene[]; onClose: () => void }) {
  const [i, setI] = useState(-1); // -1 = title card
  const [muted, setMuted] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const next = useCallback(() => setI((x) => x + 1), []);

  useEffect(() => {
    if (timer.current) clearTimeout(timer.current);
    stopSpeaking();
    if (i >= scenes.length) return;

    const text = i < 0 ? "Previously on… your job." : `${scenes[i].title}. ${scenes[i].line}`;
    const fallbackMs = i < 0 ? 2600 : Math.max(3800, text.length * 65);

    if (!muted) {
      // Natural narrator voice; the safety timer moves on if audio stalls
      let moved = false;
      const go = (ms: number) => {
        if (moved) return;
        moved = true;
        if (timer.current) clearTimeout(timer.current);
        timer.current = setTimeout(next, ms);
      };
      speak(text, { style: "narrate", onEnd: () => go(650) });
      timer.current = setTimeout(() => go(0), fallbackMs + 14000);
    } else {
      timer.current = setTimeout(next, fallbackMs);
    }
    return () => {
      if (timer.current) clearTimeout(timer.current);
    };
  }, [i, muted, scenes, next]);

  useEffect(() => {
    return () => stopSpeaking();
  }, []);

  const ended = i >= scenes.length;
  const scene = i >= 0 && !ended ? scenes[i] : null;
  const mood = (scene && MOODS.includes(scene.mood) ? scene.mood : "narrating") as Mood;

  return (
    <div className="tv-overlay" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="tv">
        <div className="tv-screen">
          <div className="tv-noise" />
          {i < 0 && (
            <div className="tv-title" key="title">
              <span>PREVIOUSLY ON</span>
              <h1>Your Job</h1>
            </div>
          )}
          {scene && (
            <div className="tv-scene" key={i}>
              <Mascot mood={mood} size={150} />
              <div className="tv-text">
                {scene.stat && <div className="tv-stat">{scene.stat}</div>}
                <h2>{scene.title}</h2>
                <p>{scene.line}</p>
              </div>
            </div>
          )}
          {ended && (
            <div className="tv-scene" key="end">
              <Mascot mood="success" size={150} />
              <div className="tv-text">
                <h2>Welcome back 🏰</h2>
                <p>The fort held. Everything else is on your desk.</p>
                <div className="row" style={{ marginTop: 14 }}>
                  <button className="btn" onClick={() => setI(-1)}>Replay</button>
                  <button className="btn ghost light" onClick={onClose}>Close</button>
                </div>
              </div>
            </div>
          )}
        </div>
        <div className="tv-controls">
          <div className="dots">
            {scenes.map((_, k) => (
              <span key={k} className={k === i ? "on" : k < i ? "past" : ""} onClick={() => setI(k)} />
            ))}
          </div>
          <button onClick={() => setMuted((m) => !m)}>{muted ? "🔇" : "🔊"}</button>
          {!ended && <button onClick={next}>Skip ⏭</button>}
          <button onClick={onClose}>✕</button>
        </div>
      </div>
    </div>
  );
}
