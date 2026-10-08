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
console.log("Then run (in this order):");
console.log("  pnpm run db:replica-setup   # <- MongoDB needs a replica set for Prisma upsert");
console.log("  pnpm run db:generate");
console.log("  pnpm run db:push");
console.log("  pnpm run db:seed");
console.log("  pnpm run dev");
console.log("");
console.log("⚠ varlock/auto-load resolves .env from the current working directory.");
console.log("  Always start the server via `pnpm run dev` or `pnpm run dev:server`");
console.log("  (these cd into apps/server). Do NOT run `npx tsx apps/server/src/index.ts`");
console.log("  from the repo root — ENV.CORS_ORIGIN will be undefined and the");
console.log("  CORS middleware crashes before login can run.");
console.log("");
console.log("⚠ Prisma's upsert (used by db:seed) requires MongoDB transactions, which");
console.log("  need a replica set. If db:seed fails with P2031, run `pnpm run db:replica-setup`.");
console.log("  If mongod was started without --replSet, restart it with --replSet rs0 first.");