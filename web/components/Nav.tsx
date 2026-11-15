"use client";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import ThemeToggle from "./ThemeToggle";
import { getRole, TABS, type Role } from "@/lib/role";

const SITE = ["/", "/about", "/start"];
const OWNER_PAGES = ["/setup", "/back", "/phone"];

// Home page sections, in page order. Clicking scrolls instead of opening a new page.
const SECTIONS = [
  { id: "about", label: "About" },
  { id: "features", label: "Features" },
  { id: "how", label: "How it works" },
  { id: "privacy", label: "Privacy" },
];

export default function Nav() {
  const path = usePathname() || "/";
  const [role, setRoleState] = useState<Role | null>(null);
  const [active, setActive] = useState<string | null>(null);
  const router = useRouter();
  useEffect(() => setRoleState(getRole(path)), [path]);

  // Alice's pages need the passcode: send anyone who isn't signed in to the lock card
  useEffect(() => {
    if (!OWNER_PAGES.some((p) => path.startsWith(p))) return;
    let gone = false;
    fetch("/api/owner-login")
      .then((r) => r.json())
      .then((st) => {
        if (!gone && st.required && !st.owner) router.replace(`/start?alice=1&next=${encodeURIComponent(path)}`);
      })
      .catch(() => {});
    return () => { gone = true; };
  }, [path, router]);
  const inApp = !SITE.includes(path);
  const onHome = path === "/";

  // Highlight the section currently on screen
  useEffect(() => {
    if (!onHome) {
      setActive(null);
      return;
    }
    const onScroll = () => {
      const atBottom = window.innerHeight + window.scrollY >= document.documentElement.scrollHeight - 4;
      if (atBottom) return setActive(SECTIONS[SECTIONS.length - 1].id);
      let current: string | null = null;
      for (const s of SECTIONS) {
        const el = document.getElementById(s.id);
        if (el && el.getBoundingClientRect().top <= window.innerHeight * 0.4) current = s.id;
      }
      setActive(current);
    };
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, [onHome]);

  function go(e: React.MouseEvent, id: string) {
    if (!onHome) return; // other pages: let the link open the home page at that section
    const el = document.getElementById(id);
    if (!el) return;
    e.preventDefault();
    el.scrollIntoView({ behavior: "smooth", block: "start" });
    window.history.replaceState(null, "", `#${id}`);
  }

  return (
    <>
      <header className="nav">
        <Link href="/" className="brand" aria-label="Hold the Fort home">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/logo-light.png" alt="Hold the Fort" className="brand-wordmark only-light" />
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/logo-dark.png" alt="Hold the Fort" className="brand-wordmark only-dark" />
        </Link>
        <div className="nav-right">
          <nav className="nav-links nav-pill" aria-label="Sections">
            {SECTIONS.map((s) => (
              <a key={s.id} href={`/#${s.id}`} onClick={(e) => go(e, s.id)} className={active === s.id ? "on" : ""}>
                {s.label}
              </a>
            ))}
          </nav>
          {/* Inside the app this button switches between Alice and coworker views */}
          <Link href="/start" className="btn small">{inApp && role ? "Switch view" : "Try it live"}</Link>
          <ThemeToggle />
        </div>
      </header>

      {inApp && role && (
        <div className="app-bar">
          <span className="app-role">{role === "owner" ? "Viewing as Alice" : "Viewing as a coworker"}</span>
          <div className="app-tabs" role="navigation" aria-label="App">
            {TABS[role].map((t) => (
              <Link key={t.href} href={t.href} className={path.startsWith(t.href.split("/").slice(0, 2).join("/")) ? "on" : ""}>
                {t.label}
              </Link>
            ))}
          </div>
        </div>
      )}
    </>
  );
}
