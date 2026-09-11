import { chromium } from 'playwright';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const STATE_PATH = path.resolve(__dirname, '../src/playwright/storageState/cbs.json');

const browser = await chromium.launch({ headless: true });
const context = await browser.newContext({ storageState: STATE_PATH });
const page = await context.newPage();

try {
  await page.goto('https://wildetime.football.cbssports.com/scoring/live/1/1', { waitUntil: 'domcontentloaded', timeout: 20000 });
  await page.waitForTimeout(3000);

  const result = await page.evaluate(() => {
    const containers = Array.from(document.querySelectorAll('.matchupDetailsContainer'));
    return containers.map((c) => {
      const header = c.querySelector('.scoringTableHeader')?.textContent.trim().slice(0, 30);
      const regions = Array.from(c.querySelectorAll('.playerItemsContainer')).map((r) => ({
        className: r.className,
        playerCount: r.querySelectorAll('.playerLayoutContainer').length,
      }));
      return { header, regions };
    });
  });

  console.log(JSON.stringify(result, null, 2));
} catch (err) {
  console.error('ERROR:', err.message);
} finally {
  await browser.close();
}
