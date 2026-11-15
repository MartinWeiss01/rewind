"use client";

import { Button } from "@ui-sdk/react/button";
import { useTranslations } from "next-intl";
import { useEffect } from "react";
import { StatePanel } from "./state-panel";

/** Body of every route's error.tsx: message plus a retry that re-fetches the segment. */
export function RouteError({ error, retry }: { error: unknown; retry: () => void }) {
  const t = useTranslations("states");

  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <StatePanel
      tone="error"
      title={t("errorTitle")}
      body={t("errorBody")}
      action={
        <Button
          onClick={() => retry()}
          className="inline-flex min-h-9 cursor-pointer items-center rounded-full bg-ink px-4 font-semibold text-on-ink text-sm"
        >
          {t("retry")}
        </Button>
      }
    />
  );
}
