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
import { PlusIcon } from "lucide-react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { type FormEvent, useState } from "react";
import { alert, buttonClass, chipClass } from "@/components/ui/styles";
import { createPlaylistAction } from "../actions";
import { writeFailure } from "../changes";
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
import { usePlaylistWrite } from "./use-playlist-write";
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
  const write = usePlaylistWrite(createPlaylistAction);
  const failure = writeFailure(write);

  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    write.mutate(
      { name, description, isPublic },
      {
        onSuccess: (outcome) => {
          if (outcome.status !== "ok") return;
          setOpen(false);
          setName("");
          setDescription("");
          setIsPublic(false);
          write.reset();
          router.push(`/app/playlists/${encodeURIComponent(outcome.playlistId)}`);
        },
      },
    );
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        if (!next) write.reset();
      }}
    >
      <DialogTrigger className={buttonClass(variant)}>
        <PlusIcon size={18} aria-hidden="true" />
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
          {failure ? <WriteOutcome result={failure} /> : null}
          <div className="flex justify-end gap-2">
            <DialogClose className={buttonClass("ghost")}>{t("cancel")}</DialogClose>
            <Button type="submit" className={buttonClass("primary")} disabled={write.isPending}>
              {write.isPending ? t("creating") : t("submit")}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
