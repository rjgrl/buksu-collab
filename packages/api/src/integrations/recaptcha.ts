import type { IntegrationEnv } from "../context";

export type RecaptchaResult = {
  ok: boolean;
  score?: number;
};

// TODO(PLAKY-INTEGRATIONS): PLAKY-INT-008 - implement reCAPTCHA verification.
// Contract: POST secret + response to Google's siteverify endpoint. When the module is not
// configured the caller passes `fallback: true` and this must accept without a network call,
// which is what renders the local "I am not a robot" checkbox.
export async function verifyRecaptcha(
  env: IntegrationEnv,
  input: { token?: string | null; fallback?: boolean },
): Promise<RecaptchaResult> {
  if (!env.recaptchaSecretKey) {
    return { ok: Boolean(input.fallback) };
  }

  if (!input.token) {
    return { ok: false };
  }

  const body = new URLSearchParams({
    secret: env.recaptchaSecretKey,
    response: input.token,
  });

  const response = await fetch("https://www.google.com/recaptcha/api/siteverify", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body,
  });

  if (!response.ok) {
    return { ok: false };
  }

  const payload = (await response.json()) as { success?: boolean; score?: number };
  return {
    ok: Boolean(payload.success),
    score: typeof payload.score === "number" ? payload.score : undefined,
  };
}
