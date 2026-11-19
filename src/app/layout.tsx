import type { Metadata } from "next";
import "@fontsource/ibm-plex-sans/400.css";
import "@fontsource/ibm-plex-sans/500.css";
import "@fontsource/ibm-plex-sans/600.css";
import "@fontsource/ibm-plex-sans/700.css";
import "@fontsource/jetbrains-mono/400.css";
import "@fontsource/jetbrains-mono/500.css";
import "@fontsource/jetbrains-mono/600.css";
import "./globals.css";

export const metadata: Metadata = {
  title: "SentinelBank — Fraud Operations Workbench",
  description:
    "Enterprise Hybrid Banking Fraud Detection Workbench (Rule Engine + Isolation Forest + Calibrated Classifier) with Live Risk Queue, ECharts Cost Analytics, and Simulator.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="id" suppressHydrationWarning>
      <head>
        <meta name="color-scheme" content="light dark" />
      </head>
      <body className="min-h-screen bg-[#f8f8f9] text-zinc-950 dark:bg-[#09090b] dark:text-zinc-50 antialiased transition-colors">
        {children}
      </body>
    </html>
  );
}
