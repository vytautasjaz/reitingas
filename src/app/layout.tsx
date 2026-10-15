import type { Metadata } from "next";
import { Montserrat, JetBrains_Mono } from "next/font/google";
import "./globals.css";
import { AppShell } from "@/components/AppShell";
import { getDb } from "@/lib/db";
import { getActiveSeasonYear, listSeasonYears } from "@/lib/season";

const display = Montserrat({
  subsets: ["latin", "latin-ext"],
  variable: "--font-display",
  weight: ["400", "500", "600", "700", "800"],
});

const mono = JetBrains_Mono({
  subsets: ["latin", "latin-ext"],
  variable: "--font-mono",
});

export const metadata: Metadata = {
  title: "TRItonas reitingas",
  description: "Oficialus TRItono klubo triatlono reitingas",
  icons: {
    icon: "/brand/logo-positive.jpg",
    apple: "/brand/logo-positive.jpg",
  },
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  getDb();
  const seasonYear = await getActiveSeasonYear();
  const seasonYears = listSeasonYears();
  if (!seasonYears.includes(seasonYear)) {
    seasonYears.push(seasonYear);
    seasonYears.sort((a, b) => b - a);
  }

  return (
    <html lang="lt">
      <body className={`${display.variable} ${mono.variable} antialiased font-sans`}>
        <AppShell seasonYear={seasonYear} seasonYears={seasonYears}>
          {children}
        </AppShell>
      </body>
    </html>
  );
}
