type GoogleApiRequest = {
  headers: Record<string, string>;
  url: string;
};

export type GoogleApiGetRequest = GoogleApiRequest & {
  method: "GET";
};

export type GoogleApiPostRequest = GoogleApiRequest & {
  body: string;
  method: "POST";
};

export type GmailCorrection = {
  recipient: string;
  subject: string;
  text: string;
};

export class GmailHeaderError extends Error {
  readonly code = "GMAIL_HEADER_INVALID";

  constructor() {
    super("GMAIL_HEADER_INVALID");
    this.name = "GmailHeaderError";
  }
}

export function buildGoogleDocExportRequest(
  fileId: string,
  accessToken: string,
): GoogleApiGetRequest {
  const encodedFileId = encodeURIComponent(fileId);
  return {
    headers: { Authorization: `Bearer ${accessToken}` },
    method: "GET",
    url:
      `https://www.googleapis.com/drive/v3/files/${encodedFileId}/export` +
      "?mimeType=text%2Fplain",
  };
}

export function buildGmailSendRequest(
  correction: GmailCorrection,
  accessToken: string,
): GoogleApiPostRequest {
  assertSafeHeader(correction.recipient);
  assertSafeHeader(correction.subject);

  const mime = [
    `To: ${correction.recipient}`,
    `Subject: ${correction.subject}`,
    "MIME-Version: 1.0",
    "Content-Type: text/plain; charset=UTF-8",
    "",
    correction.text,
  ].join("\r\n");

  return {
    body: JSON.stringify({ raw: encodeBase64Url(mime) }),
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
    },
    method: "POST",
    url: "https://gmail.googleapis.com/gmail/v1/users/me/messages/send",
  };
}

function assertSafeHeader(value: string): void {
  if (/[\r\n]/.test(value)) {
    throw new GmailHeaderError();
  }
}

function encodeBase64Url(value: string): string {
  const bytes = new TextEncoder().encode(value);
  let binary = "";
  for (const byte of bytes) {
    binary += String.fromCharCode(byte);
  }
  return btoa(binary)
    .replaceAll("+", "-")
    .replaceAll("/", "_")
    .replace(/=+$/, "");
}
