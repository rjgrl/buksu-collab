// Auto-generates .env files for local development.
// Run once after cloning:  pnpm run env:setup
//
// Safe to re-run: existing .env files are never overwritten.
// For production or remote databases, edit the generated files manually.

import { existsSync, writeFileSync, mkdirSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = resolve(__dirname, "..");

const files = {
  "packages/db/.env": `NODE_ENV=development
DATABASE_URL=mongodb://127.0.0.1:27017/alumni_tracking
`,
  "apps/server/.env": `NODE_ENV=development
CORS_ORIGIN=http://localhost:3001
DATABASE_URL=mongodb://127.0.0.1:27017/alumni_tracking
APP_URL=http://localhost:3000
`,
  "apps/web/.env": `NODE_ENV=development
VITE_SERVER_URL=http://localhost:3000
`,
};

let created = 0;
for (const [rel, content] of Object.entries(files)) {
  const abs = resolve(root, rel);
  if (existsSync(abs)) {
    console.log(`skip  ${rel} (already exists)`);
    continue;
  }
  mkdirSync(dirname(abs), { recursive: true });
  writeFileSync(abs, content, "utf8");
  console.log(`create  ${rel}`);
  created++;
}

console.log(`\nDone. Created ${created} file(s).`);
console.log("Edit DATABASE_URL if you use a remote MongoDB, then run:");
console.log("  pnpm run db:generate && pnpm run db:push && pnpm run db:seed && pnpm run dev");