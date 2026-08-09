import type { Metadata } from "next";
import { Geist_Mono } from "next/font/google";
import { cookies } from "next/headers";
import {
  parseThemePreference,
  THEME_COOKIE_NAME,
  THEME_INIT_SCRIPT,
} from "@/constants/theme";
import { i18n } from "@/i18n.config";
import { defaultLocalization } from "@/utils/localization";
import { AppProviders } from "./providers";
import "./globals.css";

/**
 * Geist Sans is gone: it shipped `subsets: ["latin"]`, so it carried no Hangul
 * at all and every Korean glyph — the majority of this UI — fell back to an OS
 * font. Body and headings now use self-hosted Pretendard, wired up in
 * `app/globals.css`.
 *
 * Geist Mono stays for event payloads, document IDs, and other monospace runs,
 * which are ASCII by nature.
 */
const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: defaultLocalization.metadata.title,
  description: defaultLocalization.metadata.description,
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  // Read on the server, mirroring how `app/(service)/layout.tsx` reads
  // `sidebar_state`, so an explicit light/dark choice is already correct in the
  // first HTML byte and never flashes.
  const themePreference = parseThemePreference(
    (await cookies()).get(THEME_COOKIE_NAME)?.value,
  );

  return (
    <html
      lang={i18n.defaultLocale}
      className={`${geistMono.variable} h-full antialiased${
        themePreference === "dark" ? " dark" : ""
      }`}
      style={
        themePreference === "system"
          ? undefined
          : { colorScheme: themePreference }
      }
      suppressHydrationWarning
    >
      <head>
        {/*
         * Resolves the "system" preference before first paint. The server has
         * no OS signal, so without this a system-dark user gets a white flash
         * on every navigation. The script is a static constant with no request
         * or user data interpolated into it.
         */}
        {/* biome-ignore lint/security/noDangerouslySetInnerHtml: static constant, runs before paint to avoid a theme flash */}
        <script dangerouslySetInnerHTML={{ __html: THEME_INIT_SCRIPT }} />
      </head>
      <body className="flex min-h-full flex-col">
        <AppProviders>{children}</AppProviders>
      </body>
    </html>
  );
}
