import type { Metadata } from "next";
import { GeistSans } from "geist/font/sans";
import { JetBrains_Mono } from "next/font/google";
import "@solana/wallet-adapter-react-ui/styles.css";
import "./globals.css";
import { Providers } from "./providers";

const jetbrainsMono = JetBrains_Mono({
  subsets: ["latin"],
  variable: "--font-jetbrains-mono",
  display: "swap",
});

const FALLBACK_SITE_URL = "http://localhost:3000";

function resolveMetadataBase(): URL {
  const raw = process.env.NEXT_PUBLIC_SITE_URL;
  try {
    return new URL(raw || FALLBACK_SITE_URL);
  } catch {
    return new URL(FALLBACK_SITE_URL);
  }
}

export const metadata: Metadata = {
  metadataBase: resolveMetadataBase(),
  title: {
    default: "ZKSettle — Compliance-grade rails for stablecoin settlement",
    template: "%s · ZKSettle",
  },
  description:
    "Prove compliance without exposing data. Sub-5s proofs, sub-cent verification, zero PII on-chain — built on Solana.",
  openGraph: {
    title: "ZKSettle — Compliance-grade rails for stablecoin settlement",
    description:
      "Prove compliance without exposing data. Sub-5s proofs, sub-cent verification, zero PII on-chain — built on Solana.",
    type: "website",
    images: ["/og"],
  },
  twitter: {
    card: "summary_large_image",
    title: "ZKSettle — Compliance-grade rails for stablecoin settlement",
    description:
      "Prove compliance without exposing data. Sub-5s proofs, sub-cent verification, zero PII on-chain — built on Solana.",
    images: ["/og"],
  },
  icons: {
    icon: [{ url: "/favicon.svg", type: "image/svg+xml" }],
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      suppressHydrationWarning
      className={`${GeistSans.variable} ${jetbrainsMono.variable}`}
    >
      <body className="font-sans antialiased">
        <a
          href="#main-content"
          className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-50 focus:rounded-[var(--radius-3)] focus:bg-forest focus:px-4 focus:py-2 focus:font-mono focus:text-sm focus:text-canvas focus:outline-2 focus:outline-offset-2 focus:outline-forest"
        >
          Skip to content
        </a>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
