import { notFound } from "next/navigation";
import type { FeatureFlag } from "./feature-flags";
import { getRequestContext } from "./request-context";

/** Ends the request with a 404 when the viewer does not have the flag (ADR 0004). */
export async function requireFlag(flag: FeatureFlag) {
  const context = await getRequestContext();
  if (!context.flags.has(flag)) notFound();
  return context;
}
