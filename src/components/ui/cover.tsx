import type { Cover as CoverData } from "@/domain/music";

type Shape = "square" | "round";

/**
 * Artwork for a track, album, playlist or artist. Real images come from Spotify's CDN;
 * generated covers (demo, missing art) are one of eight patterns picked by seed.
 */
export function Cover({
  cover,
  size = 44,
  shape = "square",
  className = "",
}: {
  cover: CoverData | null;
  size?: number;
  shape?: Shape;
  className?: string;
}) {
  const radius = shape === "round" ? "rounded-full" : size >= 120 ? "rounded-2xl" : "rounded-lg";
  const box = `relative shrink-0 overflow-hidden ${radius} ${className}`;
  if (cover?.kind === "image") {
    return (
      // Spotify artwork is already sized by the CDN; next/image would only add a proxy hop.
      // biome-ignore lint/performance/noImgElement: see comment above
      <img
        src={cover.url}
        alt=""
        width={size}
        height={size}
        loading="lazy"
        className={`${box} object-cover`}
        style={{ width: size, height: size }}
      />
    );
  }
  const pattern = cover ? cover.seed % 8 : 0;
  return (
    <span
      aria-hidden="true"
      className={`${box} block cover-pattern-${pattern}`}
      style={{ width: size, height: size }}
    />
  );
}
