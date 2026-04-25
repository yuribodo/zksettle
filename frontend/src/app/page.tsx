import { Footer } from "@/components/landing/footer";
import { ActOneHero, ActTwoParadox, ActThreeEngine, ActFourMove } from "@/components/landing/acts";
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
      </main>
      <Footer />
    </SmoothScrollProvider>
  );
}
