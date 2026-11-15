// One consistent line icon style for the whole app.
const PATHS: Record<string, string> = {
  chat: "M4 5h16v11H9l-5 4V5z M8 9h8 M8 12h5",
  shield: "M12 3l8 3v6c0 5-3.5 8-8 9-4.5-1-8-4-8-9V6l8-3z M9 12l2 2 4-4",
  calendar: "M4 6h16v14H4z M4 10h16 M8 3v4 M16 3v4 M9 14h3v3H9z",
  star: "M12 3l2.7 5.6 6.1.9-4.4 4.3 1 6.1L12 17l-5.4 2.9 1-6.1-4.4-4.3 6.1-.9z",
  tv: "M3 7h18v12H3z M8 3l4 4 4-4 M10 11l4 2-4 2z",
  lock: "M6 11h12v9H6z M8 11V8a4 4 0 0 1 8 0v3 M12 14v3",
  brain: "M9 4a3 3 0 0 0-3 3 3 3 0 0 0-2 5 3 3 0 0 0 2 5 3 3 0 0 0 3 3h0V4z M15 4a3 3 0 0 1 3 3 3 3 0 0 1 2 5 3 3 0 0 1-2 5 3 3 0 0 1-3 3h0V4z",
  rules: "M12 4v16 M5 8h14 M5 8l-2 6h4z M19 8l-2 6h4z M8 20h8",
  play: "M8 5l11 7-11 7z",
  sun: "M12 8a4 4 0 1 0 0 8 4 4 0 0 0 0-8z M12 2v2 M12 20v2 M4.9 4.9l1.4 1.4 M17.7 17.7l1.4 1.4 M2 12h2 M20 12h2 M4.9 19.1l1.4-1.4 M17.7 6.3l1.4-1.4",
  moon: "M20 14A8 8 0 1 1 10 4a6 6 0 0 0 10 10z",
  ask: "M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18z M9.5 9a2.5 2.5 0 1 1 3.5 2.3c-.6.3-1 .9-1 1.5V14 M12 17h.01",
  memory: "M4 6h16 M4 12h16 M4 18h10",
  globe: "M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18z M3 12h18 M12 3c3 3 3 15 0 18 M12 3c-3 3-3 15 0 18",
  check: "M5 12l5 5 9-10",
  arrowDown: "M12 5v13 M6.5 12.5L12 18l5.5-5.5",
  arrowRight: "M5 12h13 M12.5 6.5L18 12l-5.5 5.5",
  sparkle: "M12 3l1.8 5.2L19 10l-5.2 1.8L12 17l-1.8-5.2L5 10l5.2-1.8z M19 15l.8 2.2L22 18l-2.2.8L19 21l-.8-2.2L16 18l2.2-.8z",
  gavel: "M14 4l6 6 M11 7l6 6 M12.5 5.5l-6 6 M18.5 11.5l-6 6 M9.5 8.5L3 15l3 3 6.5-6.5 M4 21h9",
  plane: "M10.5 13.5L3 11l1.5-1.5 8 1 4.5-4.5a2 2 0 0 1 3 3l-4.5 4.5 1 8L15 22l-2.5-7.5L9 18v3l-1.5 1-1-4-4-1L4 15.5h3z",
  users: "M9 11a3.2 3.2 0 1 0 0-6.4A3.2 3.2 0 0 0 9 11z M3 20c0-3.3 2.7-6 6-6s6 2.7 6 6 M17 11.6a2.6 2.6 0 1 0 0-5.2 M16 14.2c2.9.2 5 2.6 5 5.8",
  copy: "M9 9h11v11H9z M5 15H4V4h11v1",
  phone: "M7 2h10v20H7z M11 18h2",
};

export default function Icon({ name, size = 24, stroke = 2, className = "" }: { name: string; size?: number; stroke?: number; className?: string }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={stroke}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden
    >
      <path d={PATHS[name] || PATHS.check} />
    </svg>
  );
}
