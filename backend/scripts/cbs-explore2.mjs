import { chromium } from 'playwright';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const STATE_PATH = path.resolve(__dirname, '../src/playwright/storageState/cbs.json');

const browser = await chromium.launch({ headless: true });
const context = await browser.newContext({ storageState: STATE_PATH });
const page = await context.newPage();

async function shot(label) {
  await page.screenshot({ path: `C:/Users/bherman/AppData/Local/Temp/claude/c--Dev-Projects/5dee938c-8085-499e-be57-1a0855a0fea4/scratchpad/cbs2-${label}.png`, fullPage: true }).catch(() => {});
}

try {
  await page.goto('https://wildetime.football.cbssports.com/scoring/live/1/1', { waitUntil: 'domcontentloaded', timeout: 20000 });
  await page.waitForTimeout(3000);
  console.log('URL after nav:', page.url());
  await shot('page');

  const result = await page.evaluate(() => {
    function outer(el, max = 4000) {
      return el ? el.outerHTML.slice(0, max) : null;
    }
    const teamLogos = Array.from(document.querySelectorAll('.teamLogo')).map((e) => outer(e, 3000));
    const playerCount = document.querySelectorAll('.playerLayoutContainer').length;
    const matchupDetailsContainer = outer(document.querySelector('.matchupDetailsContainer'), 6000);
    const benchSpans = Array.from(document.querySelectorAll('span')).filter((s) => s.textContent.trim() === 'BENCH').length;
    return { teamLogos, playerCount, matchupDetailsContainer, benchSpans };
  });

  console.log('\n=== TEAM LOGOS ===');
  result.teamLogos.forEach((t, i) => console.log(`--- teamLogo[${i}] ---\n${t}\n`));
  console.log('=== PLAYER COUNT ===', result.playerCount);
  console.log('=== BENCH SPAN COUNT ===', result.benchSpans);
  console.log('\n=== matchupDetailsContainer (first 6000 chars) ===\n', result.matchupDetailsContainer);
} catch (err) {
  console.error('ERROR:', err.message);
  await shot('error');
} finally {
  await browser.close();
}
