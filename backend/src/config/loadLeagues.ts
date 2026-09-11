import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import type { LeagueConfig, Platform } from '../../../shared/types.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const LEAGUES_PATH = path.resolve(__dirname, '../../../config/leagues.json');

let cached: LeagueConfig[] | null = null;

export function loadLeagues(): LeagueConfig[] {
  if (cached) return cached;
  const raw = readFileSync(LEAGUES_PATH, 'utf-8');
  cached = JSON.parse(raw) as LeagueConfig[];
  return cached;
}

export function loadLeaguesForPlatform(platform: Platform): LeagueConfig[] {
  return loadLeagues().filter((l) => l.platform === platform);
}
