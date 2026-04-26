import { Footer } from "@/components/landing/footer";
import { ActOneHero, ActTwoParadox, ActThreeEngine, ActFourMove } from "@/components/landing/acts";
import { ActFourThreeLines } from "@/components/landing/acts/act-four-three-lines";
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
        <ActFourMove />
        <ActFourThreeLines />
      </main>
      <Footer />
    </SmoothScrollProvider>
  );
}
