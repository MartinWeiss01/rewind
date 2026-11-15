"use client";

import { Button } from "@ui-sdk/react/button";
import messages from "../../messages/en.json";
import "./globals.css";

/**
 * Replaces the root layout when it fails, so the i18n provider is unavailable.
 * Copy comes straight from the English messages file.
 */
export default function GlobalError({ retry }: { error: unknown; retry: () => void }) {
  const t = messages.states;
  return (
    <html lang="en">
      <body className="grid min-h-dvh place-items-center p-6">
        <div role="alert" className="flex max-w-md flex-col items-center gap-3 text-center">
          <b>{t.errorTitle}</b>
          <span className="text-muted text-sm">{t.errorBody}</span>
          <Button
            onClick={() => retry()}
            className="inline-flex min-h-9 cursor-pointer items-center rounded-full bg-ink px-4 font-semibold text-on-ink text-sm"
          >
            {t.retry}
          </Button>
        </div>
      </body>
    </html>
  );
}
