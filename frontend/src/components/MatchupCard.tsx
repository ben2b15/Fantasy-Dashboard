import { useState } from 'react';
import type { LeagueMatchup } from '../../../shared/types.js';
import { RosterTable } from './RosterTable.js';

const PLATFORM_LABEL: Record<LeagueMatchup['platform'], string> = {
  sleeper: 'Sleeper',
  yahoo: 'Yahoo',
  espn: 'ESPN',
  cbs: 'CBS',
  ffpc: 'FFPC',
};

export function MatchupCard({ matchup }: { matchup: LeagueMatchup }) {
  const [expanded, setExpanded] = useState(false);
  const winning = matchup.myTeam.totalPoints >= matchup.opponent.totalPoints;

  return (
    <div className="rounded-xl border border-slate-800 bg-slate-900 p-4 shadow-sm">
      <button
        className="flex w-full items-center justify-between text-left"
        onClick={() => setExpanded((e) => !e)}
        disabled={!!matchup.fetchError}
      >
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <span className="rounded bg-slate-800 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-slate-400">
              {PLATFORM_LABEL[matchup.platform]}
            </span>
            <span className="truncate text-sm font-medium text-slate-200">{matchup.leagueName}</span>
          </div>

          {matchup.fetchError ? (
            <p className="mt-1 text-sm text-amber-400">Unavailable: {matchup.fetchError}</p>
          ) : (
            <div className="mt-1 flex items-baseline gap-2">
              <span className={`text-lg font-bold tabular-nums ${winning ? 'text-emerald-400' : 'text-slate-200'}`}>
                {matchup.myTeam.totalPoints.toFixed(1)}
              </span>
              <span className="text-sm text-slate-500">{matchup.myTeam.teamName}</span>
              <span className="text-slate-600">vs</span>
              <span className={`text-lg font-bold tabular-nums ${!winning ? 'text-emerald-400' : 'text-slate-200'}`}>
                {matchup.opponent.totalPoints.toFixed(1)}
              </span>
              <span className="text-sm text-slate-500">{matchup.opponent.teamName}</span>
            </div>
          )}
        </div>
        {!matchup.fetchError && (
          <span className="ml-2 shrink-0 text-slate-500">{expanded ? '−' : '+'}</span>
        )}
      </button>

      {expanded && !matchup.fetchError && (
        <RosterTable
          myStarters={matchup.myTeam.starters}
          myBench={matchup.myTeam.bench}
          oppStarters={matchup.opponent.starters}
          oppBench={matchup.opponent.bench}
        />
      )}
    </div>
  );
}
