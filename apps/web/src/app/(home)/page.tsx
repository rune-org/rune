import { AboutSection } from "@/components/home/AboutSection";
import { FeatureSection } from "@/components/home/FeatureSection";
import { Hero } from "@/components/home/Hero";
import { HowItWorks } from "@/components/home/HowItWorks";

export default function HomePage() {
  return (
    <>
      <Hero />
      <FeatureSection />
      <HowItWorks />
      <AboutSection />
    </>
  );
}
