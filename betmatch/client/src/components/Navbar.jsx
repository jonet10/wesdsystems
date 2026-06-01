import { Link } from "react-router-dom";
import { useState } from "react";

const languages = ["EN", "FR", "HT"];

export function Navbar() {
  const [lang, setLang] = useState("EN");

  return (
    <nav className="sticky top-0 z-50 border-b border-white/10 bg-[#0d0a1f]/80 backdrop-blur-xl">
      <div className="mx-auto flex h-20 max-w-7xl items-center justify-between px-5 sm:px-6 lg:px-8">
        <Link to="/" className="flex items-center gap-3">
          <div className="h-10 w-10 rounded-xl bg-bet-gradient shadow-lg shadow-violet-500/30" />
          <span className="text-xl font-black tracking-tight">BetMatch</span>
        </Link>
        <div className="hidden items-center gap-8 text-sm font-medium text-white/70 md:flex">
          <a href="#features" className="hover:text-white">Features</a>
          <a href="#dashboard" className="hover:text-white">Dashboard</a>
          <a href="#matches" className="hover:text-white">Matches</a>
        </div>
        <div className="flex items-center gap-3">
          <div className="hidden rounded-full border border-white/10 bg-white/5 p-1 sm:flex">
            {languages.map((code) => (
              <button
                key={code}
                onClick={() => setLang(code)}
                className={`rounded-full px-3 py-1 text-xs font-bold uppercase transition ${
                  lang === code ? "bg-white text-slate-950" : "text-white/60 hover:text-white"
                }`}
              >
                {code}
              </button>
            ))}
          </div>
          <Link
            to="/signup"
            className="rounded-full bg-gradient-to-r from-violet-600 to-pink-500 px-5 py-2.5 text-sm font-semibold text-white shadow-lg shadow-violet-500/30"
          >
            Start free
          </Link>
        </div>
      </div>
    </nav>
  );
}
