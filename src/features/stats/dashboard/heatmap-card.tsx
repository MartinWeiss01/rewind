import { getFormatter, getTranslations } from "next-intl/server";
import { card, heading } from "@/components/ui/styles";
import type { Heatmap } from "../engine";
import { hourLabel, weekdayLabel } from "../labels";
import { cardHeader } from "../ui";

/** Cell colour: surface for quiet hours, then violet mixed in by share of the busiest hour. */
function cellColor(value: number, max: number): string {
  if (max === 0 || value === 0) return "var(--surface-2)";
  const share = Math.max(0.15, value / max);
  return `color-mix(in oklab, var(--violet) ${Math.round(share * 100)}%, var(--surface-2))`;
}

/** "When you listen": plays by weekday and hour in the listener's time zone. */
export async function HeatmapCard({ heatmap }: { heatmap: Heatmap }) {
  const t = await getTranslations("dashboard");
  const format = await getFormatter();
  const peak = heatmap.peak
    ? t("peak", {
        day: weekdayLabel(format, heatmap.peak.weekday),
        time: hourLabel(format, heatmap.peak.hour),
      })
    : t("noPeak");

  return (
    <section aria-labelledby="heat-title" className={`${card} md:col-span-2`}>
      <div className={cardHeader}>
        <h2 id="heat-title" className={heading.h2}>
          {t("when")}
        </h2>
        <span className="eyebrow">{peak}</span>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[520px] border-separate border-spacing-[3px] text-[10px]">
          <caption className="sr-only">{t("heatmapCaption")}</caption>
          <thead>
            <tr>
              <td />
              {Array.from({ length: 24 }, (_, hour) => (
                <th
                  // biome-ignore lint/suspicious/noArrayIndexKey: fixed 24-hour axis
                  key={hour}
                  scope="col"
                  className="p-0 text-center font-mono font-normal text-muted"
                >
                  <span className={hour % 3 === 0 ? undefined : "sr-only"}>
                    {hourLabel(format, hour)}
                  </span>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {heatmap.cells.map((row, weekday) => {
              const day = weekdayLabel(format, weekday);
              return (
                // biome-ignore lint/suspicious/noArrayIndexKey: fixed Monday..Sunday rows
                <tr key={weekday}>
                  <th scope="row" className="w-9 pr-1 text-left font-mono font-normal text-muted">
                    {day}
                  </th>
                  {row.map((value, hour) => {
                    const label = t("cellTitle", {
                      day,
                      time: hourLabel(format, hour),
                      count: value,
                    });
                    return (
                      <td
                        // biome-ignore lint/suspicious/noArrayIndexKey: fixed 24-hour axis
                        key={hour}
                        title={label}
                        className="aspect-square rounded-[4px] p-0"
                        style={{ background: cellColor(value, heatmap.max) }}
                      >
                        <span className="sr-only">{label}</span>
                      </td>
                    );
                  })}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </section>
  );
}
