export function BetCard({ bet }) {
  return (
    <div className="glass rounded-2xl p-4">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm text-white/50">P2P Bet</p>
          <h4 className="font-semibold">{bet.match}</h4>
        </div>
        <span className="rounded-full border border-emerald-400/30 bg-emerald-400/10 px-3 py-1 text-xs text-emerald-300">
          {bet.status}
        </span>
      </div>
      <div className="mt-4 flex items-center justify-between text-sm text-white/70">
        <span>{bet.userName}</span>
        <span className="font-semibold">${Number(bet.amount || 0).toFixed(2)}</span>
      </div>
    </div>
  );
}
