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
  // Clearance for the floating pill tab bar (2026-07-31): taller than the
  // old edge-to-edge bar, so content needs pb-24 below md.
  assert.match(shell, /pb-24 md:pb-0/);
});

test("portal chrome is monochrome and dark mode uses a true-black surface stack", () => {
  assert.match(styles, /--primary:\s+#1C1C1E/);
  assert.match(styles, /--sidebar-primary:\s+#1C1C1E/);
  assert.match(styles, /\.dark\s*\{[\s\S]*--background:\s+#000000/);
  assert.match(styles, /\.dark\s*\{[\s\S]*--card:\s+#080808/);
  assert.match(styles, /\.dark\s*\{[\s\S]*--primary:\s+#F5F5F7/);
  assert.match(styles, /--success:\s+#16A34A/); // real green per founder 2026-07-28
  assert.match(styles, /\.dark\s*\{[\s\S]*--success:\s+#22C55E/);
  assert.doesNotMatch(
    visualSource,
    /(?:bg|text|border|from|to)-(?:green|emerald|lime|olive|sage)-|#(?:10b981)/i,
  );
  assert.doesNotMatch(styles, /--cat-\*\//);
});
