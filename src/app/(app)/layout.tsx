import type { ReactNode } from "react";
import { Dock } from "@/components/shell/dock";
import { TopBar } from "@/components/shell/top-bar";

/** App shell: top bar and floating dock around every /app screen (ADR 0003). */
export default function AppLayout({ children }: { children: ReactNode }) {
  return (
    <>
      <TopBar />
      <main
        id="content"
        className="mx-auto flex w-full max-w-[1400px] flex-col gap-6 px-[clamp(16px,3vw,40px)] pt-7 pb-[140px]"
      >
        {children}
      </main>
      <Dock />
    </>
  );
}
