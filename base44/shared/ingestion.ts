export type DriveAutomationEvent = {
  automation: {
    id: string;
    name: string;
    type: string;
  };
  event: {
    integration_type: string;
    provider_identifier: string;
    type: string;
  };
  data: unknown;
  payload_too_large: boolean;
};

type DriveEventErrorCode =
  | "DRIVE_EVENT_PAYLOAD_TOO_LARGE"
  | "DRIVE_EVENT_TYPE_INVALID"
  | "DRIVE_FILE_ID_MISSING"
  | "DRIVE_FILE_NOT_ALLOWLISTED";

export class DriveEventError extends Error {
  readonly code: DriveEventErrorCode;

  constructor(code: DriveEventErrorCode) {
    super(code);
    this.name = "DriveEventError";
    this.code = code;
  }
}

export function normalizeDriveAutomationEvent(
  input: Record<string, unknown>,
): DriveAutomationEvent {
  if (readString(input, "trigger_type")) {
    return normalizeWorkflowTrigger(input);
  }
  return input as unknown as DriveAutomationEvent;
}

export function assertAllowlistedDriveUpdate(
  event: DriveAutomationEvent,
  allowlistedFileId: string,
): { fileId: string; providerIdentifier: string } {
  if (event.payload_too_large) {
    throw new DriveEventError("DRIVE_EVENT_PAYLOAD_TOO_LARGE");
  }
  if (
    event.automation.type !== "connector" ||
    event.event.integration_type !== "googledrive" ||
    event.event.type !== "file.update"
  ) {
    throw new DriveEventError("DRIVE_EVENT_TYPE_INVALID");
  }

  const fileId = readFileId(event.data);
  if (fileId !== allowlistedFileId) {
    throw new DriveEventError("DRIVE_FILE_NOT_ALLOWLISTED");
  }
  return { fileId, providerIdentifier: event.event.provider_identifier };
}

function readFileId(data: unknown): string {
  if (!isRecord(data) || typeof data.file_id !== "string") {
    throw new DriveEventError("DRIVE_FILE_ID_MISSING");
  }
  return data.file_id;
}

function normalizeWorkflowTrigger(
  trigger: Record<string, unknown>,
): DriveAutomationEvent {
  if (
    readString(trigger, "trigger_type") !== "connector" ||
    readString(trigger, "integration_type") !== "googledrive" ||
    readString(trigger, "event_type") !== "file.update"
  ) {
    throw new DriveEventError("DRIVE_EVENT_TYPE_INVALID");
  }
  const metadata = readProviderMetadata(trigger.data);
  const providerIdentifier =
    readString(metadata, "x-goog-resource-id") || "googledrive";
  return buildWorkflowDriveEvent(
    providerIdentifier,
    readFileIdFromResourceUri(metadata),
    trigger.payload_too_large === true,
  );
}

function buildWorkflowDriveEvent(
  providerIdentifier: string,
  fileId: string,
  payloadTooLarge: boolean,
): DriveAutomationEvent {
  return {
    automation: {
      id: providerIdentifier,
      name: "base44_workflow",
      type: "connector",
    },
    event: {
      integration_type: "googledrive",
      provider_identifier: providerIdentifier,
      type: "file.update",
    },
    data: {
      file_id: fileId,
    },
    payload_too_large: payloadTooLarge,
  };
}

function readProviderMetadata(data: unknown): Record<string, unknown> {
  if (!isRecord(data) || !isRecord(data._provider_meta)) {
    throw new DriveEventError("DRIVE_FILE_ID_MISSING");
  }
  return data._provider_meta;
}

function readFileIdFromResourceUri(
  metadata: Record<string, unknown>,
): string {
  const resourceUri = readString(metadata, "x-goog-resource-uri");
  try {
    const url = new URL(resourceUri);
    const match = url.pathname.match(/^\/drive\/v3\/files\/([^/]+)$/);
    if (url.hostname === "www.googleapis.com" && match?.[1]) {
      return decodeURIComponent(match[1]);
    }
  } catch {
    // The boundary error below intentionally hides URL parser details.
  }
  throw new DriveEventError("DRIVE_FILE_ID_MISSING");
}

function readString(source: Record<string, unknown>, field: string): string {
  const value = source[field];
  return typeof value === "string" ? value.trim() : "";
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

export function canonicalizePolicyText(text: string): string {
  const normalizedLines = text
    .normalize("NFC")
    .replace(/\r\n?/g, "\n")
    .split("\n")
    .map((line) => line.trimEnd());

  return normalizedLines.join("\n").trim() + "\n";
}

export async function sha256Hex(value: string): Promise<string> {
  const bytes = new TextEncoder().encode(value);
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return Array.from(new Uint8Array(digest), toHex).join("");
}

function toHex(byte: number): string {
  return byte.toString(16).padStart(2, "0");
}

export function buildPolicyVersionDedupeKey(
  fileId: string,
  contentHash: string,
): string {
  return `${fileId}:${contentHash}`;
}
