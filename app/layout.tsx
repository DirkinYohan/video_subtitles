import type { ReactNode } from "react";
import { Inter } from "next/font/google";
import { I18nProvider } from "@/components/I18nProvider";
import { readLocale } from "@/lib/locale";
import "./globals.css";

const inter = Inter({ subsets: ["latin"], variable: "--font-inter" });

export const metadata = {
  title: "IA Doblaje",
  description: "Subtitulado, traducción y tiempo real",
};

export default async function RootLayout({ children }: { children: ReactNode }) {
  const locale = await readLocale();
  return (
    <html lang={locale}>
      <body className={`${inter.variable} font-sans`}>
        <I18nProvider locale={locale}>{children}</I18nProvider>
      </body>
    </html>
  );
}
