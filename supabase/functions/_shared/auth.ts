/**
 * Shared-secret gate for internal Edge Functions called via database webhooks.
 *
 * Compares the incoming `x-webhook-secret` header against the `WEBHOOK_SECRET`
 * environment variable using a constant-time comparison to prevent timing attacks.
 *
 * Returns a 500 Response if the server environment is missing the secret (fail closed),
 * a 401 Response if the header is missing or does not match,
 * or `null` if the request is authenticated.
 */
export function requireWebhookSecret(req: Request): Response | null {
  const expectedSecret = Deno.env.get("WEBHOOK_SECRET");
  if (!expectedSecret) {
    console.error("WEBHOOK_SECRET environment variable is not configured");
    return new Response("Webhook secret misconfigured", { status: 500 });
  }

  const providedSecret = req.headers.get("x-webhook-secret");
  if (!providedSecret) {
    return new Response("Unauthorized", { status: 401 });
  }

  const encoder = new TextEncoder();
  const a = encoder.encode(providedSecret);
  const b = encoder.encode(expectedSecret);

  if (a.byteLength !== b.byteLength) {
    return new Response("Unauthorized", { status: 401 });
  }

  let diff = 0;
  for (let i = 0; i < a.byteLength; i++) {
    diff |= a[i] ^ b[i];
  }

  if (diff !== 0) {
    return new Response("Unauthorized", { status: 401 });
  }

  return null;
}
