import { getTranslations } from "next-intl/server";
import { Skeleton } from "./skeleton";

/** Default route loading state: header plus a grid of card placeholders. */
export async function ScreenSkeleton() {
  const t = await getTranslations("states");
  return (
    <div aria-busy="true" className="flex flex-col gap-6">
      <span className="sr-only" role="status">
        {t("loading")}
      </span>
      <div className="flex flex-col gap-2">
        <Skeleton className="h-3 w-40" />
        <Skeleton className="h-10 w-72" />
      </div>
      <div className="grid gap-4 md:grid-cols-3">
        <Skeleton className="h-56 rounded-3xl md:col-span-2" />
        <Skeleton className="h-56 rounded-3xl" />
        <Skeleton className="h-40 rounded-3xl" />
        <Skeleton className="h-40 rounded-3xl md:col-span-2" />
      </div>
    </div>
  );
}
