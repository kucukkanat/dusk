// Render the home-screen shortcut icons (manifest `shortcuts`) from Dusk's own icon paths.
// Run: node scripts/shortcut-icons.mjs  (needs Playwright with a Chromium) — writes public/icons/shortcuts/*.png
import { readFileSync } from "node:fs";
import { chromium } from "playwright";

const src = readFileSync(new URL("../src/ui/Icon.tsx", import.meta.url), "utf8");
const path = (name) => src.match(new RegExp(`\\b${name}: "([^"]+)"`))[1];
const ICONS = { compose: "plus", search: "search", messages: "message", activity: "bell" };

const browser = await chromium.launch(process.env.CHROMIUM ? { executablePath: process.env.CHROMIUM } : {});
const page = await browser.newPage({ viewport: { width: 192, height: 192 } });
for (const [file, name] of Object.entries(ICONS)) {
  await page.setContent(`<body style="margin:0;background:transparent">
    <svg width="192" height="192" viewBox="0 0 192 192" xmlns="http://www.w3.org/2000/svg">
      <circle cx="96" cy="96" r="96" fill="#14151a"/>
      <g transform="translate(48 48) scale(4)" fill="none" stroke="#9cc6c2" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round"><path d="${path(name)}"/></g>
    </svg></body>`);
  await page.screenshot({ path: new URL(`../public/icons/shortcuts/${file}.png`, import.meta.url).pathname, omitBackground: true });
}
await browser.close();
