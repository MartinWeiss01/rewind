"use client";

import { Button } from "@ui-sdk/react/button";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { useRef, useState } from "react";
import { match } from "ts-pattern";
import { Skeleton } from "@/components/feedback/skeleton";
import { StatePanel } from "@/components/feedback/state-panel";
import { buttonClass, card, cardFlat, chipClass, heading } from "@/components/ui/styles";
import { finishRun, matchCandidates, openGeneration, requestCandidates } from "../actions";
import {
  candidateLabel,
  type DiscoverError,
  type DiscoverRequest,
  matchBatchSize,
  type Suggestion,
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

type Phase =
  | { kind: "idle" }
  | {
      kind: "running";
      step: Step;
      profilePlays: number | null;
      asked: number | null;
      live: boolean;
      matched: number;
    }
  | { kind: "error"; error: DiscoverError; retry: () => void }
  | { kind: "results"; run: RunView };

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
  const [phase, setPhase] = useState<Phase>({ kind: "idle" });
  const [lastRequest, setLastRequest] = useState<DiscoverRequest | null>(null);
  const [openingId, setOpeningId] = useState<string | null>(null);
  const [openFailed, setOpenFailed] = useState(false);
  const runId = useRef(0);
  const busy = phase.kind === "running" || openingId !== null;

  const run = async (request: DiscoverRequest) => {
    const id = ++runId.current;
    const stale = () => id !== runId.current;
    const failWith = (error: DiscoverError) => {
      if (!stale()) setPhase({ kind: "error", error, retry: () => void run(request) });
    };
    setLastRequest(request);
    setPhase({
      kind: "running",
      step: Step.Ask,
      profilePlays: null,
      asked: null,
      live: true,
      matched: 0,
    });
    try {
      const first = await requestCandidates(request);
      if (stale()) return;
      if (!first.ok) return failWith(first.error);
      const { candidates, profilePlays, live } = first.data;
      const base = { kind: "running", profilePlays, asked: candidates.length, live } as const;
      setPhase({ ...base, step: Step.Match, matched: 0 });

      const matches: (Suggestion | null)[] = [];
      for (let start = 0; start < candidates.length; start += matchBatchSize) {
        const batch = candidates.slice(start, start + matchBatchSize);
        const result = await matchCandidates({ candidates: batch });
        if (stale()) return;
        if (!result.ok) return failWith(result.error);
        matches.push(...result.data);
        setPhase({ ...base, step: Step.Match, matched: matches.length });
      }

      setPhase({ ...base, step: Step.Finish, matched: matches.length });
      const matched = matches.flatMap((m) =>
        m ? [{ trackId: m.track.id, reason: m.reason, closestMatch: m.closestMatch }] : [],
      );
      const unmatched = candidates.flatMap((c, i) => (matches[i] ? [] : [candidateLabel(c)]));
      const finished = await finishRun({ request, matched, unmatched });
      if (stale()) return;
      if (!finished.ok) return failWith(finished.error);
      setPhase({
        kind: "results",
        run: {
          title: finished.data.title,
          suggestions: finished.data.suggestions,
          unmatched: finished.data.unmatched,
          matched: matched.length,
          asked: finished.data.asked,
          filteredOut: finished.data.filteredOut,
          initialCount: finished.data.suggestions.length,
          reopened: false,
          pregenerated: !live,
        },
      });
      // Refreshes "Earlier suggestions" with the run that was just saved.
      router.refresh();
    } catch (error) {
      console.error(error);
      failWith("unknown");
    }
  };

  const submit = () => {
    const request = toRequest(form);
    if (request) void run(request);
  };

  const reopen = async (id: string) => {
    runId.current += 1;
    setOpeningId(id);
    setOpenFailed(false);
    const result = await openGeneration(id).catch(() => null);
    setOpeningId(null);
    if (!result?.ok) {
      setOpenFailed(true);
      return;
    }
    setPhase({
      kind: "results",
      run: {
        title: result.data.title,
        suggestions: result.data.suggestions,
        unmatched: result.data.unmatched,
        matched: null,
        asked: null,
        filteredOut: 0,
        initialCount: result.data.suggestions.length,
        reopened: true,
        pregenerated: false,
      },
    });
  };

  const remove = (trackId: string) =>
    setPhase((current) =>
      current.kind === "results"
        ? {
            kind: "results",
            run: {
              ...current.run,
              suggestions: current.run.suggestions.filter((s) => s.track.id !== trackId),
            },
          }
        : current,
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

      {match(phase)
        .with({ kind: "idle" }, () => null)
        .with({ kind: "running" }, (running) => <Progress phase={running} />)
        .with({ kind: "error" }, ({ error, retry }) => (
          <StatePanel
            tone="error"
            title={t(`errors.${error}.title`)}
            body={t(`errors.${error}.body`)}
            action={
              <Button type="button" onClick={retry} className={buttonClass("primary", "sm")}>
                {t("errors.retry")}
              </Button>
            }
          />
        ))
        .with({ kind: "results" }, ({ run: view }) => (
          <RunResults
            // A new run starts with fresh notices and dialog state.
            key={`${view.title}-${view.initialCount}-${view.reopened}`}
            run={view}
            onRemove={remove}
            onRegenerate={() => lastRequest && void run(lastRequest)}
            canRegenerate={lastRequest !== null && !view.reopened}
            canWrite={canWrite}
            editablePlaylists={editablePlaylists}
          />
        ))
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
                  onClick={() => void reopen(item.id)}
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

function Progress({ phase }: { phase: Extract<Phase, { kind: "running" }> }) {
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
