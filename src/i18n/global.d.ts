import type { Messages } from "../../messages/en";
import type { Locale } from "./locale";

declare module "next-intl" {
  // next-intl reads its configuration through declaration merging, which only works
  // with an interface. This is the documented exception to the `type` rule (ADR 0002).
  // biome-ignore lint/style/useConsistentTypeDefinitions: declaration merging needs an interface
  interface AppConfig {
    Locale: Locale;
    Messages: Messages;
  }
}
