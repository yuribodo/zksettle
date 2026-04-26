import { Footer } from "@/components/landing/footer";
import { ActOneHero, ActTwoParadox, ActThreeEngine, ActFiveMarkets } from "@/components/landing/acts";
import { CanvasStageProvider } from "@/components/landing/canvas/canvas-stage-provider";
import { Nav } from "@/components/landing/nav";
import { SmoothScrollProvider } from "@/components/landing/smooth-scroll-provider";

export default function Home() {
  return (
    <SmoothScrollProvider>
      <CanvasStageProvider>
        <Nav />
        <main id="main-content" className="relative z-10">
          <ActOneHero />
          <ActTwoParadox />
          <ActThreeEngine />
          <ActFiveMarkets />
        </main>
        <Footer />
      </CanvasStageProvider>
    </SmoothScrollProvider>
  );
}
