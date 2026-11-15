"use client";
import { useEffect, useState } from "react";

type Theme = "light" | "dark";

export default function ThemeToggle() {
  const [theme, setTheme] = useState<Theme>("light");

  useEffect(() => {
    setTheme((document.documentElement.dataset.theme as Theme) || "light");
  }, []);

  function flip() {
    const next: Theme = theme === "light" ? "dark" : "light";
    setTheme(next);
    document.documentElement.dataset.theme = next;
    try {
      localStorage.setItem("fort-theme", next);
    } catch {
      /* storage can be unavailable; the toggle still works for this visit */
    }
  }

  const label = theme === "light" ? "Day" : "Night";
  return (
    <button
      className="theme-switch"
      onClick={flip}
      aria-label={`Theme: ${label}. Switch to ${theme === "light" ? "night" : "day"} mode`}
      title={`Switch to ${theme === "light" ? "night" : "day"} mode`}
    >
      <span className="theme-toggle" aria-hidden>
        <span className="orb">{theme === "light" ? "☀️" : "🌙"}</span>
        <span className="mesa" />
      </span>
      <span className="theme-label">{label}</span>
    </button>
  );
}
