export const ListenerKind = {
  NightOwl: "nightOwl",
  EarlyBird: "earlyBird",
  Daytime: "daytime",
} as const;
export type ListenerKind = (typeof ListenerKind)[keyof typeof ListenerKind];

/** Night owl when at least 30% of plays fall between 20:00 and 05:00; early bird when the peak is before noon. */
export function listenerKind(nightShare: number, peakHour: number | null): ListenerKind {
  if (nightShare >= 0.3) return ListenerKind.NightOwl;
  if (peakHour !== null && peakHour < 12) return ListenerKind.EarlyBird;
  return ListenerKind.Daytime;
}
