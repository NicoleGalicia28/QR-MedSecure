#!/usr/bin/env node
/**
 * IoT bridge: Django command queue -> ESP32 local HTTP API
 * ---------------------------------------------------------
 * The ESP32 firmware in `med_secure_iot_v1-main/src/main.cpp` is a standalone
 * HTTP server. It does NOT poll Django, so a command queued from the website
 * (POST /api/v1/commands/send/) would otherwise sit in the Django DB forever.
 *
 * This script runs on your PC (same Wi-Fi/LAN as the ESP32) and:
 *   1. polls Django  GET /api/v1/iot/poll/?machine_id=<MACHINE_ID>
 *   2. for DISPENSE commands, calls the ESP32  POST /api/dispense
 *   3. writes the result back to Django  POST /api/v1/logs/machine/
 *
 * Nothing in the ESP32 project is modified.
 *
 * Usage (from the QR-MedSecure folder):
 *   node --env-file-if-exists=.env scripts/iot-bridge.mjs
 *   node --env-file-if-exists=.env scripts/iot-bridge.mjs --test
 *
 * Environment (.env or shell):
 *   ESP32_URL        http://<esp32-ip>            (required)
 *   IOT_API_URL      http://localhost:8000
 *   IOT_API_KEY      qr-medsecure-super-secret-key-123
 *   MACHINE_ID       MSv1M-001
 *   POLL_MS          2000
 *   DISPENSE_TIMEOUT_MS 60000
 */

import process from "node:process";

const IOT_API_URL = (process.env.IOT_API_URL || "http://localhost:8000").replace(/\/$/, "");
const IOT_API_KEY = process.env.IOT_API_KEY || "qr-medsecure-super-secret-key-123";
const MACHINE_ID = process.env.MACHINE_ID || "MSv1M-001";
const ESP32_URL = (process.env.ESP32_URL || "").replace(/\/$/, "");
const POLL_MS = Number(process.env.POLL_MS || 2000);
const DISPENSE_TIMEOUT_MS = Number(process.env.DISPENSE_TIMEOUT_MS || 60000);

const TEST_MODE = process.argv.includes("--test");
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

function fail(msg) {
  console.error("\n[bridge] " + msg + "\n");
  process.exit(1);
}

async function fetchJson(url, { method = "GET", headers = {}, body, timeoutMs = 10000 } = {}) {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    const res = await fetch(url, {
      method,
      headers: { "Content-Type": "application/json", ...headers },
      body: body != null ? JSON.stringify(body) : undefined,
      signal: ctrl.signal,
    });
    const text = await res.text();
    let data = null;
    try { data = text ? JSON.parse(text) : null; } catch { data = { raw: text }; }
    if (!res.ok) {
      const err = new Error(`${method} ${url} -> ${res.status} ${JSON.stringify(data).slice(0, 300)}`);
      err.status = res.status;
      throw err;
    }
    return data;
  } finally {
    clearTimeout(timer);
  }
}

const djangoHeaders = { "X-API-Key": IOT_API_KEY };

async function logToDjango(logType, message) {
  try {
    await fetchJson(`${IOT_API_URL}/api/v1/logs/machine/`, {
      method: "POST",
      headers: djangoHeaders,
      body: { log_type: logType, message },
    });
  } catch (e) {
    console.warn("[bridge] could not write Django log:", e.message);
  }
}

async function checkEsp32() {
  try {
    const status = await fetchJson(`${ESP32_URL}/api/status`, { timeoutMs: 5000 });
    console.log(`[bridge] ESP32 reachable at ${ESP32_URL} ->`, JSON.stringify(status));
    return true;
  } catch (e) {
    console.error(`[bridge] ESP32 NOT reachable at ${ESP32_URL}: ${e.message}`);
    return false;
  }
}

async function handleCommand(cmd) {
  const id = cmd?.id;
  const type = cmd?.command_type;
  console.log(`\n[bridge] command #${id} ${type} (channel ${cmd?.motor_channel ?? "-"})`);

  if (type === "DISPENSE") {
    try {
      const res = await fetchJson(`${ESP32_URL}/api/dispense`, {
        method: "POST",
        timeoutMs: DISPENSE_TIMEOUT_MS,
      });
      console.log(`[bridge] command #${id} done:`, JSON.stringify(res));
      await logToDjango("INFO", `Command #${id} DISPENSE completed via bridge (${res?.machineId || MACHINE_ID})`);
    } catch (e) {
      console.error(`[bridge] command #${id} failed: ${e.message}`);
      await logToDjango("ERROR", `Command #${id} DISPENSE failed: ${e.message}`);
    }
    return;
  }

  // The current firmware only exposes /api/dispense and /api/status.
  const note = `Command #${id} (${type}) is not supported by the current ESP32 firmware. Use the physical CALIBRATE/DISPENSE buttons.`;
  console.warn("[bridge] " + note);
  await logToDjango("WARN", note);
}

async function testMode() {
  console.log(`[bridge] test mode against ${ESP32_URL}`);
  if (!(await checkEsp32())) process.exit(1);
  console.log("[bridge] sending POST /api/dispense ...");
  try {
    const res = await fetchJson(`${ESP32_URL}/api/dispense`, {
      method: "POST",
      timeoutMs: DISPENSE_TIMEOUT_MS,
    });
    console.log("[bridge] dispense response:", JSON.stringify(res));
  } catch (e) {
    console.error("[bridge] dispense failed:", e.message);
    process.exit(1);
  }
}

async function main() {
  if (!ESP32_URL) {
    fail(
      "ESP32_URL is not set.\n" +
        "  1. Flash the ESP32 and open the Serial Monitor (115200) to read its IP.\n" +
        "  2. Add to .env:  ESP32_URL=http://<that-ip>\n" +
        "  3. Re-run: node --env-file-if-exists=.env scripts/iot-bridge.mjs"
    );
  }

  console.log(`[bridge] machine=${MACHINE_ID}  django=${IOT_API_URL}  esp32=${ESP32_URL}`);

  if (TEST_MODE) return testMode();

  if (!(await checkEsp32())) {
    console.error("[bridge] Continuing anyway; will retry on each command.");
  }

  let running = true;
  process.on("SIGINT", () => {
    running = false;
    console.log("\n[bridge] stopping...");
    process.exit(0);
  });

  while (running) {
    try {
      const poll = await fetchJson(
        `${IOT_API_URL}/api/v1/iot/poll/?machine_id=${encodeURIComponent(MACHINE_ID)}`,
        { headers: djangoHeaders, timeoutMs: 8000 }
      );
      if (poll?.status === "success" && poll?.command) {
        await handleCommand(poll.command);
      }
    } catch (e) {
      console.error("[bridge] poll error:", e.message);
      await sleep(Math.min(POLL_MS * 3, 10000));
      continue;
    }
    await sleep(POLL_MS);
  }
}

main().catch((e) => fail(e.stack || e.message));
