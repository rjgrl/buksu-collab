// Initiates a MongoDB replica set if the server is not already one.
// Prisma's upsert (used by db:seed) requires transactions, which need a
// replica set. mongod started without --replSet reports P2031.
//
// Safe to re-run: exits 0 without changes when rs0 is already PRIMARY.
// Run:  pnpm run db:replica-setup
//
// On Windows this script:
//   1. Reads the mongod config path from the service definition (sc qc).
//   2. Ensures the config file has  replication.replSetName: rs0.
//   3. Restarts the Windows service so mongod picks up the new config.
//   4. Calls rs.initiate() (no-op if already initiated).
//   5. Waits for the set to elect a PRIMARY.
//
// If the service query fails, set MONGOD_CFG to the config file path,
// MONGOD_PATH to the mongod binary path, and/or MONGOSH_PATH to mongosh.

import { spawnSync } from "node:child_process";
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { setTimeout } from "node:timers/promises";

const SET_NAME = process.env.REPLICA_SET_NAME ?? "rs0";
const PORT = process.env.MONGODB_PORT ?? "27017";
const HOST = process.env.MONGODB_HOST ?? "127.0.0.1";
const HOST_PORT = `${HOST}:${PORT}`;
const SERVICE_NAME = process.env.MONGODB_SERVICE_NAME ?? "MongoDB";

function mongosh(script, mongoshPath) {
  const cmd = mongoshPath ?? "mongosh";
  return spawnSync(cmd, ["--quiet", "--host", HOST, "--port", PORT, "--eval", script], {
    stdio: "pipe",
    encoding: "utf8",
    timeout: 20000,
  });
}

function run(cmd, args, opts = {}) {
  return spawnSync(cmd, args, { stdio: "pipe", encoding: "utf8", timeout: 60000, ...opts });
}

function sleep(ms) {
  return setTimeout(ms);
}

function checkState(mongoshPath) {
  const r = mongosh(
    `(async()=>{ try { const h=db.hello(); print(JSON.stringify({ok:1,setName:h.setName,isPrimary:h.isWritablePrimary})); } catch(e){ print(JSON.stringify({ok:0,error:String(e)})); } })()`,
    mongoshPath,
  );
  if (r.error) return { ok: false, error: r.error.message };
  try {
    return JSON.parse(r.stdout.trim());
  } catch {
    return { ok: false, raw: r.stdout, err: r.stderr };
  }
}

function findMongosh(binaryPath) {
  if (binaryPath) {
    const derived = binaryPath.replace(/mongod\.exe$/i, "mongosh.exe");
    if (existsSync(derived)) return derived;
  }

  const localAppData = process.env.LOCALAPPDATA;
  if (localAppData) {
    const p = `${localAppData}\\Programs\\mongosh\\mongosh.exe`;
    if (existsSync(p)) return p;
  }

  const which = run("where", ["mongosh"]);
  if (which.stdout && which.stdout.trim()) {
    return which.stdout.trim().split("\n")[0].trim();
  }

  return "mongosh";
}

function getServiceInfo() {
  if (process.env.MONGOD_PATH || process.env.MONGOD_CFG || process.env.MONGOSH_PATH) {
    const binaryPath = process.env.MONGOD_PATH ?? null;
    const result = {
      binaryPath,
      configPath: process.env.MONGOD_CFG ?? null,
      mongoshPath: process.env.MONGOSH_PATH ?? findMongosh(binaryPath),
    };
    return result;
  }

  try {
    const r = run("sc", ["qc", SERVICE_NAME]);
    if (r.status !== 0) {
      return { binaryPath: null, configPath: null, mongoshPath: findMongosh(null) };
    }
    const output = (r.stdout || "") + (r.stderr || "");
    const binMatch = output.match(/BINARY_PATH_NAME\s*:\s*(.+)/i);
    if (!binMatch) {
      return { binaryPath: null, configPath: null, mongoshPath: findMongosh(null) };
    }
    const binLine = binMatch[1].trim();
    const exeMatch = binLine.match(/"([^"]+mongod\.exe)"/i);
    const configMatch = binLine.match(/--config\s+"([^"]+)"/i);
    const binaryPath = exeMatch ? exeMatch[1] : null;
    return {
      binaryPath,
      configPath: configMatch ? configMatch[1] : null,
      mongoshPath: findMongosh(binaryPath),
    };
  } catch {
    return { binaryPath: null, configPath: null, mongoshPath: findMongosh(null) };
  }
}

function ensureReplicationConfig(configPath) {
  if (!configPath || !existsSync(configPath)) return false;
  const original = readFileSync(configPath, "utf8");

  if (/^replication:\r?\n[ \t]*replSetName:[ \t]*rs0[ \t]*$/m.test(original)) return false;

  let updated = original;
  const EOL = original.includes("\r\n") ? "\r\n" : "\n";

  if (/#replication:[ \t]*$/m.test(updated)) {
    updated = updated.replace(/#replication:[ \t]*$/m, `replication:${EOL}  replSetName: ${SET_NAME}`);
  } else if (/^replication:\r?\n[ \t]*replSetName:[ \t]*.+$/m.test(updated)) {
    updated = updated.replace(
      /^replication:\r?\n[ \t]*replSetName:[ \t]*.+$/m,
      `replication:${EOL}  replSetName: ${SET_NAME}`,
    );
  } else if (/^replication:[ \t]*$/m.test(updated)) {
    updated = updated.replace(/^replication:[ \t]*$/m, `replication:${EOL}  replSetName: ${SET_NAME}`);
  } else {
    updated = `${original.trimEnd()}${EOL}${EOL}replication:${EOL}  replSetName: ${SET_NAME}${EOL}`;
  }

  writeFileSync(configPath, updated);
  return true;
}

async function restartService(mongoshPath) {
  const stop = run("net", ["stop", SERVICE_NAME]);
  const stopMsg = (stop.stdout || stop.stderr).trim();
  console.log("stop:", stopMsg || "ok");

  for (let i = 0; i < 30; i++) {
    if (!checkState(mongoshPath).ok) break;
    await sleep(1000);
  }

  const start = run("net", ["start", SERVICE_NAME]);
  const startMsg = (start.stdout || start.stderr).trim();
  console.log("start:", startMsg || "ok");
}

async function waitForMongod(mongoshPath, timeoutSeconds = 30) {
  for (let i = 0; i < timeoutSeconds; i++) {
    const s = checkState(mongoshPath);
    if (s.ok) return s;
    await sleep(1000);
  }
  return null;
}

async function waitForPrimary(mongoshPath, timeoutSeconds = 30) {
  for (let i = 0; i < timeoutSeconds; i++) {
    const s = checkState(mongoshPath);
    if (s.ok && s.isPrimary && s.setName === SET_NAME) return s;
    await sleep(1000);
  }
  return null;
}

async function main() {
  const svc = getServiceInfo();
  const mongoshPath = svc.mongoshPath;

  const state = checkState(mongoshPath);
  if (!state.ok) {
    console.log("MongoDB not reachable:", state.error || state.err || state.raw || "mongosh not found");
    process.exit(1);
  }

  if (state.setName === SET_NAME && state.isPrimary) {
    console.log(`Replica set "${SET_NAME}" is already PRIMARY.`);
    process.exit(0);
  }

  if (state.setName !== SET_NAME) {
    console.log(
      `MongoDB is NOT a replica set (setName=${state.setName ?? "none"}). Enabling replication...`,
    );

    if (!svc.configPath) {
      console.error(
        `Could not determine the mongod config path for service "${SERVICE_NAME}".\n` +
          `Run: sc qc ${SERVICE_NAME}  — or — set MONGOD_CFG=<path-to-config>`,
      );
      process.exit(1);
    }

    const changed = ensureReplicationConfig(svc.configPath);
    if (changed) {
      console.log(`Config updated: replication.replSetName: ${SET_NAME}`);
    } else {
      console.log("Config already has replication.replSetName — restarting service to apply.");
    }

    await restartService(mongoshPath);

    const ready = await waitForMongod(mongoshPath, 30);
    if (!ready) {
      console.error("mongod did not become reachable after service restart.");
      process.exit(1);
    }
    console.log(
      `mongod is up (setName=${ready.setName ?? "none"}, isPrimary=${ready.isPrimary})`,
    );
  }

  console.log(`Initiating "${SET_NAME}"...`);
  const init = mongosh(
    `rs.initiate({ _id: "${SET_NAME}", members: [{ _id: 0, host: "${HOST_PORT}" }] })`,
    mongoshPath,
  );
  const initOut = (init.stdout || "").trim();
  const initErr = (init.stderr || "").trim();

  if (init.status !== 0) {
    if (/already/i.test(initOut) || /already/i.test(initErr)) {
      console.log("Replica set already initiated, skipping.");
    } else {
      console.error(initOut || initErr);
      console.error(`Initiation failed. Is mongod running with --replSet ${SET_NAME}?`);
      process.exit(1);
    }
  } else if (initOut) {
    console.log(initOut);
  }

  const primary = await waitForPrimary(mongoshPath, 30);
  if (!primary) {
    console.error("Timed out waiting for replica set to become primary.");
    process.exit(1);
  }
  console.log(`Replica set "${SET_NAME}" is now PRIMARY.`);
  process.exit(0);
}

main();
