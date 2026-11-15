// Sage: a saguaro cactus security guard. Original mascot for Hold the Fort.
type Props = { size?: number; talking?: boolean; className?: string };

export default function Sage({ size = 120, talking = false, className = "" }: Props) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 120 140"
      className={`sage ${talking ? "sage-talk" : ""} ${className}`}
      role="img"
      aria-label="Sage the cactus guard"
    >
      {/* pot */}
      <path d="M32 112 h56 l-6 24 h-44 z" fill="#C65D3B" />
      <rect x="28" y="106" width="64" height="10" rx="3" fill="#A94B2E" />
      {/* arms */}
      <path d="M38 78 c-14 0 -16 -10 -16 -22 v-8 a6 6 0 0 1 12 0 v8 c0 6 2 9 6 9" fill="#4E8B5B" />
      <path d="M82 70 c14 0 16 -10 16 -22 v-12 a6 6 0 0 0 -12 0 v12 c0 6 -2 9 -6 9" fill="#4E8B5B" />
      {/* body */}
      <rect x="36" y="34" width="48" height="76" rx="24" fill="#5A9B67" />
      <path d="M48 44 v58 M60 40 v66 M72 44 v58" stroke="#4E8B5B" strokeWidth="3" strokeLinecap="round" />
      {/* spines */}
      <g stroke="#2F5A38" strokeWidth="1.6" strokeLinecap="round">
        <path d="M40 60 l-4 -2 M40 86 l-4 2 M80 60 l4 -2 M80 86 l4 2 M25 52 l-4 -1 M95 44 l4 -1" />
      </g>
      {/* guard hat */}
      <path d="M34 34 q26 -22 52 0 z" fill="#24324A" />
      <rect x="30" y="32" width="60" height="7" rx="3.5" fill="#1B2638" />
      <circle cx="60" cy="24" r="5" fill="#E9B949" />
      <path d="M60 21 l1.2 2.4 2.6 .4 -1.9 1.8 .5 2.6 -2.4 -1.3 -2.4 1.3 .5 -2.6 -1.9 -1.8 2.6 -.4z" fill="#B8860B" />
      {/* sunglasses */}
      <rect x="42" y="50" width="16" height="10" rx="4" fill="#1B2638" />
      <rect x="62" y="50" width="16" height="10" rx="4" fill="#1B2638" />
      <rect x="57" y="53" width="6" height="2.5" fill="#1B2638" />
      <rect x="45" y="52" width="5" height="2" rx="1" fill="#ffffff" opacity=".55" />
      {/* cheeks + smile */}
      <circle cx="44" cy="68" r="3.5" fill="#F2A07B" opacity=".7" />
      <circle cx="76" cy="68" r="3.5" fill="#F2A07B" opacity=".7" />
      <path className="sage-mouth" d="M52 68 q8 7 16 0" stroke="#1B2638" strokeWidth="2.6" fill="none" strokeLinecap="round" />
      {/* flower */}
      <circle cx="90" cy="34" r="4" fill="#F28CA6" />
      <circle cx="90" cy="34" r="1.6" fill="#E9B949" />
    </svg>
  );
}
