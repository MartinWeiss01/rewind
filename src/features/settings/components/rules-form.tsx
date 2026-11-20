"use client";

import { useMutation } from "@tanstack/react-query";
import { Button } from "@ui-sdk/react/button";
import { Field, FieldLabel } from "@ui-sdk/react/field";
import {
  NumberInput,
  NumberInputControl,
  NumberInputDecrement,
  NumberInputGroup,
  NumberInputIncrement,
} from "@ui-sdk/react/number-input";
import {
  Select,
  SelectContent,
  SelectEmpty,
  SelectInput,
  SelectItem,
  SelectList,
  SelectTrigger,
  SelectValue,
} from "@ui-sdk/react/select";
import { MinusIcon, PlusIcon } from "lucide-react";
import { useTranslations } from "next-intl";
import { useState } from "react";
import { buttonClass } from "@/components/ui/styles";
import { saveListeningRules } from "../actions";

const control = "min-h-11 rounded-full border border-line-strong bg-surface px-4 text-sm";

export function RulesForm({
  skipSeconds,
  timeZone,
  timeZones,
}: {
  skipSeconds: number;
  timeZone: string;
  timeZones: readonly string[];
}) {
  const t = useTranslations("settings");
  const [skip, setSkip] = useState<number | null>(skipSeconds);
  const [zone, setZone] = useState<string | null>(timeZone);
  const save = useMutation({
    mutationFn: async (input: { skipSeconds: number; timeZone: string }) => {
      const result = await saveListeningRules(input);
      if (!result.ok) throw new Error(result.error);
    },
  });

  return (
    <div className="flex flex-col gap-5">
      <Field className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-col gap-1">
          <FieldLabel className="font-semibold text-[15px]">{t("skipThreshold")}</FieldLabel>
          <span className="text-muted text-sm">{t("skipHint")}</span>
        </div>
        <NumberInput value={skip} onValueChange={setSkip} min={0} max={60} step={5}>
          <NumberInputGroup className="inline-flex items-center gap-1 rounded-full border border-line-strong bg-surface p-1">
            <NumberInputDecrement
              aria-label={t("skipDecrease")}
              className="grid size-9 cursor-pointer place-items-center rounded-full hover:bg-surface-2"
            >
              <MinusIcon size={16} aria-hidden="true" />
            </NumberInputDecrement>
            <NumberInputControl className="w-12 bg-transparent text-center font-mono" />
            <NumberInputIncrement
              aria-label={t("skipIncrease")}
              className="grid size-9 cursor-pointer place-items-center rounded-full hover:bg-surface-2"
            >
              <PlusIcon size={16} aria-hidden="true" />
            </NumberInputIncrement>
          </NumberInputGroup>
        </NumberInput>
      </Field>

      <Field className="flex flex-wrap items-center justify-between gap-3">
        <FieldLabel className="font-semibold text-[15px]">{t("timeZone")}</FieldLabel>
        <Select
          items={[...timeZones]}
          value={zone}
          onValueChange={(next) => setZone(typeof next === "string" ? next : null)}
        >
          <SelectTrigger className={`${control} min-w-64 cursor-pointer text-left`}>
            <SelectValue />
          </SelectTrigger>
          <SelectContent className="z-30 flex max-h-80 w-72 flex-col overflow-hidden rounded-2xl border border-line bg-surface shadow-lg">
            <SelectInput
              aria-label={t("timeZoneSearch")}
              placeholder={t("timeZoneSearch")}
              className="m-2 rounded-xl border border-line bg-surface-2 px-3 py-2 text-sm"
            />
            <SelectEmpty className="px-4 py-3 text-muted text-sm">{t("noTimeZone")}</SelectEmpty>
            <SelectList className="overflow-y-auto pb-2">
              {timeZones.map((tz) => (
                <SelectItem
                  key={tz}
                  value={tz}
                  className="cursor-pointer px-4 py-2 text-sm data-highlighted:bg-surface-2 data-selected:font-semibold"
                >
                  {tz}
                </SelectItem>
              ))}
            </SelectList>
          </SelectContent>
        </Select>
      </Field>

      <div className="flex items-center gap-3">
        <Button
          className={buttonClass("primary", "sm")}
          onClick={() => save.mutateAsync({ skipSeconds: skip ?? 0, timeZone: zone ?? timeZone })}
        >
          {t("save")}
        </Button>
        <span role="status" className={save.isError ? "text-danger text-sm" : "text-muted text-sm"}>
          {save.isSuccess ? t("saved") : save.isError ? t("saveFailed") : ""}
        </span>
      </div>
    </div>
  );
}
