import { execFileSync } from 'node:child_process';
import net from 'node:net';
import process from 'node:process';
import path from 'node:path';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);

function failClosed(msg) {
  console.error(`\x1b[31m[PREFLIGHT FATAL]\x1b[0m ${msg}`);
  process.exit(1);
}

// 1. Resolve Local Supabase CLI JavaScript Entry Point
const projectRoot = fileURLToPath(new URL('..', import.meta.url));
let pkgJsonPath;
try {
  pkgJsonPath = require.resolve('supabase/package.json', { paths: [projectRoot] });
} catch (e) {
  pkgJsonPath = path.join(projectRoot, 'node_modules', 'supabase', 'package.json');
}

let supabaseJsPath;
try {
  if (!fs.existsSync(pkgJsonPath)) {
    failClosed(`Supabase CLI package.json not found at '${pkgJsonPath}'`);
  }
  const pkg = JSON.parse(fs.readFileSync(pkgJsonPath, 'utf8'));
  const binRel = typeof pkg.bin === 'string' ? pkg.bin : pkg.bin?.supabase;
  if (!binRel) failClosed("Local 'supabase' package.json is missing 'bin.supabase'");
  supabaseJsPath = path.resolve(path.dirname(pkgJsonPath), binRel);
  if (!fs.existsSync(supabaseJsPath)) {
    failClosed(`Supabase CLI entry point does not exist at '${supabaseJsPath}'`);
  }
} catch (e) {
  failClosed(`Failed to resolve local 'supabase' package: ${e.message}`);
}

// 2. Query Supabase CLI Status JSON via Node.js (No Shell Required)
let rawOutput;
try {
  rawOutput = execFileSync(process.execPath, [supabaseJsPath, 'status', '-o', 'json'], {
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
  });
} catch (e) {
  const stderr = e.stderr ? ` Stderr: ${e.stderr.toString().trim()}` : '';
  failClosed(`Failed to execute Supabase CLI status via Node.js: ${e.message}.${stderr}`);
}

let status;
try {
  status = JSON.parse(rawOutput.trim());
} catch (e) {
  failClosed(`Supabase CLI output is not valid JSON or contains unexpected non-JSON content: ${e.message}`);
}

const dbUrl = status.DB_URL || status.db_url;
if (!dbUrl) failClosed('Supabase CLI did not report DB_URL');

let parsed;
try {
  parsed = new URL(dbUrl);
} catch (e) {
  failClosed(`Invalid DB_URL: ${dbUrl}`);
}

if (parsed.hostname !== '127.0.0.1' && parsed.hostname !== 'localhost') {
  failClosed(`Target host '${parsed.hostname}' is not loopback (127.0.0.1/localhost)`);
}
if (parsed.port !== '54322') {
  failClosed(`Target port '${parsed.port}' is not expected 54322`);
}

// 2. Exact Single Docker Container Inspection
const containerName = 'supabase_db_smartstudio-ai';
let inspectResults;
try {
  inspectResults = JSON.parse(execFileSync('docker', ['inspect', containerName], { encoding: 'utf8' }));
} catch (e) {
  failClosed(`Docker inspect failed for '${containerName}'. Is local Supabase started?`);
}

if (!Array.isArray(inspectResults) || inspectResults.length !== 1) {
  failClosed(`Expected exactly 1 inspect result for '${containerName}', received ${inspectResults?.length}`);
}

const inspect = inspectResults[0];
if (inspect.State?.Status !== 'running') {
  failClosed(`Container '${containerName}' is in state '${inspect.State?.Status}', expected 'running'`);
}

// 3. Port Bindings (Strict Single Loopback Only on 54322, reject unexpected additional bindings)
const allPorts = inspect.NetworkSettings?.Ports || {};
for (const [portKey, portBindings] of Object.entries(allPorts)) {
  if (portKey !== '5432/tcp' && Array.isArray(portBindings) && portBindings.length > 0) {
    failClosed(`Unexpected port mapping found on '${portKey}': ${JSON.stringify(portBindings)}`);
  }
}

const bindings = allPorts['5432/tcp'] || [];
if (!Array.isArray(bindings) || bindings.length !== 1) {
  failClosed(`Expected exactly 1 port binding for '5432/tcp', received ${bindings?.length}: ${JSON.stringify(bindings)}`);
}
const [binding] = bindings;
if (binding.HostIp !== '127.0.0.1' || binding.HostPort !== '54322') {
  failClosed(`Unexpected host binding '${binding.HostIp}:${binding.HostPort}'. Expected strictly '127.0.0.1:54322'`);
}

// 4. Live Server Target Proof via docker exec
let serverInfo;
try {
  serverInfo = execFileSync('docker', [
    'exec', containerName,
    'psql', '-U', 'postgres', '-d', 'postgres', '-t', '-A', '-c',
    "SELECT current_database() || '|' || current_setting('server_version_num') || '|' || version();"
  ], { encoding: 'utf8' }).trim();
} catch (e) {
  failClosed(`Failed to query running database: ${e.message}`);
}

const [dbName, versionNumStr] = serverInfo.split('|');
if (dbName !== 'postgres') {
  failClosed(`Active database is '${dbName}', expected 'postgres'`);
}
const versionNum = parseInt(versionNumStr, 10);
if (isNaN(versionNum) || versionNum < 170000 || versionNum >= 180000) {
  failClosed(`Active PostgreSQL engine version number is '${versionNumStr}', expected 170000..179999 (PostgreSQL 17)`);
}

// 5. TCP Socket Probe
const socket = new net.Socket();
socket.setTimeout(2000);
socket.connect(54322, '127.0.0.1', () => {
  socket.destroy();
  console.log(`\x1b[32m[PREFLIGHT PASSED]\x1b[0m Verified isolated live PostgreSQL 17 container on 127.0.0.1:54322.`);
  process.exit(0);
});
socket.on('error', err => failClosed(`Socket probe failed: ${err.message}`));
socket.on('timeout', () => failClosed('Socket probe timed out'));
