import { Navbar } from "../components/Navbar";
import { Hero } from "../components/Hero";

export function Home() {
  return (
    <div className="min-h-screen bg-[#0d0a1f] text-white">
      <Navbar />
      <main>
        <Hero />
      </main>
    </div>
  );
}
