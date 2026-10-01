import type { IntegrationEnv } from "../context";

export type EmailResult = {
  ok: boolean;
  detail: string;
};

// TODO(PLAKY-INTEGRATIONS): PLAKY-INT-007 - implement the SMTP module.
// Contract: POST to env.smtpUrl with the payload below and map the response to EmailResult.
// When SMTP_URL is absent the caller must have already fallen back (see summarize() in
// ./registry.ts), so this function reports the failure instead of silently succeeding.
export async function sendEmail(
  env: IntegrationEnv,
  input: { to: string; subject: string; text: string },
): Promise<EmailResult> {
  void env;
  void input;
  throw new Error("TODO(PLAKY-INT-007): implement sendEmail");
}