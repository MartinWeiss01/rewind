/** Class recipes shared by the playlist screens and their dialogs. */

export const dialogBackdrop =
  "fixed inset-0 z-40 bg-[rgba(23,20,15,.42)] transition-opacity duration-150 data-ending-style:opacity-0 data-starting-style:opacity-0 motion-reduce:transition-none";

export const dialogContent =
  "fixed inset-0 z-50 m-auto flex h-fit max-h-[calc(100dvh-48px)] w-[calc(100%-32px)] max-w-[720px] flex-col gap-5 overflow-auto rounded-[28px] border border-line bg-surface p-[26px] text-ink shadow-[0_40px_80px_-30px_rgba(0,0,0,.5)] transition-[opacity,scale] duration-150 data-ending-style:scale-96 data-ending-style:opacity-0 data-starting-style:scale-96 data-starting-style:opacity-0 motion-reduce:transition-none";

export const dialogTitle = "m-0 font-display font-bold text-2xl tracking-tight";

export const fieldLabel = "font-semibold text-ink-2 text-sm";
export const fieldHint = "text-muted text-xs";

export const input =
  "min-h-11 w-full rounded-xl border border-line-strong bg-surface px-3.5 text-ink text-sm placeholder:text-muted";

export const textarea =
  "min-h-20 w-full rounded-xl border border-line-strong bg-surface px-3.5 py-2.5 text-ink text-sm placeholder:text-muted";

export const switchRoot =
  "relative inline-flex h-[26px] w-11 shrink-0 cursor-pointer rounded-full border-0 bg-line-strong transition-colors data-checked:bg-ink data-disabled:cursor-not-allowed data-disabled:opacity-50";
export const switchThumb =
  "absolute top-[3px] left-[3px] size-5 rounded-full bg-surface transition-[left] duration-200 data-checked:left-[21px] motion-reduce:transition-none";

export const checkbox =
  "grid size-[18px] shrink-0 cursor-pointer place-items-center rounded-[5px] border-[1.5px] border-line-strong bg-surface text-on-ink aria-checked:border-ink aria-checked:bg-ink aria-[checked=mixed]:border-ink aria-[checked=mixed]:bg-ink";

export const popup =
  "z-50 flex min-w-[220px] flex-col rounded-[18px] border border-line bg-surface p-1.5 text-ink shadow-[0_24px_48px_-24px_rgba(60,40,10,.35)]";
export const popupItem =
  "flex w-full cursor-pointer flex-col items-start gap-0.5 rounded-xl px-3 py-2 text-left text-sm data-disabled:cursor-not-allowed data-highlighted:bg-surface-2 data-disabled:opacity-50";

export const table = "w-full min-w-[720px] border-collapse text-sm";
export const tableBox = "overflow-x-auto rounded-[18px] border border-line bg-surface";
export const th =
  "whitespace-nowrap border-line border-b px-3.5 py-3 text-left font-mono font-semibold text-[11px] text-muted uppercase tracking-[0.1em]";
export const td = "border-line border-b px-3.5 py-2.5 align-middle";
