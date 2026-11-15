import type { Route } from "next";

export type NavKey = "dashboard" | "history" | "playlists" | "discover" | "settings";
export type NavItem = { key: NavKey; href: Route; icon: string };

/** Dock entries in order; `icon` is an SVG path drawn with a 24px stroke icon. */
export const navItems: readonly NavItem[] = [
  { key: "dashboard", href: "/app", icon: "M4 13h6V4H4zM14 20h6v-9h-6zM14 4v4h6V4zM4 20h6v-3H4z" },
  { key: "history", href: "/app/history", icon: "M12 7v5l3 2M3 12a9 9 0 1 0 3-6.7L3 8M3 3v5h5" },
  { key: "playlists", href: "/app/playlists", icon: "M4 6h12M4 12h12M4 18h7M18 15v6M15 18h6" },
  {
    key: "discover",
    href: "/app/discover",
    icon: "M12 3l1.9 5.6L19.5 10l-5.6 1.9L12 17.5l-1.9-5.6L4.5 10l5.6-1.4z",
  },
  {
    key: "settings",
    href: "/app/settings",
    icon: "M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6zM19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-2.9 1.2V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-2.9-1.2l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1A1.7 1.7 0 0 0 3 15.1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.2-2.9l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1A1.7 1.7 0 0 0 9 4.6V4.5a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 2.9 1.2l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0 1.2 2.9h.1a2 2 0 1 1 0 4z",
  },
];
