import { mkdir, readFile, readdir, rm, stat, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { build } from "esbuild";

const projectRoot = dirname(dirname(fileURLToPath(import.meta.url)));
const sourceRoot = join(projectRoot, "base44", "functions");
const deployRoot = join(projectRoot, "base44", ".deploy", "functions");

function isMissingFileError(error) {
  return error instanceof Error && "code" in error && error.code === "ENOENT";
}

async function pathExists(path) {
  return stat(path).then(
    () => true,
    (error) => {
      if (isMissingFileError(error)) return false;
      throw error;
    },
  );
}

async function listFunctionNames() {
  const entries = await readdir(sourceRoot, { withFileTypes: true });
  return entries
    .filter((entry) => entry.isDirectory() && !entry.name.startsWith("_"))
    .map((entry) => entry.name)
    .sort();
}

async function bundleEntry(sourceEntry) {
  const result = await build({
    bundle: true,
    entryPoints: [sourceEntry],
    external: ["@base44/sdk"],
    format: "esm",
    logLevel: "silent",
    platform: "neutral",
    target: "es2022",
    write: false,
  });
  const [output] = result.outputFiles;
  if (!output) throw new Error(`No bundle emitted for ${sourceEntry}`);
  return output.text.replaceAll('from "@base44/sdk"', 'from "npm:@base44/sdk"');
}

async function writeDeployConfig(sourceConfig, targetConfig) {
  const config = JSON.parse(await readFile(sourceConfig, "utf8"));
  Reflect.deleteProperty(config, "automations");
  await writeFile(targetConfig, `${JSON.stringify(config, null, 2)}\n`);
}

async function packageFunction(name) {
  const sourceDirectory = join(sourceRoot, name);
  const targetDirectory = join(deployRoot, name);
  await mkdir(targetDirectory, { recursive: true });
  const bundledEntry = await bundleEntry(join(sourceDirectory, "entry.ts"));
  await writeFile(join(targetDirectory, "entry.ts"), bundledEntry);

  const configPath = join(sourceDirectory, "function.jsonc");
  if (await pathExists(configPath)) {
    await writeDeployConfig(
      configPath,
      join(targetDirectory, "function.jsonc"),
    );
  }
}

async function packageBase44Functions() {
  await rm(deployRoot, { force: true, recursive: true });
  const functionNames = await listFunctionNames();
  await Promise.all(functionNames.map(packageFunction));
  console.log(`Packaged ${functionNames.length} Base44 functions.`);
}

await packageBase44Functions().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
