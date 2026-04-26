import { Footer } from "@/components/landing/footer";
import { ActOneHero, ActTwoParadox, ActThreeEngine, ActFourThreeLines, ActFiveMarkets } from "@/components/landing/acts";
import { Nav } from "@/components/landing/nav";
import { SmoothScrollProvider } from "@/components/landing/smooth-scroll-provider";

export default function Home() {
  return (
    <SmoothScrollProvider>
      <Nav />
      <main id="main-content">
        <ActOneHero />
        <ActTwoParadox />
        <ActThreeEngine />
        <ActFourThreeLines />
        <ActFiveMarkets />
      </main>
      <Footer />
    </SmoothScrollProvider>
  );
}
