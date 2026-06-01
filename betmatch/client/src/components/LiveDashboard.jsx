import { Area, AreaChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { motion } from "framer-motion";
import { useLiveDashboard } from "../hooks/useLiveDashboard";
import { BetCard } from "./BetCard";
import { MatchCard } from "./MatchCard";

const cards = [
  { label: "Total bets amount", key: "totalBetsAmount" },
  { label: "Commission earned", key: "commissionEarned" },
  { label: "Active bets", key: "activeBets" },
];

export function LiveDashboard() {
  const { data, loading } = useLiveDashboard();

  return (
    <motion.div
      id="dashboard"
      initial={{ opacity: 0, y: 24 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.7, delay: 0.15 }}
      className="glass rounded-[2rem] p-4 sm:p-6"
    >
      <div className="mb-4 flex items-center justify-between">
        <div>
          <p className="text-sm text-white/50">Used by bettors in real time</p>
          <h3 className="text-xl font-bold">Live dashboard</h3>
        </div>
        <span className="rounded-full border border-cyan-400/30 bg-cyan-400/10 px-3 py-1 text-xs text-cyan-300">
          {loading ? "Syncing..." : "Live"}
        </span>
      </div>

      <div className="grid gap-3 sm:grid-cols-3">
        {cards.map((card) => (
          <div key={card.key} className="glass rounded-2xl p-4">
            <p className="text-xs uppercase tracking-[0.2em] text-white/40">{card.label}</p>
            <p className="mt-2 text-2xl font-black">
              {typeof data[card.key] === "number" && card.key !== "activeBets"
                ? `$${Number(data[card.key]).toLocaleString()}`
                : Number(data[card.key] || 0).toLocaleString()}
            </p>
          </div>
        ))}
      </div>

      <div className="mt-4 grid gap-4 xl:grid-cols-[1.4fr_0.9fr]">
        <div className="glass rounded-2xl p-4">
          <div className="mb-3 flex items-center justify-between">
            <h4 className="font-semibold">Betting volume (7 days)</h4>
            <span className="text-xs text-white/40">Polling every 30s</span>
          </div>
          <div className="h-48">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={data.volume7d}>
                <defs>
                  <linearGradient id="betGlow" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#8b5cf6" stopOpacity={0.55} />
                    <stop offset="95%" stopColor="#ec4899" stopOpacity={0.08} />
                  </linearGradient>
                </defs>
                <XAxis dataKey="day" tickLine={false} axisLine={false} stroke="#a1a1aa" fontSize={11} />
                <YAxis tickLine={false} axisLine={false} stroke="#a1a1aa" fontSize={11} />
                <Tooltip
                  contentStyle={{
                    background: "rgba(17, 12, 34, 0.96)",
                    border: "1px solid rgba(255,255,255,0.12)",
                    borderRadius: 16,
                    color: "#fff",
                  }}
                />
                <Area type="monotone" dataKey="volume" stroke="#ec4899" fill="url(#betGlow)" strokeWidth={3} />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="space-y-4">
          <div className="glass rounded-2xl p-4">
            <div className="mb-3 flex items-center justify-between">
              <h4 className="font-semibold">Open bets</h4>
              <span className="text-xs text-white/40">{data.statsRow.open} open</span>
            </div>
            <div className="space-y-3">
              {data.activeBetsList.slice(0, 4).map((bet) => (
                <BetCard key={bet.id} bet={bet} />
              ))}
            </div>
          </div>
          <div className="glass rounded-2xl p-4">
            <div className="mb-3 flex items-center justify-between">
              <h4 className="font-semibold">Top matches</h4>
              <span className="text-xs text-white/40">{data.statsRow.closed} closed</span>
            </div>
            <div className="space-y-3">
              {data.topMatches.slice(0, 3).map((match) => (
                <MatchCard key={match.id} match={match} />
              ))}
            </div>
          </div>
        </div>
      </div>
    </motion.div>
  );
}
