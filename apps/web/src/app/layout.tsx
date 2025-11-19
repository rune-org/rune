import type { Metadata } from "next";
import { Open_Sans, Playfair_Display, Cinzel } from "next/font/google";
import { Toaster } from "@/components/ui/toast";
import { ClientProviders } from "@/components/providers/ClientProviders";

import "./globals.css";

const fontSans = Open_Sans({
  variable: "--font-sans",
  subsets: ["latin"],
  display: "swap",
});
const fontDisplay = Playfair_Display({
  variable: "--font-display",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  style: ["normal", "italic"],
  display: "swap",
});
const fontRune = Cinzel({
  variable: "--font-rune",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  display: "swap",
});

export const metadata: Metadata = {
  title: {
    default: "Rune",
    template: "%s • Rune",
  },
  description: "Rune is a low-code workflow automation platform.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body
        className={`${fontSans.variable} ${fontDisplay.variable} ${fontRune.variable} antialiased bg-background text-foreground min-h-screen`}
      >
        <ClientProviders>{children}</ClientProviders>
        <Toaster />
      </body>
    </html>
  );
}
