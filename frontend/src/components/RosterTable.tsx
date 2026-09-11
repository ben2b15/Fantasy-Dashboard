import type { RosterPlayer } from '../../../shared/types.js';

function PlayerRow({ player }: { player: RosterPlayer }) {
  return (
    <div className="flex items-center justify-between py-1 text-sm">
      <div className="min-w-0 flex-1 truncate">
        <span className="text-slate-100">{player.name}</span>{' '}
        <span className="text-slate-500">
          {player.position}
          {player.nflTeam ? ` · ${player.nflTeam}` : ''}
        </span>
      </div>
      <span className="ml-2 shrink-0 tabular-nums text-slate-300">{player.points.toFixed(1)}</span>
    </div>
  );
}

function RosterColumn({ title, starters, bench }: { title: string; starters: RosterPlayer[]; bench: RosterPlayer[] }) {
  return (
    <div className="flex-1 min-w-0">
      <h4 className="mb-1 text-xs font-semibold uppercase tracking-wide text-slate-400">{title}</h4>
      {starters.map((p, i) => (
        <PlayerRow key={`s-${i}`} player={p} />
      ))}
      {bench.length > 0 && (
        <>
          <div className="mt-2 mb-1 text-xs uppercase tracking-wide text-slate-500">Bench</div>
          {bench.map((p, i) => (
            <PlayerRow key={`b-${i}`} player={p} />
          ))}
        </>
      )}
    </div>
  );
}

export function RosterTable({
  myStarters,
  myBench,
  oppStarters,
  oppBench,
}: {
  myStarters: RosterPlayer[];
  myBench: RosterPlayer[];
  oppStarters: RosterPlayer[];
  oppBench: RosterPlayer[];
}) {
  return (
    <div className="mt-3 flex flex-col gap-4 border-t border-slate-800 pt-3 sm:flex-row sm:gap-6">
      <RosterColumn title="My Team" starters={myStarters} bench={myBench} />
      <RosterColumn title="Opponent" starters={oppStarters} bench={oppBench} />
    </div>
  );
}
