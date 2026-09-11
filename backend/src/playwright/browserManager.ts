import { chromium, type Browser, type BrowserContext, type Page } from 'playwright';
import { existsSync, mkdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const STORAGE_DIR = path.resolve(__dirname, 'storageState');

if (!existsSync(STORAGE_DIR)) mkdirSync(STORAGE_DIR, { recursive: true });

let browserPromise: Promise<Browser> | null = null;

function getBrowser(): Promise<Browser> {
  if (!browserPromise) browserPromise = chromium.launch({ headless: true });
  return browserPromise;
}

function storageStatePath(site: 'cbs' | 'ffpc'): string {
  return path.join(STORAGE_DIR, `${site}.json`);
}

/**
 * Returns an authenticated context for the given site, reusing a persisted
 * login session (storageState) when it's still valid instead of logging in
 * on every call. `isLoggedIn` should check a page for a signal that the
 * saved session actually authenticated (not just that a cookie exists).
 * `login` performs a fresh username/password login if the saved session
 * is missing or expired.
 */
export async function getAuthenticatedContext(
  site: 'cbs' | 'ffpc',
  isLoggedIn: (page: Page) => Promise<boolean>,
  login: (page: Page) => Promise<void>,
  landingUrl: string
): Promise<BrowserContext> {
  const browser = await getBrowser();
  const statePath = storageStatePath(site);
  const hasState = existsSync(statePath);

  const context = await browser.newContext(hasState ? { storageState: statePath } : {});
  const page = await context.newPage();

  await page.goto(landingUrl, { waitUntil: 'domcontentloaded' });

  if (!(await isLoggedIn(page))) {
    await login(page);
    if (!(await isLoggedIn(page))) {
      await page.close();
      await context.close();
      throw new Error(`${site}: login did not succeed — credentials may be wrong or the login flow changed`);
    }
  }

  await context.storageState({ path: statePath });
  await page.close();
  return context;
}

/** Plain (unauthenticated) context sharing the same browser process — for sites like FFPC that don't require login. */
export async function newPlainContext(): Promise<BrowserContext> {
  const browser = await getBrowser();
  return browser.newContext();
}

export async function closeBrowser(): Promise<void> {
  if (browserPromise) {
    const browser = await browserPromise;
    await browser.close();
    browserPromise = null;
  }
}
