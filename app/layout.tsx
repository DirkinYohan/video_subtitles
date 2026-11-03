import type { ReactNode } from "react";
import { Inter } from "next/font/google";
import { I18nProvider } from "@/components/I18nProvider";
import { readLocale } from "@/lib/locale";
import { readTheme } from "@/lib/themeServer";
import "./globals.css";

const inter = Inter({ subsets: ["latin"], variable: "--font-inter" });

export const metadata = {
  title: "IA Doblaje",
  description: "Subtitulado, traducción y tiempo real",
};

export default async function RootLayout({ children }: { children: ReactNode }) {
  const [locale, theme] = await Promise.all([readLocale(), readTheme()]);
  return (
    // Sin elección, sin atributo: manda el tema del sistema. El botón cambia
    // el atributo en el cliente, de ahí suppressHydrationWarning.
    <html lang={locale} data-theme={theme ?? undefined} suppressHydrationWarning>
      <body className={`${inter.variable} font-sans`}>
        <I18nProvider locale={locale}>{children}</I18nProvider>
      </body>
    </html>
  );
}
