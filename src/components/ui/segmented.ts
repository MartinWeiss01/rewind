/** Shared classes for ui-sdk SegmentedControl, matching the design's pill switch. */
export const segmentedRoot =
  "relative inline-flex gap-0.5 rounded-full border border-line bg-surface-2 p-1";
export const segmentedIndicator =
  "absolute top-(--segmented-control-indicator-top) left-(--segmented-control-indicator-left) h-(--segmented-control-indicator-height) w-(--segmented-control-indicator-width) rounded-full bg-ink transition-[left,width] duration-200 motion-reduce:transition-none";
export const segmentedItem =
  "relative z-10 min-h-9 cursor-pointer rounded-full px-3.5 font-medium text-ink-2 text-sm data-checked:text-on-ink";
