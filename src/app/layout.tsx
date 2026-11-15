import type { Metadata } from "next";
import { Bricolage_Grotesque, Inter, JetBrains_Mono } from "next/font/google";
import { NextIntlClientProvider } from "next-intl";
import { getLocale, getTranslations } from "next-intl/server";
import type { ReactNode } from "react";
import { AppPreferences } from "@/components/preferences/app-preferences";
import "./globals.css";

const inter = Inter({ subsets: ["latin", "latin-ext"], variable: "--font-inter" });
const bricolage = Bricolage_Grotesque({
  subsets: ["latin", "latin-ext"],
  variable: "--font-bricolage",
});
const jetbrains = JetBrains_Mono({ subsets: ["latin", "latin-ext"], variable: "--font-jetbrains" });

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("common");
  return { title: { default: t("appName"), template: `%s · ${t("appName")}` } };
}

export default async function RootLayout({ children }: { children: ReactNode }) {
  const [locale, t] = await Promise.all([getLocale(), getTranslations("shell")]);
  return (
    // The color scheme script sets data-color-scheme on <html> before hydration.
    <html
      lang={locale}
      suppressHydrationWarning
      className={`${inter.variable} ${bricolage.variable} ${jetbrains.variable}`}
    >
      <body className="min-h-dvh">
        <AppPreferences>
          <a
            href="#content"
            className="sr-only focus:not-sr-only focus:fixed focus:top-3 focus:left-3 focus:z-20 focus:rounded-full focus:bg-ink focus:px-4 focus:py-2 focus:text-on-ink"
          >
            {t("skipToContent")}
          </a>
          <NextIntlClientProvider>{children}</NextIntlClientProvider>
        </AppPreferences>
      </body>
    </html>
  );
}
