import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getFormatter, getTranslations } from "next-intl/server";
import { StatePanel } from "@/components/feedback/state-panel";
import { card, cardFlat, chipClass, heading } from "@/components/ui/styles";
import { adminDb } from "@/data/supabase/client";
import { AccessToasts } from "@/features/admin/components/access-toasts";
import { AddPersonDialog } from "@/features/admin/components/add-person-dialog";
import { FeatureSwitch } from "@/features/admin/components/feature-switch";
import { RemovePerson } from "@/features/admin/components/remove-person";
import { table, tableBox, td, th } from "@/features/playlists/components/ui";
import { AccessAction, type AccessPerson, loadAccessOverview } from "@/server/access";
import { spotifyConfig } from "@/server/env";
import { featureFlags, parseAdminIds } from "@/server/feature-flags";
import { getRequestContext } from "@/server/request-context";

export async function generateMetadata(): Promise<Metadata> {
  // Non-admins get the not-found page; its title must not reveal this one.
  if (!(await getRequestContext()).isAdmin) return {};
  const t = await getTranslations("admin");
  return { title: t("title") };
}

const featureTone = { stats: "violet", ai: "mint", playlistWrite: "coral" } as const;
const verbTone = {
  [AccessAction.Add]: "violet",
  [AccessAction.Remove]: "neutral",
  [AccessAction.Grant]: "mint",
  [AccessAction.Revoke]: "coral",
} as const;

const initials = (name: string) =>
  name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? "")
    .join("") || "?";

function Avatar({ person }: { person: AccessPerson }) {
  if (person.avatarUrl) {
    return (
      // Spotify profile images are already small; next/image would only add a proxy hop.
      // biome-ignore lint/performance/noImgElement: see comment above
      <img
        src={person.avatarUrl}
        alt=""
        width={40}
        height={40}
        className="size-10 shrink-0 rounded-full object-cover"
      />
    );
  }
  return (
    <span
      aria-hidden="true"
      className="grid size-10 shrink-0 place-items-center rounded-full bg-butter-soft font-semibold text-[13px]"
    >
      {initials(person.name)}
    </span>
  );
}

/** Admin-only: who gets which gated feature (ADR 0004). Everyone else gets a 404. */
export default async function AdminPage() {
  const context = await getRequestContext();
  const config = spotifyConfig();
  if (!context.isAdmin || context.viewer.mode !== "spotify" || !config) notFound();
  const me = context.viewer.spotifyUserId;

  const [t, format, overview] = await Promise.all([
    getTranslations("admin"),
    getFormatter(),
    loadAccessOverview(adminDb(config), parseAdminIds(process.env)),
  ]);
  const { people, events } = overview;
  const nameOf = (id: string) =>
    id === me ? t("you") : (people.find((p) => p.spotifyUserId === id)?.name ?? id);
  const others = people.filter((p) => !p.admin);

  return (
    <div className="mx-auto flex w-full max-w-[1120px] flex-col gap-6">
      <div className="flex flex-col gap-1.5">
        <Link href="/app/settings" className="text-muted text-sm">
          {t("back")}
        </Link>
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div className="flex flex-col gap-1.5">
            <span className="eyebrow">{t("eyebrow")}</span>
            <h1 className={heading.h1}>{t("title")}</h1>
            <p className="m-0 max-w-[620px] text-muted">{t("intro")}</p>
          </div>
          <AddPersonDialog />
        </div>
      </div>

      <section aria-label={t("title")} className="grid gap-4 md:grid-cols-3">
        {featureFlags.map((flag) => (
          <div key={flag} className={`${cardFlat} flex flex-col gap-2`}>
            <div className="flex items-center justify-between gap-3">
              <b>{t(`features.${flag}.name`)}</b>
              <span className={chipClass(featureTone[flag])}>
                {t("featureCount", {
                  count: people.filter((p) => p.admin || p.features.includes(flag)).length,
                })}
              </span>
            </div>
            <span className="text-muted text-sm">{t(`features.${flag}.desc`)}</span>
          </div>
        ))}
      </section>

      <section aria-labelledby="people-heading" className={`${card} flex flex-col gap-4`}>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 id="people-heading" className={heading.h2}>
            {t("people")}
          </h2>
          <span className="text-muted text-sm">{t("spotifyLimit")}</span>
        </div>
        <div className={tableBox}>
          <table className={table}>
            <thead>
              <tr>
                <th scope="col" className={th}>
                  {t("columnPerson")}
                </th>
                <th scope="col" className={th}>
                  {t("columnSeen")}
                </th>
                {featureFlags.map((flag) => (
                  <th key={flag} scope="col" className={th}>
                    {t(`features.${flag}.name`)}
                  </th>
                ))}
                <th scope="col" className={th}>
                  <span className="sr-only">{t("columnActions")}</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {people.map((person) => (
                <tr key={person.spotifyUserId} className="[&:last-child>td]:border-b-0">
                  <td className={td}>
                    <div className="flex items-center gap-3">
                      <Avatar person={person} />
                      <div className="flex min-w-0 flex-col gap-0.5">
                        <div className="flex flex-wrap items-center gap-2">
                          <b className="text-sm">{person.name}</b>
                          {person.admin ? (
                            <span className={chipClass("violet", "h-6")}>{t("admin")}</span>
                          ) : null}
                          {!person.signedIn ? (
                            <span className={chipClass("butter", "h-6")}>{t("pending")}</span>
                          ) : null}
                        </div>
                        <span className="font-mono text-muted text-xs">{person.spotifyUserId}</span>
                      </div>
                    </div>
                  </td>
                  <td className={`${td} whitespace-nowrap text-muted`}>
                    {person.lastSeenAt
                      ? format.relativeTime(person.lastSeenAt, context.now)
                      : t("never")}
                  </td>
                  {featureFlags.map((flag) => (
                    <td key={flag} className={td}>
                      <FeatureSwitch
                        spotifyUserId={person.spotifyUserId}
                        name={person.name}
                        feature={flag}
                        checked={person.features.includes(flag)}
                        locked={person.admin}
                      />
                    </td>
                  ))}
                  <td className={`${td} text-right`}>
                    {person.member && !person.admin ? (
                      <RemovePerson spotifyUserId={person.spotifyUserId} name={person.name} />
                    ) : null}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {others.length === 0 ? (
          <StatePanel
            title={t("emptyTitle")}
            body={t("emptyBody")}
            action={<AddPersonDialog variant="secondary" />}
          />
        ) : null}
        <p className="m-0 text-muted text-sm">{t("adminNote")}</p>
      </section>

      <section aria-labelledby="changes-heading" className={`${card} flex flex-col gap-3`}>
        <h2 id="changes-heading" className={heading.h2}>
          {t("changes")}
        </h2>
        {events.length === 0 ? (
          <p className="m-0 text-muted text-sm">{t("changesEmpty")}</p>
        ) : (
          <ul className="m-0 flex list-none flex-col p-0">
            {events.map((event) => (
              <li
                key={event.id}
                className="flex flex-wrap items-center gap-3 border-line border-b py-2.5 last:border-b-0"
              >
                <span className={chipClass(verbTone[event.action], "h-6 min-w-14 justify-center")}>
                  {t(`verb.${event.action}`)}
                </span>
                <span className="grow text-sm">
                  {t(`event.${event.action}`, {
                    subject: nameOf(event.subject),
                    feature: event.feature ? t(`features.${event.feature}.name`) : "",
                  })}{" "}
                  <span className="text-muted">· {t("by", { actor: nameOf(event.actor) })}</span>
                </span>
                <time dateTime={event.at.toISOString()} className="font-mono text-muted text-xs">
                  {format.relativeTime(event.at, context.now)}
                </time>
              </li>
            ))}
          </ul>
        )}
      </section>
      <AccessToasts />
    </div>
  );
}
