import type { LeagueConfig, LeagueMatchup, RosterPlayer, TeamSide } from '../../../shared/types.js';
import type { PlatformAdapter } from './types.js';
import { getAuthenticatedContext } from '../playwright/browserManager.js';

// CBS Fantasy has no public/private API and its login form has a Google
// reCAPTCHA checkbox that blocks automated login entirely. So unlike the
// other adapters, this one never logs in itself — it only ever reuses a
// session saved by `npm run cbs-login` (a script the user runs manually,
// solving the CAPTCHA themselves once). If that saved session has expired,
// this throws a clear error telling them to rerun it, rather than attempting
// (and failing) an automated login.

function matchupUrl(leagueId: string): string {
  return `https://${leagueId}.football.cbssports.com/scoring/live/1/1`;
}

async function isLoggedIn(page: any): Promise<boolean> {
  return (await page.locator('.matchupDetailsContainer').count()) > 0;
}

async function login(): Promise<void> {
  throw new Error(
    "CBS session expired or missing — run 'npm run cbs-login' in backend/ to log in manually (CBS's CAPTCHA blocks automated login)"
  );
}

function parsePosTeam(posText: string): { position: string; nflTeam: string } {
  const parts = posText.split('|').map((s) => s.trim()).filter(Boolean);
  return { position: parts[0] ?? '?', nflTeam: parts[1] ?? '' };
}

async function scrapeMatchup(page: any, leagueId: string): Promise<{ my: TeamSide; opp: TeamSide; week: number }> {
  await page.goto(matchupUrl(leagueId), { waitUntil: 'domcontentloaded' });
  await page.waitForSelector('.matchupDetailsContainer', { timeout: 15000 });

  // Passed as a string (not a TS closure) so tsx/esbuild never transforms it —
  // esbuild injects a `__name` helper for nested named functions that doesn't
  // exist in the browser context Playwright evaluates this in.
  const data = await page.evaluate(`(() => {
    const text = (sel, root) => (root || document).querySelector(sel)?.textContent?.replace(/\\s+/g, ' ').trim() ?? '';
    const num = (sel, root) => {
      const t = text(sel, root);
      const n = parseFloat(t.replace(/[^0-9.-]/g, ''));
      return Number.isFinite(n) ? n : 0;
    };
    const players = (sel) => Array.from(document.querySelectorAll(sel)).map((el) => ({
      name: text('.playerName a', el) || text('.playerName', el),
      posText: text('.playerPos', el),
      points: num('.playerScoreRegion .playerScore', el),
      projected: num('.projScore', el),
    }));

    const homeIsMine = document.querySelector('.teamLogo.homeTeamLogo.selectedTeamLogo') !== null;
    const myPrefix = homeIsMine ? 'home' : 'away';
    const oppPrefix = homeIsMine ? 'away' : 'home';
    const weekMatch = document.body.textContent?.match(/WEEK\\s*(\\d+)/i);

    return {
      week: weekMatch ? Number(weekMatch[1]) : 0,
      my: {
        teamName: text('.' + myPrefix + 'TeamName'),
        ownerName: text('.' + myPrefix + 'Owners'),
        totalPoints: num('.' + myPrefix + 'Team.scoreCont'),
        starters: players('.' + myPrefix + 'StartersRegion .playerLayoutContainer'),
        bench: players('.' + myPrefix + 'BenchRegion .playerLayoutContainer'),
      },
      opp: {
        teamName: text('.' + oppPrefix + 'TeamName'),
        ownerName: text('.' + oppPrefix + 'Owners'),
        totalPoints: num('.' + oppPrefix + 'Team.scoreCont'),
        starters: players('.' + oppPrefix + 'StartersRegion .playerLayoutContainer'),
        bench: players('.' + oppPrefix + 'BenchRegion .playerLayoutContainer'),
      },
    };
  })()`);

  type RawPlayer = { name: string; posText: string; points: number; projected: number };

  function toRosterPlayers(raw: RawPlayer[], slot: 'starter' | 'bench'): RosterPlayer[] {
    return raw.map((p: RawPlayer) => {
      const { position, nflTeam } = parsePosTeam(p.posText);
      return { name: p.name, position, nflTeam, points: p.points, projectedPoints: p.projected, slot };
    });
  }

  function toTeamSide(side: typeof data.my): TeamSide {
    return {
      teamName: side.teamName,
      ownerName: side.ownerName,
      totalPoints: side.totalPoints,
      starters: toRosterPlayers(side.starters, 'starter'),
      bench: toRosterPlayers(side.bench, 'bench'),
    };
  }

  return { my: toTeamSide(data.my), opp: toTeamSide(data.opp), week: data.week };
}

export const cbsAdapter: PlatformAdapter = {
  platform: 'cbs',

  async fetchMatchups(leagueConfigs: LeagueConfig[]): Promise<LeagueMatchup[]> {
    const results: LeagueMatchup[] = [];

    for (const config of leagueConfigs) {
      try {
        const context = await getAuthenticatedContext('cbs', isLoggedIn, login, matchupUrl(config.leagueId));
        const page = await context.newPage();
        const { my, opp, week } = await scrapeMatchup(page, config.leagueId);
        await page.close();

        results.push({
          leagueId: config.leagueId,
          platform: 'cbs',
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
    platform: 'cbs',
    leagueName: config.displayName,
    week: 0,
    myTeam: emptyTeamSide('Error'),
    opponent: emptyTeamSide('Error'),
    lastUpdated: new Date().toISOString(),
    fetchError: err instanceof Error ? err.message : String(err),
  };
}
