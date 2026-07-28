import assert from "node:assert/strict";
import { it } from "node:test";

it("preserves complete PolicyDiff admin claims", async () => {
  const module = await import("../../base44/shared/demo-admin.ts").catch(() => null);
  assert.ok(module, "Missing demo admin resolver");

  assert.deepEqual(
    module.resolveDemoAdmin({
      id: "admin-1",
      organization_id: "organization-1",
      policy_role: "policy_admin",
    }),
    {
      actor: {
        id: "admin-1",
        organizationId: "organization-1",
        policyRole: "policy_admin",
      },
    },
  );
});

it("bootstraps only a built-in Base44 app admin", async () => {
  const module = await import("../../base44/shared/demo-admin.ts").catch(() => null);
  assert.ok(module, "Missing demo admin resolver");

  const resolution = module.resolveDemoAdmin({
    _app_role: "admin",
    id: "admin-1",
    role: "admin",
  });
  assert.deepEqual(resolution.actor, {
    id: "admin-1",
    organizationId: "northstar-benefits-demo",
    policyRole: "policy_admin",
  });
  assert.deepEqual(resolution.profileUpdate, {
    organization_id: "northstar-benefits-demo",
    policy_role: "policy_admin",
  });
  assert.throws(
    () => module.resolveDemoAdmin({ id: "member-1", role: "user" }),
    /POLICY_ADMIN_REQUIRED/,
  );
});
