export function readAcknowledgementToken(url: string): string | undefined {
  const parsed = new URL(url);
  if (parsed.pathname !== "/acknowledge") {
    return undefined;
  }
  return parsed.searchParams.get("token")?.trim() || undefined;
}
