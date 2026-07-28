import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { it } from "node:test";

it("gives the policy agent only explanation and reviewer-task tools", () => {
  const path = join(
    process.cwd(),
    "base44",
    "agents",
    "policy_ops.json",
  );
  assert.ok(existsSync(path), "Missing policy operations agent");
  const agent = JSON.parse(readFileSync(path, "utf8")) as {
    instructions: string;
    name: string;
    tool_configs: Array<{
      allowed_operations?: string[];
      entity_name?: string;
      function_name?: string;
    }>;
  };

  assert.equal(agent.name, "policy_ops");
  assert.deepEqual(
    agent.tool_configs.map((tool) => tool.function_name),
    ["explainFinding", "createReviewerTask"],
  );
  assert.equal(
    agent.tool_configs.some((tool) =>
      tool.allowed_operations?.some((operation) =>
        ["create", "update", "delete"].includes(operation),
      ),
    ),
    false,
  );
  assert.match(agent.instructions, /never approve/i);
  assert.match(agent.instructions, /staff/i);
});

it("backs every agent tool with a deployable Base44 function", () => {
  const agentPath = join(process.cwd(), "base44", "agents", "policy_ops.json");
  const agent = JSON.parse(readFileSync(agentPath, "utf8")) as {
    tool_configs: Array<{ function_name?: string }>;
  };

  for (const tool of agent.tool_configs) {
    assert.ok(tool.function_name, "Agent function name is required");
    const entryPath = join(
      process.cwd(),
      "base44",
      "functions",
      tool.function_name,
      "entry.ts",
    );
    assert.ok(existsSync(entryPath), `Missing agent function: ${tool.function_name}`);
  }
});
