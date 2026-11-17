"use client";

import { useMutation } from "@tanstack/react-query";
import { Button } from "@ui-sdk/react/button";
import {
  Dialog,
  DialogBackdrop,
  DialogClose,
  DialogContent,
  DialogTitle,
  DialogTrigger,
} from "@ui-sdk/react/dialog";
import { Field, FieldDescription, FieldLabel } from "@ui-sdk/react/field";
import { Input } from "@ui-sdk/react/input";
import { Switch, SwitchThumb } from "@ui-sdk/react/switch";
import { useTranslations } from "next-intl";
import { useState } from "react";
import { alert, buttonClass } from "@/components/ui/styles";
import {
  dialogBackdrop,
  dialogContent,
  dialogTitle,
  fieldHint,
  fieldLabel,
  input,
  switchRoot,
  switchThumb,
} from "@/features/playlists/components/ui";
import { type FeatureFlag, featureFlags } from "@/server/feature-flags";
import { addPersonAction } from "../actions";
import { AccessError } from "../types";
import { accessToaster } from "./access-toasts";

/** Adds someone by Spotify user ID or profile link, before or after their first login. */
export function AddPersonDialog({ variant = "primary" }: { variant?: "primary" | "secondary" }) {
  const t = useTranslations("admin");
  const [open, setOpen] = useState(false);
  const [spotifyUser, setSpotifyUser] = useState("");
  const [note, setNote] = useState("");
  const [features, setFeatures] = useState<FeatureFlag[]>([]);
  const write = useMutation({ mutationFn: addPersonAction });
  const error = write.data?.status === "error" ? write.data.error : write.isError ? "failed" : null;

  const reset = () => {
    setSpotifyUser("");
    setNote("");
    setFeatures([]);
    write.reset();
  };

  const submit = () =>
    write.mutate(
      { spotifyUser, note, features },
      {
        onSuccess: (result) => {
          if (result.status !== "ok") return;
          setOpen(false);
          accessToaster(t("toast.added", { name: note.trim() || spotifyUser.trim() }));
          reset();
        },
      },
    );

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        if (!next) reset();
      }}
    >
      <DialogTrigger className={buttonClass(variant, variant === "primary" ? "md" : "sm")}>
        {variant === "primary" ? (
          <svg
            width="18"
            height="18"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            aria-hidden="true"
          >
            <path d="M12 5v14M5 12h14" />
          </svg>
        ) : null}
        {t("add.open")}
      </DialogTrigger>
      <DialogBackdrop className={dialogBackdrop} />
      <DialogContent className={`${dialogContent} max-w-[540px]`}>
        <DialogTitle className={dialogTitle}>{t("add.title")}</DialogTitle>
        <form
          className="flex flex-col gap-5"
          onSubmit={(event) => {
            event.preventDefault();
            submit();
          }}
        >
          <Field className="flex flex-col gap-1.5">
            <FieldLabel className={fieldLabel}>{t("add.id")}</FieldLabel>
            <Input
              required
              maxLength={400}
              autoComplete="off"
              value={spotifyUser}
              onChange={(event) => setSpotifyUser(event.currentTarget.value)}
              placeholder={t("add.idPlaceholder")}
              aria-invalid={error === AccessError.InvalidId || undefined}
              className={`${input} aria-invalid:border-danger`}
            />
            {error === AccessError.InvalidId ? (
              <span role="alert" className="text-danger text-xs">
                {t("add.idInvalid")}
              </span>
            ) : (
              <FieldDescription className={`${fieldHint} m-0`}>{t("add.idHint")}</FieldDescription>
            )}
          </Field>
          <Field className="flex flex-col gap-1.5">
            <FieldLabel className={fieldLabel}>{t("add.note")}</FieldLabel>
            <Input
              maxLength={200}
              value={note}
              onChange={(event) => setNote(event.currentTarget.value)}
              placeholder={t("add.notePlaceholder")}
              className={input}
            />
          </Field>
          <fieldset className="m-0 flex flex-col gap-3 border-0 p-0">
            <legend className={`${fieldLabel} mb-2 p-0`}>{t("add.features")}</legend>
            {featureFlags.map((flag) => (
              // biome-ignore lint/a11y/noLabelWithoutControl: the ui-sdk Switch inside is the labelled control
              <label key={flag} className="flex cursor-pointer items-center justify-between gap-4">
                <span className="flex flex-col gap-0.5">
                  <b className="text-sm">{t(`features.${flag}.name`)}</b>
                  <span className="text-muted text-sm">{t(`features.${flag}.desc`)}</span>
                </span>
                <Switch
                  aria-label={t(`features.${flag}.name`)}
                  checked={features.includes(flag)}
                  onCheckedChange={(on) =>
                    setFeatures(on ? [...features, flag] : features.filter((f) => f !== flag))
                  }
                  className={switchRoot}
                >
                  <SwitchThumb className={switchThumb} />
                </Switch>
              </label>
            ))}
          </fieldset>
          <div className={`${alert.base} border-transparent bg-butter-soft`}>
            {t("add.dashboardNote")}
          </div>
          {error && error !== AccessError.InvalidId ? (
            <div role="alert" className={`${alert.base} ${alert.tone.danger}`}>
              {t(`error.${error}`)}
            </div>
          ) : null}
          <div className="flex justify-end gap-2">
            <DialogClose className={buttonClass("ghost")}>{t("add.cancel")}</DialogClose>
            <Button type="submit" className={buttonClass("primary")} disabled={write.isPending}>
              {write.isPending ? t("add.adding") : t("add.submit")}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
