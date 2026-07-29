import assert from "node:assert/strict";
import { existsSync, readFileSync, readdirSync } from "node:fs";
import { fileURLToPath } from "node:url";
import test from "node:test";

const root = new URL("../", import.meta.url);
const staffNavUrl = new URL("src/components/staff-bottom-nav.tsx", root);
const shell = readFileSync(new URL("src/routes/_authenticated.tsx", root), "utf8");
const styles = readFileSync(new URL("src/styles.css", root), "utf8");
const srcDir = fileURLToPath(new URL("src/", root));
const visualSource = readdirSync(srcDir, { recursive: true })
  .filter((file) => /\.(?:css|ts|tsx)$/.test(file))
  .map((file) => readFileSync(new URL(`src/${file}`, root), "utf8"))
  .join("\n");

test("staff mobile navigation keeps primary work visible and opens the shared sidebar for more", () => {
  assert.ok(existsSync(staffNavUrl));
  const staffNav = readFileSync(staffNavUrl, "utf8");
  assert.match(staffNav, /Staff primary navigation/);
  assert.match(staffNav, /PRIMARY_NAV_ITEMS/);
  assert.match(staffNav, /"home", "work", "performance", "customers"/);
  assert.match(staffNav, /setOpenMobile\(true\)/);
  assert.match(staffNav, /md:hidden/);
  assert.match(staffNav, /min-h-12/);
  assert.match(shell, /StaffBottomNav/);
  assert.match(shell, /isTeam && !studentOnly/);
  assert.match(shell, /pb-20 md:pb-0/);
});

test("original subtle coloring: green primary, blue-black dark stack (founder 2026-07-29)", () => {
  // Hermes's pure-monochrome pass was overridden by the founder: the portal
  // keeps the command-center layout but the ORIGINAL palette.
  assert.match(styles, /--primary:\s+#16A34A/);
  assert.match(styles, /--sidebar-primary:\s+#16A34A/);
  assert.match(styles, /\.dark\s*\{[\s\S]*--background:\s+#08090D/);
  assert.match(styles, /\.dark\s*\{[\s\S]*--card:\s+#0E0F14/);
  assert.match(styles, /\.dark\s*\{[\s\S]*--primary:\s+#22C55E/);
  assert.match(styles, /--chart-1:\s+#2563EB/);
  assert.match(styles, /--success:\s+#16A34A/); // real green per founder 2026-07-28
  assert.match(styles, /\.dark\s*\{[\s\S]*--success:\s+#22C55E/);
  assert.doesNotMatch(
    visualSource,
    /(?:bg|text|border|from|to)-(?:green|emerald|lime|olive|sage)-|#(?:10b981)/i,
  );
  assert.doesNotMatch(styles, /--cat-\*\//);
});
