import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, it } from "node:test";

type Permission = boolean | Record<string, unknown>;

type EntitySchema = {
  name?: string;
  properties: Record<string, {
    enum?: string[];
    rls?: {
      read?: Permission;
      write?: Permission;
    };
    type: string;
  }>;
  required?: string[];
  rls?: {
    create: Permission;
    delete: Permission;
    read: Permission;
    update: Permission;
  };
  type: string;
};

const entityDirectory = join(process.cwd(), "base44", "entities");
const workflowEntities = [
  "Organization",
  "Policy",
  "PolicyVersion",
  "PolicyClause",
  "Guidance",
  "PolicyDelta",
  "ReplayJob",
  "ReplayItem",
  "Finding",
  "ReviewTask",
  "Approval",
  "Delivery",
  "DeliverySecret",
  "Acknowledgement",
  "AuditPacket",
  "OperationEvent",
] as const;
const allRoles = ["policy_admin", "reviewer", "auditor", "staff"];
const reviewRoles = ["policy_admin", "reviewer", "auditor"];
const auditRoles = ["policy_admin", "auditor"];
const readRoles: Record<(typeof workflowEntities)[number], string[]> = {
  Acknowledgement: reviewRoles,
  Approval: reviewRoles,
  AuditPacket: auditRoles,
  Delivery: reviewRoles,
  DeliverySecret: [],
  Finding: allRoles,
  Guidance: allRoles,
  OperationEvent: auditRoles,
  Organization: allRoles,
  Policy: allRoles,
  PolicyClause: allRoles,
  PolicyDelta: allRoles,
  PolicyVersion: allRoles,
  ReplayItem: reviewRoles,
  ReplayJob: reviewRoles,
  ReviewTask: allRoles,
};

function readEntity(name: string): EntitySchema {
  const path = join(entityDirectory, `${name}.json`);
  assert.ok(existsSync(path), `Missing Base44 entity: ${name}`);
  return JSON.parse(readFileSync(path, "utf8")) as EntitySchema;
}

function roleScopedReadRule(roles: string[]): Permission {
  return {
    "$and": [
      { "data.organization_id": "{{user.data.organization_id}}" },
      {
        "user_condition": {
          "data.policy_role": { "$in": roles },
        },
      },
    ],
  };
}

function assertFieldHidden(entityName: string, fieldName: string): void {
  const field = readEntity(entityName).properties[fieldName];
  assert.equal(field?.rls?.read, false);
}

describe("Base44 entity security", () => {
  it("defines every entity in the minimal workflow graph", () => {
    for (const name of workflowEntities) {
      const schema = readEntity(name);
      assert.equal(schema.name, name);
      assert.equal(schema.type, "object");
    }
  });

  it("scopes readable workflow records to the current organization", () => {
    for (const name of workflowEntities.filter(
      (entityName) => entityName !== "DeliverySecret",
    )) {
      assert.deepEqual(
        readEntity(name).rls?.read,
        roleScopedReadRule(readRoles[name]),
      );
    }
    assert.equal(readEntity("DeliverySecret").rls?.read, false);
  });

  it("denies direct client mutation of trusted workflow records", () => {
    for (const name of workflowEntities) {
      const rls = readEntity(name).rls;
      assert.equal(rls?.create, false, `${name} create must use a function`);
      assert.equal(rls?.update, false, `${name} update must use a function`);
      assert.equal(rls?.delete, false, `${name} delete must be denied`);
    }
  });

  it("persists an idempotency key for agent-created review tasks", () => {
    const reviewTask = readEntity("ReviewTask");

    assert.equal(reviewTask.properties.dedupe_key?.type, "string");
    assert.ok(reviewTask.required?.includes("dedupe_key"));
    assert.equal(reviewTask.properties.created_by_user_id?.type, "string");
  });

  it("persists idempotency keys for model findings and acknowledgements", () => {
    for (const entityName of ["Finding", "Acknowledgement"]) {
      const entity = readEntity(entityName);
      assert.equal(entity.properties.dedupe_key?.type, "string");
      assert.ok(entity.required?.includes("dedupe_key"));
    }
  });

  it("prevents users from changing their organization or policy role", () => {
    const user = readEntity("User");

    assert.equal(user.name, "User");
    assert.deepEqual(user.required, ["organization_id", "policy_role"]);
    assert.deepEqual(user.properties.policy_role?.enum, [
      "policy_admin",
      "reviewer",
      "auditor",
      "staff",
    ]);
    assert.equal(user.properties.organization_id?.rls?.write, false);
    assert.equal(user.properties.policy_role?.rls?.write, false);
  });

  it("hides recipient, token, connector, and private-file fields", () => {
    assertFieldHidden("Guidance", "recipient_email");
    assertFieldHidden("Delivery", "connector_message_id");
    assertFieldHidden("AuditPacket", "private_file_uri");
    for (const property of Object.values(readEntity("DeliverySecret").properties)) {
      assert.equal(property.rls?.read, false);
      assert.equal(property.rls?.write, false);
    }
  });
});
