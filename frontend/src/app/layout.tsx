import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "ZKSettle",
  description: "Compliance-grade rails for stablecoin settlement.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
