// Which side of the app you're viewing in the demo: the person going away, or a coworker.
export type Role = "owner" | "coworker";

const OWNER_PATHS = ["/setup", "/back", "/phone"];
const COWORKER_PATHS = ["/ask", "/cover", "/board"];

export function getRole(path?: string): Role | null {
  if (path) {
    if (OWNER_PATHS.some((p) => path.startsWith(p))) return "owner";
    if (COWORKER_PATHS.some((p) => path.startsWith(p))) return "coworker";
  }
  try {
    const r = localStorage.getItem("fort-role");
    return r === "owner" || r === "coworker" ? r : null;
  } catch {
    return null;
  }
}

export function setRole(r: Role) {
  try {
    localStorage.setItem("fort-role", r);
  } catch {
    /* fine: the path decides the role anyway */
  }
}

export const TABS: Record<Role, { href: string; label: string }[]> = {
  owner: [
    { href: "/setup", label: "Before I leave" },
    { href: "/phone", label: "My phone" },
    { href: "/back", label: "Catch Me Up" },
  ],
  coworker: [
    { href: "/ask/alice", label: "Ask Sage" },
    { href: "/cover", label: "Thank You Stars" },
    { href: "/board", label: "Team board" },
  ],
};
