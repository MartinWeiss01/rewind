import { createColorScheme, createLocalStorage } from "@ui-sdk/core";

/** Light, dark or follow the system; applied as data-color-scheme on <html>. */
export const colorScheme = createColorScheme({
  storage: createLocalStorage("rewind-color-scheme"),
  global: true,
});
