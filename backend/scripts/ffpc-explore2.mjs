import { chromium } from 'playwright';

const browser = await chromium.launch({ headless: true });
const page = await (await browser.newContext()).newPage();

try {
  await page.goto('https://myffpc.com/Scoreboard.aspx?ltuid=4B4-4F379186623A', { waitUntil: 'domcontentloaded', timeout: 20000 });
  await page.waitForTimeout(1500);

  const dump = await page.evaluate(() => {
    const tableIds = Array.from(document.querySelectorAll('table[id]')).map((t) => t.id);
    const clocks = Array.from(document.querySelectorAll('.clock')).map((c) => c.textContent.trim());
    // Look for team name headings near the clocks
    const headerArea = document.querySelector('.clock')?.closest('div[class]')?.parentElement?.outerHTML?.slice(0, 3000);
    const allDivsWithTeam = Array.from(document.querySelectorAll('[class*="team" i], [id*="team" i], [class*="Team"]'))
      .slice(0, 20)
      .map((e) => ({ tag: e.tagName, id: e.id, className: e.className, text: e.textContent.trim().slice(0, 60) }));
    return { tableIds, clocks, headerArea, allDivsWithTeam };
  });

  console.log('=== TABLE IDS ===', JSON.stringify(dump.tableIds));
  console.log('\n=== CLOCKS ===', JSON.stringify(dump.clocks));
  console.log('\n=== TEAM-ish ELEMENTS ===\n', JSON.stringify(dump.allDivsWithTeam, null, 2));
  console.log('\n=== HEADER AREA ===\n', dump.headerArea);
} catch (err) {
  console.error('ERROR:', err.message);
} finally {
  await browser.close();
}
