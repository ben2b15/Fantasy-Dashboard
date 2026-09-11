import type { LeagueConfig, LeagueMatchup, RosterPlayer, TeamSide } from '../../../shared/types.js';
import type { PlatformAdapter } from './types.js';
import { newPlainContext } from '../playwright/browserManager.js';

// FFPC's (myffpc.com) scoreboard pages are publicly viewable — no login
// required at all, unlike CBS/ESPN. `config.myTeamId` stores the exact team
// name text (e.g. "Infinity Scores") since the page has no session-based
// "this is you" signal to key off of; we match it against the home/away
// team names scraped from the page to figure out which side is the user's.

function matchupUrl(ltuid: string): string {
  return `https://myffpc.com/Scoreboard.aspx?ltuid=${ltuid}`;
}

async function scrapeMatchup(page: any, ltuid: string, myTeamName: string): Promise<{ my: TeamSide; opp: TeamSide; week: number }> {
  await page.goto(matchupUrl(ltuid), { waitUntil: 'domcontentloaded' });
  await page.waitForSelector('.team-name', { timeout: 15000 });
  await page.waitForSelector('tr[id^="trPlayerInfo_"]', { timeout: 15000 }).catch(() => {});

  // Passed as a string (not a TS closure) so tsx/esbuild never transforms it —
  // esbuild injects a `__name` helper for nested named functions that doesn't
  // exist in the browser context Playwright evaluates this in.
  const data = await page.evaluate(`(() => {
    const text = (el) => el ? el.textContent.replace(/\\s+/g, ' ').trim() : '';
    const num = (t) => {
      const n = parseFloat(String(t).replace(/[^0-9.-]/g, ''));
      return Number.isFinite(n) ? n : 0;
    };

    function starters(teamNum) {
      return Array.from(document.querySelectorAll('tr[id^="trPlayerInfo_' + teamNum + '_"]')).map((row) => {
        const position = text(row.querySelector('.lsPos'));
        const nameDiv = row.querySelector('[id^="divPlayerName_"]');
        const nflTeam = text(nameDiv?.querySelector('.lsPlayerTeam'));
        const fullName = text(nameDiv);
        const name = nflTeam && fullName.endsWith(nflTeam) ? fullName.slice(0, -nflTeam.length).trim() : fullName;
        const projText = text(row.querySelector('.lsProjections'));
        const projMatch = projText.match(/([0-9.]+)/);
        const points = num(text(row.querySelector('.lsPoints')));
        return { name, position, nflTeam, points, projected: projMatch ? Number(projMatch[1]) : 0 };
      });
    }

    function bench(teamNum) {
      const table = document.querySelector('#t' + teamNum + 'Bench');
      if (!table) return [];
      return Array.from(table.querySelectorAll('tr')).slice(1).map((row) => {
        const cells = row.querySelectorAll('td');
        if (cells.length < 5) return null;
        const position = text(cells[0]);
        const nameTeam = text(cells[1]);
        const [name, nflTeam] = nameTeam.includes(',') ? nameTeam.split(',').map((s) => s.trim()) : [nameTeam, ''];
        const points = num(text(cells[4]));
        return { name, position, nflTeam, points, projected: 0 };
      }).filter(Boolean);
    }

    const homeName = text(document.querySelector('.team-left .team-name'));
    const awayName = text(document.querySelector('.team-rightFull .team-name')) || text(document.querySelector('.team-right .team-name'));
    const homeScore = num(text(document.querySelector('.clock-left .clock')));
    const awayScore = num(text(document.querySelector('.clock-right .clock')));

    return {
      home: { teamName: homeName, totalPoints: homeScore, starters: starters(1), bench: bench(1) },
      away: { teamName: awayName, totalPoints: awayScore, starters: starters(2), bench: bench(2) },
    };
  })()`);

  type RawPlayer = { name: string; position: string; nflTeam: string; points: number; projected: number };
  type RawSide = { teamName: string; totalPoints: number; starters: RawPlayer[]; bench: RawPlayer[] };

  function toRosterPlayers(raw: RawPlayer[], slot: 'starter' | 'bench'): RosterPlayer[] {
    return raw.map((p: RawPlayer) => ({
      name: p.name,
      position: p.position,
      nflTeam: p.nflTeam,
      points: p.points,
      projectedPoints: p.projected,
      slot,
    }));
  }

  function toTeamSide(side: RawSide): TeamSide {
    return {
      teamName: side.teamName,
      ownerName: '',
      totalPoints: side.totalPoints,
      starters: toRosterPlayers(side.starters, 'starter'),
      bench: toRosterPlayers(side.bench, 'bench'),
    };
  }

  const homeIsMine = data.home.teamName.trim().toLowerCase() === myTeamName.trim().toLowerCase();
  if (!homeIsMine && data.away.teamName.trim().toLowerCase() !== myTeamName.trim().toLowerCase()) {
    throw new Error(
      `Neither team on this page ("${data.home.teamName}" / "${data.away.teamName}") matches configured myTeamId "${myTeamName}"`
    );
  }

  return {
    my: toTeamSide(homeIsMine ? data.home : data.away),
    opp: toTeamSide(homeIsMine ? data.away : data.home),
    week: 0,
  };
}

export const ffpcAdapter: PlatformAdapter = {
  platform: 'ffpc',

  async fetchMatchups(leagueConfigs: LeagueConfig[]): Promise<LeagueMatchup[]> {
    const results: LeagueMatchup[] = [];

    for (const config of leagueConfigs) {
      try {
        const context = await newPlainContext();
        const page = await context.newPage();
        const { my, opp, week } = await scrapeMatchup(page, config.leagueId, config.myTeamId);
        await page.close();
        await context.close();

        results.push({
          leagueId: config.leagueId,
          platform: 'ffpc',
          leagueName: config.displayName,
          week,
          myTeam: my,
          opponent: opp,
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
    platform: 'ffpc',
    leagueName: config.displayName,
    week: 0,
    myTeam: emptyTeamSide('Error'),
    opponent: emptyTeamSide('Error'),
    lastUpdated: new Date().toISOString(),
    fetchError: err instanceof Error ? err.message : String(err),
  };
}
