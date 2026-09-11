import { chromium } from 'playwright';

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 420, height: 1400 } }).catch(() => browser.newPage());
await page.setViewportSize({ width: 420, height: 1400 });

await page.goto('http://localhost:3000', { waitUntil: 'networkidle', timeout: 30000 });
await page.waitForTimeout(3000);

await page.screenshot({
  path: 'C:/Users/bherman/AppData/Local/Temp/claude/c--Dev-Projects/5dee938c-8085-499e-be57-1a0855a0fea4/scratchpad/final-app-collapsed.png',
  fullPage: true,
});

// Expand the WildeTime (CBS) card specifically to show roster detail too
const cbsCard = page.locator('button', { hasText: 'WildeTime' }).first();
await cbsCard.click().catch(() => {});
await page.waitForTimeout(500);
await page.screenshot({
  path: 'C:/Users/bherman/AppData/Local/Temp/claude/c--Dev-Projects/5dee938c-8085-499e-be57-1a0855a0fea4/scratchpad/final-app-expanded.png',
  fullPage: true,
});

console.log('Screenshots saved.');
await browser.close();
