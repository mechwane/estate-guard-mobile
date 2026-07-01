export function reportClientError(error: unknown, context: Record<string, unknown> = {}) {
  if (import.meta.env.DEV) {
    console.error("Client error", { error, context });
  }
}
