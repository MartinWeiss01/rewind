import {
  HistoryIcon,
  LayoutDashboardIcon,
  ListMusicIcon,
  type LucideIcon,
  SettingsIcon,
  SparklesIcon,
} from "lucide-react";
import type { Route } from "next";
import { FeatureFlag } from "@/server/feature-flags";

export type NavKey = "dashboard" | "history" | "playlists" | "discover" | "settings";
/** `flag`: the item only shows when that feature flag is on. */
export type NavItem = { key: NavKey; href: Route; icon: LucideIcon; flag?: FeatureFlag };

/** Dock entries in order, each with its Lucide icon. */
export const navItems: readonly NavItem[] = [
  {
    key: "dashboard",
    href: "/app",
    flag: FeatureFlag.Stats,
    icon: LayoutDashboardIcon,
  },
  {
    key: "history",
    href: "/app/history",
    flag: FeatureFlag.Stats,
    icon: HistoryIcon,
  },
  { key: "playlists", href: "/app/playlists", icon: ListMusicIcon },
  {
    key: "discover",
    href: "/app/discover",
    icon: SparklesIcon,
  },
  {
    key: "settings",
    href: "/app/settings",
    icon: SettingsIcon,
  },
];
