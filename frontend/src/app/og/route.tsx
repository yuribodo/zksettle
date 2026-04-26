import { ImageResponse } from "next/og";

export const runtime = "edge";
export const alt = "ZKSettle — Compliance-grade rails for stablecoin settlement";
export const contentType = "image/png";
export const size = { width: 1200, height: 630 };

export async function GET() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          background: "#0C3D2E",
          color: "#FAFAF7",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          fontFamily: "Georgia, 'Times New Roman', serif",
          padding: "80px",
          position: "relative",
        }}
      >
        <div
          style={{
            position: "absolute",
            top: 60,
            left: 60,
            fontFamily: "ui-monospace, 'JetBrains Mono', monospace",
            fontSize: 16,
            letterSpacing: 2,
            color: "#FAFAF7",
            opacity: 0.7,
            textTransform: "uppercase",
          }}
        >
          ZKSettle · Compliance Infrastructure
        </div>

        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            width: 120,
            height: 120,
            marginBottom: 48,
            borderRadius: 9999,
            border: "2px solid #FAFAF7",
            position: "relative",
          }}
        >
          <div
            style={{
              fontSize: 68,
              fontWeight: 400,
              color: "#FAFAF7",
              lineHeight: 1,
            }}
          >
            Z
          </div>
          <div
            style={{
              position: "absolute",
              left: 18,
              right: 18,
              top: "50%",
              height: 5,
              background: "#FAFAF7",
            }}
          />
        </div>

        <div
          style={{
            fontSize: 96,
            fontWeight: 400,
            letterSpacing: -3,
            textAlign: "center",
            lineHeight: 1.02,
          }}
        >
          Settle in 181ms. Audit for life.
        </div>

        <div
          style={{
            marginTop: 32,
            fontFamily: "system-ui, -apple-system, sans-serif",
            fontSize: 28,
            color: "#FAFAF7",
            opacity: 0.8,
            maxWidth: 880,
            textAlign: "center",
            lineHeight: 1.3,
          }}
        >
          Zero-knowledge compliance for stablecoins on Solana.
        </div>

        <div
          style={{
            position: "absolute",
            bottom: 60,
            left: 60,
            right: 60,
            display: "flex",
            justifyContent: "space-between",
            fontFamily: "ui-monospace, 'JetBrains Mono', monospace",
            fontSize: 14,
            color: "#FAFAF7",
            opacity: 0.6,
            letterSpacing: 1,
          }}
        >
          <span>zksettle.com</span>
          <span>Colosseum Frontier 2026</span>
        </div>
      </div>
    ),
    { ...size },
  );
}
