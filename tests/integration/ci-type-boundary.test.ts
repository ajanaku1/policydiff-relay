import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import test from "node:test";

interface TypeScriptConfig {
  include?: string[];
}

function readConfig(path: string): TypeScriptConfig {
  return JSON.parse(readFileSync(path, "utf8")) as TypeScriptConfig;
}

test("keeps Base44 typechecking independent of ignored generated files", () => {
  const backendConfig = readConfig("tsconfig.json");
  const frontendConfig = readConfig("tsconfig.app.json");
  const trackedTypes = "base44/types/*.d.ts";

  assert.equal(existsSync("base44/types/base44.d.ts"), true);
  assert.ok(backendConfig.include?.includes(trackedTypes));
  assert.ok(frontendConfig.include?.includes(trackedTypes));
  assert.ok(!backendConfig.include?.includes("base44/.types/*.d.ts"));
  assert.ok(!frontendConfig.include?.includes("base44/.types/*.d.ts"));
});
