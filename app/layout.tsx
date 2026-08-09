import type { Metadata } from "next";
import { Geist_Mono } from "next/font/google";
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

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang={i18n.defaultLocale}
      className={`${geistMono.variable} h-full antialiased`}
    >
      <body className="flex min-h-full flex-col">
        <AppProviders>{children}</AppProviders>
      </body>
    </html>
  );
}
