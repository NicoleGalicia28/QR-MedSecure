// Server-side PDF rendering for the dispensing receipt.
//
// The browser's "Save as PDF" print dialog still works (the print stylesheet
// in DispensingReceipt.css isolates the receipt card), but the receipt page
// also offers a direct download. This controller renders the same receipt
// server-side so the saved file is a clean, single-page PDF with no browser
// headers, URL bar or workspace chrome.
import PDFDocument from "pdfkit";
import { Transaction, Medicine, Beneficiary, User } from "../models/index.js";
import { fullName } from "../utils/codes.js";

const INCLUDE = [
  { model: Beneficiary, as: "beneficiary" },
  { model: Medicine, as: "medicine" },
  { model: User, as: "dispenser" },
];

const INK = "#1a1a1a";
const MUTED = "#6b7280";
const BRAND = "#0a3d3d";
const LINE = "#e5e7eb";
const GREEN_BG = "#d1fae5";
const GREEN_INK = "#065f46";
const AMBER_BG = "#fdf3e3";
const AMBER_INK = "#92400e";
const RED_BG = "#fee2e2";
const RED_INK = "#991b1b";
const SOFT = "#f9fafb";

const TIMEZONE = "Asia/Manila";

// Layout metrics (PDF points). The card height is computed from these, so
// the background rectangle and the content always line up.
const M = {
  padTop: 26,
  padBottom: 12,
  pillH: 20,
  gapAfterPill: 18,
  rule: 1,
  gapAfterRule: 12,
  labelH: 12,
  gapAfterLabel: 0,
  gapAfterValue: 12,
  gapAfterTxRule: 18,
  rowGap: 20,
  gapAfterFields: 14,
  noteH: 40,
  gapAfterNote: 16,
  metaH: 12,
  gapAfterMeta: 12,
};

function fmtDateTime(value) {
  if (!value) return "—";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return String(value);
  const date = d.toLocaleDateString("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    timeZone: TIMEZONE,
  });
  const time = d.toLocaleTimeString("en-GB", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
    timeZone: TIMEZONE,
  });
  return `${date}, ${time}`;
}

function statusMeta(status) {
  if (status === "completed")
    return { label: "Dispensed", bg: GREEN_BG, ink: GREEN_INK };
  if (status === "voided") return { label: "Voided", bg: RED_BG, ink: RED_INK };
  return { label: String(status || "—"), bg: SOFT, ink: MUTED };
}

// GET /transactions/:id/receipt.pdf
export async function receiptPdf(req, res) {
  const { id } = req.params;
  const row = /^\d+$/.test(id)
    ? await Transaction.findByPk(id, { include: INCLUDE })
    : await Transaction.findOne({ where: { code: id }, include: INCLUDE });
  if (!row) return res.status(404).json({ error: "Transaction not found" });

  const t = {
    code: row.code,
    beneficiary: row.beneficiary
      ? `${row.beneficiary.firstName} ${row.beneficiary.lastName}`
      : "—",
    beneficiaryId: row.beneficiary?.publicId || "—",
    medicine: row.medicine?.name || "—",
    quantity: row.quantity,
    dispensedBy: fullName(row.dispenser),
    machine: row.machineCode || "—",
    at: row.createdAt,
    status: row.status,
    note: row.note || "",
  };

  const meta = statusMeta(t.status);
  const method =
    t.machine && t.machine !== "—"
      ? `${t.machine} · Machine release`
      : "Manual · Health center";

  const filename = `dispensing-receipt-${t.code}.pdf`;
  res.setHeader("Content-Type", "application/pdf");
  res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);

  const doc = new PDFDocument({
    size: "A4",
    margin: 0,
    info: {
      Title: `Dispensing receipt ${t.code}`,
      Author: "QR-MedSecure",
      Subject: "Barangay 354 Tayuman Health Center",
    },
  });
  doc.pipe(res);

  const pageW = doc.page.width;
  const pageH = doc.page.height;

  const cardW = 520;
  const cardX = (pageW - cardW) / 2;
  const cardY = 54;
  const pad = 28;
  const innerX = cardX + pad;
  const innerW = cardW - pad * 2;
  const colW = innerW / 2;

  // ---- Measure ------------------------------------------------------------
  const fields = [
    [
      { label: "Beneficiary", value: t.beneficiary },
      { label: "Beneficiary ID", value: t.beneficiaryId },
    ],
    [
      { label: "Medicine", value: t.medicine },
      { label: "Quantity", value: String(t.quantity) },
    ],
    [
      { label: "Released by", value: t.dispensedBy },
      { label: "Release method", value: method },
    ],
  ];

  const valueHeight = (text) =>
    Math.max(
      13,
      doc.heightOfString(String(text ?? ""), {
        width: colW - 12,
        fontSize: 11,
        font: "Helvetica-Bold",
      })
    );

  const rowHeights = fields.map((row) => {
    const h = Math.max(
      valueHeight(row[0].value),
      valueHeight(row[1].value)
    );
    return M.labelH + h + M.rowGap;
  });

  const noteHeight = t.note
    ? M.noteH +
      Math.max(
        0,
        doc.heightOfString(t.note, {
          width: innerW - 24,
          fontSize: 9.5,
          font: "Helvetica",
        }) -
          20
      )
    : 0;

  const cardH =
    M.padTop +
    M.pillH +
    M.gapAfterPill +
    M.gapAfterRule +
    M.labelH +
    17 +
    M.gapAfterValue +
    M.rule +
    M.gapAfterTxRule +
    rowHeights.reduce((a, b) => a + b, 0) +
    M.rule +
    M.gapAfterFields +
    noteHeight +
    (t.note ? M.gapAfterNote : 0) +
    M.metaH +
    M.gapAfterMeta +
    M.padBottom;

  // ---- Card background ----------------------------------------------------
  doc
    .save()
    .roundedRect(cardX, cardY + 64, cardW, cardH, 10)
    .lineWidth(1)
    .fillAndStroke("#ffffff", LINE)
    .restore();

  // ---- Page header --------------------------------------------------------
  doc
    .font("Helvetica-Bold")
    .fontSize(9)
    .fillColor(BRAND)
    .text("BARANGAY 354 TAYUMAN HEALTH CENTER", cardX, cardY, {
      width: cardW,
      characterSpacing: 1.2,
      align: "center",
    });
  doc
    .font("Helvetica-Bold")
    .fontSize(20)
    .fillColor(INK)
    .text("Dispensing receipt", cardX, cardY + 16, { width: cardW, align: "center" });
  doc
    .font("Helvetica")
    .fontSize(9)
    .fillColor(MUTED)
    .text(`Transaction ${t.code} · Recorded ${fmtDateTime(t.at)}`, cardX, cardY + 42, {
      width: cardW,
      align: "center",
    });

  // ---- Card content -------------------------------------------------------
  let y = cardY + 64 + M.padTop;

  // Status pill
  const pillW = 92;
  doc.roundedRect(innerX, y, pillW, M.pillH, 10).fill(meta.bg);
  doc
    .font("Helvetica-Bold")
    .fontSize(9)
    .fillColor(meta.ink)
    .text(meta.label, innerX, y + 6, { width: pillW, align: "center" });
  y += M.pillH + M.gapAfterPill;

  // Transaction block
  doc.moveTo(innerX, y).lineTo(innerX + innerW, y).lineWidth(M.rule).strokeColor(LINE).stroke();
  y += M.gapAfterRule;
  doc
    .font("Helvetica-Bold")
    .fontSize(8)
    .fillColor(MUTED)
    .text("TRANSACTION", innerX, y, { width: innerW, characterSpacing: 0.4 });
  y += M.labelH;
  doc
    .font("Helvetica-Bold")
    .fontSize(13)
    .fillColor(BRAND)
    .text(t.code, innerX, y, { width: innerW });
  y += 17 + M.gapAfterValue;
  doc.moveTo(innerX, y).lineTo(innerX + innerW, y).lineWidth(M.rule).strokeColor(LINE).stroke();
  y += M.gapAfterTxRule;

  // Field grid
  fields.forEach((row, idx) => {
    const draw = (cell, cx) => {
      doc
        .font("Helvetica-Bold")
        .fontSize(8)
        .fillColor(MUTED)
        .text(cell.label.toUpperCase(), cx, y, {
          width: colW - 12,
          characterSpacing: 0.4,
        });
      doc
        .font("Helvetica-Bold")
        .fontSize(11)
        .fillColor(INK)
        .text(String(cell.value ?? "—"), cx, y + M.labelH, { width: colW - 12 });
    };
    draw(row[0], innerX);
    draw(row[1], innerX + colW);
    y += rowHeights[idx];
  });

  doc.moveTo(innerX, y).lineTo(innerX + innerW, y).lineWidth(M.rule).strokeColor(LINE).stroke();
  y += M.gapAfterFields;

  // Note
  if (t.note) {
    doc.roundedRect(innerX, y, innerW, noteHeight, 6).fill(AMBER_BG);
    doc
      .font("Helvetica-Bold")
      .fontSize(8)
      .fillColor(AMBER_INK)
      .text("NOTE", innerX + 12, y + 8, { width: innerW - 24, characterSpacing: 0.4 });
    doc
      .font("Helvetica")
      .fontSize(9.5)
      .fillColor(INK)
      .text(t.note, innerX + 12, y + 20, { width: innerW - 24, lineGap: 1.5 });
    y += noteHeight + M.gapAfterNote;
  }

  // Closing line
  doc
    .font("Helvetica-Oblique")
    .fontSize(8.5)
    .fillColor(MUTED)
    .text("This receipt records a release; it is not a new prescription.", innerX, y, {
      width: innerW,
    });

  // ---- Audit footer --------------------------------------------------------
  let ay = cardY + 64 + cardH + 22;
  doc.moveTo(cardX, ay).lineTo(cardX + cardW, ay).lineWidth(1).strokeColor(LINE).stroke();
  ay += 12;
  doc
    .font("Helvetica-Bold")
    .fontSize(9)
    .fillColor(INK)
    .text("Audit recorded", cardX, ay, { width: cardW / 2 });
  doc
    .font("Helvetica")
    .fontSize(8.5)
    .fillColor(MUTED)
    .text("Staff, medicine, quantity and time released.", cardX, ay + 12, {
      width: cardW / 2,
    });
  doc
    .font("Helvetica-Bold")
    .fontSize(9)
    .fillColor(GREEN_INK)
    .text("• Complete", cardX + cardW / 2, ay, { width: cardW / 2, align: "right" });

  // ---- Page footer ---------------------------------------------------------
  doc
    .font("Helvetica")
    .fontSize(8)
    .fillColor("#9ca3af")
    .text("QR-MedSecure · Barangay 354 Tayuman, Manila", cardX, pageH - 46, {
      width: cardW,
    })
    .text(`Generated ${fmtDateTime(new Date())}`, cardX, pageH - 34, {
      width: cardW,
      align: "right",
    });

  doc.end();
}
