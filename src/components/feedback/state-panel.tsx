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
        <svg
          width="26"
          height="26"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          aria-hidden="true"
        >
          <circle cx="12" cy="12" r="9" />
          <path d={tone === "error" ? "M12 8v5M12 16.5v.5" : "M12 7v5l3 2"} />
        </svg>
      </span>
      <b>{title}</b>
      <span className="text-muted text-sm">{body}</span>
      {action}
    </div>
  );
}
