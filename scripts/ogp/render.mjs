// card.html を 1200×630 の PNG（icons/ogp.png）に、icon.html をホーム画面のアイコン（icons/icon-*.png など）に書き出す。
//   node scripts/ogp/render.mjs
import { chromium } from "playwright";
import { fileURLToPath } from "node:url";

const here = (p) => fileURLToPath(new URL(p, import.meta.url));
const browser = await chromium.launch();
async function render(file, size, out, query = "") {
  const page = await browser.newPage({ viewport: size });
  await page.goto("file://" + here(file) + query, { waitUntil: "networkidle" });
  await page.evaluate(() => document.fonts.ready);
  await page.screenshot({ path: here(out) });
  await page.close();
}
await render("./card.html", { width: 1200, height: 630 }, "../../icons/ogp.png");
await render("./icon.html", { width: 192, height: 192 }, "../../icons/icon-192.png");
await render("./icon.html", { width: 512, height: 512 }, "../../icons/icon-512.png");
await render("./icon.html", { width: 512, height: 512 }, "../../icons/icon-maskable-512.png", "?safe=1");
await render("./icon.html", { width: 180, height: 180 }, "../../icons/apple-touch-icon.png");
await browser.close();
