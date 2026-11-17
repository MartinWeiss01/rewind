import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { match } from "ts-pattern";
import { z } from "zod";
import { SpotifyLoginLink } from "@/components/auth/spotify-login-link";
import { Cover } from "@/components/ui/cover";
import { alert, buttonClass, card, cardFlat, chipClass, heading } from "@/components/ui/styles";
import { spotifyConfig } from "@/server/env";

const loginSchema = z
  .enum(["cancelled", "forbidden", "failed", "unavailable"])
  .optional()
  .catch(undefined);
const repositoryUrl = "https://github.com/MartinWeiss01/rewind";

const features = [
  { key: "tools", tint: "bg-coral-soft" },
  { key: "ai", tint: "bg-butter-soft" },
  { key: "demo", tint: "bg-mint-soft" },
] as const;

export default async function LandingPage({ searchParams }: PageProps<"/">) {
  const t = await getTranslations();
  const login = loginSchema.parse((await searchParams).login);
  // Without Spotify sign-in (a demo-only deployment) the page doesn't mention Spotify.
  const spotify = spotifyConfig() !== null;
  const infoCards = spotify
    ? (["whyInvite", "yourData", "openSource"] as const)
    : (["openSource"] as const);
  const loginMessage =
    login &&
    match(login)
      .with("cancelled", () => t("marketing.loginCancelled"))
      .with("forbidden", () => t("marketing.loginForbidden"))
      .with("failed", () => t("marketing.loginFailed"))
      .with("unavailable", () => t("marketing.loginUnavailable"))
      .exhaustive();

  const dupes = [
    {
      title: "Glasshouse",
      sub: `Velvet Static · ${t("marketing.dupeInPlaylists")}`,
      tag: t("marketing.dupeExact"),
      tone: "coral",
      seed: 0,
    },
    {
      title: "Coastline Radio (Remastered)",
      sub: `Marlowe June · ${t("marketing.dupeSameSong")}`,
      tag: t("marketing.dupeLikely"),
      tone: "violet",
      seed: 1,
    },
    {
      title: "Low Tide",
      sub: `Neon Harbor · ${t("marketing.dupeVersions")}`,
      tag: t("marketing.dupeReview"),
      tone: "neutral",
      seed: 2,
    },
  ] as const;

  return (
    <div className="flex flex-col gap-16 pb-12">
      <section className="relative flex flex-col items-start gap-6 pt-[clamp(48px,10vw,120px)]">
        <span
          aria-hidden="true"
          className="absolute top-10 right-0 -z-10 hidden size-[340px] rounded-full bg-violet-soft blur-0 md:block"
        />
        <span
          aria-hidden="true"
          className="absolute top-56 right-48 -z-10 hidden size-[180px] rounded-full bg-butter-soft md:block"
        />
        {loginMessage ? (
          <div role="status" className={`${alert.base} ${alert.tone.info}`}>
            {loginMessage}
          </div>
        ) : null}
        <span className="eyebrow">{t("marketing.eyebrow")}</span>
        <h1 className={`${heading.display} max-w-[14ch] text-[clamp(48px,8vw,104px)]`}>
          {t("marketing.title")}
        </h1>
        <p className="m-0 max-w-[56ch] text-lg text-muted leading-relaxed">{t("marketing.lead")}</p>
        <div className="flex flex-wrap items-center gap-3">
          <Link href="/app" className={buttonClass("primary", "lg")}>
            {t("common.tryDemo")}
          </Link>
          {spotify ? (
            <SpotifyLoginLink className={buttonClass("secondary", "lg")}>
              {t("shell.useMySpotify")}
            </SpotifyLoginLink>
          ) : null}
        </div>
        <span className="text-muted text-sm">{t("common.demoNote")}</span>
      </section>

      <section id="features" className="flex flex-col gap-5">
        <div className="flex items-end justify-between gap-3">
          <h2 className={heading.h1}>{t("marketing.featuresTitle")}</h2>
          <span className="eyebrow">{t("marketing.sideA")}</span>
        </div>
        <div className="grid gap-4 md:grid-cols-3">
          {features.map((feature, index) => (
            <article key={feature.key} className={`${card} flex min-h-[260px] flex-col gap-3.5`}>
              <span
                aria-hidden="true"
                className={`absolute -top-8 -right-8 h-24 w-28 rounded-full ${feature.tint}`}
              />
              <span className="eyebrow relative">{String(index + 1).padStart(2, "0")}</span>
              <h3 className={`${heading.h2} relative`}>
                {t(`marketing.features.${feature.key}.title`)}
              </h3>
              <p className="m-0 text-muted text-sm leading-relaxed">
                {t(`marketing.features.${feature.key}.text`)}
              </p>
              <span className={chipClass("neutral", "mt-auto self-start")}>
                {t(`marketing.features.${feature.key}.tag`)}
              </span>
            </article>
          ))}
        </div>
      </section>

      <section className={`${card} grid items-center gap-8 p-8 md:grid-cols-2`}>
        <div className="flex flex-col gap-3.5">
          <span className="eyebrow">{t("marketing.previewEyebrow")}</span>
          <h2 className={heading.h1}>{t("marketing.previewTitle")}</h2>
          <p className="m-0 text-muted leading-relaxed">{t("marketing.previewText")}</p>
          <div>
            <Link href="/app/playlists" className={buttonClass("primary")}>
              {t("marketing.openDemo")}
            </Link>
          </div>
        </div>
        <div
          role="img"
          aria-label={t("marketing.previewLabel")}
          className="grid grid-cols-3 gap-2.5 rounded-[20px] border border-line bg-bg p-4"
        >
          {(
            [
              ["statPlaylists", 12],
              ["statDuplicates", 37],
              ["statSuggestions", 25],
            ] as const
          ).map(([key, value]) => (
            <div key={key} className={`${cardFlat} rounded-2xl p-3.5`}>
              <div className="eyebrow">{t(`marketing.${key}`)}</div>
              <div className="font-display font-extrabold text-[28px]">{value}</div>
            </div>
          ))}
          <div className={`${cardFlat} col-span-3 flex flex-col gap-2.5 rounded-2xl p-3.5`}>
            {dupes.map((dupe) => (
              <div key={dupe.title} className="flex items-center gap-3">
                <Cover cover={{ kind: "generated", seed: dupe.seed }} size={40} />
                <div className="flex min-w-0 flex-1 flex-col">
                  <b className="truncate text-sm">{dupe.title}</b>
                  <span className="truncate text-muted text-sm">{dupe.sub}</span>
                </div>
                <span className={chipClass(dupe.tone)}>{dupe.tag}</span>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className={`grid gap-4 ${infoCards.length > 1 ? "md:grid-cols-3" : "md:max-w-md"}`}>
        {infoCards.map((key) => (
          <div key={key} className={`${cardFlat} flex flex-col gap-2.5`}>
            <span className="eyebrow">{t(`marketing.${key}Title`)}</span>
            <p className="m-0 text-sm leading-relaxed">{t(`marketing.${key}Text`)}</p>
            {key === "openSource" ? (
              <a
                href={repositoryUrl}
                target="_blank"
                rel="noreferrer"
                className={buttonClass("secondary", "sm", "self-start")}
              >
                {t("marketing.viewOnGithub")}
              </a>
            ) : null}
          </div>
        ))}
      </section>

      {spotify ? (
        <footer className="flex flex-wrap items-center justify-between gap-3 border-line border-t pt-5 text-muted text-sm">
          <span>{t("marketing.disclaimer")}</span>
          <span>{t("marketing.attribution")}</span>
        </footer>
      ) : null}
    </div>
  );
}
