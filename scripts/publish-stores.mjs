import { spawnSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";

const manifest = JSON.parse(readFileSync(new URL("../package.json", import.meta.url), "utf8"));
const vsixPath = `${manifest.name}-${manifest.version}.vsix`;
const isDryRun = process.argv.includes("--dry-run");

if (!existsSync(vsixPath)) {
  throw new Error(`Package ${vsixPath} does not exist. Run pnpm run package first.`);
}

if (!isDryRun) {
  for (const variableName of ["VSCE_PAT", "OVSX_PAT"]) {
    if (!process.env[variableName]) {
      throw new Error(`${variableName} is not available. Run through op run --env-file=.env.1password.`);
    }
  }
}

console.log(`Ready to publish ${manifest.publisher}.${manifest.name}@${manifest.version} from ${vsixPath}.`);

/** Runs each store publish command after packaging so the release script stops on the first failed upload.
 * @param {string} command Command name to execute.
 * @param {string[]} args Arguments passed without shell interpolation.
 * @returns {void}
 * @example run("pnpm", ["exec", "vsce", "publish", "--packagePath", "extension.vsix"]);
 */
function run(command, args) {
  console.log(`$ ${[command, ...args].join(" ")}`);

  if (isDryRun) {
    return;
  }

  const result = spawnSync(command, args, {
    stdio: "inherit",
    env: process.env,
  });

  // Stop after the first failed store publish so a release cannot look half-complete.
  if (result.status !== 0) {
    process.exit(result.status ?? 1);
  }
}

run("pnpm", ["exec", "vsce", "publish", "--packagePath", vsixPath]);
run("pnpm", ["dlx", "ovsx", "publish", vsixPath]);
