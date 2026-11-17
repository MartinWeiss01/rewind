/** Why an access change failed, translated on the client. */
export const AccessError = {
  /** The viewer is not an admin. */
  Forbidden: "forbidden",
  Invalid: "invalid",
  /** The pasted text is not a Spotify user ID or profile link. */
  InvalidId: "invalidId",
  /** Admins come from the environment and can't be changed here. */
  Admin: "admin",
  Failed: "failed",
} as const;
export type AccessError = (typeof AccessError)[keyof typeof AccessError];

export type AccessResult = { status: "ok" } | { status: "error"; error: AccessError };
