"use client";

import { useMutation } from "@tanstack/react-query";
import {
  AlertDialog,
  AlertDialogBackdrop,
  AlertDialogClose,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@ui-sdk/react/alert-dialog";
import { Button } from "@ui-sdk/react/button";
import { useTranslations } from "next-intl";
import { useState } from "react";
import { alert, buttonClass } from "@/components/ui/styles";
import { dialogBackdrop, dialogContent, dialogTitle } from "@/features/playlists/components/ui";
import { removePersonAction } from "../actions";
import { accessToaster } from "./access-toasts";

/** Removes a person and every feature they had, after a confirmation. */
export function RemovePerson({ spotifyUserId, name }: { spotifyUserId: string; name: string }) {
  const t = useTranslations("admin");
  const [open, setOpen] = useState(false);
  const write = useMutation({ mutationFn: () => removePersonAction(spotifyUserId) });
  const error = write.data?.status === "error" ? write.data.error : write.isError ? "failed" : null;

  return (
    <AlertDialog
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        if (!next) write.reset();
      }}
    >
      <AlertDialogTrigger
        aria-label={t("remove.label", { name })}
        className={buttonClass("ghost", "sm")}
      >
        {t("remove.open")}
      </AlertDialogTrigger>
      <AlertDialogBackdrop className={dialogBackdrop} />
      <AlertDialogContent className={`${dialogContent} max-w-[480px] text-left`}>
        <AlertDialogTitle className={dialogTitle}>{t("remove.title", { name })}</AlertDialogTitle>
        <AlertDialogDescription className="m-0 text-sm leading-relaxed">
          {t("remove.body")}
        </AlertDialogDescription>
        {error ? (
          <div role="alert" className={`${alert.base} ${alert.tone.danger}`}>
            {t(`error.${error === "invalidId" ? "invalid" : error}`)}
          </div>
        ) : null}
        <div className="flex justify-end gap-2">
          <AlertDialogClose className={buttonClass("ghost")}>{t("remove.cancel")}</AlertDialogClose>
          <Button
            className={buttonClass("danger")}
            disabled={write.isPending}
            onClick={() =>
              write.mutate(undefined, {
                onSuccess: (result) => {
                  if (result.status !== "ok") return;
                  setOpen(false);
                  accessToaster(t("toast.removed", { name }));
                },
              })
            }
          >
            {write.isPending ? t("remove.removing") : t("remove.confirm")}
          </Button>
        </div>
      </AlertDialogContent>
    </AlertDialog>
  );
}
