import type { ComponentProps } from "react";

/** Purely visual placeholder (ADR 0001). Wrap groups in an element with aria-busy. */
export function Skeleton({ className = "", ...props }: ComponentProps<"span">) {
  return (
    <span
      aria-hidden="true"
      className={`block animate-shimmer rounded-[10px] bg-[linear-gradient(90deg,var(--skel)_0%,var(--skel-hi)_50%,var(--skel)_100%)] bg-size-[200%_100%] motion-reduce:animate-none ${className}`}
      {...props}
    />
  );
}
