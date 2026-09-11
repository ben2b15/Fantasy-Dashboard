import { chromium } from 'playwright';
import 'dotenv/config';

const EMAIL = process.env.CBS_USERNAME;
const PASSWORD = process.env.CBS_PASSWORD;

const browser = await chromium.launch({ headless: true });
const context = await browser.newContext();
const page = await context.newPage();

async function dump(label) {
  console.log(`\n=== ${label} — URL: ${page.url()} ===`);
  await page.screenshot({ path: `C:/Users/bherman/AppData/Local/Temp/claude/c--Dev-Projects/5dee938c-8085-499e-be57-1a0855a0fea4/scratchpad/cbs-${label}.png`, fullPage: true }).catch(() => {});
}

try {
  await page.goto('https://www.cbssports.com/login/', { waitUntil: 'domcontentloaded', timeout: 20000 });
  await dump('01-login-page');

  const emailInput = page.locator('input[name="email"]').first();
  await emailInput.waitFor({ timeout: 10000 });
  await emailInput.fill(EMAIL);

  const continueBtn = page.locator('button[data-testid="submit-button"], button[type="submit"]').first();
  if (await continueBtn.count() > 0) {
    await continueBtn.click().catch(() => {});
    await page.waitForTimeout(1500);
  }

  const passwordInput = page.locator('input[name="password"]').first();
  await passwordInput.waitFor({ timeout: 10000 });
  await passwordInput.fill(PASSWORD);

  await dump('02-before-submit');

  const submitBtn = page.locator('button[data-testid="submit-button"], button[type="submit"]').first();
  await submitBtn.click();
  await page.waitForTimeout(4000);

  await dump('03-after-login');
  console.log('COOKIES:', (await context.cookies()).map(c => c.name).join(', '));

  await page.goto('https://wildetime.football.cbssports.com/scoring/live/1/1', { waitUntil: 'domcontentloaded', timeout: 20000 });
  await page.waitForTimeout(3000);
  await dump('04-matchup-page');

  const html = await page.evaluate(() => {
    function outer(sel) {
      const el = document.querySelector(sel);
      return el ? el.outerHTML.slice(0, 3000) : `NOT FOUND: ${sel}`;
    }
    const teamLogos = Array.from(document.querySelectorAll('.teamLogo')).map(e => e.outerHTML.slice(0, 2000));
    const playerCount = document.querySelectorAll('.playerLayoutContainer').length;
    const matchupDetails = outer('#matchupDetailsRegion');
    return { teamLogos, playerCount, matchupDetails };
  });

  console.log('\n=== TEAM LOGOS ===');
  html.teamLogos.forEach((t, i) => console.log(`--- teamLogo[${i}] ---\n${t}\n`));
  console.log('\n=== PLAYER COUNT ===', html.playerCount);
  console.log('\n=== matchupDetailsRegion (first 3000 chars) ===\n', html.matchupDetails);
} catch (err) {
  console.error('ERROR:', err.message);
  await dump('99-error');
} finally {
  await browser.close();
}
