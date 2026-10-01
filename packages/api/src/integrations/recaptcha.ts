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
  void env;
  void input;
  throw new Error("TODO(PLAKY-INT-008): implement verifyRecaptcha");
}