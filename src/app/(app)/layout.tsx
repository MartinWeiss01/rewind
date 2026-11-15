import type { ReactNode } from "react";
import { DemoBar } from "@/components/shell/demo-bar";
import { Dock } from "@/components/shell/dock";
import { TopBar } from "@/components/shell/top-bar";
import { DataMode } from "@/data/music-data-source";
import { getRequestContext } from "@/server/request-context";

/** App shell: demo notice, top bar and floating dock around every /app screen (ADR 0003). */
export default async function AppLayout({ children }: { children: ReactNode }) {
  const { source, flags } = await getRequestContext();
  const isDemo = source.mode === DataMode.Demo;
  return (
    <>
      {isDemo ? <DemoBar /> : null}
      <TopBar />
      <main
        id="content"
        className="mx-auto flex w-full max-w-[1400px] flex-col gap-6 px-[clamp(16px,3vw,40px)] pt-7 pb-[140px]"
      >
        {children}
      </main>
      <Dock flags={[...flags]} isDemo={isDemo} />
    </>
  );
}
