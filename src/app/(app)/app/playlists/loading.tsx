import { getTranslations } from "next-intl/server";
import { Skeleton } from "@/components/feedback/skeleton";

const cards = Array.from({ length: 8 }, (_, i) => `card-${i}`);

export default async function Loading() {
  const t = await getTranslations("states");
  return (
    <div aria-busy="true" className="flex flex-col gap-6">
      <span className="sr-only" role="status">
        {t("loading")}
      </span>
      <div className="flex flex-col gap-2">
        <Skeleton className="h-3 w-40" />
        <Skeleton className="h-10 w-56" />
      </div>
      <Skeleton className="h-11 w-full rounded-full" />
      <div className="grid grid-cols-[repeat(auto-fill,minmax(min(100%,220px),1fr))] gap-4">
        {cards.map((key) => (
          <div
            key={key}
            className="flex flex-col gap-3 rounded-3xl border border-line bg-surface p-4"
          >
            <Skeleton className="aspect-square w-full rounded-[14px]" />
            <Skeleton className="h-3.5 w-[70%]" />
            <Skeleton className="h-3 w-[45%]" />
          </div>
        ))}
      </div>
    </div>
  );
}
