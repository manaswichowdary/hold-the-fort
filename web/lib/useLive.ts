"use client";
// Keeps a page's numbers live: runs `load` now, every few seconds, and the moment you come back to the tab.
// So a question asked as Jen shows up on Alice's pages without a refresh.
import { useEffect, useRef } from "react";

export function useLive(load: () => unknown, everyMs = 4000) {
  const ref = useRef(load);
  ref.current = load;
  useEffect(() => {
    const run = () => {
      if (document.visibilityState === "visible") ref.current();
    };
    ref.current();
    const t = setInterval(run, everyMs);
    document.addEventListener("visibilitychange", run);
    window.addEventListener("focus", run);
    return () => {
      clearInterval(t);
      document.removeEventListener("visibilitychange", run);
      window.removeEventListener("focus", run);
    };
  }, [everyMs]);
}
