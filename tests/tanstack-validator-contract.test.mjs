import assert from "node:assert/strict";
import { readdirSync, readFileSync } from "node:fs";
import { extname, join } from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

const sourceRoot = fileURLToPath(new URL("../src/", import.meta.url));

function sourceFiles(directory) {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const path = join(directory, entry.name);
    if (entry.isDirectory()) return sourceFiles(path);
    return [".ts", ".tsx"].includes(extname(entry.name)) ? [path] : [];
  });
}

test("TanStack server functions use the current validator API", () => {
  const deprecatedUsages = sourceFiles(sourceRoot).filter((path) =>
    readFileSync(path, "utf8").includes(".inputValidator("),
  );

  assert.deepEqual(deprecatedUsages, []);
});
