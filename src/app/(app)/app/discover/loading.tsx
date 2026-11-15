import { getTranslations } from "next-intl/server";
import { Skeleton } from "@/components/feedback/skeleton";

export default async function Loading() {
  const t = await getTranslations("states");
  return (
    <div aria-busy="true" className="flex flex-col gap-6">
      <span className="sr-only" role="status">
        {t("loading")}
      </span>
      <div className="flex flex-col gap-2">
        <Skeleton className="h-3 w-32" />
        <Skeleton className="h-10 w-80" />
        <Skeleton className="h-4 w-[min(560px,90%)]" />
      </div>
      <div className="grid gap-4 md:grid-cols-2">
        <Skeleton className="h-32 rounded-3xl" />
        <Skeleton className="h-32 rounded-3xl" />
      </div>
      <Skeleton className="h-72 rounded-3xl" />
      <div className="flex flex-col gap-2.5">
        <Skeleton className="h-4 w-40" />
        <div className="grid gap-4 md:grid-cols-3">
          <Skeleton className="h-24 rounded-3xl" />
          <Skeleton className="h-24 rounded-3xl" />
          <Skeleton className="h-24 rounded-3xl" />
        </div>
      </div>
    </div>
  );
}
