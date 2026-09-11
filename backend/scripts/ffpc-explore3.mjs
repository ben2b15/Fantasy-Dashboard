import { chromium } from 'playwright';

const browser = await chromium.launch({ headless: true });
const page = await (await browser.newContext()).newPage();

try {
  await page.goto('https://myffpc.com/Scoreboard.aspx?ltuid=4B4-4F379186623A', { waitUntil: 'domcontentloaded', timeout: 20000 });
  await page.waitForTimeout(1500);

  const dump = await page.evaluate(() => {
    const homeName = document.querySelector('.team-left .team-name')?.textContent.trim();
    const awayName = document.querySelector('.team-rightFull .team-name')?.textContent.trim()
      ?? document.querySelector('.team-right .team-name')?.textContent.trim();
    const clockLeft = document.querySelector('.clock-left .clock')?.textContent.trim();
    const clockRight = document.querySelector('.clock-right .clock')?.textContent.trim();
    const team1FirstPlayer = document.querySelector('tr[id^="trPlayerInfo_1_"] [id^="divPlayerName_"]')?.textContent.trim();
    const team2FirstPlayer = document.querySelector('tr[id^="trPlayerInfo_2_"] [id^="divPlayerName_"]')?.textContent.trim();
    const t1BenchFirstRow = document.querySelector('#t1Bench tr:nth-child(2)')?.textContent.replace(/\s+/g, ' ').trim();
    const t2BenchFirstRow = document.querySelector('#t2Bench tr:nth-child(2)')?.textContent.replace(/\s+/g, ' ').trim();
    const allClasses = Array.from(document.querySelectorAll('[class*="clock"], [class*="team-right"], [class*="team-left"]')).map(e => e.className);
    return { homeName, awayName, clockLeft, clockRight, team1FirstPlayer, team2FirstPlayer, t1BenchFirstRow, t2BenchFirstRow, allClasses };
  });

  console.log(JSON.stringify(dump, null, 2));
} catch (err) {
  console.error('ERROR:', err.message);
} finally {
  await browser.close();
}
