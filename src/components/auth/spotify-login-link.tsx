"use client";

import { type ReactNode, useEffect, useState } from "react";

const loginPath = "/api/auth/spotify/login";

/**
 * Link to the Spotify sign-in route handler (a full navigation, not a client route).
 * Adds the browser's time zone so a new account starts with local heatmaps and streaks.
 */
export function SpotifyLoginLink({
  className,
  children,
}: {
  className?: string;
  children: ReactNode;
}) {
  // The server render has no time zone; it is added after hydration.
  const [href, setHref] = useState(loginPath);
  useEffect(() => {
    const timeZone = Intl.DateTimeFormat().resolvedOptions().timeZone;
    if (timeZone) setHref(`${loginPath}?${new URLSearchParams({ tz: timeZone })}`);
  }, []);
  return (
    <a href={href} className={className}>
      {children}
    </a>
  );
}
