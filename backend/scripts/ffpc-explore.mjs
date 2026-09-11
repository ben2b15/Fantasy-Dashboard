import { chromium } from 'playwright';
import 'dotenv/config';

const EMAIL = process.env.FFPC_USERNAME;
const PASSWORD = process.env.FFPC_PASSWORD;

const browser = await chromium.launch({ headless: true });
const context = await browser.newContext();
const page = await context.newPage();

async function shot(label) {
  await page.screenshot({ path: `C:/Users/bherman/AppData/Local/Temp/claude/c--Dev-Projects/5dee938c-8085-499e-be57-1a0855a0fea4/scratchpad/ffpc-${label}.png`, fullPage: true }).catch(() => {});
}

try {
  await page.goto('https://myffpc.com/Scoreboard.aspx?ltuid=4B4-4F379186623A', { waitUntil: 'domcontentloaded', timeout: 20000 });
  console.log('Landed at:', page.url());
  await shot('01-initial');

  const hasLoginForm = await page.locator('input[name="txtExistingUsername"]').count();
  console.log('Login form present:', hasLoginForm > 0);

  if (hasLoginForm > 0) {
    await page.fill('input[name="txtExistingUsername"]', EMAIL);
    await page.fill('input[name="txtExistingPassword"]', PASSWORD);
    await shot('02-filled');
    await Promise.all([
      page.waitForNavigation({ waitUntil: 'domcontentloaded', timeout: 20000 }).catch(() => {}),
      page.click('input[name="btnSignIn"]'),
    ]);
    await page.waitForTimeout(3000);
  }

  console.log('After login URL:', page.url());
  await shot('03-after-login');

  // Navigate to the actual matchup page (in case login redirected elsewhere)
  await page.goto('https://myffpc.com/Scoreboard.aspx?ltuid=4B4-4F379186623A', { waitUntil: 'domcontentloaded', timeout: 20000 });
  await page.waitForTimeout(2000);
  await shot('04-matchup');
  console.log('Final URL:', page.url());

  const dump = await page.evaluate(() => {
    const clock = document.querySelector('.clock')?.outerHTML;
    const benchTh = Array.from(document.querySelectorAll('th')).find((th) => th.textContent.trim() === 'Bench');
    const benchTable = benchTh ? benchTh.closest('table')?.outerHTML.slice(0, 6000) : null;
    const anyProjDiv = document.querySelector('[id^="divPlayerProjections"]');
    const projRow = anyProjDiv ? anyProjDiv.closest('tr')?.outerHTML : null;
    const allTables = document.querySelectorAll('table').length;
    return { clock, benchTable, projRow, allTables };
  });

  console.log('\n=== clock ===', dump.clock);
  console.log('\n=== table count ===', dump.allTables);
  console.log('\n=== projRow ===\n', dump.projRow);
  console.log('\n=== benchTable (first 6000) ===\n', dump.benchTable);
} catch (err) {
  console.error('ERROR:', err.message);
  await shot('99-error');
} finally {
  await browser.close();
}
