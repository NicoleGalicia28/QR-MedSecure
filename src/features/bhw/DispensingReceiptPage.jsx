import { useState } from "react";
import { Link, useParams } from "react-router-dom";
import { ArrowLeft, FileDown, Loader2 } from "lucide-react";
import { useEndpoint } from "../../lib/useApi";
import { downloadFile } from "../../lib/api";
import { Loading, ErrorState } from "../../lib/ui";
import { getSession, roleKey } from "../auth/authStore";
import { fmtDateTime } from "./apiFormat";
import "../admin/DashboardPage.css";
import "./DispensingReceipt.css";

// The receipt is shared by the BHW and admin workspaces, so the return links
// have to point at the signed-in user's own workspace.
function workspaceBase() {
  const key = roleKey(getSession());
  if (key === "admin") return "/admin";
  if (key === "chairman") return "/chairman";
  return "/bhw";
}

export default function DispensingReceiptPage() {
  const { id } = useParams();
  const base = workspaceBase();
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState("");

  // Real transaction receipt — id may be numeric or a code (TXN-2026-0001).
  const { data: transaction, isLoading, error, refetch } = useEndpoint(
    `/transactions/${id}`,
    (res) => res.transaction
  );

  // The PDF is rendered server-side so the saved file contains the receipt
  // only — no sidebar, top bar or browser print headers.
  const handleSavePdf = async () => {
    setSaving(true);
    setSaveError("");
    try {
      await downloadFile(
        `/transactions/${encodeURIComponent(id)}/receipt.pdf`,
        `dispensing-receipt-${transaction?.code || id}.pdf`
      );
    } catch (err) {
      setSaveError(err?.message || "Could not save the PDF. Please try again.");
    } finally {
      setSaving(false);
    }
  };

  if (isLoading && !transaction) {
    return <Loading label="Loading receipt…" />;
  }
  if (error) {
    return (
      <>
        <Link to={`${base}/transactions`} className="dr-back">
          <ArrowLeft size={14} /> Transactions
        </Link>
        <ErrorState
          title="Could not load this receipt"
          message={error}
          onRetry={refetch}
        />
      </>
    );
  }
  if (!transaction) {
    return (
      <>
        <Link to={`${base}/transactions`} className="dr-back">
          <ArrowLeft size={14} /> Transactions
        </Link>
        <ErrorState title="Receipt not found" message="This transaction does not exist." />
      </>
    );
  }

  const statusLabel =
    transaction.status === "completed"
      ? "Dispensed"
      : transaction.status === "voided"
        ? "Voided"
        : transaction.status;
  const method =
    transaction.machine && transaction.machine !== "—"
      ? `${transaction.machine} · Machine release`
      : "Manual · Health center";
  const confirmedAt = fmtDateTime(transaction.at);

  return (
    <>
      {/* Back */}
      <Link to={`${base}/transactions`} className="dr-back">
        <ArrowLeft size={14} /> Transactions
      </Link>

      {/* Header */}
      <div className="dr-header">
        <h1 className="dr-header__title">Medicine dispensing recorded</h1>
        <p className="dr-header__subtitle">
          {transaction.code} · Confirmed {confirmedAt} · Post-release receipt
          state.
        </p>
      </div>

      {/* Success banner */}
      <div className="dr-banner">
        <strong>
          {statusLabel} · {transaction.code}
        </strong>
        <br />
        {transaction.quantity} of {transaction.medicine} were recorded for{" "}
        {transaction.beneficiary}.
      </div>

      {/* ---------- LAYOUT ---------- */}
      <div className="dr-layout">
        {/* ============ LEFT: RECEIPT ============ */}
        <div className="dr-receipt">
          {/* Receipt header */}
          <div className="dr-receipt__header">
            <div>
              <h2 className="dr-receipt__title">Dispensing receipt</h2>
              <p className="dr-receipt__sub">
                Barangay 354 Tayuman Health Center
              </p>
            </div>
            <span className="dr-receipt__pill">• {statusLabel}</span>
          </div>

          {/* Transaction row */}
          <div className="dr-tx-row">
            <div className="dr-tx-row__left">
              <span className="dr-tx-row__label">Transaction</span>
              <span className="dr-tx-row__value">{transaction.code}</span>
            </div>
          </div>

          {/* Fields grid */}
          <div className="dr-fields">
            <div className="dr-field">
              <span className="dr-field__label">Beneficiary</span>
              <span className="dr-field__value">
                {transaction.beneficiary}
              </span>
            </div>
            <div className="dr-field">
              <span className="dr-field__label">Beneficiary ID</span>
              <span className="dr-field__value">
                {transaction.beneficiaryId}
              </span>
            </div>

            <div className="dr-field">
              <span className="dr-field__label">Medicine</span>
              <span className="dr-field__value">{transaction.medicine}</span>
            </div>
            <div className="dr-field">
              <span className="dr-field__label">Quantity</span>
              <span className="dr-field__value">{transaction.quantity}</span>
            </div>

            <div className="dr-field">
              <span className="dr-field__label">Released by</span>
              <span className="dr-field__value">{transaction.dispensedBy}</span>
            </div>
            <div className="dr-field">
              <span className="dr-field__label">Release method</span>
              <span className="dr-field__value dr-field__value--muted">
                {method}
              </span>
            </div>
          </div>

          {/* Meta */}
          <p className="dr-receipt__meta">
            Recorded {confirmedAt}. This receipt records a release; it is not a
            new prescription.
          </p>

          {/* Actions */}
          <div className="dr-actions">
            <button
              type="button"
              className="dr-btn dr-btn--primary"
              onClick={handleSavePdf}
              disabled={saving}
            >
              {saving ? (
                <Loader2 size={14} strokeWidth={2.5} className="dr-btn__spin" />
              ) : (
                <FileDown size={14} strokeWidth={2.5} />
              )}
              {saving ? "Saving PDF…" : "Save as PDF"}
            </button>
            {saveError ? <span className="dr-actions__error">{saveError}</span> : null}
          </div>
        </div>

        {/* ============ RIGHT: ALLOCATION + RETURNS ============ */}
        <div>
          {/* Allocation result */}
          <div className="dr-side-panel">
            <h2 className="dr-side-panel__title">Allocation result</h2>

            <div className="dr-alloc-row">
              <span className="dr-alloc-row__label">
                {transaction.medicine} allocation
              </span>
              <span className="dr-alloc-row__value">
                {transaction.quantity} released
              </span>
            </div>

            <div className="dr-alloc-row">
              <span className="dr-alloc-row__label">Status</span>
              <span className="dr-alloc-row__value dr-alloc-row__value--muted">
                {statusLabel}
              </span>
            </div>

            {transaction.note ? (
              <div className="dr-warning">
                <strong>Note</strong>
                {transaction.note}
              </div>
            ) : null}
          </div>

          {/* Return routes */}
          <div className="dr-side-panel">
            <h2 className="dr-side-panel__title">Return routes</h2>

            <Link to={`${base}/transactions`} className="dr-return-btn">
              View transaction details
            </Link>
            {base === "/bhw" ? (
              <Link to={`${base}/clinical-records`} className="dr-return-btn">
                View clinical records
              </Link>
            ) : (
              <Link to={`${base}/beneficiaries`} className="dr-return-btn">
                View beneficiaries
              </Link>
            )}
            <Link to={`${base}/dashboard`} className="dr-return-btn">
              Return to dashboard
            </Link>
          </div>

          {/* Audit footer */}
          <div className="dr-audit">
            <div>
              <p className="dr-audit__label">Audit recorded</p>
              <p className="dr-audit__meta">
                Staff, medicine, quantity and time released.
              </p>
            </div>
            <span className="dr-audit__status">• Complete</span>
          </div>
        </div>
      </div>

      {/* ---------- PAGE FOOTER ---------- */}
      <div className="dr-page-footer">
        <span>QR-MedSecure · Barangay 354 Tayuman, Manila</span>
        <span>Dispensing receipt</span>
      </div>
    </>
  );
}
