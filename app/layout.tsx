import type { Metadata } from "next";
// Self-hosted via npm (fontsource) rather than next/font/google, so the
// build never depends on reaching Google's font CDN at build time.
import "@fontsource-variable/fraunces/full.css";
import "@fontsource/inter/400.css";
import "@fontsource/inter/500.css";
import "@fontsource/inter/600.css";
import "./globals.css";

export const metadata: Metadata = {
  title: "Signal — Know which conversations deserve your attention",
  description:
    "Signal analyzes your customer conversations and helps you focus on the opportunities that deserve your attention.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className="h-full">
      <body className="min-h-full bg-paper text-ink antialiased">
        {children}
      </body>
    </html>
  );
}
