import { existsSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import type { LeagueConfig, Platform } from '../../../shared/types.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const LOCAL_LEAGUES_PATH = path.resolve(__dirname, '../../../config/leagues.json');
// Render (and similar hosts) can't mount a "Secret File" at a nested path like
// config/leagues.json — every secret file lands flat at /etc/secrets/<name>
// regardless of the name given, so that's the deployed fallback location.
const SECRET_FILE_LEAGUES_PATH = '/etc/secrets/leagues.json';

let cached: LeagueConfig[] | null = null;

export function loadLeagues(): LeagueConfig[] {
  if (cached) return cached;
  const leaguesPath = existsSync(LOCAL_LEAGUES_PATH) ? LOCAL_LEAGUES_PATH : SECRET_FILE_LEAGUES_PATH;
  const raw = readFileSync(leaguesPath, 'utf-8');
  cached = JSON.parse(raw) as LeagueConfig[];
  return cached;
}

export function loadLeaguesForPlatform(platform: Platform): LeagueConfig[] {
  return loadLeagues().filter((l) => l.platform === platform);
}
