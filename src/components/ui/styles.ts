/** Class recipes matching the approved design. Use with ui-sdk parts or plain elements. */
export const button = {
  base: "inline-flex cursor-pointer items-center justify-center gap-2 whitespace-nowrap rounded-full border border-transparent font-semibold text-sm leading-none no-underline disabled:cursor-not-allowed disabled:opacity-50 data-pending:opacity-70",
  size: {
    md: "min-h-11 px-5",
    sm: "min-h-9 px-3.5 text-[13px]",
    lg: "min-h-[52px] px-7 text-[15px]",
  },
  variant: {
    primary: "bg-ink text-on-ink",
    secondary: "border-line-strong bg-transparent text-ink",
    ghost: "bg-transparent text-ink-2 hover:bg-surface-2",
    danger: "bg-danger text-on-ink",
  },
} as const;

export const buttonClass = (
  variant: keyof typeof button.variant = "primary",
  size: keyof typeof button.size = "md",
  extra = "",
) => `${button.base} ${button.size[size]} ${button.variant[variant]} ${extra}`;

export const card =
  "relative min-w-0 overflow-clip rounded-3xl border border-line bg-surface p-[22px] shadow-[0_1px_0_rgba(23,20,15,.04),0_24px_48px_-24px_rgba(60,40,10,.22)]";
export const cardFlat =
  "relative min-w-0 overflow-clip rounded-3xl border border-line bg-surface p-[22px]";

export const chip = {
  base: "inline-flex h-7 items-center gap-1.5 rounded-full border px-3 font-semibold text-ink-2 text-xs",
  tone: {
    neutral: "border-line bg-surface-2",
    violet: "border-transparent bg-violet-soft text-ink",
    coral: "border-transparent bg-coral-soft text-ink",
    butter: "border-transparent bg-butter-soft text-ink",
    mint: "border-transparent bg-mint-soft text-ink",
  },
} as const;

export const chipClass = (tone: keyof typeof chip.tone = "neutral", extra = "") =>
  `${chip.base} ${chip.tone[tone]} ${extra}`;

export const heading = {
  display: "m-0 font-display font-extrabold leading-[0.95] tracking-tighter",
  h1: "m-0 font-display font-extrabold text-[40px] leading-[1.05] tracking-tight",
  h2: "m-0 font-display font-bold text-2xl tracking-tight",
  h3: "m-0 font-semibold text-[15px]",
} as const;

export const tabs = {
  list: "flex flex-wrap gap-1 border-line border-b",
  tab: "-mb-px min-h-11 cursor-pointer border-transparent border-b-2 bg-transparent px-3.5 font-medium text-muted text-sm data-selected:border-ink data-selected:text-ink",
} as const;

export const alert = {
  base: "flex items-start gap-3 rounded-2xl border px-4 py-3.5 text-sm",
  tone: {
    neutral: "border-line bg-surface-2",
    danger: "border-transparent bg-danger-soft",
    info: "border-transparent bg-violet-soft",
  },
} as const;
