export type SafeCodedError = Error & { code: string };

export function createSafeError(code: string): SafeCodedError {
  return Object.assign(new Error(code), { code });
}
