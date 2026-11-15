"use client";

import {
  type ChangeDetails,
  createChange,
  createReorder,
  createSelection,
  definePrimitive,
  type ReorderDraft,
  type ReorderMessage,
  type ReorderReason,
} from "@ui-sdk/core";
import { createParts } from "@ui-sdk/react/primitive";

type SelectionReason = "item-press" | "list-navigation";

export type TrackOrderOptions = {
  /** Row keys in display order. */
  value?: string[];
  defaultValue?: string[];
  onValueChange?: (value: string[], details: ChangeDetails<ReorderReason>) => void;
  /** Selected row keys. */
  selected?: string[];
  defaultSelected?: string[];
  onSelectedChange?: (value: string[], details: ChangeDetails<SelectionReason>) => void;
  /** Whether rows can be picked up and moved. */
  reorderable?: boolean;
  /** What screen readers call a row, like its track title. */
  rowLabel?: (key: string) => string | undefined;
  /** Translated announcements for pickup, moves and drops. */
  announce?: (message: ReorderMessage) => string;
};

/**
 * A playlist's rows: select them with checkboxes (Shift extends a range, the header
 * checkbox selects all) and reorder them by a drag handle, with the pointer or with
 * Space, the arrows and Space again. Selected rows move together.
 */
export const trackOrder = definePrimitive({
  name: "track-order",
  options: {
    value: "value",
    defaultValue: "value",
    onValueChange: "callback",
    selected: "value",
    defaultSelected: "value",
    onSelectedChange: "callback",
    reorderable: "boolean",
    rowLabel: "value",
    announce: "value",
  },
  controlled: ["value", "selected"],
  state: (options: TrackOrderOptions) => ({
    value: options.value ?? options.defaultValue ?? [],
    selected: options.selected ?? options.defaultSelected ?? [],
    moving: null as ReorderDraft | null,
  }),
  sync: (options) => ({
    ...(options.value === undefined ? {} : { value: options.value }),
    ...(options.selected === undefined ? {} : { selected: options.selected }),
  }),
  api: (context) => {
    const change = createChange(context);
    const reorder = createReorder(context, {
      slot: "row",
      key: "value",
      draft: "moving",
      set: (value, details) => change("value", value, details),
      group: (key) => {
        const { selected } = context.store.get();
        return selected.includes(key) ? selected : [key];
      },
      disabled: () => context.options().reorderable === false,
      label: (key) => context.options().rowLabel?.(key),
      message: (message) => context.options().announce?.(message) ?? "",
    });
    const selection = createSelection(context, {
      key: "selected",
      set: (value, details) => change("selected", value, details),
      order: () => context.store.get().value,
      multiple: () => true,
    });
    return {
      reorder,
      selection,
      press(key: string, event?: Event) {
        const why = { reason: "item-press" as const, event };
        if (event instanceof MouseEvent && event.shiftKey) selection.extend(key, why);
        else selection.toggle(key, why);
      },
    };
  },
  slots: (slot) => ({
    root: slot({}),
    row: slot<{ value: string }, { selected: boolean; grabbed: boolean; moving: boolean }>({
      props: { value: "string" },
      state: (state, { key, api }) => ({
        selected: state.selected.includes(key),
        grabbed: api.reorder.dragging(state, key),
        moving: api.reorder.moving(state, key),
      }),
      attrs: (state, { key }) => ({
        "data-selected": state.selected.includes(key) ? "" : undefined,
        "data-grabbed": state.moving?.pointer && state.moving.keys.includes(key) ? "" : undefined,
        "data-moving": state.moving?.keys.includes(key) ? "" : undefined,
      }),
      bind: (el, part) => part.api.reorder.bind(el, part),
    }),
    handle: slot<{ value: string }>({
      props: { value: "string" },
      role: "button",
      focus: "native",
      press: { none: "Space and Enter pick the row up in the keydown handler." },
      attrs: (state, { key }) => ({
        type: "button",
        "aria-pressed": state.moving?.key === key ? "true" : "false",
      }),
      on: {
        keydown: (event, { api, key }) => {
          api.reorder.keydown(event as KeyboardEvent, key);
        },
        pointerdown: (event, { api, key }) => api.reorder.pointerdown(event as PointerEvent, key),
      },
    }),
    check: slot<{ value: string }>({
      props: { value: "string" },
      role: "checkbox",
      focus: "native",
      press: ({ api, key }, event) => api.press(key, event),
      attrs: (state, { key }) => ({
        type: "button",
        "aria-checked": state.selected.includes(key) ? "true" : "false",
      }),
    }),
    checkAll: slot({
      role: "checkbox",
      focus: "native",
      press: ({ api }, event) => api.selection.toggleAll({ reason: "item-press", event }),
      attrs: (state) => ({
        type: "button",
        "aria-checked":
          state.selected.length === 0
            ? "false"
            : state.selected.length >= state.value.length
              ? "true"
              : "mixed",
      }),
    }),
  }),
});

export const {
  Root: TrackOrderRoot,
  Row: TrackOrderRow,
  Handle: TrackOrderHandle,
  Check: TrackOrderCheck,
  CheckAll: TrackOrderCheckAll,
} = createParts(trackOrder, {
  row: "tr",
  handle: "button",
  check: "button",
  checkAll: "button",
});
