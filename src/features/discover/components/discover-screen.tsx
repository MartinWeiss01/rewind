"use client";

import { keepPreviousData, useMutation, useQuery } from "@tanstack/react-query";
import { Button } from "@ui-sdk/react/button";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { useRef, useState } from "react";
import { match } from "ts-pattern";
import { Skeleton } from "@/components/feedback/skeleton";
import { StatePanel } from "@/components/feedback/state-panel";
import { buttonClass, card, cardFlat, chipClass, heading } from "@/components/ui/styles";
import { queryKeys } from "@/lib/query-keys";
import { finishRun, matchCandidates, openGeneration, requestCandidates } from "../actions";
import {
  candidateLabel,
  DiscoverError,
  DiscoverFailure,
  type DiscoverRequest,
  discoverErrorOf,
  matchBatchSize,
  retryUnexpected,
  type Suggestion,
  unwrapResult,
} from "../types";
import {
  type FormState,
  initialFormState,
  type PlaylistOption,
  RequestForm,
  toRequest,
} from "./request-form";
import { type PlaylistTarget, RunResults, type RunView } from "./run-results";

export type EarlierItem = {
  id: string;
  /** Already formatted on the server. */
  when: string;
  title: string;
  trackCount: number;
  unmatchedCount: number;
};

const Step = {
  Ask: "ask",
  Match: "match",
  Finish: "finish",
} as const;
type Step = (typeof Step)[keyof typeof Step];

type RunProgress = {
  step: Step;
  profilePlays: number | null;
  asked: number | null;
  live: boolean;
  matched: number;
};

const startProgress: RunProgress = {
  step: Step.Ask,
  profilePlays: null,
  asked: null,
  live: true,
  matched: 0,
};

export function DiscoverScreen({
  playlists,
  editablePlaylists,
  earlier,
  canWrite,
  note,
}: {
  playlists: readonly PlaylistOption[];
  editablePlaylists: readonly PlaylistTarget[];
  earlier: readonly EarlierItem[];
  canWrite: boolean;
  note: string;
}) {
  const t = useTranslations("discover");
  const router = useRouter();
  const [form, setForm] = useState<FormState>(initialFormState);
  const [progress, setProgress] = useState<RunProgress>(startProgress);
  /** The earlier run picked from "Earlier suggestions"; null shows the latest new run. */
  const [openId, setOpenId] = useState<string | null>(null);
  /** Suggestions the listener removed from the run on screen. */
  const [removed, setRemoved] = useState<ReadonlySet<string>>(new Set());
  const runId = useRef(0);

  // The whole pipeline is one mutation: its steps run in sequence and report progress
  // through local state; a failed step throws its reason (see `unwrapResult`).
  const pipeline = useMutation({
    mutationFn: async (request: DiscoverRequest): Promise<RunView> => {
      const id = ++runId.current;
      // A newer run replaces this one; stop before saving anything for it.
      const check = () => {
        if (id !== runId.current) throw new DiscoverFailure(DiscoverError.Unknown);
      };
      const first = unwrapResult(await requestCandidates(request));
      check();
      const { candidates, profilePlays, live } = first;
      const base = { profilePlays, asked: candidates.length, live };
      setProgress({ ...base, step: Step.Match, matched: 0 });

      const matches: (Suggestion | null)[] = [];
      for (let start = 0; start < candidates.length; start += matchBatchSize) {
        const batch = candidates.slice(start, start + matchBatchSize);
        matches.push(...unwrapResult(await matchCandidates({ candidates: batch })));
        check();
        setProgress({ ...base, step: Step.Match, matched: matches.length });
      }

      setProgress({ ...base, step: Step.Finish, matched: matches.length });
      const matched = matches.flatMap((m) =>
        m ? [{ trackId: m.track.id, reason: m.reason, closestMatch: m.closestMatch }] : [],
      );
      const unmatched = candidates.flatMap((c, i) => (matches[i] ? [] : [candidateLabel(c)]));
      const finished = unwrapResult(await finishRun({ request, matched, unmatched }));
      return {
        title: finished.title,
        suggestions: finished.suggestions,
        unmatched: finished.unmatched,
        matched: matched.length,
        asked: finished.asked,
        filteredOut: finished.filteredOut,
        initialCount: finished.suggestions.length,
        reopened: false,
        pregenerated: !live,
      };
    },
    // Refreshes "Earlier suggestions" with the run that was just saved.
    onSuccess: () => router.refresh(),
    onError: (error) => {
      if (!(error instanceof DiscoverFailure)) console.error(error);
    },
  });

  // A saved run doesn't change, so reopening it is a cached read.
  const earlierRun = useQuery({
    queryKey: queryKeys.discover.generation(openId ?? ""),
    queryFn: async (): Promise<RunView> => {
      const run = unwrapResult(await openGeneration(openId));
      return {
        title: run.title,
        suggestions: run.suggestions,
        unmatched: run.unmatched,
        matched: null,
        asked: null,
        filteredOut: 0,
        initialCount: run.suggestions.length,
        reopened: true,
        pregenerated: false,
      };
    },
    enabled: openId !== null,
    retry: retryUnexpected,
    // Switching between earlier runs keeps the previous one on screen while the next loads.
    placeholderData: keepPreviousData,
  });

  const openingId = openId !== null && earlierRun.isFetching ? openId : null;
  const openFailed = openId !== null && earlierRun.isError;
  const busy = pipeline.isPending || openingId !== null;
  const lastRequest = pipeline.variables ?? null;

  const run = (request: DiscoverRequest) => {
    setOpenId(null);
    setRemoved(new Set());
    setProgress(startProgress);
    pipeline.mutate(request);
  };

  const submit = () => {
    const request = toRequest(form);
    if (request) run(request);
  };

  const reopen = (id: string) => {
    setRemoved(new Set());
    if (id === openId) void earlierRun.refetch();
    else setOpenId(id);
  };

  const remove = (trackId: string) => setRemoved((current) => new Set(current).add(trackId));

  const withoutRemoved = (view: RunView): RunView => ({
    ...view,
    suggestions: view.suggestions.filter((s) => !removed.has(s.track.id)),
  });

  // Until an earlier run has loaded, the latest new run (or its progress) stays on screen.
  const reopened = openId !== null ? earlierRun.data : undefined;
  const results = (view: RunView) => (
    <RunResults
      // A new run starts with fresh notices and dialog state.
      key={`${view.title}-${view.initialCount}-${view.reopened}`}
      run={withoutRemoved(view)}
      onRemove={remove}
      onRegenerate={() => lastRequest && run(lastRequest)}
      canRegenerate={lastRequest !== null && !view.reopened}
      canWrite={canWrite}
      editablePlaylists={editablePlaylists}
    />
  );

  return (
    <>
      <RequestForm
        form={form}
        onChange={setForm}
        onSubmit={submit}
        playlists={playlists}
        busy={busy}
        note={note}
      />

      {reopened
        ? results(reopened)
        : match(pipeline)
            .with({ status: "idle" }, () => null)
            .with({ status: "pending" }, () => <Progress phase={progress} />)
            .with({ status: "error" }, ({ error }) => {
              const reason = discoverErrorOf(error);
              return (
                <StatePanel
                  tone="error"
                  title={t(`errors.${reason}.title`)}
                  body={t(`errors.${reason}.body`)}
                  action={
                    <Button
                      type="button"
                      onClick={() => lastRequest && run(lastRequest)}
                      className={buttonClass("primary", "sm")}
                    >
                      {t("errors.retry")}
                    </Button>
                  }
                />
              );
            })
            .with({ status: "success" }, ({ data }) => results(data))
            .exhaustive()}

      <section aria-labelledby="discover-earlier" className="flex flex-col gap-2.5">
        <h2 id="discover-earlier" className={heading.h3}>
          {t("earlier.title")}
        </h2>
        {openFailed ? (
          <p role="alert" className="m-0 text-danger text-sm">
            {t("earlier.loadFailed")}
          </p>
        ) : null}
        {earlier.length === 0 ? (
          <p className={`${cardFlat} m-0 text-muted text-sm`}>{t("earlier.empty")}</p>
        ) : (
          <ul className="m-0 grid list-none gap-4 p-0 md:grid-cols-3">
            {earlier.map((item) => (
              <li key={item.id}>
                <Button
                  type="button"
                  disabled={busy}
                  aria-busy={openingId === item.id}
                  onClick={() => reopen(item.id)}
                  className={`${cardFlat} flex w-full cursor-pointer flex-col gap-1.5 text-left text-ink disabled:cursor-wait aria-busy:opacity-60`}
                >
                  <span className="eyebrow">{item.when}</span>
                  <b className="truncate">{item.title}</b>
                  <span className="text-muted text-sm">
                    {item.unmatchedCount > 0
                      ? t("earlier.metaUnmatched", {
                          count: item.trackCount,
                          unmatched: item.unmatchedCount,
                        })
                      : t("earlier.meta", { count: item.trackCount })}
                  </span>
                </Button>
              </li>
            ))}
          </ul>
        )}
      </section>
    </>
  );
}

function Progress({ phase }: { phase: RunProgress }) {
  const t = useTranslations("discover.progress");
  const asked = phase.asked;
  const done = <span className={chipClass("mint")}>{t("done")}</span>;
  const pending = (
    <span className={chipClass("butter")} aria-hidden="true">
      …
    </span>
  );
  const matchDone = phase.step === Step.Finish;
  const percent = asked ? Math.round((phase.matched / asked) * 100) : 0;
  const row = "flex flex-wrap items-center gap-3 border-line border-b py-3 last:border-b-0";

  return (
    <section aria-live="polite" aria-busy="true" className={`${card} flex flex-col gap-3.5`}>
      <h2 className={heading.h2}>{t("title")}</h2>
      <ol className="m-0 list-none p-0">
        <li className={row}>
          {phase.profilePlays === null ? pending : done}
          <span>
            {phase.profilePlays === null
              ? t("profilePending")
              : t("profile", { plays: phase.profilePlays })}
          </span>
        </li>
        <li className={row}>
          {asked === null ? pending : done}
          <span>
            {asked === null
              ? t("askPending")
              : phase.live
                ? t("ask", { count: asked })
                : t("askDemo", { count: asked })}
          </span>
        </li>
        {asked !== null ? (
          <li className={row}>
            {matchDone ? (
              done
            ) : (
              <span className={chipClass("butter")}>{`${phase.matched} / ${asked}`}</span>
            )}
            <span>{t("match")}</span>
            <span
              role="progressbar"
              aria-label={t("match")}
              aria-valuemin={0}
              aria-valuemax={asked}
              aria-valuenow={phase.matched}
              className="relative block h-1.5 max-w-60 grow overflow-hidden rounded-full bg-line"
            >
              <span
                className="absolute inset-y-0 left-0 rounded-full bg-ink transition-[width] motion-reduce:transition-none"
                style={{ width: `${percent}%` }}
              />
            </span>
          </li>
        ) : null}
        {matchDone ? (
          <li className={row}>
            {pending}
            <span>{t("finish")}</span>
          </li>
        ) : null}
      </ol>
      <div aria-hidden="true" className="flex flex-col gap-2.5">
        {[0, 1, 2, 3].map((i) => (
          <div key={i} className="flex items-center gap-3">
            <Skeleton className="size-12 shrink-0" />
            <div className="flex grow flex-col gap-2">
              <Skeleton className="h-3 w-2/5" />
              <Skeleton className="h-2.5 w-3/4" />
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}
