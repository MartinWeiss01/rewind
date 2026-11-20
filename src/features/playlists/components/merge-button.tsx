"use client";

import { Button } from "@ui-sdk/react/button";
import { ListIcon } from "lucide-react";
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
        <ListIcon size={18} aria-hidden="true" />
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
