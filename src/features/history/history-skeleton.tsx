import { getTranslations } from "next-intl/server";
import { Skeleton } from "@/components/feedback/skeleton";

/** Loading state shaped like the history screen: header, filters and table rows. */
export async function HistorySkeleton() {
  const t = await getTranslations("states");
  return (
    <div aria-busy="true" className="flex flex-col gap-6">
      <span className="sr-only" role="status">
        {t("loading")}
      </span>
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div className="flex flex-col gap-2">
          <Skeleton className="h-3 w-56" />
          <Skeleton className="h-10 w-44" />
        </div>
        <Skeleton className="h-11 w-40 rounded-full" />
      </div>
      <div className="flex flex-wrap gap-2.5">
        <Skeleton className="h-11 min-w-[260px] flex-1 rounded-full" />
        <Skeleton className="h-11 w-72 rounded-full" />
        <Skeleton className="h-11 w-60 rounded-full" />
      </div>
      <div className="overflow-hidden rounded-[18px] border border-line bg-surface">
        {Array.from({ length: 8 }, (_, i) => (
          <div
            // biome-ignore lint/suspicious/noArrayIndexKey: static placeholder rows
            key={i}
            className="flex items-center gap-6 border-line border-b px-3.5 py-2.5 last:border-b-0"
          >
            <Skeleton className="h-3 w-24" />
            <Skeleton className="size-9 rounded-lg" />
            <Skeleton className="h-3 w-40" />
            <Skeleton className="hidden h-3 w-32 md:block" />
            <Skeleton className="h-3 w-12" />
            <Skeleton className="h-5 w-16 rounded-full" />
          </div>
        ))}
      </div>
    </div>
  );
}
