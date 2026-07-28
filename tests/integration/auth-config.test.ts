import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { it } from "node:test";

it("enables judge-runnable login methods without custom OAuth secrets", () => {
  const path = join(process.cwd(), "base44", "auth", "config.json");
  assert.ok(existsSync(path), "Missing Base44 auth config");

  const auth = JSON.parse(readFileSync(path, "utf8")) as Record<
    string,
    boolean | null | string
  >;
  assert.equal(auth.enableUsernamePassword, true);
  assert.equal(auth.enableGoogleLogin, true);
  assert.equal(auth.enableMicrosoftLogin, false);
  assert.equal(auth.enableFacebookLogin, false);
  assert.equal(auth.enableAppleLogin, false);
  assert.equal(auth.googleOAuthMode, "default");
  assert.equal(auth.googleOAuthClientId, null);
});
