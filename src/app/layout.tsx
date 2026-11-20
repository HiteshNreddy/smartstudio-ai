import type { Metadata } from "next";
import LayoutShell from "@/components/layout-shell";
import "./globals.css";

export const metadata: Metadata = {
  title: "SmartStudio AI — Music Studio Management",
  description:
    "AI-powered music studio management and audio production assistant for Muzico, Bengaluru.",
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html
      lang="en"
      className="h-full antialiased font-sans"
    >
      <body className="min-h-full bg-bg-primary">
        <LayoutShell>{children}</LayoutShell>
      </body>
    </html>
  );
}
