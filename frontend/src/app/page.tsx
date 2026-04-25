import { ClosingCta } from "@/components/landing/closing-cta";
import { DemoSection } from "@/components/landing/demo-section";
import { DevelopersSection } from "@/components/landing/developers-section";
import { Footer } from "@/components/landing/footer";
import { ActOneHero, ActTwoParadox, ActThreeEngine } from "@/components/landing/acts";
import { HowItWorksSection } from "@/components/landing/how-it-works-section";
import { MomentumSection } from "@/components/landing/momentum-section";
import { Nav } from "@/components/landing/nav";
import { NumbersSection } from "@/components/landing/numbers-section";
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
        <HowItWorksSection />
        <NumbersSection />
        <DemoSection />
        <UseCasesSection />
        <DevelopersSection />
        <MomentumSection />
        <ClosingCta />
      </main>
      <Footer />
    </SmoothScrollProvider>
  );
}
