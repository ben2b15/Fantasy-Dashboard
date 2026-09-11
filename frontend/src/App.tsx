import { useScoreboard } from './hooks/useScoreboard.js';
import { ScoreboardList } from './components/ScoreboardList.js';

export default function App() {
  const { data, loading, error, refresh } = useScoreboard();

  return (
    <div className="mx-auto max-w-2xl px-4 pb-10">
      <header className="sticky top-0 z-10 flex items-center justify-between bg-slate-950/90 py-4 backdrop-blur">
        <div>
          <h1 className="text-lg font-bold">Fantasy Dashboard</h1>
          {data && <p className="text-xs text-slate-500">Updated {new Date(data.cachedAt).toLocaleTimeString()}</p>}
        </div>
        <button
          onClick={refresh}
          disabled={loading}
          className="rounded-lg bg-slate-800 px-3 py-1.5 text-sm font-medium text-slate-200 active:bg-slate-700 disabled:opacity-50"
        >
          {loading ? 'Loading…' : 'Refresh'}
        </button>
      </header>

      {error && (
        <div className="mb-4 rounded-lg border border-red-900 bg-red-950 px-3 py-2 text-sm text-red-300">
          Failed to load scoreboard: {error}
        </div>
      )}

      {data && <ScoreboardList matchups={data.matchups} />}
      {loading && !data && <p className="text-slate-500">Loading your leagues…</p>}
    </div>
  );
}
