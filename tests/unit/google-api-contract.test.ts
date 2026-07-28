import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  buildGoogleDocExportRequest,
  buildGmailSendRequest,
} from "../../base44/shared/google-api.ts";

describe("Google connector API contracts", () => {
  it("builds a plain-text Google Docs export request", () => {
    assert.deepEqual(buildGoogleDocExportRequest("policy doc/123", "token-1"), {
      headers: {
        Authorization: "Bearer token-1",
      },
      method: "GET",
      url:
        "https://www.googleapis.com/drive/v3/files/" +
        "policy%20doc%2F123/export?mimeType=text%2Fplain",
    });
  });

  it("builds a base64url Gmail send request for an external recipient", () => {
    const request = buildGmailSendRequest(
      {
        recipient: "casey@example.test",
        subject: "Updated eligibility guidance",
        text: "Please review the corrected guidance.",
      },
      "token-2",
    );

    assert.equal(request.method, "POST");
    assert.equal(
      request.url,
      "https://gmail.googleapis.com/gmail/v1/users/me/messages/send",
    );
    assert.deepEqual(request.headers, {
      Authorization: "Bearer token-2",
      "Content-Type": "application/json",
    });

    const body = JSON.parse(request.body) as { raw: string };
    const mime = Buffer.from(body.raw, "base64url").toString("utf8");
    assert.match(mime, /^To: casey@example\.test\r\n/m);
    assert.match(mime, /^Subject: Updated eligibility guidance\r\n/m);
    assert.match(mime, /\r\n\r\nPlease review the corrected guidance\.$/);
  });

  it("rejects header injection in recipient and subject fields", () => {
    assert.throws(
      () =>
        buildGmailSendRequest(
          {
            recipient: "casey@example.test\r\nBcc: leak@example.test",
            subject: "Updated guidance",
            text: "Correction.",
          },
          "token-2",
        ),
      { code: "GMAIL_HEADER_INVALID" },
    );
  });
});
