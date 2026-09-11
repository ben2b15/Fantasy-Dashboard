export type Platform = 'sleeper' | 'yahoo' | 'espn' | 'cbs' | 'ffpc';

export interface RosterPlayer {
  name: string;
  position: string;
  nflTeam: string;
  points: number;
  projectedPoints?: number;
  slot: 'starter' | 'bench' | 'ir';
}

export interface TeamSide {
  teamName: string;
  ownerName: string;
  totalPoints: number;
  starters: RosterPlayer[];
  bench: RosterPlayer[];
}

export interface LeagueMatchup {
  leagueId: string;
  platform: Platform;
  leagueName: string;
  week: number;
  myTeam: TeamSide;
  opponent: TeamSide;
  lastUpdated: string;
  fetchError?: string;
}

export interface LeagueConfig {
  platform: Platform;
  leagueId: string;
  myTeamId: string;
  displayName: string;
}

export interface ScoreboardResponse {
  matchups: LeagueMatchup[];
  cachedAt: string;
}
