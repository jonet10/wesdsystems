import { Link } from "react-router-dom";
import { motion } from "framer-motion";
import { ArrowRight, Play } from "lucide-react";
import { LiveDashboard } from "./LiveDashboard";

export function Hero() {
  return (
    <section className="mx-auto grid max-w-7xl gap-10 px-5 py-16 sm:px-6 lg:grid-cols-[1fr_1.05fr] lg:px-8 lg:py-20">
      <motion.div
        initial={{ opacity: 0, y: 24 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.7 }}
        className="max-w-2xl"
      >
        <div className="mb-6 inline-flex rounded-full border border-white/10 bg-white/5 px-4 py-2 text-sm text-white/80">
          P2P betting, matching, escrow, and live results
        </div>
        <h1 className="text-5xl font-black tracking-tight sm:text-6xl lg:text-7xl">
          Bet smarter with <span className="gradient-text">BetMatch</span>
        </h1>
        <p className="mt-6 max-w-xl text-lg leading-8 text-white/65">
          A dark, glassmorphism sports betting platform where users create bets, match opponents, and track live market data in one place.
        </p>
        <div className="mt-8 flex flex-col gap-4 sm:flex-row">
          <Link
            to="/signup"
            className="inline-flex items-center justify-center gap-2 rounded-full bg-gradient-to-r from-violet-600 to-pink-500 px-6 py-3 font-semibold text-white shadow-lg shadow-violet-500/30"
          >
            Start free <ArrowRight className="h-4 w-4" />
          </Link>
          <a
            href="#dashboard"
            className="inline-flex items-center justify-center gap-2 rounded-full border border-white/10 bg-white/5 px-6 py-3 font-semibold text-white/80"
          >
            <Play className="h-4 w-4" /> Watch live dashboard
          </a>
        </div>
      </motion.div>

      <LiveDashboard />
    </section>
  );
}
