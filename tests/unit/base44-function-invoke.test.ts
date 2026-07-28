import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  type FunctionCaller,
  invokeFunction,
} from "../../base44/shared/base44-invoke.ts";

class FixedCaller implements FunctionCaller {
  private readonly response: Response;

  constructor(response: Response) {
    this.response = response;
  }

  async fetch(): Promise<Response> {
    return this.response;
  }
}

describe("Base44 internal function invocation", () => {
  it("accepts a successful downstream function response", async () => {
    await invokeFunction(
      new FixedCaller(Response.json({ ok: true })),
      "extractPolicyClauses",
      { resource_id: "resource-1" },
    );
  });

  it("turns a failed downstream response into a safe workflow error", async () => {
    await assert.rejects(
      invokeFunction(
        new FixedCaller(Response.json({ error: "private" }, { status: 500 })),
        "extractPolicyClauses",
        {},
      ),
      { code: "DOWNSTREAM_FUNCTION_FAILED" },
    );
  });
});
