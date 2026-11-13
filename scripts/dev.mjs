// Friendly `npm run dev`.
//
// Vite is configured with `strictPort: true` so port forwarding and LAN links
// stay stable. The downside is that starting it while another copy is already
// running crashes with "Port 5173 is already in use". This wrapper turns that
// crash into a clear message and starts Vite only when the port is free.
import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";
import net from "node:net";

const PORT = 5173;
const DEV_URL = `http://localhost:${PORT}`;

async function isOurDevServer() {
  try {
    const res = await fetch(DEV_URL, { signal: AbortSignal.timeout(1500) });
    if (!res.ok) return false;
    const text = await res.text();
    return text.includes("QR-MedSecure");
  } catch {
    return false;
  }
}

function portInUse() {
  return new Promise((resolve) => {
    const socket = net.connect({ host: "127.0.0.1", port: PORT });
    const done = (value) => {
      socket.destroy();
      resolve(value);
    };
    socket.setTimeout(800);
    socket.once("connect", () => done(true));
    socket.once("timeout", () => done(false));
    socket.once("error", () => done(false));
  });
}

if (await isOurDevServer()) {
  console.log(`\nQR-MedSecure is already running at ${DEV_URL}`);
  console.log("Open it in your browser. To restart it, run .\\stop-services.cmd 5173 first.\n");
  process.exit(0);
}

if (await portInUse()) {
  console.error(`\nPort ${PORT} is in use by another program.`);
  console.error("Free it with .\\stop-services.cmd 5173, then run npm run dev again.\n");
  process.exit(1);
}

const viteBin = fileURLToPath(new URL("../node_modules/vite/bin/vite.js", import.meta.url));
const child = spawn(process.execPath, [viteBin], { stdio: "inherit" });

child.on("exit", (code) => process.exit(code ?? 0));
