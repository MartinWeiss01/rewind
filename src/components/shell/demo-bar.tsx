import { getTranslations } from "next-intl/server";
import { buttonClass } from "@/components/ui/styles";

export async function DemoBar() {
  const t = await getTranslations("shell");
  return (
    <div className="flex flex-wrap items-center justify-center gap-3 border-line border-b bg-butter-soft px-4 py-2 text-[13px] text-ink">
      <span className="inline-flex h-6 items-center rounded-full bg-ink px-2.5 font-semibold text-on-ink text-xs">
        {t("demo")}
      </span>
      <span>{t("demoNotice")}</span>
      {/* Sign-in is a route handler that redirects to Spotify, so a full navigation. */}
      <a href="/api/auth/spotify/login" className={buttonClass("primary", "sm")}>
        {t("useMySpotify")}
      </a>
    </div>
  );
}
