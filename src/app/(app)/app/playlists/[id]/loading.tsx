import { getTranslations } from "next-intl/server";
import { Skeleton } from "@/components/feedback/skeleton";

const rows = Array.from({ length: 6 }, (_, i) => `row-${i}`);

export default async function Loading() {
  const t = await getTranslations("states");
  return (
    <div aria-busy="true" className="flex flex-col gap-6">
      <span className="sr-only" role="status">
        {t("loading")}
      </span>
      <Skeleton className="h-3.5 w-48" />
      <div className="flex flex-wrap items-end gap-7">
        <Skeleton className="size-[220px] rounded-[18px]" />
        <div className="flex flex-1 flex-col gap-3">
          <Skeleton className="h-3.5 w-32" />
          <Skeleton className="h-11 w-3/5" />
          <Skeleton className="h-3.5 w-2/5" />
        </div>
      </div>
      <div className="flex flex-col rounded-[18px] border border-line bg-surface">
        {rows.map((key) => (
          <div
            key={key}
            className="flex items-center gap-4 border-line border-b px-3.5 py-2.5 last:border-b-0"
          >
            <Skeleton className="size-[18px]" />
            <Skeleton className="size-10" />
            <Skeleton className="h-3 w-52" />
            <Skeleton className="ml-auto h-3 w-28" />
            <Skeleton className="h-3 w-10" />
          </div>
        ))}
      </div>
    </div>
  );
}
