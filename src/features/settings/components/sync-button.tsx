"use client";

import { Button } from "@ui-sdk/react/button";
import { useTranslations } from "next-intl";
import { useState } from "react";
import { buttonClass } from "@/components/ui/styles";
import { syncNow } from "../actions";

export function SyncButton() {
  const t = useTranslations("settings");
  const [message, setMessage] = useState("");
  return (
    <div className="flex items-center gap-3">
      <span role="status" className="text-muted text-sm">
        {message}
      </span>
      <Button
        className={buttonClass("secondary", "sm")}
        pendingAnnouncement={t("syncing")}
        onClick={async () => {
          const result = await syncNow();
          setMessage(
            result.ok ? t("syncAdded", { count: Number(result.message ?? 0) }) : t("syncFailed"),
          );
        }}
      >
        {t("syncNow")}
      </Button>
    </div>
  );
}
