import type { LeagueConfig, LeagueMatchup, RosterPlayer, TeamSide } from '../../../shared/types.js';
import type { PlatformAdapter } from './types.js';

const SEASON = new Date().getMonth() >= 7 ? new Date().getFullYear() : new Date().getFullYear() - 1;

// ESPN's lineupSlotId enum — used only to tell starter vs. bench apart.
const BENCH_SLOTS = new Set([20, 21]); // Bench, IR

// ESPN's player.defaultPositionId enum — the player's actual position (distinct
// from lineupSlotId, which is which roster *slot* they're started/benched in).
const DEFAULT_POSITION_MAP: Record<number, string> = {
  1: 'QB', 2: 'RB', 3: 'WR', 4: 'TE', 5: 'K', 16: 'D/ST',
};

// ESPN's proTeamId enum — the NFL team a player belongs to.
const PRO_TEAM_MAP: Record<number, string> = {
  0: 'FA', 1: 'ATL', 2: 'BUF', 3: 'CHI', 4: 'CIN', 5: 'CLE', 6: 'DAL', 7: 'DEN',
  8: 'DET', 9: 'GB', 10: 'TEN', 11: 'IND', 12: 'KC', 13: 'LV', 14: 'LAR', 15: 'MIA',
  16: 'MIN', 17: 'NE', 18: 'NO', 19: 'NYG', 20: 'NYJ', 21: 'PHI', 22: 'ARI', 23: 'PIT',
  24: 'LAC', 25: 'SF', 26: 'SEA', 27: 'TB', 28: 'WSH', 29: 'CAR', 30: 'JAX', 33: 'BAL', 34: 'HOU',
};

function envCookieHeader(): string {
  const swid = (process.env.ESPN_SWID ?? '').trim();
  const s2 = (process.env.ESPN_S2 ?? '').trim();
  return `SWID=${swid}; espn_s2=${s2}`;
}

function playerToRosterPlayer(entry: any): RosterPlayer {
  const player = entry.playerPoolEntry?.player ?? entry.player ?? {};
  const slotId: number = entry.lineupSlotId;
  return {
    name: player.fullName ?? 'Unknown',
    position: DEFAULT_POSITION_MAP[player.defaultPositionId] ?? '?',
    nflTeam: PRO_TEAM_MAP[player.proTeamId] ?? '',
    points: entry.playerPoolEntry?.appliedStatTotal ?? player.appliedStatTotal ?? 0,
    slot: BENCH_SLOTS.has(slotId) ? 'bench' : 'starter',
  };
}

function ownerDisplayName(team: any, members: any[]): string {
  const ownerId = team?.owners?.[0];
  const member = members?.find((m) => m.id === ownerId);
  if (!member) return '';
  return member.displayName ?? `${member.firstName ?? ''} ${member.lastName ?? ''}`.trim();
}

function buildTeamSide(team: any, entries: any[], totalPoints: number, members: any[]): TeamSide {
  const roster = entries.map(playerToRosterPlayer);
  return {
    teamName: team?.name ?? `Team ${team?.id ?? '?'}`,
    ownerName: ownerDisplayName(team, members),
    totalPoints,
    starters: roster.filter((p) => p.slot === 'starter'),
    bench: roster.filter((p) => p.slot === 'bench'),
  };
}

export const espnAdapter: PlatformAdapter = {
  platform: 'espn',

  async fetchMatchups(leagueConfigs: LeagueConfig[]): Promise<LeagueMatchup[]> {
    const results: LeagueMatchup[] = [];

    for (const config of leagueConfigs) {
      try {
        const url =
          `https://lm-api-reads.fantasy.espn.com/apis/v3/games/ffl/seasons/${SEASON}/segments/0/leagues/${config.leagueId}` +
          `?view=mRoster&view=mMatchup&view=mTeam`;
        const res = await fetch(url, { headers: { Cookie: envCookieHeader() } });
        if (!res.ok) {
          const body = await res.text();
          let detail = body;
          try {
            detail = JSON.parse(body)?.messages?.join('; ') ?? body;
          } catch {
            // response wasn't JSON; fall back to raw text
          }
          throw new Error(`ESPN request failed (${res.status}): ${detail}`);
        }
        const data = await res.json();

        const week: number = data.scoringPeriodId;
        const myTeamId = Number(config.myTeamId);
        const myTeamMeta = data.teams.find((t: any) => t.id === myTeamId);

        const currentMatchup = data.schedule.find(
          (m: any) =>
            m.matchupPeriodId === week &&
            (m.home?.teamId === myTeamId || m.away?.teamId === myTeamId)
        );
        if (!currentMatchup) throw new Error(`No current-week matchup found for teamId=${myTeamId}`);

        const isHome = currentMatchup.home?.teamId === myTeamId;
        const mySide = isHome ? currentMatchup.home : currentMatchup.away;
        const oppSide = isHome ? currentMatchup.away : currentMatchup.home;
        const oppTeamMeta = data.teams.find((t: any) => t.id === oppSide?.teamId);

        results.push({
          leagueId: config.leagueId,
          platform: 'espn',
          leagueName: config.displayName,
          week,
          myTeam: buildTeamSide(
            myTeamMeta,
            mySide.rosterForCurrentScoringPeriod?.entries ?? [],
            mySide.totalPoints ?? 0,
            data.members
          ),
          opponent: buildTeamSide(
            oppTeamMeta,
            oppSide?.rosterForCurrentScoringPeriod?.entries ?? [],
            oppSide?.totalPoints ?? 0,
            data.members
          ),
          lastUpdated: new Date().toISOString(),
        });
      } catch (err) {
        results.push(errorMatchup(config, err));
      }
    }

    return results;
  },
};

function emptyTeamSide(name: string) {
  return { teamName: name, ownerName: '', totalPoints: 0, starters: [], bench: [] };
}

function errorMatchup(config: LeagueConfig, err: unknown): LeagueMatchup {
  return {
    leagueId: config.leagueId,
    platform: 'espn',
    leagueName: config.displayName,
    week: 0,
    myTeam: emptyTeamSide('Error'),
    opponent: emptyTeamSide('Error'),
    lastUpdated: new Date().toISOString(),
    fetchError: err instanceof Error ? err.message : String(err),
  };
}
