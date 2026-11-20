import { RewindIcon } from "lucide-react";
import type { CSSProperties, Ref } from "react";
import { match } from "ts-pattern";
import { Cover } from "@/components/ui/cover";
import type { RecapData } from "./load-recap";

export const ExportFormat = { Story: "story", Square: "square" } as const;
export type ExportFormat = (typeof ExportFormat)[keyof typeof ExportFormat];

export const ExportTheme = { Paper: "paper", Tape: "tape" } as const;
export type ExportTheme = (typeof ExportTheme)[keyof typeof ExportTheme];

/** Pixel size of the exported PNG: 9:16 for stories, 1:1 for feeds. */
export function exportSize(format: ExportFormat): { width: number; height: number } {
  return match(format)
    .with(ExportFormat.Story, () => ({ width: 1080, height: 1920 }))
    .with(ExportFormat.Square, () => ({ width: 1080, height: 1080 }))
    .exhaustive();
}

/**
 * Fixed colours: the image must look the same whatever the page's colour scheme is,
 * so this card doesn't use the theme's CSS variables.
 */
const palettes = {
  paper: {
    bg: "#F3ECDF",
    ink: "#17140F",
    muted: "#615A4F",
    arcs: ["#D9CFFF", "#FFC9BB", "#FCEBA6"],
  },
  tape: {
    bg: "#13110E",
    ink: "#F3ECDF",
    muted: "#A89F90",
    arcs: ["#3A2F6E", "#5A2A20", "#4A3F14"],
  },
} as const satisfies Record<
  ExportTheme,
  { bg: string; ink: string; muted: string; arcs: readonly string[] }
>;

export type ExportLabels = {
  title: string;
  topTrack: string;
  topArtist: string;
  minutes: string;
  streak: string;
  minutesValue: string;
  streakValue: string;
};

/** The image itself, rendered at full export size; the dialog scales it down for the preview. */
export function ExportCard({
  ref,
  data,
  shape,
  theme,
  showName,
  labels,
}: {
  ref?: Ref<HTMLDivElement>;
  data: RecapData;
  shape: ExportFormat;
  theme: ExportTheme;
  showName: boolean;
  labels: ExportLabels;
}) {
  const size = exportSize(shape);
  const colors = palettes[theme];
  const story = shape === ExportFormat.Story;
  const topTrack = data.topTracks[0];
  const arc = (color: string, width: string, left: string): CSSProperties => ({
    position: "absolute",
    bottom: -80,
    left,
    width,
    aspectRatio: "2 / 1.2",
    borderRadius: "999px 999px 0 0",
    background: color,
  });

  const stats = [
    [labels.topTrack, topTrack?.name ?? "–"],
    [labels.topArtist, data.topArtist?.name ?? "–"],
    [labels.minutes, labels.minutesValue],
    [labels.streak, labels.streakValue],
  ] as const;

  return (
    <div
      ref={ref}
      className="font-sans"
      style={{
        width: size.width,
        height: size.height,
        background: colors.bg,
        color: colors.ink,
        position: "relative",
        overflow: "hidden",
        display: "flex",
        flexDirection: "column",
        gap: 28,
        padding: 72,
        boxSizing: "border-box",
      }}
    >
      <div aria-hidden="true" style={arc(colors.arcs[0], "140%", "-20%")} />
      <div aria-hidden="true" style={arc(colors.arcs[1], "90%", "5%")} />
      {story ? <div aria-hidden="true" style={arc(colors.arcs[2], "50%", "25%")} /> : null}
      <div
        className="font-display"
        style={{
          position: "relative",
          display: "flex",
          alignItems: "center",
          gap: 14,
          fontWeight: 800,
          fontSize: 40,
        }}
      >
        <RewindIcon size={40} fill="currentColor" aria-hidden="true" />
        Rewind
      </div>
      {showName ? (
        <div style={{ position: "relative", fontSize: 32, color: colors.muted }}>
          {data.displayName}
        </div>
      ) : null}
      <div
        className="font-display"
        style={{
          position: "relative",
          fontWeight: 800,
          fontSize: story ? 112 : 92,
          lineHeight: 0.95,
          letterSpacing: "-0.03em",
        }}
      >
        {labels.title}
      </div>
      {topTrack ? (
        <div style={{ position: "relative", alignSelf: "center", marginTop: story ? 48 : 0 }}>
          <Cover cover={topTrack.cover} size={story ? 520 : 300} />
        </div>
      ) : null}
      <dl
        style={{
          position: "relative",
          marginTop: "auto",
          marginBottom: 0,
          display: "grid",
          gridTemplateColumns: story ? "1fr 1fr" : "1fr 1fr 1fr 1fr",
          gap: 28,
          fontSize: story ? 34 : 28,
        }}
      >
        {stats.map(([label, value]) => (
          <div key={label}>
            <dt style={{ fontWeight: 700 }}>{label}</dt>
            <dd style={{ margin: 0 }}>{value}</dd>
          </div>
        ))}
      </dl>
    </div>
  );
}
