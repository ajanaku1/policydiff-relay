import { createSafeError } from "./base44-error.ts";

export type InternalFunctionName =
  | "comparePolicyVersions"
  | "createReplayJob"
  | "extractPolicyClauses"
  | "replayGuidance";

export interface FunctionCaller {
  fetch(
    path: InternalFunctionName,
    init?: RequestInit,
  ): Promise<Response>;
}

export async function invokeFunction(
  caller: FunctionCaller,
  name: InternalFunctionName,
  body: Record<string, unknown>,
): Promise<void> {
  const response = await caller.fetch(name, {
    body: JSON.stringify(body),
    headers: { "Content-Type": "application/json" },
    method: "POST",
  });
  if (!response.ok) {
    throw createSafeError("DOWNSTREAM_FUNCTION_FAILED");
  }
}
