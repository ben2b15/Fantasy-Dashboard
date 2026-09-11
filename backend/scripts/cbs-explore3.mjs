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
    const container = document.querySelector('.playerItemsMatchupContainer');
    const regions = Array.from(container.children).map((child) => ({
      className: child.className,
      grandchildClassNames: Array.from(child.querySelectorAll(':scope > div')).map((gc) => gc.className),
      playerCount: child.querySelectorAll('.playerLayoutContainer').length,
      innerTextSnippet: child.textContent.replace(/\s+/g, ' ').trim().slice(0, 200),
    }));
    const benchLabels = Array.from(document.querySelectorAll('span, div')).filter(
      (el) => el.children.length === 0 && el.textContent.trim() === 'BENCH'
    ).map((el) => ({ tag: el.tagName, className: el.className, parentClassName: el.parentElement?.className }));
    return { regions, benchLabels };
  });

  console.log(JSON.stringify(result, null, 2));
} catch (err) {
  console.error('ERROR:', err.message);
} finally {
  await browser.close();
}
