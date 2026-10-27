import { Medicine, Notification, RestockLog } from "../models/index.js";
import { Op } from "sequelize";

function serialize(m) {
  const low = m.stock < m.minimum;
  const soon = m.expiryDate && new Date(m.expiryDate) < new Date(Date.now() + 60 * 864e5);
  return {
    id: m.id,
    code: m.code,
    name: m.name,
    slot: m.slot || "—",
    stock: m.stock,
    minimum: m.minimum,
    unit: m.unit,
    category: m.category || "",
    expiryDate: m.expiryDate || "",
    status: low ? "Low stock" : soon ? "Expiry review" : "OK",
  };
}

// GET /inventory?q=&status=
export async function list(req, res) {
  const where = {};
  if (req.query.q) where.name = req.query.q;
  const rows = await Medicine.findAll({ where, order: [["slot", "ASC"], ["name", "ASC"]] });
  let items = rows.map(serialize);
  if (req.query.status) items = items.filter((i) => i.status === req.query.status);
  res.json({ items });
}

// GET /medicines — compact list for pickers (restock, dispensing forms).
export async function medicines(req, res) {
  const rows = await Medicine.findAll({ order: [["name", "ASC"]] });
  res.json({
    medicines: rows.map((m) => ({
      id: m.id,
      code: m.code,
      name: m.name,
      stock: m.stock,
      unit: m.unit,
      slot: m.slot || "—",
    })),
  });
}

// GET /inventory/:id
export async function getById(req, res) {
  const row = await Medicine.findByPk(req.params.id);
  if (!row) return res.status(404).json({ error: "Medicine not found" });
  res.json({ item: serialize(row) });
}

// POST /inventory — add a new medicine to the formulary.
export async function create(req, res) {
  const { name, slot, stock, minimum, unit, category, expiryDate } = req.body || {};
  if (!name) return res.status(400).json({ error: "Name is required." });
  const last = await Medicine.findOne({ order: [["code", "DESC"]] });
  const n = last ? parseInt(String(last.code).replace(/\D/g, ""), 10) + 1 : 1;
  const row = await Medicine.create({
    code: `MED-${String(n).padStart(3, "0")}`,
    name,
    slot: slot || "",
    stock: Number(stock) || 0,
    minimum: Number(minimum) || 0,
    unit: unit || "tablets",
    category: category || "",
    expiryDate: expiryDate || null,
  });
  res.status(201).json({ item: serialize(row) });
}

// Shared restock application: add units, refresh expiry when supplied, and
// clear outstanding low-stock alerts once the level is back above minimum.
async function applyRestock(row, qty, expiryDate, req) {
  const before = row.stock;
  await row.update({ stock: row.stock + qty, ...(expiryDate ? { expiryDate } : {}) });
  await row.reload();
  try {
    await RestockLog.create({
      medicineId: row.id,
      quantity: qty,
      previousStock: before,
      newStock: row.stock,
      expiryDate: expiryDate || row.expiryDate || null,
      receivedById: req?.user?.id || null,
      receivedByName: req?.user ? `${req.user.firstName || ""} ${req.user.lastName || ""}`.trim() || req.user.email : null,
      note: expiryDate ? "Batch expiry updated" : null,
    });
  } catch {}
  try {
    await Notification.create({
      kind: "stock",
      severity: "info",
      title: `${row.name} restocked`,
      body: `+${qty} ${row.unit || "units"} added · Balance ${row.stock} ${row.unit || "units"}${row.slot ? ` · ${row.slot}` : ""}`,
      link: "/bhw/inventory",
    });
  } catch {}
  if (row.stock >= row.minimum) {
    await Notification.update(
      { read: true },
      {
        where: {
          kind: "stock",
          read: false,
          title: { [Op.like]: `%${row.name}%` },
        },
      },
    ).catch(() => {});
  }
  return row;
}

const slugify = (s) => String(s).toLowerCase().replace(/[^a-z0-9]+/g, "-");

// POST /inventory/restock — accepted by the restock form, which identifies
// the medicine by numeric id, name-slug, or display name.
export async function restockByAny(req, res) {
  const { medicineId, medicine, quantity, expiryDate } = req.body || {};
  const qty = Number(quantity);
  if (!qty || qty <= 0)
    return res.status(400).json({ error: "A positive quantity is required." });

  let row = null;
  if (medicineId && /^\d+$/.test(String(medicineId))) {
    row = await Medicine.findByPk(medicineId);
  }
  if (!row && (medicineId || medicine)) {
    const needle = String(medicineId || medicine);
    const rows = await Medicine.findAll();
    row =
      rows.find((m) => slugify(m.name) === slugify(needle)) ||
      rows.find((m) => m.name.toLowerCase() === needle.toLowerCase()) ||
      null;
  }
  if (!row) return res.status(404).json({ error: "Medicine not found" });

  await applyRestock(row, qty, expiryDate, req);
  res.json({ item: serialize(row) });
}

// POST /inventory/:id/restock — adds units; clears the low-stock alert.
export async function restock(req, res) {
  const row = await Medicine.findByPk(req.params.id);
  if (!row) return res.status(404).json({ error: "Medicine not found" });
  const qty = Number(req.body?.quantity);
  if (!qty || qty <= 0) return res.status(400).json({ error: "A positive quantity is required." });

  await applyRestock(row, qty, req.body?.expiryDate, req);
  res.json({ item: serialize(row) });
}

// GET /inventory/restock-logs
export async function restockLogs(req, res) {
  const { medicineId } = req.query;
  const where = {};
  if (medicineId && /^\d+$/.test(String(medicineId))) where.medicineId = medicineId;
  const rows = await RestockLog.findAll({
    where,
    include: [{ model: Medicine, as: "medicine" }],
    order: [["createdAt", "DESC"]],
    limit: 200,
  });
  res.json({
    logs: rows.map((r) => ({
      id: r.id,
      medicineId: r.medicineId,
      medicine: r.medicine?.name || "",
      quantity: r.quantity,
      previousStock: r.previousStock,
      newStock: r.newStock,
      expiryDate: r.expiryDate || "",
      receivedBy: r.receivedByName || "",
      note: r.note || "",
      at: r.createdAt,
    })),
  });
}

// PUT /inventory/:id — edit stock levels, minimum, expiry.
export async function update(req, res) {
  const row = await Medicine.findByPk(req.params.id);
  if (!row) return res.status(404).json({ error: "Medicine not found" });
  const { name, slot, stock, minimum, unit, category, expiryDate } = req.body || {};
  await row.update({
    name: name ?? row.name,
    slot: slot ?? row.slot,
    stock: stock !== undefined ? Number(stock) : row.stock,
    minimum: minimum !== undefined ? Number(minimum) : row.minimum,
    unit: unit ?? row.unit,
    category: category ?? row.category,
    expiryDate: expiryDate || row.expiryDate,
  });
  res.json({ item: serialize(row) });
}
