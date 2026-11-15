"use client";

import { Button } from "@ui-sdk/react/button";
import Link from "next/link";
import { useTranslations } from "next-intl";
import { useEffect } from "react";
import { StatePanel } from "@/components/feedback/state-panel";
import { buttonClass } from "@/components/ui/styles";

export default function ErrorBoundary({ error, retry }: { error: unknown; retry: () => void }) {
  const t = useTranslations("playlists.detail");
  const states = useTranslations("states");

  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <StatePanel
      tone="error"
      title={states("errorTitle")}
      body={t("errorBody")}
      action={
        <div className="flex flex-wrap justify-center gap-2">
          <Button onClick={() => retry()} className={buttonClass("primary", "sm")}>
            {states("retry")}
          </Button>
          <Link href="/app/playlists" className={buttonClass("ghost", "sm")}>
            {t("backToPlaylists")}
          </Link>
        </div>
      }
    />
  );
}
