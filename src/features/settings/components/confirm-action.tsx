"use client";

import {
  AlertDialog,
  AlertDialogBackdrop,
  AlertDialogClose,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@ui-sdk/react/alert-dialog";
import { buttonClass } from "@/components/ui/styles";

/** A destructive action behind a confirmation dialog. */
export function ConfirmAction({
  trigger,
  title,
  description,
  cancel,
  confirm,
  action,
  variant = "danger",
}: {
  trigger: string;
  title: string;
  description: string;
  cancel: string;
  confirm: string;
  action: () => Promise<unknown>;
  variant?: "danger" | "secondary";
}) {
  return (
    <AlertDialog>
      <AlertDialogTrigger className={buttonClass(variant, "sm")}>{trigger}</AlertDialogTrigger>
      <AlertDialogBackdrop className="fixed inset-0 z-40 bg-black/40" />
      <AlertDialogContent className="fixed top-1/2 left-1/2 z-50 flex w-[min(92vw,460px)] -translate-x-1/2 -translate-y-1/2 flex-col gap-5 rounded-3xl border border-line bg-surface p-6 shadow-2xl">
        <div className="flex flex-col gap-2">
          <AlertDialogTitle className="m-0 font-bold font-display text-xl">
            {title}
          </AlertDialogTitle>
          <AlertDialogDescription className="m-0 text-muted text-sm">
            {description}
          </AlertDialogDescription>
        </div>
        <div className="flex justify-end gap-2">
          <AlertDialogClose className={buttonClass("ghost", "sm")}>{cancel}</AlertDialogClose>
          {/* The dialog stays open, marked pending, until the action finishes. */}
          <AlertDialogClose
            value="confirm"
            action={() => action()}
            className={buttonClass("danger", "sm")}
          >
            {confirm}
          </AlertDialogClose>
        </div>
      </AlertDialogContent>
    </AlertDialog>
  );
}
