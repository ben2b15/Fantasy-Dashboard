import type { LeagueMatchup } from '../../../shared/types.js';
import { MatchupCard } from './MatchupCard.js';

export function ScoreboardList({ matchups }: { matchups: LeagueMatchup[] }) {
  return (
    <div className="flex flex-col gap-3">
      {matchups.map((m) => (
        <MatchupCard key={`${m.platform}-${m.leagueId}`} matchup={m} />
      ))}
    </div>
  );
}
