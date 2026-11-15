import { LocaleSwitch } from "@/components/preferences/locale-switch";
import { Logo } from "./logo";

export function TopBar() {
  return (
    <header className="mx-auto flex w-full max-w-[1400px] flex-wrap items-center justify-between gap-3 px-[clamp(12px,3vw,40px)] pt-5">
      <Logo href="/app" />
      <LocaleSwitch />
    </header>
  );
}
