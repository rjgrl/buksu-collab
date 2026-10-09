import type { IntegrationEnv } from "../context";

// Evidence storage.
//
// Provider selection order for a single upload:
//   1. imgbb        - only when the caller asked for an image host AND IMGBB_API_KEY is set
//   2. google_drive - when a service account is configured; falls back to local on error
//   3. local        - always available; this is the contractual fallback for the
//                     `google_drive` and `image_host` modules

export type StoredFile = {
  provider: "local" | "google_drive" | "imgbb";
  storageKey: string;
  url?: string;
};

// TODO(PLAKY-FILES): PLAKY-FILE-003 - implement the provider chain above.
// Return the chosen provider so the EvidenceFile row records how the bytes were stored and
// the download route knows whether it can redirect to a URL or must stream from disk.
export async function storeFile(
  env: IntegrationEnv,
  input: {
    buffer: Buffer;
    mimeType: string;
    originalName: string;
    preferImageHost?: boolean;
  },
): Promise<StoredFile> {
  void env;
  void input;
  throw new Error("TODO(PLAKY-FILE-003): implement storeFile");
}

// TODO(PLAKY-FILE_003 - write the buffer under env.uploadDir (default ./uploads) using a
// `${Date.now()}-${randomUUID()}-${sanitisedName}` key so filenames can never collide or
// escape the directory. Returns provider "local" with no url.
async function _storeLocal(
  _env: IntegrationEnv,
  _input: { buffer: Buffer; originalName: string },
): Promise<StoredFile> {
  void _env;
  void _input;
  throw new Error("TODO(PLAKY-FILE-003): implement storeLocal");
}
void _storeLocal;

// TODO(PLAKY-INTEGRATIONS): PLAKY-INT-011 - implement `uploadImgbb(apiKey, buffer, name)`:
// multipart POST to https://api.imgbb.com/1/upload, mapping the response to a public URL.
// TODO(PLAKY-INTEGRATIONS): PLAKY-INT-012 - implement `uploadDrive(env, input)`: resumable
// multipart upload into GOOGLE_DRIVE_FOLDER_ID, returning webViewLink as the url.

// TODO(PLAKY-INTEGRATIONS): PLAKY-INT-013 - implement the service-account JWT flow.
// Build an RS256 assertion from client_email + private_key with the requested scopes, POST
// it to the Google token endpoint, and return the access token.
export async function googleAccessToken(json: string, scopes: string[]) {
  void json;
  void scopes;
  throw new Error("TODO(PLAKY-INT-013): implement googleAccessToken");
}

/**
 * MIME types accepted by the evidence upload route (POST /api/files/evidence).
 * TODO(PLAKY-FILE-004 - extend this allow-list per Plaky task acceptance criteria.
 */
export const ALLOWED_EVIDENCE_TYPES = new Set([
  "application/pdf",
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/gif",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  "application/vnd.ms-excel",
  "text/csv",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
]);

/** Upload ceiling enforced by the evidence route: 10 MB. */
// TODO(PLAKY-FILE-004 - keep aligned with the documented evidence size limit.
export const MAX_EVIDENCE_BYTES = 10 * 1024 * 1024;