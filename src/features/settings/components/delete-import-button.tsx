"use client";

import { Button } from "@ui-sdk/react/button";
import { buttonClass } from "@/components/ui/styles";
import { deleteImport } from "../actions";

export function DeleteImportButton({ id, label }: { id: string; label: string }) {
  return (
    <Button className={buttonClass("ghost", "sm")} onClick={() => deleteImport(id)}>
      {label}
    </Button>
  );
}
