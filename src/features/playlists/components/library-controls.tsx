"use client";

import { Input } from "@ui-sdk/react/input";
import {
  SegmentedControl,
  SegmentedControlIndicator,
  SegmentedControlItem,
} from "@ui-sdk/react/segmented-control";
import type { Route } from "next";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useTranslations } from "next-intl";
import { useEffect, useRef, useState, useTransition } from "react";
import type { z } from "zod";
import { segmentedIndicator, segmentedItem, segmentedRoot } from "@/components/ui/segmented";
import {
  type LibraryParams,
  LibrarySort,
  LibraryView,
  libraryParamsSchema,
  OwnerFilter,
} from "../library";
import { input } from "./ui";

const defaults = libraryParamsSchema.parse({});

/** Filter text, owner, sort and view, kept in the URL so the server renders the result. */
export function LibraryControls({ params }: { params: LibraryParams }) {
  const t = useTranslations("playlists.library");
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  // Filtering is URL navigation, not a client data call, so it stays a transition
  // (not TanStack Query): the Server Component reloads and loading.tsx covers the wait.
  const [, startTransition] = useTransition();
  const [state, setState] = useState(params);
  const [query, setQuery] = useState(params.q);
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  useEffect(() => () => clearTimeout(timer.current), []);

  const navigate = (next: LibraryParams) => {
    const search = new URLSearchParams(searchParams);
    for (const key of ["q", "owner", "sort", "view"] as const) {
      if (next[key] === defaults[key]) search.delete(key);
      else search.set(key, next[key]);
    }
    const qs = search.toString();
    startTransition(() => {
      // typedRoutes can't check a built query string; the pathname is this route's own.
      router.replace((qs ? `${pathname}?${qs}` : pathname) as Route, { scroll: false });
    });
  };

  const update = <K extends keyof LibraryParams>(
    key: K,
    schema: z.ZodType<LibraryParams[K]>,
    value: unknown,
  ) => {
    const parsed = schema.safeParse(value);
    if (!parsed.success) return false;
    const next = { ...state, [key]: parsed.data };
    setState(next);
    navigate(next);
    return true;
  };

  return (
    <div className="flex flex-wrap items-center gap-2.5">
      <div className="min-w-[220px] flex-[1_1_260px]">
        <Input
          aria-label={t("filterLabel")}
          type="search"
          value={query}
          placeholder={t("filterPlaceholder")}
          className={`${input} rounded-full`}
          onValueChange={(value) => {
            setQuery(value);
            clearTimeout(timer.current);
            timer.current = setTimeout(() => {
              update("q", libraryParamsSchema.shape.q, value);
            }, 250);
          }}
        />
      </div>
      <SegmentedControl
        aria-label={t("ownerLabel")}
        className={segmentedRoot}
        value={state.owner}
        onValueChange={(value, details) => {
          if (!update("owner", libraryParamsSchema.shape.owner, value)) details.cancel();
        }}
      >
        <SegmentedControlIndicator className={segmentedIndicator} />
        <SegmentedControlItem value={OwnerFilter.All} className={segmentedItem}>
          {t("ownerAll")}
        </SegmentedControlItem>
        <SegmentedControlItem value={OwnerFilter.Mine} className={segmentedItem}>
          {t("ownerMine")}
        </SegmentedControlItem>
        <SegmentedControlItem value={OwnerFilter.Followed} className={segmentedItem}>
          {t("ownerFollowed")}
        </SegmentedControlItem>
      </SegmentedControl>
      <SegmentedControl
        aria-label={t("sortLabel")}
        className={segmentedRoot}
        value={state.sort}
        onValueChange={(value, details) => {
          if (!update("sort", libraryParamsSchema.shape.sort, value)) details.cancel();
        }}
      >
        <SegmentedControlIndicator className={segmentedIndicator} />
        <SegmentedControlItem value={LibrarySort.Recent} className={segmentedItem}>
          {t("sortRecent")}
        </SegmentedControlItem>
        <SegmentedControlItem value={LibrarySort.Name} className={segmentedItem}>
          {t("sortName")}
        </SegmentedControlItem>
        <SegmentedControlItem value={LibrarySort.Size} className={segmentedItem}>
          {t("sortSize")}
        </SegmentedControlItem>
      </SegmentedControl>
      <SegmentedControl
        aria-label={t("viewLabel")}
        className={segmentedRoot}
        value={state.view}
        onValueChange={(value, details) => {
          if (!update("view", libraryParamsSchema.shape.view, value)) details.cancel();
        }}
      >
        <SegmentedControlIndicator className={segmentedIndicator} />
        <SegmentedControlItem value={LibraryView.Grid} className={segmentedItem}>
          {t("viewGrid")}
        </SegmentedControlItem>
        <SegmentedControlItem value={LibraryView.List} className={segmentedItem}>
          {t("viewList")}
        </SegmentedControlItem>
      </SegmentedControl>
    </div>
  );
}
