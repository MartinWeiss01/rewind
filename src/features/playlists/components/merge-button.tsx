"use client";

import { Button } from "@ui-sdk/react/button";
import { useTranslations } from "next-intl";
import { useState } from "react";
import { buttonClass } from "@/components/ui/styles";
import { MergeDialog, type MergeOption } from "./merge-dialog";

/** "Merge playlists" on the library screen: merges into a new playlist by default. */
export function MergeButton({ playlists }: { playlists: readonly MergeOption[] }) {
  const t = useTranslations("playlistTools.merge");
  const [open, setOpen] = useState(false);
  return (
    <>
      <Button className={buttonClass("secondary")} onClick={() => setOpen(true)}>
        <svg
          width="18"
          height="18"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          aria-hidden="true"
        >
          <path d="M8 6h13M8 12h13M8 18h13M3 6h.01M3 12h.01M3 18h.01" />
        </svg>
        {t("open")}
      </Button>
      <MergeDialog
        open={open}
        onOpenChange={setOpen}
        playlists={playlists}
        defaultTargetId={null}
      />
    </>
  );
}
