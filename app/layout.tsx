import type { Metadata } from "next";
import { Cairo, Tajawal } from "next/font/google";
import type { ReactNode } from "react";
import "./globals.css";

const bodyFont = Tajawal({
  subsets: ["arabic", "latin"],
  variable: "--font-body",
  weight: ["400", "500", "700", "800"],
  display: "swap",
});

const displayFont = Cairo({
  subsets: ["arabic", "latin"],
  variable: "--font-display",
  weight: ["600", "700", "800", "900"],
  display: "swap",
});

export const metadata: Metadata = {
  title: {
    default: "LegalPro Elite",
    template: "%s | LegalPro Elite",
  },
  description: "نظام ويب احترافي لإدارة مكاتب المحاماة باللغة العربية بالكامل.",
};

const themeScript = `
(function() {
  try {
    var stored = localStorage.getItem('legalpro-theme');
    var prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
    var theme = stored || (prefersDark ? 'dark' : 'light');
    document.documentElement.classList.toggle('dark', theme === 'dark');
  } catch (e) {}
})();
`;

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="ar" dir="rtl" suppressHydrationWarning>
      <body className={`${bodyFont.variable} ${displayFont.variable} min-h-screen antialiased`}>
        <script dangerouslySetInnerHTML={{ __html: themeScript }} />
        {children}
      </body>
    </html>
  );
}
