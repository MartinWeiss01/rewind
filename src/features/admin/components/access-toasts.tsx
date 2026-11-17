"use client";

import { createToaster, Toast, ToastAction, ToastRegion, ToastTitle } from "@ui-sdk/react/toast";
import { buttonClass } from "@/components/ui/styles";

/** One queue for every switch, remove button and dialog on the admin page. */
export const accessToaster = createToaster();

/** Where the admin page's results appear: above the dock, newest first. */
export function AccessToasts() {
  return (
    <ToastRegion
      toaster={accessToaster}
      side="bottom"
      align="center"
      className="fixed inset-x-0 bottom-28 z-50 mx-auto flex w-fit max-w-[calc(100%-32px)] flex-col gap-2"
    >
      {() => (
        <Toast className="flex items-center gap-3 rounded-full bg-ink py-2.5 pr-2.5 pl-5 text-on-ink text-sm shadow-lg data-[type=error]:rounded-2xl data-[type=error]:bg-danger">
          <ToastTitle className="m-0 font-medium" />
          <ToastAction className={buttonClass("ghost", "sm", "bg-on-ink! text-ink!")} />
        </Toast>
      )}
    </ToastRegion>
  );
}
