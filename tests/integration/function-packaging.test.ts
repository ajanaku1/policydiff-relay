import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { it } from "node:test";

const projectRoot = process.cwd();
const sourceRoot = join(projectRoot, "base44", "functions");
const deployRoot = join(projectRoot, "base44", ".deploy", "functions");

interface PackageManifest {
  devDependencies?: Record<string, string>;
  scripts?: Record<string, string>;
}

interface FunctionConfig {
  automations?: unknown[];
  entry: string;
  name: string;
}

function listFunctionNames(root: string): string[] {
  return readdirSync(root, { withFileTypes: true })
    .filter((entry) => entry.isDirectory() && !entry.name.startsWith("_"))
    .map((entry) => entry.name)
    .sort();
}

it("packages isolated Base44 function artifacts", () => {
  const result = spawnSync(
    process.execPath,
    [join(projectRoot, "scripts", "package-base44-functions.mjs")],
    { encoding: "utf8" },
  );
  assert.equal(result.status, 0, result.stderr);

  const sourceNames = listFunctionNames(sourceRoot);
  assert.deepEqual(listFunctionNames(deployRoot), sourceNames);
  for (const name of sourceNames) {
    const entry = readFileSync(join(deployRoot, name, "entry.ts"), "utf8");
    assert.match(entry, /from "npm:@base44\/sdk"/);
    assert.doesNotMatch(entry, /\.\.\/\.\.\/shared/);
  }
});

it("routes Base44 deployment through the packaging step", () => {
  const config = readFileSync(join(projectRoot, "base44", "config.jsonc"), "utf8");
  assert.match(config, /"functionsDir": "\.\/\.deploy\/functions"/);

  const packageJson = JSON.parse(
    readFileSync(join(projectRoot, "package.json"), "utf8"),
  ) as PackageManifest;
  assert.equal(
    packageJson.scripts?.["package:base44"],
    "node scripts/package-base44-functions.mjs",
  );
  assert.equal(
    packageJson.scripts?.["deploy:base44"],
    "npm run package:base44 && base44 deploy --yes",
  );
  assert.ok(packageJson.devDependencies?.esbuild);
});

it("leaves legacy automations out of Workflow-enabled deploy configs", () => {
  const configName = "ingestPolicyVersion";
  const sourceConfig = JSON.parse(
    readFileSync(join(sourceRoot, configName, "function.jsonc"), "utf8"),
  ) as FunctionConfig;
  const deployConfig = JSON.parse(
    readFileSync(join(deployRoot, configName, "function.jsonc"), "utf8"),
  ) as FunctionConfig;

  assert.ok(sourceConfig.automations?.length);
  assert.equal(deployConfig.automations, undefined);
  assert.equal(deployConfig.name, sourceConfig.name);
  assert.equal(deployConfig.entry, sourceConfig.entry);
});
