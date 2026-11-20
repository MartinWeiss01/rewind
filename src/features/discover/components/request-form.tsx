"use client";

import { useQuery } from "@tanstack/react-query";
import { Button } from "@ui-sdk/react/button";
import { Field, FieldDescription, FieldLabel } from "@ui-sdk/react/field";
import {
  NumberInput,
  NumberInputControl,
  NumberInputDecrement,
  NumberInputGroup,
  NumberInputIncrement,
} from "@ui-sdk/react/number-input";
import { Radio, RadioGroup } from "@ui-sdk/react/radio";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@ui-sdk/react/select";
import {
  Slider,
  SliderControl,
  SliderIndicator,
  SliderThumb,
  SliderTrack,
  SliderValue,
} from "@ui-sdk/react/slider";
import { Switch, SwitchThumb } from "@ui-sdk/react/switch";
import { Textarea } from "@ui-sdk/react/textarea";
import { ChevronDownIcon, MinusIcon, PlusIcon, SparklesIcon } from "lucide-react";
import { useTranslations } from "next-intl";
import { match } from "ts-pattern";
import { buttonClass, card, chipClass } from "@/components/ui/styles";
import { queryKeys } from "@/lib/query-keys";
import { describePlaylistSeed } from "../actions";
import {
  countBounds,
  DiscoverMode,
  type DiscoverRequest,
  maxPromptLength,
  retryUnexpected,
  unwrapResult,
} from "../types";

export type PlaylistOption = { id: string; name: string; trackCount: number };

export type FormState = {
  mode: DiscoverMode;
  prompt: string;
  playlistId: string | null;
  count: number;
  maxPlays: number | null;
  newArtistsOnly: boolean;
};

export const initialFormState: FormState = {
  mode: DiscoverMode.Vibe,
  prompt: "",
  playlistId: null,
  count: countBounds.default,
  maxPlays: 3,
  newArtistsOnly: false,
};

/** The validated request for the current form, or null while it is incomplete. */
export function toRequest(form: FormState): DiscoverRequest | null {
  const seed = match(form.mode)
    .with(DiscoverMode.Vibe, () => {
      const prompt = form.prompt.trim();
      return prompt.length >= 3 ? ({ mode: DiscoverMode.Vibe, prompt } as const) : null;
    })
    .with(DiscoverMode.Playlist, () =>
      form.playlistId
        ? ({ mode: DiscoverMode.Playlist, playlistId: form.playlistId } as const)
        : null,
    )
    .exhaustive();
  if (!seed) return null;
  return { seed, count: form.count, maxPlays: form.maxPlays, newArtistsOnly: form.newArtistsOnly };
}

const inputClass =
  "w-full rounded-2xl border border-line-strong bg-surface px-4 py-3 text-base text-ink placeholder:text-muted focus-visible:outline-2 focus-visible:outline-violet";
const labelClass = "font-semibold text-sm";
const hintClass = "text-muted text-xs";

type SeedState =
  | { kind: "none" }
  | { kind: "loading" }
  | { kind: "ready"; artists: string[]; more: number }
  | { kind: "failed" };

export function RequestForm({
  form,
  onChange,
  onSubmit,
  playlists,
  busy,
  note,
}: {
  form: FormState;
  onChange: (next: FormState) => void;
  onSubmit: () => void;
  playlists: readonly PlaylistOption[];
  busy: boolean;
  note: string;
}) {
  const t = useTranslations("discover");
  const set = <K extends keyof FormState>(key: K, value: FormState[K]) =>
    onChange({ ...form, [key]: value });
  const playlistId = form.mode === DiscoverMode.Playlist ? form.playlistId : null;
  const seedQuery = useQuery({
    queryKey: queryKeys.discover.playlistSeed(playlistId ?? ""),
    queryFn: async () => unwrapResult(await describePlaylistSeed(playlistId)),
    enabled: playlistId !== null,
    retry: retryUnexpected,
  });
  const seed: SeedState = !playlistId
    ? { kind: "none" }
    : seedQuery.isError
      ? { kind: "failed" }
      : seedQuery.data
        ? { kind: "ready", ...seedQuery.data }
        : { kind: "loading" };

  const request = toRequest(form);
  const examples = [t("form.example1"), t("form.example2"), t("form.example3"), t("form.example4")];
  const modes = [DiscoverMode.Vibe, DiscoverMode.Playlist] as const;

  return (
    <form
      className="flex flex-col gap-4"
      aria-busy={busy}
      onSubmit={(event) => {
        event.preventDefault();
        if (request && !busy) onSubmit();
      }}
    >
      <RadioGroup
        aria-label={t("modes.label")}
        value={form.mode}
        onValueChange={(value) => value && set("mode", value as DiscoverMode)}
        disabled={busy}
        className="grid gap-4 md:grid-cols-2"
      >
        {modes.map((mode) => (
          // biome-ignore lint/a11y/noLabelWithoutControl: the ui-sdk Radio inside is the control
          <label
            key={mode}
            className={`${card} flex cursor-pointer flex-col gap-2 has-data-checked:border-2 has-data-checked:border-ink has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-violet`}
          >
            <span className="eyebrow">{t(`modes.${mode}.number`)}</span>
            <span className="font-bold font-display text-2xl tracking-tight">
              {t(`modes.${mode}.title`)}
            </span>
            <span className="text-muted text-sm">{t(`modes.${mode}.text`)}</span>
            <Radio value={mode} className="sr-only" />
          </label>
        ))}
      </RadioGroup>

      <section aria-label={t("form.label")} className={`${card} flex flex-col gap-4`}>
        {match(form.mode)
          .with(DiscoverMode.Vibe, () => (
            <>
              <Field className="flex flex-col gap-2">
                <FieldLabel className={labelClass}>{t("form.vibeLabel")}</FieldLabel>
                <Textarea
                  value={form.prompt}
                  onValueChange={(value) => set("prompt", value)}
                  placeholder={t("form.vibePlaceholder")}
                  maxLength={maxPromptLength}
                  autoResize
                  rows={2}
                  disabled={busy}
                  className={`${inputClass} max-h-48 min-h-20 resize-none`}
                />
                {form.prompt.trim().length > 0 && form.prompt.trim().length < 3 ? (
                  <FieldDescription className={hintClass}>
                    {t("form.vibeTooShort")}
                  </FieldDescription>
                ) : null}
              </Field>
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-muted text-sm">{t("form.examplesLabel")}</span>
                {examples.map((example) => (
                  <Button
                    key={example}
                    type="button"
                    disabled={busy}
                    onClick={() => set("prompt", example)}
                    className={chipClass("neutral", "cursor-pointer hover:border-line-strong")}
                  >
                    {example}
                  </Button>
                ))}
              </div>
            </>
          ))
          .with(DiscoverMode.Playlist, () =>
            playlists.length === 0 ? (
              <p className="m-0 text-muted text-sm">{t("form.noPlaylists")}</p>
            ) : (
              <>
                <Field className="flex flex-col gap-2">
                  <FieldLabel className={labelClass}>{t("form.playlistLabel")}</FieldLabel>
                  <Select
                    value={form.playlistId}
                    onValueChange={(value) => set("playlistId", value as string | null)}
                    placeholder={t("form.playlistPlaceholder")}
                    items={playlists.map((p) => ({ value: p.id, label: p.name }))}
                    disabled={busy}
                  >
                    <SelectTrigger
                      className={`${inputClass} flex cursor-pointer items-center justify-between text-left data-placeholder:text-muted`}
                    >
                      <SelectValue />
                      <ChevronDownIcon size={16} aria-hidden="true" />
                    </SelectTrigger>
                    <SelectContent
                      sideOffset={6}
                      className="z-50 max-h-[min(360px,var(--available-height))] w-(--anchor-width) overflow-auto rounded-2xl border border-line bg-surface p-1.5 shadow-lg"
                    >
                      {playlists.map((p) => (
                        <SelectItem
                          key={p.id}
                          value={p.id}
                          label={p.name}
                          className="flex cursor-pointer items-center justify-between gap-3 rounded-xl px-3 py-2.5 text-sm data-highlighted:bg-surface-2 data-selected:font-semibold"
                        >
                          <span>{p.name}</span>
                          <span className="text-muted text-xs">
                            {t("form.playlistTracks", { count: p.trackCount })}
                          </span>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FieldDescription className={hintClass}>
                    {t("form.playlistHint")}
                  </FieldDescription>
                </Field>
                <SeedLine seed={seed} />
              </>
            ),
          )
          .exhaustive()}

        <div className="grid items-end gap-5 md:grid-cols-3">
          <Field className="flex flex-col gap-2">
            <Slider
              value={form.count}
              onValueChange={(value) => set("count", value as number)}
              min={countBounds.min}
              max={countBounds.max}
              step={1}
              disabled={busy}
              className="flex flex-col gap-2"
            >
              <div className="flex items-baseline justify-between gap-3">
                <FieldLabel className={labelClass}>{t("form.countLabel")}</FieldLabel>
                <span className="font-mono text-muted text-xs">
                  {t("form.countValue", { count: form.count })}
                </span>
                <SliderValue className="sr-only" />
              </div>
              <SliderControl className="relative flex h-8 w-full cursor-pointer items-center">
                <SliderTrack className="relative h-1.5 w-full rounded-full bg-line">
                  <SliderIndicator className="rounded-full bg-ink" />
                  <SliderThumb className="size-5 rounded-full border-2 border-surface bg-ink shadow has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-violet has-[:focus-visible]:outline-offset-2" />
                </SliderTrack>
              </SliderControl>
            </Slider>
          </Field>

          <Field className="flex flex-col gap-2">
            <FieldLabel className={labelClass}>{t("form.maxPlaysLabel")}</FieldLabel>
            <NumberInput
              value={form.maxPlays}
              onValueChange={(value) => set("maxPlays", value)}
              min={0}
              max={999}
              step={1}
              disabled={busy}
            >
              <NumberInputGroup className="flex items-center gap-1 rounded-2xl border border-line-strong bg-surface p-1 has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-violet">
                <NumberInputDecrement
                  aria-label={t("form.decrease")}
                  className="grid size-9 cursor-pointer place-items-center rounded-xl text-lg hover:bg-surface-2 data-disabled:opacity-40"
                >
                  <MinusIcon size={16} aria-hidden="true" />
                </NumberInputDecrement>
                <NumberInputControl className="w-full min-w-0 bg-transparent text-center text-base outline-none" />
                <NumberInputIncrement
                  aria-label={t("form.increase")}
                  className="grid size-9 cursor-pointer place-items-center rounded-xl text-lg hover:bg-surface-2 data-disabled:opacity-40"
                >
                  <PlusIcon size={16} aria-hidden="true" />
                </NumberInputIncrement>
              </NumberInputGroup>
            </NumberInput>
            <FieldDescription className={hintClass}>{t("form.maxPlaysHint")}</FieldDescription>
          </Field>

          {/* biome-ignore lint/a11y/noLabelWithoutControl: the ui-sdk Switch inside is the control */}
          <label className="flex min-h-11 cursor-pointer items-center justify-between gap-3 self-center">
            <span className="text-sm">{t("form.newArtistsLabel")}</span>
            <Switch
              checked={form.newArtistsOnly}
              onCheckedChange={(checked) => set("newArtistsOnly", checked)}
              disabled={busy}
              className="relative inline-flex h-7 w-12 shrink-0 cursor-pointer items-center rounded-full border border-line-strong bg-surface-2 p-0.5 transition-colors data-checked:border-ink data-checked:bg-ink focus-visible:outline-2 focus-visible:outline-violet"
            >
              <SwitchThumb className="block size-5 rounded-full bg-ink transition-transform data-checked:translate-x-5 data-checked:bg-on-ink motion-reduce:transition-none" />
            </Switch>
          </label>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-3">
          <span className="text-muted text-sm">{note}</span>
          <Button
            type="submit"
            disabled={!request || busy}
            className={buttonClass("primary", "lg")}
          >
            <SparklesIcon size={18} aria-hidden="true" />
            {t("form.submit", { count: form.count })}
          </Button>
        </div>
      </section>
    </form>
  );
}

function SeedLine({ seed }: { seed: SeedState }) {
  const t = useTranslations("discover.form");
  return match(seed)
    .with({ kind: "none" }, () => null)
    .with({ kind: "loading" }, () => (
      <p className="m-0 text-muted text-sm" role="status">
        {t("seedLoading")}
      </p>
    ))
    .with({ kind: "failed" }, () => (
      <p className="m-0 text-danger text-sm" role="alert">
        {t("seedFailed")}
      </p>
    ))
    .with({ kind: "ready" }, ({ artists, more }) => (
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-muted text-sm">{t("seededFrom")}</span>
        {artists.map((name) => (
          <span key={name} className={chipClass("violet")}>
            {name}
          </span>
        ))}
        {more > 0 ? <span className={chipClass()}>{t("seedMore", { count: more })}</span> : null}
      </div>
    ))
    .exhaustive();
}
