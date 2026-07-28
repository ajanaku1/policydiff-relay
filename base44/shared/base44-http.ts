import type { PolicyRole, WorkflowActor } from "./workflow.ts";

type DenoRuntime = {
  env: RuntimeEnvironment;
  serve(handler: (request: Request) => Promise<Response>): void;
};

export type Base44FunctionHandler = (request: Request) => Promise<Response>;
export type RuntimeEnvironment = {
  get(name: string): string | undefined;
};

type BoundaryErrorCode =
  | "AUTH_CONTEXT_INVALID"
  | "REQUEST_INVALID"
  | "SERVER_CONFIGURATION_INVALID";

class BoundaryError extends Error {
  readonly code: BoundaryErrorCode;

  constructor(code: BoundaryErrorCode) {
    super(code);
    this.code = code;
    this.name = "BoundaryError";
  }
}

const POLICY_ROLES = new Set<PolicyRole>([
  "auditor",
  "policy_admin",
  "reviewer",
  "staff",
]);

export function serveBase44Function(handler: Base44FunctionHandler): void {
  const runtime = (globalThis as typeof globalThis & { Deno: DenoRuntime }).Deno;
  runtime.serve(async (request) => {
    try {
      return await handler(request);
    } catch (error) {
      return errorResponse(error);
    }
  });
}

export function buildWorkflowActor(
  user: Record<string, unknown>,
): WorkflowActor {
  const id = readClaim(user, "id");
  const organizationId = readClaim(user, "organization_id");
  const policyRole = readClaim(user, "policy_role");
  if (!id || !organizationId || !POLICY_ROLES.has(policyRole as PolicyRole)) {
    throw new BoundaryError("AUTH_CONTEXT_INVALID");
  }
  return { id, organizationId, policyRole: policyRole as PolicyRole };
}

export function readRequiredString(
  body: Record<string, unknown>,
  field: string,
): string {
  const value = readClaim(body, field);
  if (!value) {
    throw new BoundaryError("REQUEST_INVALID");
  }
  return value;
}

export function readResourceId(
  body: Record<string, unknown>,
  field: string,
): string {
  const direct = readClaim(body, field);
  if (direct) {
    return direct;
  }
  const data = body.data;
  const automationData =
    data && typeof data === "object" && !Array.isArray(data)
      ? data as Record<string, unknown>
      : {};
  return readRequiredString(automationData, "id");
}

export function readAutomationPayload(
  body: Record<string, unknown>,
): Record<string, unknown> {
  const payload = body.payload;
  if (payload && typeof payload === "object" && !Array.isArray(payload)) {
    return payload as Record<string, unknown>;
  }
  throw new BoundaryError("REQUEST_INVALID");
}

export function readStringArray(
  body: Record<string, unknown>,
  field: string,
): string[] {
  const value = body[field];
  if (!Array.isArray(value) || value.length === 0) {
    throw new BoundaryError("REQUEST_INVALID");
  }
  const strings = value.map((item) =>
    typeof item === "string" ? item.trim() : ""
  );
  if (strings.some((item) => item.length === 0)) {
    throw new BoundaryError("REQUEST_INVALID");
  }
  return strings;
}

export function readRuntimeSecret(
  name: string,
  environment = (
    globalThis as typeof globalThis & { Deno: DenoRuntime }
  ).Deno.env,
): string {
  const value = environment.get(name)?.trim();
  if (!value) {
    throw new BoundaryError("SERVER_CONFIGURATION_INVALID");
  }
  return value;
}

export async function readJsonObject(
  request: Request,
): Promise<Record<string, unknown>> {
  try {
    const body: unknown = await request.json();
    if (body && typeof body === "object" && !Array.isArray(body)) {
      return body as Record<string, unknown>;
    }
  } catch {
    // The safe boundary error below intentionally replaces JSON parser details.
  }
  throw new BoundaryError("REQUEST_INVALID");
}

export function errorResponse(error: unknown): Response {
  const code = readErrorCode(error);
  if (!code) {
    return Response.json({ error: "INTERNAL_ERROR" }, { status: 500 });
  }
  return Response.json({ error: code }, { status: errorStatus(code) });
}

function errorStatus(code: string): number {
  if (code === "SERVER_CONFIGURATION_INVALID") {
    return 500;
  }
  if (code === "AUTH_CONTEXT_INVALID") {
    return 401;
  }
  return 400;
}

function readClaim(source: Record<string, unknown>, field: string): string {
  const value = source[field];
  return typeof value === "string" ? value.trim() : "";
}

function readErrorCode(error: unknown): string | undefined {
  if (!error || typeof error !== "object" || !("code" in error)) {
    return undefined;
  }
  const code = error.code;
  return typeof code === "string" ? code : undefined;
}

export type { DenoRuntime };
