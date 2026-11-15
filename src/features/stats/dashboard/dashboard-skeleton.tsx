import { getTranslations } from "next-intl/server";
import { Skeleton } from "@/components/feedback/skeleton";

/** Loading state shaped like the dashboard deck. */
export async function DashboardSkeleton() {
  const t = await getTranslations("states");
  return (
    <div aria-busy="true" className="flex flex-col gap-6">
      <span className="sr-only" role="status">
        {t("loading")}
      </span>
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div className="flex flex-col gap-2">
          <Skeleton className="h-3 w-40" />
          <Skeleton className="h-10 w-64" />
        </div>
        <Skeleton className="h-11 w-[360px] max-w-full rounded-full" />
      </div>
      <div className="grid min-h-[600px] grid-cols-[repeat(auto-fit,minmax(min(100%,300px),1fr))] gap-8 rounded-[36px] border border-line bg-surface p-8">
        <div className="flex flex-col gap-4">
          <Skeleton className="h-3 w-48" />
          <Skeleton className="h-10 w-60" />
          {[0, 1, 2, 3, 4].map((i) => (
            <Skeleton key={i} className="h-4 w-44" />
          ))}
          <Skeleton className="mt-auto h-12 w-32" />
        </div>
        <div className="grid place-items-center">
          <Skeleton className="size-[260px] rounded-2xl" />
        </div>
        <div className="mt-auto grid grid-cols-2 gap-2.5">
          {[0, 1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-20 rounded-[18px]" />
          ))}
        </div>
      </div>
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
        <Skeleton className="h-64 rounded-3xl md:col-span-2" />
        <Skeleton className="h-64 rounded-3xl" />
        <Skeleton className="h-64 rounded-3xl" />
        <Skeleton className="h-80 rounded-3xl md:col-span-2" />
        <Skeleton className="h-80 rounded-3xl md:col-span-2" />
        <Skeleton className="col-span-full h-72 rounded-3xl" />
      </div>
    </div>
  );
}
