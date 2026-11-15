import { getTranslations } from "next-intl/server";
import { Skeleton } from "@/components/feedback/skeleton";

/** Loading state for the recap: the tape spinning up inside the deck card. */
export async function RecapSkeleton() {
  const t = await getTranslations("recap");
  return (
    <div aria-busy="true" className="flex flex-col gap-6">
      <span className="sr-only" role="status">
        {t("loading")}
      </span>
      <div className="flex flex-wrap items-center justify-between gap-4">
        <Skeleton className="h-9 w-40 rounded-full" />
        <Skeleton className="h-11 w-[420px] max-w-full rounded-full" />
      </div>
      <div className="flex min-h-[720px] flex-col items-center justify-center gap-4 rounded-[36px] border border-line bg-surface p-10 text-center">
        <div
          aria-hidden="true"
          className="grid size-[180px] place-items-center rounded-full bg-ink"
        >
          <Skeleton className="size-[120px] rounded-full" />
        </div>
        <p className="m-0 font-display font-bold text-2xl" aria-hidden="true">
          {t("loading")}
        </p>
        <Skeleton className="h-2 w-[280px] rounded-full" />
      </div>
    </div>
  );
}
