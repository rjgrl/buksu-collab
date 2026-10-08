// Initiates a MongoDB replica set if the server is not already one.
// Prisma's upsert (used by db:seed) requires transactions, which need a
// replica set. mongod started without --replSet reports P2031.
//
// Safe to re-run: exits 0 without changes when rs0 already exists.
// Run:  pnpm run db:replica-setup
//
// If mongod was started without --replSet, restart it first:
//   net stop MongoDB
//   "C:\Program Files\MongoDB\MongoDB\bin\mongod.exe" --config "C:\ProgramData\MongoDB\MongoDB.cfg" --replSet rs0
//   net start MongoDB
// then re-run this script.

import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";

const MONGO_URL = process.env.MONGOOSE_URL ?? "mongodb://127.0.0.1:27017";
const SET_NAME = process.env.REPLICA_SET_NAME ?? "rs0";

function mongosh(script) {
  return spawnSync("mongosh", ["--quiet", "--host", "127.0.0.1", "--port", "27017", "--eval", script], {
    stdio: "pipe",
    encoding: "utf8",
  });
}

// Check current state.
const status = mongosh(`(async()=>{ try { const h=db.hello(); print(JSON.stringify({ok:1, setName:h.setName, isPrimary:h.isWritablePrimary})); } catch(e){ print(JSON.stringify({ok:0, error:String(e)})); } })()`);
let info;
try {
  info = JSON.parse(status.stdout.trim());
} catch {
  console.log("Could not read replica status:", status.stdout, status.stderr);
  process.exit(1);
}

if (!info.ok) {
  console.log("MongoDB not reachable:", info.error);
  process.exit(1);
}

if (info.setName === SET_NAME) {
  console.log(`Replica set "${SET_NAME}" already initialized.`);
  process.exit(0);
}

console.log(`MongoDB is NOT a replica set (setName=${info.setName ?? "none"}). Initiating "${SET_NAME}"...`);

// Initiate. mongod must have been started with --replSet rs0.
const init = mongosh(`rs.initiate({ _id: "${SET_NAME}", members: [{ _id: 0, host: "127.0.0.1:27017" }] })`);
console.log(init.stdout);
if (init.status !== 0) {
  console.error(init.stderr);
  console.error("Initiation failed. Is mongod running with --replSet rs0?");
  process.exit(1);
}

// Wait for primary.
for (let i = 0; i < 30; i++) {
  const check = mongosh(`(async()=>{ const h=db.hello(); print(JSON.stringify({isPrimary:h.isWritablePrimary, setName:h.setName})); })()`);
  try {
    const s = JSON.parse(check.stdout.trim());
    if (s.isPrimary && s.setName === SET_NAME) {
      console.log(`Replica set "${SET_NAME}" is now PRIMARY.`);
      process.exit(0);
    }
  } catch {
    // not ready yet
  }
  await new Promise((r) => setTimeout(r, 1000));
}

console.error("Timed out waiting for replica set to become primary.");
process.exit(1);