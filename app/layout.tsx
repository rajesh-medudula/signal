import type { Metadata } from "next";
import { GeistSans } from "geist/font/sans";
import { GeistMono } from "geist/font/mono";
import "./globals.css";

export const metadata: Metadata = {
  title: "Signal — Know which conversations deserve your attention",
  description:
    "Signal analyzes your customer conversations, prioritizes the people most likely to buy, and tells you what to do next.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html
      lang="en"
      className={`${GeistSans.variable} ${GeistMono.variable} h-full`}
    >
      <body className="min-h-full bg-bg text-text antialiased">
        {children}
      </body>
    </html>
  );
}
