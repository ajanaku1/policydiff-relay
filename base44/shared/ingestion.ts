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
