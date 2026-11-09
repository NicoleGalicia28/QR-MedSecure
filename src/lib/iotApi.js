// Client for the Django IoT/machine API (qr_medsecure_api-main).
// This runs alongside the main Express backend and is used for ESP32
// inventory, command queue, polling, and machine logs.

const IOT_BASE = (import.meta.env.VITE_IOT_API_URL || "http://localhost:8000").replace(/\/$/, "");
const IOT_API = `${IOT_BASE}/api/v1`;
const IOT_KEY = import.meta.env.VITE_IOT_API_KEY || "";
export const IOT_MACHINE_ID = import.meta.env.VITE_IOT_MACHINE_ID || "MED-001";

export const IOT_CONFIGURED = Boolean(IOT_BASE && IOT_KEY);

function headers(extra = {}) {
  return {
    "Content-Type": "application/json",
    ...(IOT_KEY ? { "X-API-Key": IOT_KEY } : {}),
    ...extra,
  };
}

async function request(path, { method = "GET", body } = {}) {
  if (!IOT_CONFIGURED) {
    const err = new Error("IoT API is not configured. Set VITE_IOT_API_URL and VITE_IOT_API_KEY in .env.");
    err.config = true;
    throw err;
  }
  let res;
  try {
    res = await fetch(`${IOT_API}${path}`, {
      method,
      headers: headers(),
      body: body != null ? JSON.stringify(body) : undefined,
    });
  } catch (e) {
    const err = new Error("Cannot reach the IoT API (Django). Is it running on " + IOT_BASE + "?");
    err.offline = true;
    err.cause = e;
    throw err;
  }
  const text = await res.text();
  let data = null;
  try { data = text ? JSON.parse(text) : null; } catch { data = { raw: text }; }
  if (!res.ok) {
    const err = new Error((data && (data.error || data.detail || data.message)) || `IoT API ${res.status}`);
    err.status = res.status;
    err.data = data;
    throw err;
  }
  return data;
}

export const iotApi = {
  base: IOT_BASE,
  machineId: IOT_MACHINE_ID,
  configured: IOT_CONFIGURED,
  getInventory: () => request("/inventory/"),
  refill: ({ medicine_inventory_id, quantity_added }) =>
    request("/refill/", { method: "POST", body: { medicine_inventory_id, quantity_added } }),
  sendCommand: ({ machine_id, command_type, motor_channel, parameters }) =>
    request("/commands/send/", { method: "POST", body: { machine_id, command_type, motor_channel, parameters } }),
  poll: (machine_id = IOT_MACHINE_ID) => request(`/iot/poll/?machine_id=${encodeURIComponent(machine_id)}`),
  postLog: ({ log_type, message }) => request("/logs/machine/", { method: "POST", body: { log_type, message } }),
};
