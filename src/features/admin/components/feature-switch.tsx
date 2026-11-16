"use client";

import { useMutation } from "@tanstack/react-query";
import { Switch, SwitchThumb } from "@ui-sdk/react/switch";
import { useTranslations } from "next-intl";
import { switchRoot, switchThumb } from "@/features/playlists/components/ui";
import type { FeatureFlag } from "@/server/feature-flags";
import { setFeatureAction } from "../actions";
import type { AccessResult } from "../types";
import { accessToaster } from "./access-toasts";

/** One feature for one person. Shows the new value while saving and reverts on failure. */
export function FeatureSwitch({
  spotifyUserId,
  name,
  feature,
  checked,
  locked,
}: {
  spotifyUserId: string;
  name: string;
  feature: FeatureFlag;
  checked: boolean;
  /** Admins always have every feature. */
  locked: boolean;
}) {
  const t = useTranslations("admin");
  const featureName = t(`features.${feature}.name`);
  const write = useMutation({
    mutationFn: (on: boolean) => setFeatureAction({ spotifyUserId, feature, on }),
  });

  const change = (on: boolean, offerUndo: boolean): void =>
    write.mutate(on, {
      onSuccess: (result: AccessResult) => {
        if (result.status === "error") return failed(on, result.error);
        accessToaster(t(on ? "toast.on" : "toast.off", { feature: featureName, name }), {
          action: offerUndo
            ? { label: t("toast.undo"), onAction: (): void => change(!on, false) }
            : undefined,
        });
      },
      onError: () => failed(on, null),
    });
  const failed = (on: boolean, error: string | null): void => {
    accessToaster.error(
      error === "admin" || error === "forbidden"
        ? t(`error.${error}`)
        : t("toast.failed", { feature: featureName, name }),
      { action: { label: t("toast.retry"), onAction: (): void => change(on, true) } },
    );
  };

  const shown = write.isPending && write.variables !== undefined ? write.variables : checked;
  return (
    <Switch
      checked={locked || shown}
      disabled={locked}
      onCheckedChange={(next) => change(next, true)}
      aria-label={t("switchLabel", { feature: featureName, name })}
      aria-busy={write.isPending || undefined}
      className={switchRoot}
    >
      <SwitchThumb className={switchThumb} />
    </Switch>
  );
}
