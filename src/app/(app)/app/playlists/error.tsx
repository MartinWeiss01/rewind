"use client";

import { Button } from "@ui-sdk/react/button";
import { useTranslations } from "next-intl";
import { useEffect } from "react";
import { StatePanel } from "@/components/feedback/state-panel";
import { buttonClass } from "@/components/ui/styles";

export default function ErrorBoundary({ error, retry }: { error: unknown; retry: () => void }) {
  const t = useTranslations("playlists.library");
  const states = useTranslations("states");

  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <StatePanel
      tone="error"
      title={t("errorTitle")}
      body={t("errorBody")}
      action={
        <Button onClick={() => retry()} className={buttonClass("primary", "sm")}>
          {states("retry")}
        </Button>
      }
    />
  );
}
