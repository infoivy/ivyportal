import { chromium } from "playwright";
const routes = ["dashboard","eods","action-items","sales","revenue","closer-resources","training","calendar","students","calls","student-success","csm","testimonials","knowledge","notes","admin","team","profile","installments","payouts","coaches","crm","analytics","policies","sops"];
const browser = await chromium.launch({ channel: "chrome", headless: true });
const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, deviceScaleFactor: 2 });
const page = await ctx.newPage();
await page.goto("http://localhost:3000/auth", { waitUntil: "networkidle" });
await page.waitForTimeout(1200);
await page.fill('input[type="email"]', "qa-admin@demo.local");
await page.fill('input[type="password"]', "DemoPortal2026!");
await page.click('button[type="submit"]:has-text("Sign in")');
await page.waitForURL(u => !u.pathname.startsWith("/auth"), { timeout: 20000 });
await page.waitForTimeout(2500);
const report = [];
for (const r of routes) {
  try {
    await page.goto("http://localhost:3000/" + r, { waitUntil: "networkidle", timeout: 25000 });
    await page.waitForTimeout(1800);
    const overflow = await page.evaluate(() => {
      const docW = document.documentElement.clientWidth;
      const wide = [];
      document.querySelectorAll("main *").forEach(el => {
        const rect = el.getBoundingClientRect();
        if (rect.width > docW + 4 || rect.right > docW + 4) {
          if (wide.length < 5) wide.push(`${el.tagName.toLowerCase()}.${String(el.className).split(" ").slice(0,3).join(".")} w=${Math.round(rect.width)}`);
        }
      });
      return { docScrollW: document.documentElement.scrollWidth, docW, wide };
    });
    const hscroll = overflow.docScrollW > overflow.docW + 4;
    report.push({ r, hscroll, wide: overflow.wide.slice(0,3) });
    await page.screenshot({ path: `/tmp/mob/${r.replace(/\//g,"_")}.png` });
  } catch (e) { report.push({ r, err: String(e).slice(0, 80) }); }
}
console.log(JSON.stringify(report, null, 1));
await browser.close();
