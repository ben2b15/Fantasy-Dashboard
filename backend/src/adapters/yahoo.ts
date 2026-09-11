import type { LeagueConfig, LeagueMatchup, RosterPlayer, TeamSide } from '../../../shared/types.js';
import type { PlatformAdapter } from './types.js';
import { TtlCache } from '../cache/ttlCache.js';

const TOKEN_URL = 'https://api.login.yahoo.com/oauth2/get_token';
const API_BASE = 'https://fantasysports.yahooapis.com/fantasy/v2';

// Access tokens are short-lived (~1hr); cache one per process run and refresh on expiry.
const tokenCache = new TtlCache<string>(55 * 60 * 1000);

async function getAccessToken(): Promise<string> {
  const cached = tokenCache.get('token');
  if (cached) return cached;

  const clientId = (process.env.YAHOO_CLIENT_ID ?? '').trim();
  const clientSecret = (process.env.YAHOO_CLIENT_SECRET ?? '').trim();
  const refreshToken = (process.env.YAHOO_REFRESH_TOKEN ?? '').trim();

  const basicAuth = Buffer.from(`${clientId}:${clientSecret}`).toString('base64');
  const res = await fetch(TOKEN_URL, {
    method: 'POST',
    headers: {
      Authorization: `Basic ${basicAuth}`,
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: new URLSearchParams({
      grant_type: 'refresh_token',
      refresh_token: refreshToken,
    }),
  });
  if (!res.ok) throw new Error(`Yahoo token refresh failed (${res.status}) — refresh token may be revoked`);
  const data = (await res.json()) as { access_token: string };
  tokenCache.set('token', data.access_token);
  return data.access_token;
}

async function yahooGet(path: string): Promise<any> {
  const token = await getAccessToken();
  const res = await fetch(`${API_BASE}${path}?format=json`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) throw new Error(`Yahoo request failed: ${path} (${res.status})`);
  return res.json();
}

// Yahoo's JSON responses nest resources as numerically-keyed objects rather than arrays.
// This flattens { "0": {...}, "1": {...}, count: N } into a plain array.
function flatten(obj: any): any[] {
  if (!obj) return [];
  return Object.keys(obj)
    .filter((k) => k !== 'count')
    .map((k) => obj[k]);
}

function parseRosterPlayers(rosterJson: any): { starters: RosterPlayer[]; bench: RosterPlayer[] } {
  const playersNode = rosterJson?.roster?.[0]?.players ?? rosterJson?.roster?.players;
  const players = flatten(playersNode).map((p) => flatten(p.player));

  const starters: RosterPlayer[] = [];
  const bench: RosterPlayer[] = [];

  for (const playerFields of players) {
    const fields = playerFields.flat();
    const name = fields.find((f: any) => f?.name)?.name?.full ?? 'Unknown';
    const position = fields.find((f: any) => f?.display_position)?.display_position ?? '?';
    const team = fields.find((f: any) => f?.editorial_team_abbr)?.editorial_team_abbr ?? '';
    const selectedPosition = fields.find((f: any) => f?.selected_position)?.selected_position;
    const slotName = flatten(selectedPosition)[1]?.position ?? selectedPosition?.position;
    const pointsField = fields.find((f: any) => f?.player_points);
    const points = Number(pointsField?.player_points?.total ?? 0);

    const rosterPlayer: RosterPlayer = {
      name,
      position,
      nflTeam: team,
      points,
      slot: slotName === 'BN' || slotName === 'IR' ? 'bench' : 'starter',
    };
    (rosterPlayer.slot === 'bench' ? bench : starters).push(rosterPlayer);
  }

  return { starters, bench };
}

export const yahooAdapter: PlatformAdapter = {
  platform: 'yahoo',

  async fetchMatchups(leagueConfigs: LeagueConfig[]): Promise<LeagueMatchup[]> {
    const results: LeagueMatchup[] = [];

    for (const config of leagueConfigs) {
      try {
        const scoreboard = await yahooGet(`/league/${config.leagueId}/scoreboard`);
        const week = Number(scoreboard?.fantasy_content?.league?.[1]?.scoreboard?.week ?? 0);
        const matchups = flatten(scoreboard?.fantasy_content?.league?.[1]?.scoreboard?.[0]?.matchups);

        const myMatchup = matchups.find((m: any) => {
          const teams = flatten(m.matchup?.[0]?.teams);
          return teams.some((t: any) => flatten(t.team?.[0]).some((f: any) => f?.team_key === config.myTeamId));
        });
        if (!myMatchup) throw new Error(`No current matchup found for team_key=${config.myTeamId}`);

        const teams = flatten(myMatchup.matchup[0].teams);
        const myTeamNode = teams.find((t: any) =>
          flatten(t.team?.[0]).some((f: any) => f?.team_key === config.myTeamId)
        );
        const oppTeamNode = teams.find((t: any) => t !== myTeamNode);

        const teamName = (node: any) => flatten(node.team?.[0]).find((f: any) => f?.name)?.name ?? 'Unknown';
        const teamPoints = (node: any) => Number(node.team?.[1]?.team_points?.total ?? 0);
        const teamKey = (node: any) => flatten(node.team?.[0]).find((f: any) => f?.team_key)?.team_key;

        const [myRoster, oppRoster] = await Promise.all([
          yahooGet(`/team/${config.myTeamId}/roster;week=${week}/players/stats;type=week;week=${week}`),
          yahooGet(`/team/${teamKey(oppTeamNode)}/roster;week=${week}/players/stats;type=week;week=${week}`),
        ]);
        const myRosterPlayers = parseRosterPlayers(myRoster.fantasy_content.team);
        const oppRosterPlayers = parseRosterPlayers(oppRoster.fantasy_content.team);

        results.push({
          leagueId: config.leagueId,
          platform: 'yahoo',
          leagueName: config.displayName,
          week,
          myTeam: {
            teamName: teamName(myTeamNode),
            ownerName: '',
            totalPoints: teamPoints(myTeamNode),
            ...myRosterPlayers,
          },
          opponent: {
            teamName: teamName(oppTeamNode),
            ownerName: '',
            totalPoints: teamPoints(oppTeamNode),
            ...oppRosterPlayers,
          },
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
    platform: 'yahoo',
    leagueName: config.displayName,
    week: 0,
    myTeam: emptyTeamSide('Error'),
    opponent: emptyTeamSide('Error'),
    lastUpdated: new Date().toISOString(),
    fetchError: err instanceof Error ? err.message : String(err),
  };
}
