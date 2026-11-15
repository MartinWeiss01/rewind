/** Class recipes shared by the statistics screens (dashboard, history, recap). */

/** Big tabular display numbers. */
export const num = "font-display font-extrabold tabular-nums tracking-[-0.03em]";

/** Organic background shapes; always decorative. */
export const blob = "pointer-events-none absolute rounded-[46%_54%_58%_42%/48%_38%_62%_52%]";
export const blobLine = `${blob} border-[1.5px] border-ink opacity-85`;

/** Thin decorative lines across the poster cards. */
export const rule = "pointer-events-none absolute h-px origin-left bg-line-strong";

/** Card header: title on the left, controls or a hint on the right. */
export const cardHeader = "mb-4 flex flex-wrap items-center justify-between gap-3";

export const listRow =
  "flex min-w-0 items-center gap-3.5 border-line border-b px-1 py-2.5 last:border-b-0";
export const rank = "w-[26px] flex-none text-right font-mono text-muted text-xs";
