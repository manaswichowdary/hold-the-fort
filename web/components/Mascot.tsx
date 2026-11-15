"use client";
// The mascot. Drop your own art into /public/mascot/<mood>.png and it replaces the placeholder everywhere.
// Missing poses fall back to idle.png, then to the built in placeholder.
import { useEffect, useState } from "react";
import Sage from "./Sage";

export type Mood = "idle" | "waving" | "thinking" | "working" | "success" | "locked" | "urgent" | "sleeping" | "narrating";

const PROP: Record<Mood, string> = {
  idle: "👋",
  waving: "👋",
  thinking: "🔍",
  working: "📄",
  success: "🎉",
  locked: "🛡️",
  urgent: "🚨",
  sleeping: "💤",
  narrating: "🎤",
};

// Remember which pose files exist, so each is checked only once per page load
const exists = new Map<string, Promise<boolean>>();
function check(url: string): Promise<boolean> {
  if (!exists.has(url)) {
    exists.set(
      url,
      new Promise((resolve) => {
        const img = new Image();
        img.onload = () => resolve(true);
        img.onerror = () => resolve(false);
        img.src = url;
      })
    );
  }
  return exists.get(url)!;
}

type Props = { mood?: Mood; size?: number; showProp?: boolean; className?: string };

export default function Mascot({ mood = "idle", size = 120, showProp = true, className = "" }: Props) {
  const [src, setSrc] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    (async () => {
      const own = `/mascot/${mood}.png`;
      if (await check(own)) return alive && setSrc(own);
      if (await check("/mascot/idle.png")) return alive && setSrc("/mascot/idle.png");
      if (alive) setSrc(null);
    })();
    return () => {
      alive = false;
    };
  }, [mood]);

  return (
    <div className={`mascot mood-${mood} ${className}`} style={{ width: size, height: size }}>
      <div className="mascot-body">
        {src ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={src} alt={`Mascot ${mood}`} width={size} height={size} draggable={false} />
        ) : (
          <Sage size={size} />
        )}
      </div>
      {showProp && !src && (
        <span className="mascot-prop" style={{ fontSize: Math.max(14, size * 0.22) }}>
          {PROP[mood]}
        </span>
      )}
      {mood === "sleeping" && !src && (
        <span className="zzz" style={{ fontSize: Math.max(12, size * 0.16) }}>
          <i>z</i><i>z</i><i>z</i>
        </span>
      )}
      {mood === "success" && (
        <span className="sparkles" aria-hidden>
          <i>✦</i><i>✦</i><i>✦</i>
        </span>
      )}
    </div>
  );
}
