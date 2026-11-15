"use client";

import { useMutation } from "@tanstack/react-query";
import { Button } from "@ui-sdk/react/button";
import { useTranslations } from "next-intl";
import { buttonClass } from "@/components/ui/styles";
import { syncNow } from "../actions";

export function SyncButton() {
  const t = useTranslations("settings");
  const sync = useMutation({
    mutationFn: async () => {
      const result = await syncNow();
      if (!result.ok) throw new Error(result.error);
      return Number(result.message ?? 0);
    },
  });
  return (
    <div className="flex items-center gap-3">
      <span role="status" className="text-muted text-sm">
        {sync.isSuccess
          ? t("syncAdded", { count: sync.data })
          : sync.isError
            ? t("syncFailed")
            : ""}
      </span>
      {/* Returning the mutation's promise keeps the button pending until it settles. */}
      <Button
        className={buttonClass("secondary", "sm")}
        pendingAnnouncement={t("syncing")}
        onClick={() => sync.mutateAsync()}
      >
        {t("syncNow")}
      </Button>
    </div>
  );
}
