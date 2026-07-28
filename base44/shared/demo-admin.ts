import { createSafeError } from "./base44-error.ts";
import type { WorkflowActor } from "./workflow.ts";

interface DemoAdminProfile {
  organization_id: string;
  policy_role: "policy_admin";
}

export interface DemoAdminResolution {
  actor: WorkflowActor;
  profileUpdate?: DemoAdminProfile;
}

const DEMO_ORGANIZATION_ID = "northstar-benefits-demo";

function readString(user: Record<string, unknown>, field: string): string {
  const value = user[field];
  return typeof value === "string" ? value.trim() : "";
}

export function resolveDemoAdmin(
  user: Record<string, unknown>,
): DemoAdminResolution {
  const id = readString(user, "id");
  const organizationId = readString(user, "organization_id");
  const policyRole = readString(user, "policy_role");
  if (id && organizationId && policyRole === "policy_admin") {
    return {
      actor: { id, organizationId, policyRole },
    };
  }

  const isAppAdmin =
    readString(user, "_app_role") === "admin" &&
    readString(user, "role") === "admin";
  if (!id || !isAppAdmin) {
    throw createSafeError("POLICY_ADMIN_REQUIRED");
  }
  return {
    actor: {
      id,
      organizationId: DEMO_ORGANIZATION_ID,
      policyRole: "policy_admin",
    },
    profileUpdate: {
      organization_id: DEMO_ORGANIZATION_ID,
      policy_role: "policy_admin",
    },
  };
}
