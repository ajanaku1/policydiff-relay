import { createClient } from "@base44/sdk";

export const BASE44_PLATFORM_URL = "https://app.base44.com";

export const base44 = createClient({
  appId: "6a67e42b2e61581e8292a74a",
  appBaseUrl: BASE44_PLATFORM_URL,
});
