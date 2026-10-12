/** An HTTP failure carrying `status`, the shape `withRetry` reads. */
export class HttpStatusError extends Error {
  constructor(
    public readonly status: number,
    message: string,
  ) {
    super(message);
    this.name = "HttpStatusError";
  }
}

export async function postJson(
  url: string,
  headers: Record<string, string>,
  body: unknown,
  signal: AbortSignal,
  label: string,
): Promise<unknown> {
  const response = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json", ...headers },
    body: JSON.stringify(body),
    signal,
    cache: "no-store",
  });
  if (!response.ok) {
    // Keep the provider's error text (it names the bad field) but never echo
    // request headers, which hold the key.
    const detail = (await response.text().catch(() => "")).slice(0, 300);
    throw new HttpStatusError(response.status, `${label} ${response.status}: ${detail}`);
  }
  return response.json();
}

export function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`${name} is not set. Add it to .env.local (see .env.example).`);
  }
  return value;
}
