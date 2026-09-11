import type { LeagueConfig, LeagueMatchup, RosterPlayer, TeamSide } from '../../../shared/types.js';
import type { PlatformAdapter } from './types.js';
import { TtlCache } from '../cache/ttlCache.js';

const BASE = 'https://api.sleeper.app/v1';

interface SleeperPlayerMeta {
  full_name?: string;
  first_name?: string;
  last_name?: string;
  position?: string;
  team?: string;
}

// Player metadata rarely changes; cache it much longer than the scoreboard cache.
const playersCache = new TtlCache<Record<string, SleeperPlayerMeta>>(6 * 60 * 60 * 1000);

async function getJson<T>(url: string): Promise<T> {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Sleeper request failed: ${url} (${res.status})`);
  return (await res.json()) as T;
}

async function getAllPlayers(): Promise<Record<string, SleeperPlayerMeta>> {
  const cached = playersCache.get('all');
  if (cached) return cached;
  const players = await getJson<Record<string, SleeperPlayerMeta>>(`${BASE}/players/nfl`);
  playersCache.set('all', players);
  return players;
}

function playerName(meta: SleeperPlayerMeta | undefined, playerId: string): string {
  if (!meta) return playerId;
  const fallback = `${meta.first_name ?? ''} ${meta.last_name ?? ''}`.trim() || playerId;
  return meta.full_name ?? fallback;
}

function buildTeamSide(
  rosterId: number,
  roster: any,
  matchup: any,
  users: any[],
  players: Record<string, SleeperPlayerMeta>
): TeamSide {
  const user = users.find((u) => u.user_id === roster.owner_id);
  const starterIds: string[] = matchup?.starters ?? [];
  const allIds: string[] = matchup?.players ?? roster.players ?? [];
  const pointsByPlayer: Record<string, number> = matchup?.players_points ?? {};

  const toRosterPlayer = (playerId: string, slot: 'starter' | 'bench'): RosterPlayer => {
    const meta = players[playerId];
    return {
      name: playerName(meta, playerId),
      position: meta?.position ?? '?',
      nflTeam: meta?.team ?? '',
      points: pointsByPlayer[playerId] ?? 0,
      slot,
    };
  };

  const starters = starterIds.map((id) => toRosterPlayer(id, 'starter'));
  const bench = allIds.filter((id) => !starterIds.includes(id)).map((id) => toRosterPlayer(id, 'bench'));

  return {
    teamName: user?.metadata?.team_name || user?.display_name || `Roster ${rosterId}`,
    ownerName: user?.display_name ?? 'Unknown',
    totalPoints: matchup?.points ?? 0,
    starters,
    bench,
  };
}

export const sleeperAdapter: PlatformAdapter = {
  platform: 'sleeper',

  async fetchMatchups(leagueConfigs: LeagueConfig[]): Promise<LeagueMatchup[]> {
    const players = await getAllPlayers();
    const results: LeagueMatchup[] = [];

    for (const config of leagueConfigs) {
      try {
        const state = await getJson<{ week: number }>(`${BASE}/state/nfl`);
        const [rosters, users, matchups] = await Promise.all([
          getJson<any[]>(`${BASE}/league/${config.leagueId}/rosters`),
          getJson<any[]>(`${BASE}/league/${config.leagueId}/users`),
          getJson<any[]>(`${BASE}/league/${config.leagueId}/matchups/${state.week}`),
        ]);

        const myRosterId = Number(config.myTeamId);
        const myMatchup = matchups.find((m) => m.roster_id === myRosterId);
        const oppMatchup = matchups.find(
          (m) => m.matchup_id === myMatchup?.matchup_id && m.roster_id !== myRosterId
        );

        const myRoster = rosters.find((r) => r.roster_id === myRosterId);
        const oppRoster = rosters.find((r) => r.roster_id === oppMatchup?.roster_id);

        if (!myMatchup || !myRoster) {
          throw new Error(`Could not find roster/matchup for myTeamId=${config.myTeamId}`);
        }

        results.push({
          leagueId: config.leagueId,
          platform: 'sleeper',
          leagueName: config.displayName,
          week: state.week,
          myTeam: buildTeamSide(myRosterId, myRoster, myMatchup, users, players),
          opponent: oppMatchup && oppRoster
            ? buildTeamSide(oppMatchup.roster_id, oppRoster, oppMatchup, users, players)
            : emptyTeamSide('Bye / TBD'),
          lastUpdated: new Date().toISOString(),
        });
      } catch (err) {
        results.push(errorMatchup(config, err));
      }
    }

    return results;
  },
};

function emptyTeamSide(name: string): TeamSide {
  return { teamName: name, ownerName: '', totalPoints: 0, starters: [], bench: [] };
}

function errorMatchup(config: LeagueConfig, err: unknown): LeagueMatchup {
  return {
    leagueId: config.leagueId,
    platform: 'sleeper',
    leagueName: config.displayName,
    week: 0,
    myTeam: emptyTeamSide('Error'),
    opponent: emptyTeamSide('Error'),
    lastUpdated: new Date().toISOString(),
    fetchError: err instanceof Error ? err.message : String(err),
  };
}
