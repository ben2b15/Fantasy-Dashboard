import { Router } from 'express';
import type { LeagueMatchup, ScoreboardResponse } from '../../../shared/types.js';
import { loadLeagues, loadLeaguesForPlatform } from '../config/loadLeagues.js';
import { TtlCache } from '../cache/ttlCache.js';
import { sleeperAdapter } from '../adapters/sleeper.js';
import { yahooAdapter } from '../adapters/yahoo.js';
import { espnAdapter } from '../adapters/espn.js';
import { cbsAdapter } from '../adapters/cbs.js';
import { ffpcAdapter } from '../adapters/ffpc.js';
import type { PlatformAdapter } from '../adapters/types.js';

const CACHE_TTL_MS = 8 * 60 * 1000; // 8 minutes — short enough to feel fresh, long enough to avoid hammering CBS/FFPC
// One slow/broken platform must never stall the rest. Playwright-based platforms
// (CBS, FFPC) can have multiple leagues scraped sequentially in real page loads,
// so this needs enough headroom for that — an occasional slow first load is an
// acceptable tradeoff given the 8-minute cache above.
const ADAPTER_TIMEOUT_MS = 45 * 1000;
const scoreboardCache = new TtlCache<ScoreboardResponse>(CACHE_TTL_MS);

const adapters: PlatformAdapter[] = [sleeperAdapter, yahooAdapter, espnAdapter, cbsAdapter, ffpcAdapter];

export const scoreboardRouter = Router();

function withTimeout<T>(promise: Promise<T>, ms: number, label: string): Promise<T> {
  return Promise.race([
    promise,
    new Promise<T>((_, reject) => setTimeout(() => reject(new Error(`${label} timed out after ${ms}ms`)), ms)),
  ]);
}

scoreboardRouter.get('/scoreboard', async (req, res) => {
  const forceRefresh = req.query.refresh === 'true';
  const cached = !forceRefresh ? scoreboardCache.get('all') : undefined;
  if (cached) {
    res.json(cached);
    return;
  }

  loadLeagues(); // fail fast with a clear error if config/leagues.json is missing/invalid

  const settled = await Promise.allSettled(
    adapters.map((adapter) =>
      withTimeout(adapter.fetchMatchups(loadLeaguesForPlatform(adapter.platform)), ADAPTER_TIMEOUT_MS, adapter.platform)
    )
  );

  const matchups: LeagueMatchup[] = settled.flatMap((result, i) => {
    if (result.status === 'fulfilled') return result.value;
    // The whole adapter call threw (not just one league within it) — synthesize
    // an error entry per configured league on that platform so the UI still
    // shows a card per league instead of silently dropping them.
    const platform = adapters[i].platform;
    return loadLeaguesForPlatform(platform).map((config) => ({
      leagueId: config.leagueId,
      platform,
      leagueName: config.displayName,
      week: 0,
      myTeam: { teamName: 'Error', ownerName: '', totalPoints: 0, starters: [], bench: [] },
      opponent: { teamName: 'Error', ownerName: '', totalPoints: 0, starters: [], bench: [] },
      lastUpdated: new Date().toISOString(),
      fetchError: result.reason instanceof Error ? result.reason.message : String(result.reason),
    }));
  });

  const response: ScoreboardResponse = { matchups, cachedAt: new Date().toISOString() };
  scoreboardCache.set('all', response);
  res.json(response);
});
