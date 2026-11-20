"use client";

import { Button } from "@ui-sdk/react/button";
import { Menu, MenuContent, MenuItem, MenuTrigger } from "@ui-sdk/react/menu";
import { ChevronDownIcon, HistoryIcon } from "lucide-react";
import { useTranslations } from "next-intl";
import { useState } from "react";
import { z } from "zod";
import { buttonClass } from "@/components/ui/styles";
import type { PlaylistItem, PlaylistSnapshot } from "@/domain/playlists";
import { CompareDialog } from "./compare-dialog";
import { DuplicatesDialog } from "./duplicates-dialog";
import { HistoryDialog } from "./history-dialog";
import { MergeDialog, type MergeOption } from "./merge-dialog";
import { SortDialog } from "./sort-dialog";
import { SortIntoDialog } from "./sort-into-dialog";
import { SplitDialog } from "./split-dialog";
import { popup, popupItem } from "./ui";

const Tool = {
  Duplicates: "duplicates",
  Compare: "compare",
  Merge: "merge",
  Sort: "sort",
  Split: "split",
  SortInto: "sortInto",
  History: "history",
} as const;
type Tool = (typeof Tool)[keyof typeof Tool];
const toolSchema = z.enum(Tool);

/** The Tools menu, the History & undo button and the dialogs they open. */
export function PlaylistTools({
  playlistId,
  playlistName,
  basedOn,
  items,
  plays,
  snapshots,
  mergeOptions,
  canWrite,
  canUseAi,
}: {
  playlistId: string;
  playlistName: string;
  basedOn: string;
  items: readonly PlaylistItem[];
  plays: Readonly<Record<string, number>> | null;
  snapshots: readonly PlaylistSnapshot[];
  mergeOptions: readonly MergeOption[];
  canWrite: boolean;
  /** Whether the viewer has the AI flag, for "Sort into playlists". */
  canUseAi: boolean;
}) {
  const t = useTranslations("playlistTools.menu");
  const [open, setOpen] = useState<Tool | null>(null);
  const setter = (tool: Tool) => (next: boolean) => setOpen(next ? tool : null);
  const writeTools = [
    Tool.Duplicates,
    Tool.Compare,
    Tool.Merge,
    Tool.Sort,
    Tool.Split,
    ...(canUseAi ? [Tool.SortInto] : []),
  ];
  const empty = items.length === 0;

  return (
    <>
      {canWrite ? (
        <Menu
          onAction={(value) => {
            const parsed = toolSchema.safeParse(value);
            if (parsed.success) setOpen(parsed.data);
          }}
        >
          <MenuTrigger className={buttonClass("secondary")}>
            {t("tools")}
            <ChevronDownIcon size={16} aria-hidden="true" />
          </MenuTrigger>
          <MenuContent className={`${popup} w-[300px]`} sideOffset={8} align="start">
            {writeTools.map((tool) => (
              <MenuItem
                key={tool}
                value={tool}
                label={t(`${tool}.label`)}
                disabled={empty && tool !== Tool.Merge}
                className={popupItem}
              >
                <b>{t(`${tool}.label`)}</b>
                <span className="text-muted text-xs">{t(`${tool}.hint`)}</span>
              </MenuItem>
            ))}
          </MenuContent>
        </Menu>
      ) : null}
      <Button className={buttonClass("ghost")} onClick={() => setOpen(Tool.History)}>
        <HistoryIcon size={18} aria-hidden="true" />
        {t("history")}
      </Button>

      <DuplicatesDialog
        open={open === Tool.Duplicates}
        onOpenChange={setter(Tool.Duplicates)}
        playlistId={playlistId}
        basedOn={basedOn}
        items={items}
        plays={plays}
      />
      <CompareDialog
        open={open === Tool.Compare}
        onOpenChange={setter(Tool.Compare)}
        playlistId={playlistId}
        playlistName={playlistName}
        basedOn={basedOn}
        items={items}
        playlists={mergeOptions}
      />
      <MergeDialog
        open={open === Tool.Merge}
        onOpenChange={setter(Tool.Merge)}
        playlists={mergeOptions}
        defaultTargetId={playlistId}
      />
      <SortDialog
        open={open === Tool.Sort}
        onOpenChange={setter(Tool.Sort)}
        playlistId={playlistId}
        basedOn={basedOn}
        items={items}
        plays={plays}
      />
      <SplitDialog
        open={open === Tool.Split}
        onOpenChange={setter(Tool.Split)}
        playlistId={playlistId}
        playlistName={playlistName}
        items={items}
      />
      {canUseAi ? (
        <SortIntoDialog
          open={open === Tool.SortInto}
          onOpenChange={setter(Tool.SortInto)}
          playlistId={playlistId}
          playlistName={playlistName}
          basedOn={basedOn}
          items={items}
          playlists={mergeOptions}
        />
      ) : null}
      <HistoryDialog
        open={open === Tool.History}
        onOpenChange={setter(Tool.History)}
        playlistId={playlistId}
        snapshots={snapshots}
        canRestore={canWrite}
      />
    </>
  );
}
