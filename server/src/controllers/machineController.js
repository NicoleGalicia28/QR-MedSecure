import { Machine, MachineEvent, Medicine } from "../models/index.js";
import { Op } from "sequelize";

function serialize(m, slotInfo) {
  return {
    id: m.id,
    code: m.code,
    name: m.name,
    status: m.status,
    firmware: m.firmware || "—",
    slotsTotal: m.slotsTotal,
    slotsFilled: slotInfo?.filled ?? 0,
    temperature: m.temperature ?? null,
    door: m.door || "locked",
    lastHeartbeat: m.lastHeartbeat,
  };
}

async function slotInfo(machine) {
  // Slots are considered filled when a medicine is assigned to one.
  const meds = await Medicine.findAll({ where: { slot: { [Op.ne]: "" } } });
  const filled = meds.filter((m) => m.slot && m.slot !== "—").length;
  return { filled: Math.min(filled, machine.slotsTotal) };
}

// GET /machine/:id (code like TY-DM-01)
export async function getById(req, res) {
  const m = await Machine.findOne({ where: { code: req.params.id } });
  if (!m) return res.status(404).json({ error: "Machine not found" });
  res.json({ machine: serialize(m, await slotInfo(m)) });
}

// GET /machine — fleet list.
export async function list(req, res) {
  const rows = await Machine.findAll({ order: [["code", "ASC"]] });
  const out = [];
  for (const m of rows) out.push(serialize(m, await slotInfo(m)));
  res.json({ machines: out });
}

// PUT /machine/:id — update status/telemetry (heartbeat, door, temp).
export async function update(req, res) {
  const m = await Machine.findOne({ where: { code: req.params.id } });
  if (!m) return res.status(404).json({ error: "Machine not found" });
  const { status, firmware, temperature, door } = req.body || {};
  await m.update({
    status: status ?? m.status,
    firmware: firmware ?? m.firmware,
    temperature: temperature !== undefined ? Number(temperature) : m.temperature,
    door: door ?? m.door,
    lastHeartbeat: new Date(),
  });
  res.json({ machine: serialize(m, await slotInfo(m)) });
}

// GET /machine/:id/events
export async function events(req, res) {
  const m = await Machine.findOne({ where: { code: req.params.id } });
  if (!m) return res.status(404).json({ error: "Machine not found" });
  const rows = await MachineEvent.findAll({
    where: { machineId: m.id },
    order: [["createdAt", "DESC"]],
    limit: 100,
  });
  res.json({
    events: rows.map((e) => ({
      id: e.id,
      kind: e.kind,
      note: e.note || "",
      recordedBy: e.recordedBy || "",
      at: e.createdAt,
    })),
  });
}

// POST /machine/:id/events — log maintenance, refills, faults.
export async function addEvent(req, res) {
  const m = await Machine.findOne({ where: { code: req.params.id } });
  if (!m) return res.status(404).json({ error: "Machine not found" });
  const { kind, note } = req.body || {};
  if (!kind) return res.status(400).json({ error: "kind is required." });
  const e = await MachineEvent.create({
    machineId: m.id,
    kind,
    note: note || "",
    recordedBy: req.user?.email || "",
  });
  res.status(201).json({
    event: { id: e.id, kind: e.kind, note: e.note, recordedBy: e.recordedBy, at: e.createdAt },
  });
}
