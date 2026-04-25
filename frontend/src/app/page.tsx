import { ClosingCta } from "@/components/landing/closing-cta";
import { DevelopersSection } from "@/components/landing/developers-section";
import { Footer } from "@/components/landing/footer";
import { ActOneHero, ActTwoParadox, ActThreeEngine } from "@/components/landing/acts";
import { MomentumSection } from "@/components/landing/momentum-section";
import { Nav } from "@/components/landing/nav";
import { SmoothScrollProvider } from "@/components/landing/smooth-scroll-provider";
import { UseCasesSection } from "@/components/landing/use-cases-section";

export default function Home() {
  return (
    <SmoothScrollProvider>
      <Nav />
      <main id="main-content">
        <ActOneHero />
        <ActTwoParadox />
        <ActThreeEngine />
        <UseCasesSection />
        <DevelopersSection />
        <MomentumSection />
        <ClosingCta />
      </main>
      <Footer />
    </SmoothScrollProvider>
  );
}
