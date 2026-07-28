import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  buildWorkflowActor,
  errorResponse,
  readJsonObject,
  readAutomationPayload,
  readResourceId,
  readRuntimeSecret,
  readStringArray,
  readRequiredString,
} from "../../base44/shared/base44-http.ts";
import { WorkflowError } from "../../base44/shared/workflow.ts";

describe("Base44 function HTTP boundary", () => {
  it("builds an actor only from complete trusted user claims", () => {
    assert.deepEqual(
      buildWorkflowActor({
        id: "staff-1",
        organization_id: "organization-1",
        policy_role: "staff",
      }),
      {
        id: "staff-1",
        organizationId: "organization-1",
        policyRole: "staff",
      },
    );
    assert.throws(
      () => buildWorkflowActor({ id: "staff-1", policy_role: "staff" }),
      { code: "AUTH_CONTEXT_INVALID" },
    );
  });

  it("reads non-empty request strings", () => {
    assert.equal(readRequiredString({ finding_id: " finding-1 " }, "finding_id"), "finding-1");
    assert.throws(
      () => readRequiredString({ finding_id: "" }, "finding_id"),
      { code: "REQUEST_INVALID" },
    );
  });

  it("reads resource IDs from direct and automation request bodies", () => {
    assert.equal(
      readResourceId({ policy_version_id: "version-1" }, "policy_version_id"),
      "version-1",
    );
    assert.equal(
      readResourceId({ data: { id: "version-2" } }, "policy_version_id"),
      "version-2",
    );
  });

  it("reads non-empty arrays of non-empty strings", () => {
    assert.deepEqual(
      readStringArray({ cited_clause_ids: [" clause-1 ", "clause-2"] }, "cited_clause_ids"),
      ["clause-1", "clause-2"],
    );
    assert.throws(
      () => readStringArray({ cited_clause_ids: [] }, "cited_clause_ids"),
      { code: "REQUEST_INVALID" },
    );
  });

  it("accepts only JSON object request bodies", async () => {
    const request = new Request("https://example.test", {
      body: JSON.stringify({ finding_id: "finding-1" }),
      method: "POST",
    });

    assert.deepEqual(await readJsonObject(request), { finding_id: "finding-1" });
    await assert.rejects(
      readJsonObject(new Request("https://example.test", {
        body: "[]",
        method: "POST",
      })),
      { code: "REQUEST_INVALID" },
    );
  });

  it("unwraps the documented connector automation payload", () => {
    assert.deepEqual(
      readAutomationPayload({
        payload: {
          event: { type: "file.update" },
          data: { file_id: "doc-1" },
        },
      }),
      {
        event: { type: "file.update" },
        data: { file_id: "doc-1" },
      },
    );
  });

  it("requires non-empty runtime secrets", () => {
    assert.equal(
      readRuntimeSecret("TOKEN_SECRET", { get: () => " configured " }),
      "configured",
    );
    assert.throws(
      () => readRuntimeSecret("TOKEN_SECRET", { get: () => undefined }),
      { code: "SERVER_CONFIGURATION_INVALID" },
    );
  });

  it("returns safe error codes without leaking exception messages", async () => {
    const known = errorResponse(new WorkflowError("REVIEWER_REQUIRED"));
    assert.equal(known.status, 400);
    assert.deepEqual(await known.json(), { error: "REVIEWER_REQUIRED" });

    const unknown = errorResponse(new Error("database password leaked"));
    assert.equal(unknown.status, 500);
    assert.deepEqual(await unknown.json(), { error: "INTERNAL_ERROR" });
  });
});
