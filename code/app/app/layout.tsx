import type { Metadata } from "next";
import { Inter, JetBrains_Mono } from "next/font/google";
import "./globals.css";
import { SkipLink } from "@/components/layout/SkipLink";

const fontSans = Inter({
  subsets: ["latin"],
  variable: "--font-sans",
  display: "swap",
});

const fontMono = JetBrains_Mono({
  subsets: ["latin"],
  variable: "--font-mono",
  display: "swap",
});

export const metadata: Metadata = {
  title: {
    default: "Turnly",
    template: "%s | Turnly",
  },
  description: "Gestione turni del personale — ospedali, retail, produzione",
  robots: {
    index: false,
    follow: false,
  },
};

interface RootLayoutProps {
  children: React.ReactNode;
}

export default function RootLayout({ children }: RootLayoutProps) {
  return (
    <html
      lang="it"
      suppressHydrationWarning
      className={`${fontSans.variable} ${fontMono.variable}`}
    >
      <body className="min-h-screen bg-background font-sans antialiased">
        <SkipLink />
        {/*
          Providers (TanStack Query, Auth session context) will be added in TSK-003.
          Keeping layout minimal for scaffolding phase.
        */}
        <main id="main-content">
          {children}
        </main>
      </body>
    </html>
  );
}
