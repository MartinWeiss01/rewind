"use client";

import { useMutation } from "@tanstack/react-query";
import { Button } from "@ui-sdk/react/button";
import { useTranslations } from "next-intl";
import { buttonClass } from "@/components/ui/styles";
import { deleteImport } from "../actions";

export function DeleteImportButton({ id, label }: { id: string; label: string }) {
  const t = useTranslations("settings");
  // The action revalidates the settings page, which then renders without this import.
  const remove = useMutation({
    mutationFn: async () => {
      const result = await deleteImport(id);
      if (!result.ok) throw new Error(result.error);
    },
  });
  return (
    <span className="inline-flex items-center gap-2">
      {remove.isError ? (
        <span role="alert" className="text-danger text-sm">
          {t("actionFailed")}
        </span>
      ) : null}
      <Button className={buttonClass("ghost", "sm")} onClick={() => remove.mutateAsync()}>
        {label}
      </Button>
    </span>
  );
}
