import type { LeagueConfig, LeagueMatchup } from '../../../shared/types.js';

export interface PlatformAdapter {
  platform: LeagueMatchup['platform'];
  fetchMatchups(leagueConfigs: LeagueConfig[]): Promise<LeagueMatchup[]>;
}
