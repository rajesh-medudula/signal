import { Nav } from "@/components/marketing/Nav";
import { Hero } from "@/components/marketing/Hero";
import { HowItWorks } from "@/components/marketing/HowItWorks";
import { Channels } from "@/components/marketing/Channels";
import { Footer } from "@/components/marketing/Footer";

export default function Home() {
  return (
    <div className="flex min-h-full flex-col">
      <Nav />
      <main className="flex-1">
        <Hero />
        <HowItWorks />
        <Channels />
      </main>
      <Footer />
    </div>
  );
}
