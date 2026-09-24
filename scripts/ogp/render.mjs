// card.html を 1200×630 の PNG（icons/ogp.png）に書き出す。
//   node scripts/ogp/render.mjs
import { chromium } from "playwright";
import { fileURLToPath } from "node:url";

const here = (p) => fileURLToPath(new URL(p, import.meta.url));
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1200, height: 630 } });
await page.goto("file://" + here("./card.html"), { waitUntil: "networkidle" });
await page.evaluate(() => document.fonts.ready);
await page.screenshot({ path: here("../../icons/ogp.png") });
await browser.close();
