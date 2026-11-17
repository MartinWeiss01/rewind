import type { Metadata } from "next";
import Link from "next/link";
import { getFormatter, getTranslations } from "next-intl/server";
import type { ReactNode } from "react";
import { SpotifyLoginLink } from "@/components/auth/spotify-login-link";
import { ScreenHeader } from "@/components/feedback/screen-header";
import { LocaleSwitch } from "@/components/preferences/locale-switch";
import { ThemeSwitch } from "@/components/preferences/theme-switch";
import { Cover } from "@/components/ui/cover";
import { alert, buttonClass, card, heading } from "@/components/ui/styles";
import { DataMode } from "@/data/music-data-source";
import { deleteAllData, disconnectSpotify, endDemo, resetDemo } from "@/features/settings/actions";
import { ConfirmAction } from "@/features/settings/components/confirm-action";
import { DeleteImportButton } from "@/features/settings/components/delete-import-button";
import { RulesForm } from "@/features/settings/components/rules-form";
import { SyncButton } from "@/features/settings/components/sync-button";
import { getRequestContext } from "@/server/request-context";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("screens.settings");
  return { title: t("title") };
}

function Section({
  id,
  title,
  children,
  aside,
}: {
  id: string;
  title: string;
  children: ReactNode;
  aside?: ReactNode;
}) {
  return (
    <section aria-labelledby={id} className={`${card} flex flex-col gap-5`}>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 id={id} className={heading.h2}>
          {title}
        </h2>
        {aside}
      </div>
      {children}
    </section>
  );
}

function Row({ label, hint, children }: { label: string; hint?: string; children: ReactNode }) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-4 border-line border-t pt-4 first:border-t-0 first:pt-0">
      <div className="flex max-w-[52ch] flex-col gap-1">
        <span className="font-semibold text-[15px]">{label}</span>
        {hint ? <span className="text-muted text-sm">{hint}</span> : null}
      </div>
      {children}
    </div>
  );
}

export default async function SettingsPage() {
  const [t, tScreens, tAdmin, format, { source, account, isAdmin, spotifyAvailable }] =
    await Promise.all([
      getTranslations("settings"),
      getTranslations("screens.settings"),
      getTranslations("admin.settingsLink"),
      getFormatter(),
      getRequestContext(),
    ]);
  const isDemo = source.mode === DataMode.Demo;
  const [profile, rules, summary, imports, lastSync] = await Promise.all([
    source.getProfile(),
    source.getListeningRules(),
    source.getDataSummary(),
    source.listImports(),
    source.getLastSyncAt(),
  ]);
  const timeZones = Intl.supportedValuesOf("timeZone");

  return (
    <div className="mx-auto flex w-full max-w-[980px] flex-col gap-6">
      <ScreenHeader eyebrow={tScreens("eyebrow")} title={tScreens("title")} />

      <Section id="account-heading" title={t("account")}>
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <Cover cover={profile.avatar} size={56} shape="round" />
            <div className="flex flex-col">
              <b className="text-lg">{profile.displayName}</b>
              <span className="text-muted text-sm">
                {isDemo ? t("demoAccountNote") : t("spotifyAccountNote")}
              </span>
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            {isDemo ? (
              <>
                <form action={resetDemo}>
                  <button type="submit" className={buttonClass("secondary", "sm")}>
                    {t("resetDemo")}
                  </button>
                </form>
                <form action={endDemo}>
                  <button type="submit" className={buttonClass("ghost", "sm")}>
                    {t("endDemo")}
                  </button>
                </form>
                {spotifyAvailable ? (
                  <SpotifyLoginLink className={buttonClass("primary", "sm")}>
                    {t("useMySpotify")}
                  </SpotifyLoginLink>
                ) : null}
              </>
            ) : (
              <>
                {profile.externalUrl ? (
                  <a
                    href={profile.externalUrl}
                    target="_blank"
                    rel="noreferrer"
                    className={buttonClass("secondary", "sm")}
                  >
                    {t("openProfile")}
                  </a>
                ) : null}
                <form action="/api/auth/logout" method="post">
                  <button type="submit" className={buttonClass("ghost", "sm")}>
                    {t("logOut")}
                  </button>
                </form>
              </>
            )}
          </div>
        </div>
      </Section>

      {isAdmin ? (
        <Section id="admin-heading" title={tAdmin("title")}>
          <Row label={tAdmin("label")} hint={tAdmin("hint")}>
            <Link href="/app/admin" className={buttonClass("secondary", "sm")}>
              {tAdmin("label")}
            </Link>
          </Row>
        </Section>
      ) : null}

      <Section id="appearance-heading" title={t("appearance")}>
        <Row label={t("theme")} hint={t("themeHint")}>
          <ThemeSwitch />
        </Row>
        <Row label={t("language")} hint={t("languageHint")}>
          <LocaleSwitch />
        </Row>
      </Section>

      <Section id="sync-heading" title={t("sync")} aside={isDemo ? null : <SyncButton />}>
        {isDemo ? (
          <p className="m-0 text-muted text-sm">{t("syncDemo")}</p>
        ) : (
          <>
            {account?.syncError === "reauthorize" ? (
              <div role="alert" className={`${alert.base} ${alert.tone.danger}`}>
                <div className="flex flex-col gap-1">
                  <b>{t("syncStopped")}</b>
                  <span>{t("syncStoppedBody")}</span>
                </div>
                <a
                  href="/api/auth/spotify/login"
                  className={buttonClass("primary", "sm", "ml-auto")}
                >
                  {t("logInAgain")}
                </a>
              </div>
            ) : null}
            <dl className="m-0 grid gap-4 sm:grid-cols-2">
              <div>
                <dt className="eyebrow">{t("lastSync")}</dt>
                <dd className="m-0 mt-1 font-semibold">
                  {lastSync ? format.relativeTime(lastSync) : t("never")}
                </dd>
              </div>
              <div>
                <dt className="eyebrow">{t("loginValidUntil")}</dt>
                <dd className="m-0 mt-1 font-semibold">
                  {account?.loginValidUntil
                    ? format.dateTime(account.loginValidUntil, { dateStyle: "medium" })
                    : "—"}
                </dd>
                <dd className="m-0 text-muted text-xs">{t("loginHint")}</dd>
              </div>
            </dl>
          </>
        )}
      </Section>

      <Section id="rules-heading" title={t("rules")}>
        <RulesForm
          skipSeconds={Math.round(rules.skipThresholdMs / 1000)}
          timeZone={rules.timeZone}
          timeZones={timeZones}
        />
      </Section>

      <Section id="data-heading" title={t("data")}>
        {isDemo ? <p className="m-0 text-muted text-sm">{t("demoDataNote")}</p> : null}
        <dl className="m-0 grid grid-cols-2 gap-4 sm:grid-cols-4">
          {(
            [
              ["playsStored", summary.plays],
              ["importsCount", summary.imports],
              ["snapshotsCount", summary.snapshots],
              ["generationsCount", summary.generations],
            ] as const
          ).map(([key, value]) => (
            <div key={key} className="rounded-2xl border border-line bg-surface-2 p-4">
              <dt className="eyebrow">{t(key)}</dt>
              <dd className="m-0 mt-1 font-display font-extrabold text-3xl">
                {format.number(value)}
              </dd>
            </div>
          ))}
        </dl>
        {imports.length === 0 ? (
          <p className="m-0 text-muted text-sm">{t("noImports")}</p>
        ) : (
          <table className="w-full border-collapse text-sm">
            <thead>
              <tr className="text-left text-muted">
                <th className="py-2 font-medium">{t("importFile")}</th>
                <th className="py-2 font-medium">{t("importDate")}</th>
                <th className="py-2 font-medium">{t("importPlays")}</th>
                <th className="py-2" />
              </tr>
            </thead>
            <tbody>
              {imports.map((record) => (
                <tr key={record.id} className="border-line border-t">
                  <td className="py-2 font-mono text-xs">{record.fileName}</td>
                  <td className="py-2">
                    {format.dateTime(record.importedAt, { dateStyle: "medium" })}
                  </td>
                  <td className="py-2">{format.number(record.added)}</td>
                  <td className="py-2 text-right">
                    <DeleteImportButton id={record.id} label={t("delete")} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
        <div>
          <a href="/api/export" className={buttonClass("secondary", "sm")} download>
            {t("export")}
          </a>
        </div>
      </Section>

      <Section id="danger-heading" title={t("danger")}>
        <Row label={t("deleteData")} hint={t("deleteDataHint")}>
          <ConfirmAction
            trigger={t("deleteDataButton")}
            title={t("deleteDataTitle")}
            description={t("deleteDataBody", {
              plays: format.number(summary.plays),
              imports: format.number(summary.imports),
              snapshots: format.number(summary.snapshots),
              generations: format.number(summary.generations),
            })}
            cancel={t("cancel")}
            confirm={t("confirmDelete")}
            action={deleteAllData}
          />
        </Row>
        {isDemo ? null : (
          <Row label={t("disconnect")} hint={t("disconnectHint")}>
            <ConfirmAction
              trigger={t("disconnectButton")}
              title={t("disconnectTitle")}
              description={t("disconnectBody")}
              cancel={t("cancel")}
              confirm={t("confirmDisconnect")}
              action={disconnectSpotify}
            />
          </Row>
        )}
      </Section>
    </div>
  );
}
