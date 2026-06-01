export function MatchCard({ match }) {
  return (
    <div className="glass rounded-2xl p-4">
      <div className="flex items-center justify-between gap-4">
        <div>
          <p className="text-xs uppercase tracking-[0.2em] text-white/40">{match.league}</p>
          <h4 className="mt-1 text-base font-semibold">{match.homeTeam} vs {match.awayTeam}</h4>
        </div>
        <div className="text-right text-sm text-white/60">
          <div>{match.homeShare}%</div>
          <div>{match.awayShare}%</div>
        </div>
      </div>
      <div className="mt-4 h-2 overflow-hidden rounded-full bg-white/10">
        <div className="h-full bg-gradient-to-r from-violet-500 to-pink-500" style={{ width: `${match.homeShare}%` }} />
      </div>
    </div>
  );
}
