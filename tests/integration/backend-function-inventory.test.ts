import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { it } from "node:test";

const functionsDirectory = join(process.cwd(), "base44", "functions");

interface ConnectorAutomation {
  integration_type: string;
  is_active: boolean;
  resource_id?: string;
  type: string;
}

interface FunctionConfig {
  automations?: ConnectorAutomation[];
}

function assertFunctionExists(name: string): void {
  const entry = join(functionsDirectory, name, "entry.ts");
  assert.ok(existsSync(entry), `Missing Base44 function: ${name}`);
}

function readIngestAutomation(): ConnectorAutomation {
  const path = join(functionsDirectory, "ingestPolicyVersion", "function.jsonc");
  const config = JSON.parse(readFileSync(path, "utf8")) as FunctionConfig;
  const [automation] = config.automations ?? [];
  assert.ok(automation, "Missing Drive ingestion automation");
  return automation;
}

it("provides the Drive-to-version ingestion boundary", () => {
  assertFunctionExists("ingestPolicyVersion");
  assertFunctionExists("createGuidance");
  assertFunctionExists("seedDemoWorkspace");
  assertFunctionExists("seedDemoIncident");
  assertFunctionExists("loadControlRoomData");
});

it("keeps the allowlisted Drive automation scoped and inactive", () => {
  const automation = readIngestAutomation();

  assert.equal(automation.type, "connector");
  assert.equal(automation.integration_type, "googledrive");
  assert.match(automation.resource_id ?? "", /^[A-Za-z0-9_-]{20,}$/);
  assert.equal(automation.is_active, false);
});

it("provides clause extraction, comparison, and activation boundaries", () => {
  assertFunctionExists("extractPolicyClauses");
  assertFunctionExists("comparePolicyVersions");
  assertFunctionExists("activatePolicyVersion");
});

it("provides deterministic replay orchestration and model review boundaries", () => {
  assertFunctionExists("createReplayJob");
  assertFunctionExists("replayGuidance");
});

it("provides human approval and locked Gmail delivery boundaries", () => {
  assertFunctionExists("approveFinding");
  assertFunctionExists("sendCorrection");
  assertFunctionExists("reconcileDeliveries");
});

it("provides single-use acknowledgement and private audit boundaries", () => {
  assertFunctionExists("acknowledgeDelivery");
  assertFunctionExists("createAuditPacket");
});
