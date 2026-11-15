import { Cover } from "@/components/ui/cover";
import type { Cover as CoverData } from "@/domain/music";

/**
 * A playlist's artwork as a 2×2 grid of its first album covers. Fewer than four
 * covers repeat; none shows a neutral placeholder.
 */
export function CoverMosaic({
  covers,
  size,
  className = "",
}: {
  covers: readonly CoverData[];
  /** Pixel size; omit to fill the parent's width as a square. */
  size?: number;
  className?: string;
}) {
  const style = size ? { width: size, height: size } : undefined;
  const radius = size && size < 80 ? "rounded-lg" : "rounded-[14px]";
  if (covers.length === 0) {
    return (
      <span
        aria-hidden="true"
        style={style}
        className={`block aspect-square shrink-0 bg-surface-2 ${radius} ${size ? "" : "w-full"} ${className}`}
      />
    );
  }
  const four = Array.from({ length: 4 }, (_, i) => covers[i % covers.length]);
  const cell = size ? Math.ceil(size / 2) : 160;
  return (
    <span
      aria-hidden="true"
      style={style}
      className={`grid aspect-square shrink-0 grid-cols-2 overflow-hidden ${radius} ${size ? "" : "w-full"} ${className}`}
    >
      {four.map((cover, i) => (
        <span
          // The four cells are positional and never reorder.
          // biome-ignore lint/suspicious/noArrayIndexKey: see comment above
          key={i}
          className="relative block overflow-hidden *:size-full! *:rounded-none!"
        >
          <Cover cover={cover ?? null} size={cell} />
        </span>
      ))}
    </span>
  );
}
