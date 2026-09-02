import { Nav } from "@/components/marketing/Nav";
import { Hero } from "@/components/marketing/Hero";
import { ProductPreviewSection } from "@/components/marketing/ProductPreviewSection";
import { HowItWorks } from "@/components/marketing/HowItWorks";
import { AICapabilities } from "@/components/marketing/AICapabilities";
import { Multilingual } from "@/components/marketing/Multilingual";
import { Channels } from "@/components/marketing/Channels";
import { FinalCTA } from "@/components/marketing/FinalCTA";
import { Footer } from "@/components/marketing/Footer";

export default function Home() {
  return (
    <div className="flex min-h-full flex-col">
      <Nav />
      <main className="flex-1">
        <Hero />
        <ProductPreviewSection />
        <HowItWorks />
        <AICapabilities />
        <Multilingual />
        <Channels />
        <FinalCTA />
      </main>
      <Footer />
    </div>
  );
}
