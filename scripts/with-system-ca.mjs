/**
 * Allowlisted tooling runner with NODE_OPTIONS=--use-system-ca.
 * spawn(execPath, args, { shell: false }) — no shell command strings.
 */
import { spawn } from "node:child_process";
import { existsSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const SAFE_ARG = /^[a-zA-Z0-9._=-]+$/;

/**
 * @typedef {{
 *   script: string,
 *   args: ReadonlySet<string>,
 *   allowEmptyArgs?: boolean,
 * }} ToolSpec
 */

/** @type {Readonly<Record<string, ToolSpec>>} */
const ALLOWED_TOOLS = {
  next: {
    script: path.join(ROOT, "node_modules", "next", "dist", "bin", "next"),
    args: new Set(["dev", "build", "start"]),
  },
  vitest: {
    script: path.join(ROOT, "node_modules", "vitest", "vitest.mjs"),
    args: new Set(["run"]),
    allowEmptyArgs: true,
  },
};

const argv = process.argv.slice(2);

if (argv.length === 0) {
  console.error(
    "Usage: node scripts/with-system-ca.mjs <next|vitest> [...args]",
  );
  process.exit(1);
}

const toolName = argv[0];
const toolArgs = argv.slice(1);

if (!toolName || !SAFE_ARG.test(toolName) || !(toolName in ALLOWED_TOOLS)) {
  console.error(`Command not allowed: ${toolName ?? "(missing)"}`);
  process.exit(1);
}

const tool = ALLOWED_TOOLS[toolName];

if (!existsSync(tool.script)) {
  console.error(`Tool not found: ${tool.script}`);
  process.exit(1);
}

if (toolArgs.length === 0 && !tool.allowEmptyArgs) {
  console.error(`Missing required args for ${toolName}`);
  process.exit(1);
}

for (const arg of toolArgs) {
  if (!SAFE_ARG.test(arg) || !tool.args.has(arg)) {
    console.error(`Argument not allowed: ${arg}`);
    process.exit(1);
  }
}

const env = {
  ...process.env,
  NODE_OPTIONS: [process.env.NODE_OPTIONS, "--use-system-ca"]
    .filter(Boolean)
    .join(" "),
};

const child = spawn(process.execPath, [tool.script, ...toolArgs], {
  stdio: "inherit",
  env,
  shell: false,
  windowsHide: true,
});

child.on("error", (err) => {
  console.error(err.message);
  process.exit(1);
});

child.on("exit", (code, signal) => {
  if (signal) {
    process.exit(1);
  }
  process.exit(code ?? 1);
});
