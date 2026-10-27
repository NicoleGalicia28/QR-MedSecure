import { Op } from "sequelize";
import { Transaction, Beneficiary, Medicine, ClinicalRecord, SyncBatch, User, Notification } from "../models/index.js";

function periodRange(period) {
  const now = new Date();
  if (period === "today") return [new Date(new Date().setHours(0, 0, 0, 0)), now];
  if (period === "week") return [new Date(Date.now() - 7 * 864e5), now];
  if (period === "month") return [new Date(Date.now() - 30 * 864e5), now];
  return [new Date(Date.now() - 30 * 864e5), now];
}

// GET /reports?period=week (or /reports/:period) — computes dispensing
// figures from real rows.
export async function report(req, res) {
  const period = req.params.period || req.query.period || "month";
  const [from, to] = periodRange(period);

  const [transactions, uniqueBeneficiaries, records, batches] = await Promise.all([
    Transaction.findAll({
      where: { createdAt: { [Op.gte]: from, [Op.lte]: to }, status: "completed" },
      include: [{ model: Medicine, as: "medicine" }],
      raw: true,
      nest: true,
    }),
    Transaction.count({
      where: { createdAt: { [Op.gte]: from, [Op.lte]: to } },
      distinct: true,
      col: "beneficiaryId",
    }),
    ClinicalRecord.count({ where: { createdAt: { [Op.gte]: from, [Op.lte]: to } } }),
    SyncBatch.count({ where: { startedAt: { [Op.gte]: from, [Op.lte]: to } } }),
  ]);

  const byMedicine = {};
  let lowStockEvents = 0;
  for (const t of transactions) {
    const name = t.medicine?.name || `Medicine #${t.medicineId}`;
    byMedicine[name] = (byMedicine[name] || 0) + Number(t.quantity || 0);
  }
  const top = Object.entries(byMedicine).sort((a, b) => b[1] - a[1])[0];

  res.json({
    report: {
      title: "Dispensing summary",
      period,
      from,
      to,
      generatedAt: new Date(),
      totals: {
        transactions: transactions.length,
        unitsDispensed: Object.values(byMedicine).reduce((a, b) => a + b, 0),
        uniqueBeneficiaries,
        clinicalRecords: records,
        syncBatches: batches,
      },
      topMedicine: top ? { name: top[0], units: top[1] } : null,
      byMedicine: Object.entries(byMedicine)
        .map(([name, units]) => ({ name, units }))
        .sort((a, b) => b.units - a.units)
        .slice(0, 10),
    },
  });
}

// GET /reports/catalog — the available reports, each annotated with live
// record counts so the list reflects what is really in the database.
export async function listReports(req, res) {
  const monthAgo = new Date(Date.now() - 30 * 864e5);
  const weekAgo = new Date(Date.now() - 7 * 864e5);
  const [txMonth, txWeek, recsWeek, batches, benes, openAlerts] = await Promise.all([
    Transaction.count({ where: { createdAt: { [Op.gte]: monthAgo }, status: "completed" } }),
    Transaction.count({ where: { createdAt: { [Op.gte]: weekAgo }, status: "completed" } }),
    ClinicalRecord.count({ where: { createdAt: { [Op.gte]: weekAgo } } }),
    SyncBatch.count(),
    Beneficiary.count(),
    Notification.count({ where: { read: false } }),
  ]);
  res.json({
    reports: [
      { id: "dispensing-30", title: "Dispensing summary", period: "Last 30 days", records: txMonth, status: "Ready" },
      { id: "dispensing-7", title: "Weekly dispensing summary", period: "Last 7 days", records: txWeek, status: "Ready" },
      { id: "clinical-7", title: "Clinical activity summary", period: "Last 7 days", records: recsWeek, status: "Ready" },
      { id: "coverage", title: "Beneficiary coverage", period: "All time", records: benes, status: "Ready" },
      { id: "sync-log", title: "Sync & compliance log", period: "All time", records: batches, status: "Ready" },
      { id: "alerts", title: "Open alerts report", period: "Current", records: openAlerts, status: "Ready" },
    ],
  });
}

// GET /reports/preview — the figures shown on the export preview tab.
export async function preview(req, res) {
  const [from, to] = periodRange("month");
  const [transactions, uniqueBeneficiaries, records, batches, medicines, low] = await Promise.all([
    Transaction.count({ where: { createdAt: { [Op.gte]: from, [Op.lte]: to }, status: "completed" } }),
    Transaction.count({ where: { createdAt: { [Op.gte]: from, [Op.lte]: to } }, distinct: true, col: "beneficiaryId" }),
    ClinicalRecord.count({ where: { createdAt: { [Op.gte]: from, [Op.lte]: to } } }),
    SyncBatch.count({ where: { startedAt: { [Op.gte]: from, [Op.lte]: to } } }),
    Medicine.count(),
    Medicine.count({ where: { stock: { [Op.lt]: Medicine.sequelize.col("minimum") } } }).catch(() => 0),
  ]);
  res.json({
    preview: {
      period: "Last 30 days",
      from,
      to,
      lines: [
        { metric: "Dispensing transactions", value: String(transactions) },
        { metric: "Unique beneficiaries served", value: String(uniqueBeneficiaries) },
        { metric: "Clinical records entered", value: String(records) },
        { metric: "Sync batches completed", value: String(batches) },
        { metric: "Medicines on formulary", value: String(medicines) },
        { metric: "Items below minimum stock", value: String(low) },
      ],
    },
  });
}

// GET /reports/export.csv — the same figures as a downloadable file.
export async function exportCsv(req, res) {
  const period = req.query.period || "month";
  const [from, to] = periodRange(period);
  const rows = await Transaction.findAll({
    where: { createdAt: { [Op.gte]: from, [Op.lte]: to } },
    include: [
      { model: Beneficiary, as: "beneficiary" },
      { model: Medicine, as: "medicine" },
      { model: User, as: "dispenser" },
    ],
    order: [["createdAt", "DESC"]],
    limit: 1000,
  });
  const header = "code,date,beneficiary,medicine,quantity,dispensedBy,status";
  const lines = rows.map((t) =>
    [
      t.code,
      new Date(t.createdAt).toISOString(),
      `"${t.beneficiary ? `${t.beneficiary.firstName} ${t.beneficiary.lastName}` : t.beneficiaryId}"`,
      `"${t.medicine?.name || t.medicineId}"`,
      t.quantity,
      `"${t.dispenser ? `${t.dispenser.firstName} ${t.dispenser.lastName}` : ""}"`,
      t.status,
    ].join(","),
  );
  res.setHeader("Content-Type", "text/csv");
  res.setHeader("Content-Disposition", `attachment; filename=dispensing-${period}.csv`);
  res.send([header, ...lines].join("\n"));
}
