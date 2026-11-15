// One consistent line icon style for the whole app
type P = { size?: number };

const base = (size: number, children: React.ReactNode) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
    {children}
  </svg>
);

export const IconChat = ({ size = 30 }: P) => base(size, <><path d="M4 5h16v11H9l-5 4z" /><path d="M8 9.5h8M8 12.5h5" /></>);
export const IconShield = ({ size = 30 }: P) => base(size, <><path d="M12 3l8 3v6c0 5-3.5 8-8 9-4.5-1-8-4-8-9V6z" /><path d="M8.5 12l2.5 2.5 4.5-5" /></>);
export const IconCalendar = ({ size = 30 }: P) => base(size, <><rect x="3.5" y="5" width="17" height="15" rx="2" /><path d="M3.5 10h17M8 3v4M16 3v4" /><path d="M9 15l2 2 4-4" /></>);
export const IconStar = ({ size = 30 }: P) => base(size, <path d="M12 3.5l2.6 5.3 5.8.8-4.2 4.1 1 5.8L12 16.8l-5.2 2.7 1-5.8-4.2-4.1 5.8-.8z" />);
export const IconRecap = ({ size = 30 }: P) => base(size, <><rect x="3" y="5" width="18" height="12" rx="2" /><path d="M10.5 8.5v5l4-2.5z" /><path d="M8 20h8" /></>);
export const IconLock = ({ size = 30 }: P) => base(size, <><rect x="5" y="10.5" width="14" height="10" rx="2" /><path d="M8 10.5V7.5a4 4 0 0 1 8 0v3" /><path d="M12 14.5v2.5" /></>);
export const IconBrain = ({ size = 30 }: P) => base(size, <><path d="M9 4a3 3 0 0 0-3 3 3 3 0 0 0-2 5 3 3 0 0 0 2 5 3 3 0 0 0 3 3h0V4z" /><path d="M15 4a3 3 0 0 1 3 3 3 3 0 0 1 2 5 3 3 0 0 1-2 5 3 3 0 0 1-3 3h0V4z" /></>);
export const IconRules = ({ size = 30 }: P) => base(size, <><rect x="4" y="3.5" width="16" height="17" rx="2" /><path d="M8 8.5l1.5 1.5L12 7.5M8 14.5l1.5 1.5 2.5-2.5M14 9h3M14 15h3" /></>);
export const IconPlay = ({ size = 22 }: P) => base(size, <path d="M8 5.5v13l10-6.5z" fill="currentColor" />);
export const IconSun = ({ size = 18 }: P) => base(size, <><circle cx="12" cy="12" r="4" /><path d="M12 2.5v2M12 19.5v2M2.5 12h2M19.5 12h2M5 5l1.5 1.5M17.5 17.5L19 19M5 19l1.5-1.5M17.5 6.5L19 5" /></>);
export const IconMoon = ({ size = 18 }: P) => base(size, <path d="M20 14.5A8 8 0 1 1 9.5 4a6.5 6.5 0 0 0 10.5 10.5z" />);
export const IconPlane = ({ size = 30 }: P) => base(size, <path d="M10.5 13.5L3 11l1.5-1.5 8 1 4.5-4.5a2 2 0 0 1 3 3l-4.5 4.5 1 8L15 22l-2.5-7.5L9 18v3l-1.5 1-1-4-4-1L4 15.5h3z" />);
export const IconUsers = ({ size = 30 }: P) => base(size, <><circle cx="9" cy="8" r="3.2" /><path d="M3 20c0-3.3 2.7-6 6-6s6 2.7 6 6" /><circle cx="17" cy="9" r="2.6" /><path d="M16 14.2c2.9.2 5 2.6 5 5.8" /></>);

export const FEATURE_ICON: Record<string, (p: P) => React.ReactElement> = {
  answers: IconChat,
  shield: IconShield,
  reschedule: IconCalendar,
  stars: IconStar,
  catchup: IconRecap,
  locked: IconLock,
};
