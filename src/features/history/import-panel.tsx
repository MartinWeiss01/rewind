"use client";

import { Button } from "@ui-sdk/react/button";
import { Collapsible, CollapsiblePanel, CollapsibleTrigger } from "@ui-sdk/react/collapsible";
import {
  FileInput,
  FileInputDropzone,
  FileInputTrigger,
  type FileRejection,
} from "@ui-sdk/react/file-input";
import { Progress, ProgressIndicator, ProgressTrack } from "@ui-sdk/react/progress";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useFormatter, useTranslations } from "next-intl";
import { type ReactNode, useRef, useState } from "react";
import { match } from "ts-pattern";
import { ScreenHeader } from "@/components/feedback/screen-header";
import { alert, buttonClass, card, chipClass, heading } from "@/components/ui/styles";
import { blob, num } from "@/features/stats/ui";
import { importHistoryFile, importSampleHistory } from "./actions";
import {
  ImportFileError,
  MAX_IMPORT_FILE_BYTES,
  MAX_IMPORT_FILES,
  precheckHistoryFile,
} from "./import-file";
import { addTotals, emptyTotals, type ImportResult, type ImportTotals } from "./import-result";

type ErrorCode = ImportFileError | "forbidden" | "tooMany";
type FileState =
  | { name: string; state: "waiting" | "importing" }
  | { name: string; state: "done"; added: number }
  | { name: string; state: "failed"; error: ErrorCode };

type Phase =
  | { kind: "idle" }
  | { kind: "importing"; files: FileState[] }
  | { kind: "done"; totals: ImportTotals; failed: { name: string; error: ErrorCode }[] }
  | { kind: "error"; name: string; error: ErrorCode };

const errorKey = (error: ErrorCode) =>
  match(error)
    .with(ImportFileError.Zip, () => "zip" as const)
    .with(ImportFileError.NotJson, () => "notJson" as const)
    .with(ImportFileError.NotHistory, () => "notHistory" as const)
    .with(ImportFileError.TooLarge, () => "tooLarge" as const)
    .with(ImportFileError.Empty, () => "empty" as const)
    .with("tooMany", () => "tooMany" as const)
    .with(ImportFileError.Failed, "forbidden", () => "failed" as const)
    .exhaustive();

function rejectionError(rejection: FileRejection): ErrorCode {
  const precheck = precheckHistoryFile(rejection.file.name, rejection.file.size);
  if (precheck) return precheck;
  if (rejection.reasons.includes("too-many-files")) return "tooMany";
  return ImportFileError.NotJson;
}

function Icon({ path, size = 20 }: { path: string; size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      aria-hidden="true"
    >
      <path d={path} />
    </svg>
  );
}

const fileIcon = "M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8zM14 3v5h5";

/**
 * Screen header with the "Import history" button and the collapsible import panel.
 * Files go to the server one per action call, so each stays under the body size limit
 * and progress can be shown per file.
 */
export function ImportPanel({
  eyebrow,
  title,
  status,
  isDemo,
}: {
  eyebrow: string;
  title: string;
  status?: ReactNode;
  isDemo: boolean;
}) {
  const t = useTranslations("history.import");
  const format = useFormatter();
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [phase, setPhase] = useState<Phase>({ kind: "idle" });
  const [files, setFiles] = useState<File[]>([]);
  const cancelled = useRef(false);

  async function run(jobs: { name: string; send: () => Promise<ImportResult> }[]) {
    cancelled.current = false;
    const states: FileState[] = jobs.map((job) => ({ name: job.name, state: "waiting" }));
    setPhase({ kind: "importing", files: [...states] });
    let totals = emptyTotals;
    const failed: { name: string; error: ErrorCode }[] = [];
    for (const [i, job] of jobs.entries()) {
      if (cancelled.current) break;
      states[i] = { name: job.name, state: "importing" };
      setPhase({ kind: "importing", files: [...states] });
      let result: ImportResult;
      try {
        result = await job.send();
      } catch {
        result = { ok: false, error: ImportFileError.Failed };
      }
      if (result.ok) {
        totals = addTotals(totals, result.totals);
        states[i] = { name: job.name, state: "done", added: result.totals.added };
      } else {
        failed.push({ name: job.name, error: result.error });
        states[i] = { name: job.name, state: "failed", error: result.error };
      }
      setPhase({ kind: "importing", files: [...states] });
    }
    setFiles([]);
    const firstFailure = failed[0];
    if (totals.files === 0 && firstFailure) {
      setPhase({ kind: "error", ...firstFailure });
    } else {
      setPhase({ kind: "done", totals, failed });
    }
    router.refresh();
  }

  function startFiles(chosen: File[]) {
    if (chosen.length === 0) return;
    void run(
      chosen.map((file) => ({
        name: file.name,
        send: async () => {
          const early = precheckHistoryFile(file.name, file.size);
          if (early) return { ok: false, error: early };
          const data = new FormData();
          data.set("file", file);
          return importHistoryFile(data);
        },
      })),
    );
  }

  const reset = () => {
    setFiles([]);
    setPhase({ kind: "idle" });
  };

  const dateRange = (totals: ImportTotals) =>
    totals.firstPlayedAt && totals.lastPlayedAt
      ? format.dateTimeRange(new Date(totals.firstPlayedAt), new Date(totals.lastPlayedAt), {
          month: "short",
          year: "numeric",
        })
      : t("noNewPlays");

  return (
    <Collapsible open={open} onOpenChange={setOpen} className="flex flex-col gap-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <ScreenHeader eyebrow={eyebrow} title={title} />
        <div className="flex flex-wrap items-center gap-2.5">
          {status}
          <CollapsibleTrigger className={buttonClass("primary")}>
            <Icon path="M12 15V3M7 8l5-5 5 5M4 15v4a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-4" size={18} />
            {t("open")}
          </CollapsibleTrigger>
        </div>
      </div>

      <CollapsiblePanel
        render={<section aria-labelledby="import-title" />}
        className={`${card} flex flex-col gap-[18px]`}
      >
        <div
          aria-hidden="true"
          className={`${blob} -top-[50px] -right-10 h-[150px] w-[180px] bg-butter-soft`}
        />
        <div className="relative flex items-start justify-between gap-3">
          <div>
            <h2 id="import-title" className={heading.h2}>
              {t("title")}
            </h2>
            <p className="m-0 mt-1.5 text-muted text-sm">
              {t.rich("howTo", { file: (chunks) => <span className="font-mono">{chunks}</span> })}
            </p>
          </div>
          <Button
            aria-label={t("close")}
            onClick={() => setOpen(false)}
            className={buttonClass("ghost", "sm", "size-9 px-0")}
          >
            <Icon path="M6 6l12 12M18 6L6 18" size={18} />
          </Button>
        </div>

        {match(phase)
          .with({ kind: "idle" }, () => (
            <>
              <FileInput
                multiple
                accept={[".json", "application/json"]}
                maxFiles={MAX_IMPORT_FILES}
                maxSize={MAX_IMPORT_FILE_BYTES}
                value={files}
                onValueChange={(value) => {
                  setFiles(value);
                  startFiles(value);
                }}
                onReject={(rejected) => {
                  const first = rejected[0];
                  if (first)
                    setPhase({
                      kind: "error",
                      name: first.file.name,
                      error: rejectionError(first),
                    });
                }}
                announcement={() => null}
              >
                <FileInputDropzone className="relative flex flex-col items-center gap-2.5 rounded-[20px] border-2 border-line-strong border-dashed bg-surface-2 px-5 py-9 text-center data-dragging:border-ink">
                  <Icon path={`${fileIcon}M12 18v-6M9 15l3-3 3 3`} size={34} />
                  <b>{t("dropTitle")}</b>
                  <span className="text-muted text-sm">{t("dropHint")}</span>
                  <FileInputTrigger className={buttonClass("secondary", "sm")}>
                    {t("choose")}
                  </FileInputTrigger>
                </FileInputDropzone>
              </FileInput>
              {isDemo ? (
                <div className={`${alert.base} ${alert.tone.info} items-center`}>
                  <span className={chipClass("neutral", "border-0 bg-ink text-on-ink")}>
                    {t("demoChip")}
                  </span>
                  <span className="grow">{t("demoHint")}</span>
                  <Button
                    onClick={() =>
                      run([
                        {
                          name: "Streaming_History_Audio_sample.json",
                          send: () => importSampleHistory(),
                        },
                      ])
                    }
                    className={buttonClass("primary", "sm")}
                  >
                    {t("useSample")}
                  </Button>
                </div>
              ) : null}
            </>
          ))
          .with({ kind: "importing" }, ({ files: states }) => {
            const finished = states.filter(
              (file) => file.state === "done" || file.state === "failed",
            ).length;
            return (
              <>
                <Progress value={finished} max={states.length} aria-label={t("overall")}>
                  <ProgressTrack className="h-2 overflow-hidden rounded-full bg-surface-2">
                    <ProgressIndicator className="block h-full w-(--progress-value) rounded-full bg-violet transition-[width] motion-reduce:transition-none" />
                  </ProgressTrack>
                </Progress>
                <ul aria-live="polite" className="m-0 flex list-none flex-col p-0">
                  {states.map((file, i) => (
                    <li
                      // biome-ignore lint/suspicious/noArrayIndexKey: two files may share a name
                      key={i}
                      className="flex items-center gap-4 border-line border-b py-2.5 last:border-b-0"
                    >
                      <Icon path={fileIcon} size={22} />
                      <div className="flex grow flex-col gap-1.5">
                        <div className="flex flex-wrap justify-between gap-2">
                          <span className="break-all font-mono text-sm">{file.name}</span>
                          <span className="text-muted text-sm">
                            {match(file)
                              .with({ state: "waiting" }, () => t("waiting"))
                              .with({ state: "importing" }, () => t("importing"))
                              .with({ state: "done" }, ({ added }) =>
                                t("fileDone", { count: added }),
                              )
                              .with({ state: "failed" }, ({ error }) =>
                                t(`errors.${errorKey(error)}.short`),
                              )
                              .exhaustive()}
                          </span>
                        </div>
                        <Progress
                          value={match(file.state)
                            .with("waiting", () => 0)
                            .with("importing", () => null)
                            .with("done", "failed", () => 100)
                            .exhaustive()}
                          aria-label={file.name}
                        >
                          <ProgressTrack className="h-2 overflow-hidden rounded-full bg-surface-2">
                            <ProgressIndicator
                              className={`block h-full w-(--progress-value) rounded-full data-indeterminate:w-1/3 data-indeterminate:animate-pulse ${file.state === "failed" ? "bg-danger" : file.state === "done" ? "bg-mint" : "bg-ink"}`}
                            />
                          </ProgressTrack>
                        </Progress>
                      </div>
                    </li>
                  ))}
                </ul>
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <span className="text-muted text-sm">{t("keepOpen")}</span>
                  <Button
                    onClick={() => (cancelled.current = true)}
                    className={buttonClass("secondary", "sm")}
                  >
                    {t("cancel")}
                  </Button>
                </div>
              </>
            );
          })
          .with({ kind: "done" }, ({ totals, failed }) => (
            <>
              <div role="status">
                <dl className="m-0 grid grid-cols-2 gap-3 md:grid-cols-4">
                  {[
                    { label: t("summary.files"), value: totals.files, sub: null },
                    { label: t("summary.added"), value: totals.added, sub: dateRange(totals) },
                    {
                      label: t("summary.duplicates"),
                      value: totals.duplicates,
                      sub: t("summary.duplicatesHint"),
                    },
                    {
                      label: t("summary.skipped"),
                      value: totals.skipped,
                      sub: t("summary.skippedHint"),
                    },
                  ].map((item) => (
                    <div
                      key={item.label}
                      className="rounded-3xl border border-line bg-surface-2 p-4"
                    >
                      <dt className="eyebrow">{item.label}</dt>
                      <dd className="m-0">
                        <div className={`${num} mt-1.5 text-[34px] leading-none`}>
                          {format.number(item.value)}
                        </div>
                        {item.sub ? (
                          <div className="mt-1 text-muted text-sm">{item.sub}</div>
                        ) : null}
                      </dd>
                    </div>
                  ))}
                </dl>
              </div>
              {failed.length > 0 ? (
                <div role="alert" className={`${alert.base} ${alert.tone.danger}`}>
                  <span>
                    {t("someFailed", {
                      count: failed.length,
                      names: failed.map((f) => f.name).join(", "),
                    })}
                  </span>
                </div>
              ) : null}
              <div className={`${alert.base} ${alert.tone.neutral}`}>
                <Icon path="M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18zM12 11v5M12 7.5v.5" />
                <span>{t("notes")}</span>
              </div>
              <div className="flex flex-wrap gap-2.5">
                <Link href="/app" className={buttonClass("primary")}>
                  {t("seeStats")}
                </Link>
                <Button onClick={reset} className={buttonClass("ghost")}>
                  {t("importMore")}
                </Button>
              </div>
            </>
          ))
          .with({ kind: "error" }, ({ name, error }) => (
            <>
              <div role="alert" className={`${alert.base} ${alert.tone.danger}`}>
                <Icon path="M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18zM12 8v5M12 16.5v.5" />
                <div className="flex flex-col gap-1">
                  <b>{t(`errors.${errorKey(error)}.title`, { name })}</b>
                  <span>
                    {t.rich(`errors.${errorKey(error)}.body`, {
                      file: (chunks) => <span className="font-mono">{chunks}</span>,
                    })}
                  </span>
                </div>
              </div>
              <div>
                <Button onClick={reset} className={buttonClass("primary")}>
                  {t("chooseAgain")}
                </Button>
              </div>
            </>
          ))
          .exhaustive()}
      </CollapsiblePanel>
    </Collapsible>
  );
}
