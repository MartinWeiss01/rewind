"use client";

import { Preferences } from "@ui-sdk/react/preferences";
import type { ReactNode } from "react";
import { colorScheme } from "./color-scheme";

export function AppPreferences({ children }: { children: ReactNode }) {
  return <Preferences preferences={[colorScheme]}>{children}</Preferences>;
}
