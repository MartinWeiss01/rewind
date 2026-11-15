import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { StatePanel } from "@/components/feedback/state-panel";
import { buttonClass } from "@/components/ui/styles";

/** A playlist that doesn't exist, was deleted, or can't be read. */
export default async function NotFound() {
  const t = await getTranslations("playlists.detail");
  return (
    <StatePanel
      tone="error"
      title={t("notFoundTitle")}
      body={t("notFoundBody")}
      action={
        <Link href="/app/playlists" className={buttonClass("primary", "sm")}>
          {t("backToPlaylists")}
        </Link>
      }
    />
  );
}
