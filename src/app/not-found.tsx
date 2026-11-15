import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { StatePanel } from "@/components/feedback/state-panel";

export default async function NotFound() {
  const t = await getTranslations("states");
  return (
    <main id="content" className="mx-auto w-full max-w-[720px] px-4 py-24">
      <StatePanel
        title={t("notFoundTitle")}
        body={t("notFoundBody")}
        action={
          <Link
            href="/"
            className="inline-flex min-h-9 items-center rounded-full bg-ink px-4 font-semibold text-on-ink text-sm"
          >
            {t("backHome")}
          </Link>
        }
      />
    </main>
  );
}
