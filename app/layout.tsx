import type { ReactNode } from "react";
import { Geist, Geist_Mono } from "next/font/google";
import { I18nProvider } from "@/components/I18nProvider";
import { ToastProvider } from "@/components/toast";
import { readLocale } from "@/lib/locale";
import { readTheme } from "@/lib/themeServer";
import "./globals.css";

const geist = Geist({ subsets: ["latin"], variable: "--font-geist" });
const geistMono = Geist_Mono({ subsets: ["latin"], variable: "--font-geist-mono" });

export const metadata = {
  title: "IA Doblaje",
  description: "Subtitulado, traducción y tiempo real",
};

export default async function RootLayout({ children }: { children: ReactNode }) {
  const [locale, theme] = await Promise.all([readLocale(), readTheme()]);
  return (
    <html lang={locale} data-theme={theme ?? "dark"} suppressHydrationWarning>
      <body className={`${geist.variable} ${geistMono.variable} font-sans`}>
        <I18nProvider locale={locale}>
          <ToastProvider>{children}</ToastProvider>
        </I18nProvider>
      </body>
    </html>
  );
}
