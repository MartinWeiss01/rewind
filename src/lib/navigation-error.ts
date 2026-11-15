import { unstable_rethrow } from "next/navigation";

/**
 * Whether an error is Next's signal to navigate (a server action called `redirect()`
 * or `notFound()`) rather than a failure. The router acts on it by itself, so a
 * mutation that rejects with it should not show an error message.
 */
export function isNavigationSignal(error: unknown): boolean {
  try {
    unstable_rethrow(error);
    return false;
  } catch {
    return true;
  }
}
