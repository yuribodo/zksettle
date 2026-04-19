import { ClosingCta } from "@/components/landing/closing-cta";
import { DemoSection } from "@/components/landing/demo-section";
import { DevelopersSection } from "@/components/landing/developers-section";
import { Footer } from "@/components/landing/footer";
import { Hero } from "@/components/landing/hero/hero";
import { HowItWorksSection } from "@/components/landing/how-it-works-section";
import { MomentumSection } from "@/components/landing/momentum-section";
import { Nav } from "@/components/landing/nav";
import { NumbersSection } from "@/components/landing/numbers-section";
import { ParadoxSection } from "@/components/landing/paradox-section";
import { TwoRealitiesSection } from "@/components/landing/two-realities-section";
import { UseCasesSection } from "@/components/landing/use-cases-section";

export default function Home() {
  return (
    <>
      <Nav />
      <main id="main-content">
        <Hero />
        <ParadoxSection />
        <TwoRealitiesSection />
        <HowItWorksSection />
        <NumbersSection />
        <DemoSection />
        <UseCasesSection />
        <DevelopersSection />
        <MomentumSection />
        <ClosingCta />
      </main>
      <Footer />
    </>
  );
}
