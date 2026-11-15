"use client";

import { Button } from "@ui-sdk/react/button";
import {
  Dialog,
  DialogBackdrop,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogTitle,
  DialogTrigger,
} from "@ui-sdk/react/dialog";
import { Field, FieldLabel } from "@ui-sdk/react/field";
import { Input } from "@ui-sdk/react/input";
import { Switch, SwitchThumb } from "@ui-sdk/react/switch";
import { Textarea } from "@ui-sdk/react/textarea";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { type FormEvent, useState, useTransition } from "react";
import { alert, buttonClass, chipClass } from "@/components/ui/styles";
import { createPlaylistAction } from "../actions";
import type { WriteResult } from "../changes";
import {
  dialogBackdrop,
  dialogContent,
  dialogTitle,
  fieldLabel,
  input,
  switchRoot,
  switchThumb,
  textarea,
} from "./ui";
import { WriteOutcome } from "./write-outcome";

/** "New playlist" button and its dialog. Opens the created playlist on success. */
export function NewPlaylistDialog({
  isDemo,
  variant = "primary",
}: {
  isDemo: boolean;
  variant?: "primary" | "secondary";
}) {
  const t = useTranslations("playlistTools.create");
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [isPublic, setIsPublic] = useState(false);
  const [result, setResult] = useState<WriteResult | null>(null);
  const [pending, startTransition] = useTransition();

  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    startTransition(async () => {
      const outcome = await createPlaylistAction({ name, description, isPublic });
      setResult(outcome);
      if (outcome.status === "ok") {
        setOpen(false);
        setName("");
        setDescription("");
        setIsPublic(false);
        setResult(null);
        router.push(`/app/playlists/${encodeURIComponent(outcome.playlistId)}`);
      }
    });
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        if (!next) setResult(null);
      }}
    >
      <DialogTrigger className={buttonClass(variant)}>
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
        {t("open")}
      </DialogTrigger>
      <DialogBackdrop className={dialogBackdrop} />
      <DialogContent className={dialogContent}>
        <div className="flex flex-col gap-1">
          <DialogTitle className={dialogTitle}>{t("title")}</DialogTitle>
          <DialogDescription className="m-0 text-muted text-sm">
            {t("description")}
          </DialogDescription>
        </div>
        <form className="flex flex-col gap-4" onSubmit={submit}>
          <Field className="flex flex-col gap-1.5">
            <FieldLabel className={fieldLabel}>{t("name")}</FieldLabel>
            <Input
              required
              maxLength={100}
              value={name}
              onValueChange={setName}
              placeholder={t("namePlaceholder")}
              className={input}
            />
          </Field>
          <Field className="flex flex-col gap-1.5">
            <FieldLabel className={fieldLabel}>
              {t("descriptionLabel")}{" "}
              <span className="font-normal text-muted">{t("optional")}</span>
            </FieldLabel>
            <Textarea
              maxLength={300}
              value={description}
              onValueChange={setDescription}
              className={textarea}
            />
          </Field>
          {/* biome-ignore lint/a11y/noLabelWithoutControl: the ui-sdk Switch inside is the labelled control */}
          <label className="flex items-center justify-between gap-4 text-sm">
            {t("public")}
            <Switch checked={isPublic} onCheckedChange={setIsPublic} className={switchRoot}>
              <SwitchThumb className={switchThumb} />
            </Switch>
          </label>
          {isDemo ? (
            <div className={`${alert.base} ${alert.tone.info} items-center`}>
              <span className={chipClass()}>{t("demoChip")}</span>
              {t("demoNote")}
            </div>
          ) : null}
          {result && result.status !== "ok" ? <WriteOutcome result={result} /> : null}
          <div className="flex justify-end gap-2">
            <DialogClose className={buttonClass("ghost")}>{t("cancel")}</DialogClose>
            <Button type="submit" className={buttonClass("primary")} disabled={pending}>
              {pending ? t("creating") : t("submit")}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
