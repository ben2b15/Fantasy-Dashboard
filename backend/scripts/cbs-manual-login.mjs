import { chromium } from 'playwright';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { existsSync, mkdirSync } from 'node:fs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const STORAGE_DIR = path.resolve(__dirname, '../src/playwright/storageState');
if (!existsSync(STORAGE_DIR)) mkdirSync(STORAGE_DIR, { recursive: true });
const OUT_PATH = path.join(STORAGE_DIR, 'cbs.json');

const browser = await chromium.launch({ headless: false });
const context = await browser.newContext();
const page = await context.newPage();

console.log('A browser window has opened. Please log into CBS Sports there (solve the CAPTCHA yourself).');
console.log('Once you are logged in, this script will detect it automatically and save your session.');
console.log('Waiting up to 5 minutes...');

await page.goto('https://www.cbssports.com/login/', { waitUntil: 'domcontentloaded' });

const deadline = Date.now() + 5 * 60 * 1000;
let loggedIn = false;

while (Date.now() < deadline) {
  await page.waitForTimeout(3000);
  const cookies = await context.cookies();
  const hasAuthCookie = cookies.some((c) => /^(sports_user|pid)$/i.test(c.name));
  const url = page.url();
  if (hasAuthCookie && !url.includes('/login')) {
    loggedIn = true;
    break;
  }
  if (hasAuthCookie) {
    // has auth cookie but still on a login-ish redirect page; give it a moment then recheck
    await page.waitForTimeout(1000);
  }
}

if (!loggedIn) {
  console.log('Timed out waiting for login. Run this again when ready.');
  await browser.close();
  process.exit(1);
}

await context.storageState({ path: OUT_PATH });
console.log(`Login detected. Session saved to ${OUT_PATH}`);
console.log('You can close the browser window now.');
await browser.close();
