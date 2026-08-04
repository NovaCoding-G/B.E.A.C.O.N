import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const root = resolve(import.meta.dirname, "..");

function readJson(relativePath: string): unknown {
  return JSON.parse(readFileSync(resolve(root, relativePath), "utf8"));
}

function parseSemver(version: string): [number, number, number] {
  const match = version.trim().match(/^(\d+)\.(\d+)\.(\d+)/);
  if (!match) {
    throw new Error(`Unexpected version: ${version}`);
  }
  return [Number(match[1]), Number(match[2]), Number(match[3])];
}

function isAtLeast(
  version: string,
  minimum: [number, number, number],
): boolean {
  const actual = parseSemver(version);
  for (let i = 0; i < 3; i++) {
    if (actual[i] > minimum[i]) return true;
    if (actual[i] < minimum[i]) return false;
  }
  return true;
}

describe("dependency advisory baseline (issue #8)", () => {
  it("pins Next.js at or above 16.3.0 with matching eslint-config-next", () => {
    const pkg = readJson("package.json") as {
      dependencies: Record<string, string>;
      devDependencies: Record<string, string>;
    };

    expect(isAtLeast(pkg.dependencies.next, [16, 3, 0])).toBe(true);
    expect(isAtLeast(pkg.devDependencies["eslint-config-next"], [16, 3, 0])).toBe(
      true,
    );
  });

  it("keeps production advisory overrides for nested postcss and sharp", () => {
    const pkg = readJson("package.json") as {
      overrides?: Record<string, string>;
    };

    expect(pkg.overrides?.postcss).toMatch(/>=?8\.5\.23/);
    expect(pkg.overrides?.sharp).toMatch(/>=?0\.35\.0/);
  });

  it("configures Dependabot for npm and GitHub Actions", () => {
    const yaml = readFileSync(resolve(root, ".github/dependabot.yml"), "utf8");

    expect(yaml).toContain("package-ecosystem: npm");
    expect(yaml).toContain("package-ecosystem: github-actions");
  });
});
