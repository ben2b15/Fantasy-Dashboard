# Fantasy Dashboard

One page, all 8 leagues: your score vs. your opponent, plus full rosters (starters + bench), across Sleeper, Yahoo, ESPN, CBS, and FFPC.

Personal-use tool only, using your own logins for your own data — not distributed or run at scale.

## Status

- **Phase 1 (done, needs your real league IDs to test live):** Sleeper, Yahoo, ESPN adapters — all API-based, no browser automation.
- **Phase 2/3 (not started):** CBS and FFPC adapters are scaffolded (login-session plumbing via Playwright is built) but the actual page-scraping selectors are placeholders — `backend/src/adapters/cbs.ts` and `ffpc.ts` currently return a "not yet implemented" error per league instead of guessing at markup we haven't inspected.

## One-time setup

### 1. Fill in your leagues

Copy the example and fill in your real league/team IDs:

```
cp config/leagues.example.json config/leagues.json
```

- **Sleeper**: `leagueId` is in the league URL; `myTeamId` is your `roster_id` (find it via `https://api.sleeper.app/v1/league/{leagueId}/rosters` and match `owner_id` to your user).
- **Yahoo**: `leagueId` = league_key (e.g. `423.l.12345`), `myTeamId` = team_key (e.g. `423.l.12345.t.4`) — both visible in the Yahoo Fantasy URL when viewing your team.
- **ESPN**: `leagueId` is the numeric ID in the league URL; `myTeamId` is your team's numeric ID.
- **CBS / FFPC**: not usable yet (Phase 2/3) — leave placeholders or omit those entries.

### 2. Credentials

Edit **`backend/.env`** directly (already created from `backend/.env.example` — the backend only reads `.env` from inside `backend/`, not the project root).

- **Yahoo**: register an app at https://developer.yahoo.com/apps/ (Fantasy Sports read permission), then run through the OAuth2 authorization-code flow once to get a refresh token. Put `YAHOO_CLIENT_ID`, `YAHOO_CLIENT_SECRET`, `YAHOO_REFRESH_TOKEN` in `backend/.env`.
- **ESPN**: log into fantasy.espn.com in your browser, open DevTools → Application → Cookies → fantasy.espn.com, copy the `SWID` and `espn_s2` values into `backend/.env`. These expire periodically — if ESPN cards start showing an error, re-extract them.
- **CBS / FFPC**: `backend/.env` has placeholders for your username/password; not wired up yet.

### 3. Install and run

```
cd backend && npm install
cd ../frontend && npm install && npm run build
cd ../backend && npm run dev
```

Then open http://localhost:3000 (the backend serves the built frontend).

For frontend-only iteration with hot reload: `cd frontend && npm run dev` (proxies `/api` to the backend on port 3000 — run the backend separately).

## Next steps to finish CBS/FFPC (Phase 2/3)

1. Log into CBS Fantasy / FFPC in a real browser, open a matchup page.
2. Inspect the DOM for: login form field selectors, score totals, and roster rows (and how starters vs. bench are distinguished).
3. Fill in the `TODO`s in `backend/src/adapters/cbs.ts` / `ffpc.ts`.
4. Confirm your hosting choice has a **persistent disk/volume** so `backend/src/playwright/storageState/*.json` survives restarts — otherwise every cold start forces a fresh login, which increases the odds of tripping bot detection on those accounts.

## Deploying

Deploy `backend/` (which also serves the built frontend) to a host with a small **always-on, persistent-disk** instance — e.g. Render or Railway — rather than classic serverless, since Playwright benefits from a long-lived process and a reused login session. Set the `.env` values as that host's environment variables/secrets (never commit `.env` or `config/leagues.json`).
