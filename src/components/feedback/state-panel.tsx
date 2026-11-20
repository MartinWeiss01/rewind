import { CircleAlertIcon, ClockIcon } from "lucide-react";
import type { ReactNode } from "react";

type Tone = "neutral" | "error";

/** Centered empty, error or not-found message inside a card. */
export function StatePanel({
  tone = "neutral",
  title,
  body,
  action,
}: {
  tone?: Tone;
  title: string;
  body: string;
  action?: ReactNode;
}) {
  return (
    <div
      role={tone === "error" ? "alert" : undefined}
      className="flex min-h-[220px] flex-col items-center justify-center gap-3 rounded-3xl border border-line bg-surface px-5 py-10 text-center"
    >
      <span
        aria-hidden="true"
        className={`grid size-14 place-items-center rounded-full ${tone === "error" ? "bg-danger-soft text-danger" : "bg-surface-2 text-ink-2"}`}
      >
        {tone === "error" ? (
          <CircleAlertIcon size={26} aria-hidden="true" />
        ) : (
          <ClockIcon size={26} aria-hidden="true" />
        )}
      </span>
      <b>{title}</b>
      <span className="text-muted text-sm">{body}</span>
      {action}
    </div>
  );
}
