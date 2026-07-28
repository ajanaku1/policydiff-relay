export async function createDeliveryToken(
  deliveryId: string,
  secret: string,
): Promise<string> {
  const encoder = new TextEncoder();
  const key = await crypto.subtle.importKey(
    "raw",
    encoder.encode(secret),
    { hash: "SHA-256", name: "HMAC" },
    false,
    ["sign"],
  );
  const signature = await crypto.subtle.sign(
    "HMAC",
    key,
    encoder.encode(deliveryId),
  );
  const signatureHex = Array.from(
    new Uint8Array(signature),
    (byte) => byte.toString(16).padStart(2, "0"),
  ).join("");
  return `${deliveryId}.${signatureHex}`;
}
