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
// Requires Administrator privileges when the config needs to be modified
// or the service needs to be restarted. If running as a standard user
// and the config already has replication.replSetName, the script can still
// initiate the set without a restart.
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

function isAdmin() {
  const r = run("net", ["session"], { timeout: 5000 });
  return r.status === 0;
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

  const which = run("where", ["mongosh"], { timeout: 10000 });
  if (which.stdout && which.stdout.trim()) {
    return which.stdout.trim().split("\n")[0].trim();
  }

  return "mongosh";
}

function getServiceInfo() {
  if (process.env.MONGOD_PATH || process.env.MONGOD_CFG || process.env.MONGOSH_PATH) {
    const binaryPath = process.env.MONGOD_PATH ?? null;
    return {
      binaryPath,
      configPath: process.env.MONGOD_CFG ?? null,
      mongoshPath: process.env.MONGOSH_PATH ?? findMongosh(binaryPath),
    };
  }

  try {
    const r = run("sc", ["qc", SERVICE_NAME], { timeout: 10000 });
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

// Parse dbPath from the mongod config file.
function parseDbPath(configPath) {
  if (!configPath || !existsSync(configPath)) return null;
  const content = readFileSync(configPath, "utf8");
  const lines = content.split(/\r?\n/);
  for (let i = 0; i < lines.length; i++) {
    const trimmed = lines[i].trim();
    if (trimmed.startsWith("#") || trimmed.startsWith("storage:")) continue;
    if (trimmed.startsWith("dbPath:")) {
      return trimmed.substring("dbPath:".length).trim();
    }
  }
  return null;
}

// Check whether the config file already has an active (non-commented)
// replSetName set to SET_NAME. Uses a line-by-line scan to be robust
// against CRLF/LF mixed line endings.
function hasReplSetName(original, setName) {
  const lines = original.split(/\r?\n/);
  for (const line of lines) {
    const trimmed = line.trim();
    if (trimmed.startsWith("#")) continue;
    if (trimmed.startsWith("replSetName:") && trimmed.includes(setName)) return true;
  }
  return false;
}

// Ensure the config file has  replication.replSetName: SET_NAME.
// Returns true if the file was modified, false if already correct.
// Throws on EPERM with a helpful message.
function ensureReplicationConfig(configPath) {
  if (!configPath || !existsSync(configPath)) return false;
  const original = readFileSync(configPath, "utf8");

  if (hasReplSetName(original, SET_NAME)) return false;

  const EOL = original.includes("\r\n") ? "\r\n" : "\n";
  let updated = original;

  // Uncomment "#replication:" placeholder
  if (/#replication:[ \t]*$/m.test(updated)) {
    updated = updated.replace(/#replication:[ \t]*$/m, `replication:${EOL}  replSetName: ${SET_NAME}`);
  } else if (/^replication:\r?\n[ \t]*replSetName:[ \t]*.+$/m.test(updated)) {
    // Update existing replSetName value
    updated = updated.replace(
      /^replication:\r?\n[ \t]*replSetName:[ \t]*.+$/m,
      `replication:${EOL}  replSetName: ${SET_NAME}`,
    );
  } else if (/^replication:[ \t]*$/m.test(updated)) {
    // Add replSetName under existing replication:
    updated = updated.replace(/^replication:[ \t]*$/m, `replication:${EOL}  replSetName: ${SET_NAME}`);
  } else {
    // Append a new replication section
    updated = `${original.trimEnd()}${EOL}${EOL}replication:${EOL}  replSetName: ${SET_NAME}${EOL}`;
  }

  try {
    writeFileSync(configPath, updated);
  } catch (e) {
    if (e.code === "EPERM" || e.code === "EACCES") {
      throw new Error(
        `Permission denied: cannot write to "${configPath}"\n` +
          "Run this script as Administrator, or set MONGOD_CFG to a config file\n" +
          "in a writable directory (e.g. C:\\temp\\mongod.cfg) and restart manually.",
      );
    }
    throw e;
  }

  return true;
}

async function restartService(mongoshPath) {
  const stop = run("net", ["stop", SERVICE_NAME]);
  const stopMsg = (stop.stdout || stop.stderr).trim();
  console.log("stop:", stopMsg || "ok");

  if (stop.status !== 0 && !stopMsg.toLowerCase().includes("already")) {
    console.error("Failed to stop service:", stopMsg);
    if (stopMsg.toLowerCase().includes("denied") || stopMsg.toLowerCase().includes("permission")) {
      console.error("Administrator privileges are required to restart services.");
    }
    process.exit(1);
  }

  // Wait for the port to free up.
  for (let i = 0; i < 30; i++) {
    if (!checkState(mongoshPath).ok) break;
    await sleep(1000);
  }

  const start = run("net", ["start", SERVICE_NAME]);
  const startMsg = (start.stdout || start.stderr).trim();
  console.log("start:", startMsg || "ok");

  if (start.status !== 0 && !startMsg.toLowerCase().includes("already")) {
    console.error("Failed to start service:", startMsg);
    if (startMsg.toLowerCase().includes("denied") || startMsg.toLowerCase().includes("permission")) {
      console.error("Administrator privileges are required to restart services.");
    }
    process.exit(1);
  }
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

  const admin = isAdmin();

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

    if (!admin) {
      console.warn(
        "⚠ Not running as Administrator — cannot modify the config file or restart the service.\n" +
          "  If the config already has replication.replSetName, a restart may still be needed.\n" +
          "  Run this script from an elevated terminal (Run as Administrator). The script will\n" +
          "  attempt to proceed but some operations may fail.",
      );
    }

    try {
      const changed = ensureReplicationConfig(svc.configPath);
      if (changed) {
        console.log(`Config updated: replication.replSetName: ${SET_NAME}`);
      } else {
        console.log("Config already has replication.replSetName — restarting service to apply.");
      }
    } catch (e) {
      console.error(e.message);
      process.exit(1);
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
